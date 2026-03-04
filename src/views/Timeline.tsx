import React, { useState, useEffect, useRef } from 'react'
import { useStore, useDerived } from '../store'
import type { Allocation, Person } from '../types'
import { Modal, FormRow, ModalActions } from '../components/Modal'

// ── Design tokens (unchanged) ─────────────────────────────────────────────────
const BG_BASE      = '#0D0D0F'
const BG_SURFACE   = '#141416'
const BG_ELEVATED  = '#1C1C1F'
const BORDER       = '#2A2A2E'
const ACCENT       = '#C8F041'
const TEXT_PRIMARY = '#F0F0F2'
const TEXT_SEC     = '#8A8A96'
const TEXT_MUTED   = '#55555F'
const GREEN        = '#4ADE80'
const AMBER        = '#FBBF24'
const RED          = '#F87171'

// ── Timeline constants ────────────────────────────────────────────────────────
const MONTHS       = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06']
const COLUMN_WIDTH = 170    // must match minWidth / width on every month cell
const DRAG_THRESH  = 5      // px — how far the mouse must move before it's a drag
const SNAP_STEP    = 5      // pct snap increment for resize

const fmtMonth     = (m: string) => new Date(m + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
const fmtMonthLong = (m: string) => new Date(m + '-15').toLocaleDateString('en-US', { month: 'long',  year: 'numeric' })
const fmtMoney     = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

function snapPct(raw: number): number {
  return Math.max(1, Math.min(100, Math.round(raw / SNAP_STEP) * SNAP_STEP))
}

// ── Drag types ────────────────────────────────────────────────────────────────
type DragType = 'resize-left' | 'resize-right' | 'move'

/** Captured at mousedown — never mutated, lives in a ref */
interface DragStart {
  type:              DragType
  alloc:             Allocation
  personId:          string
  startX:            number
  startPct:          number
  originalMonthIdx:  number
  moved:             boolean   // true once past DRAG_THRESH
}

/** Updated on every mousemove — drives re-renders for live preview */
interface DragVisual {
  allocId:   string
  personId:  string
  type:      DragType
  pct:       number    // preview pct (resize) | original pct (move)
  monthIdx:  number    // preview target month (move) | original month (resize)
  tooltipX:  number
  tooltipY:  number
}

interface ToastData { kind: 'success' | 'warn' | 'error'; msg: string }

// ── Component ─────────────────────────────────────────────────────────────────
export function Timeline() {
  const { people, projects, allocations, customers,
          addAllocation, updateAllocation, deleteAllocation } = useStore()
  const { roleById, projectById, customerById,
          utilizationForPersonMonth, workingDaysInMonth } = useDerived()

  // ── Modal state (unchanged) ──────────────────────────────────────────────
  const [isModalOpen,      setIsModalOpen]      = useState(false)
  const [editingAlloc,     setEditingAlloc]      = useState<Allocation | null>(null)
  const [currentPerson,    setCurrentPerson]     = useState<Person | null>(null)
  const [currentMonth,     setCurrentMonth]      = useState('')
  const [projectId,        setProjectId]         = useState('')
  const [pct,              setPct]               = useState(0)
  const [hoursPerDay,      setHoursPerDay]       = useState(0)
  const [confirmed,        setConfirmed]         = useState(true)
  const [filterCustomer,   setFilterCustomer]    = useState<string | 'all'>('all')

  // ── Drag state ───────────────────────────────────────────────────────────
  const dragStartRef   = useRef<DragStart | null>(null)
  const [dragVisual,   setDragVisual]  = useState<DragVisual | null>(null)
  const dragVisualRef  = useRef<DragVisual | null>(null)
  dragVisualRef.current = dragVisual   // always-current ref (no stale closure)

  // Keep always-current refs to store values used inside once-attached listeners
  const allocationsRef       = useRef(allocations)
  allocationsRef.current     = allocations
  const updateAllocationRef  = useRef(updateAllocation)
  updateAllocationRef.current = updateAllocation

  // ── Flash / toast state ──────────────────────────────────────────────────
  const [flashId, setFlashId] = useState<string | null>(null)
  const [toast,   setToast]   = useState<ToastData | null>(null)

  const showToast = (kind: ToastData['kind'], msg: string) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 2800)
  }
  const flashBar = (id: string) => {
    setFlashId(id)
    setTimeout(() => setFlashId(null), 700)
  }

  // ── Hover state (for resize-handle visibility) ───────────────────────────
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // ── Suppress click after drag ────────────────────────────────────────────
  const suppressClick = useRef(false)

  // ── Scrollable-right-pane ref (for month-index calculation during move) ──
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Document-level listeners — attached once ─────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragStartRef.current
      if (!d) return

      // Activate drag only after threshold
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) < DRAG_THRESH) return
        d.moved = true
      }

      const deltaX = e.clientX - d.startX

      if (d.type === 'resize-right') {
        const pct = snapPct(d.startPct + (deltaX / COLUMN_WIDTH) * 100)
        setDragVisual({ allocId: d.alloc.id, personId: d.personId, type: 'resize-right', pct, monthIdx: d.originalMonthIdx, tooltipX: e.clientX, tooltipY: e.clientY })
      } else if (d.type === 'resize-left') {
        const pct = snapPct(d.startPct - (deltaX / COLUMN_WIDTH) * 100)
        setDragVisual({ allocId: d.alloc.id, personId: d.personId, type: 'resize-left', pct, monthIdx: d.originalMonthIdx, tooltipX: e.clientX, tooltipY: e.clientY })
      } else {
        // move — derive target month from absolute mouse X inside the scroll pane
        const pane = scrollRef.current
        if (!pane) return
        const rect     = pane.getBoundingClientRect()
        const xInPane  = e.clientX - rect.left + pane.scrollLeft
        const monthIdx = Math.max(0, Math.min(MONTHS.length - 1, Math.floor(xInPane / COLUMN_WIDTH)))
        setDragVisual({ allocId: d.alloc.id, personId: d.personId, type: 'move', pct: d.startPct, monthIdx, tooltipX: e.clientX, tooltipY: e.clientY })
      }
    }

    const onUp = () => {
      const d      = dragStartRef.current
      const visual = dragVisualRef.current
      dragStartRef.current = null

      if (!d || !d.moved || !visual) {
        // Was just a click — clear any partial visual but don't suppress click
        setDragVisual(null)
        return
      }

      // It was a real drag — suppress the subsequent click event
      suppressClick.current = true
      setDragVisual(null)

      const allocs = allocationsRef.current
      const update = updateAllocationRef.current

      if (visual.type === 'move') {
        const newMonth = MONTHS[visual.monthIdx]
        if (newMonth === d.alloc.month) return   // no-op

        // Conflict: same person already has an allocation from this project in target month
        const sameProject = allocs.find(a =>
          a.id !== d.alloc.id &&
          a.person_id === d.personId &&
          a.month === newMonth &&
          a.project_id === d.alloc.project_id,
        )
        if (sameProject) {
          showToast('warn', `Already allocated to this project in ${fmtMonthLong(newMonth)}`)
          return
        }

        // Conflict: total would exceed 100 %
        const otherTotal = allocs
          .filter(a => a.id !== d.alloc.id && a.person_id === d.personId && a.month === newMonth)
          .reduce((s, a) => s + a.pct, 0)
        if (otherTotal + d.alloc.pct > 100) {
          showToast('warn', `This person is already allocated in ${fmtMonthLong(newMonth)}`)
          return
        }

        update({ ...d.alloc, month: newMonth })
        flashBar(d.alloc.id)
        showToast('success', `Moved to ${fmtMonth(newMonth)}`)
      } else {
        // resize
        const newPct = visual.pct
        if (newPct === d.alloc.pct) return   // no change

        // Conflict: total would exceed 100 %
        const otherTotal = allocs
          .filter(a => a.id !== d.alloc.id && a.person_id === d.personId && a.month === d.alloc.month)
          .reduce((s, a) => s + a.pct, 0)
        if (otherTotal + newPct > 100) {
          showToast('warn', `Total would exceed 100 % in ${fmtMonthLong(d.alloc.month)}`)
          return
        }

        update({ ...d.alloc, pct: newPct })
        flashBar(d.alloc.id)
        showToast('success', `Updated to ${newPct}%`)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
  }, [])  // attach once — latest data always accessed via refs

  // ── Drag initiators ──────────────────────────────────────────────────────
  const startMove = (e: React.MouseEvent, alloc: Allocation, personId: string, monthIdx: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragStartRef.current = {
      type: 'move', alloc, personId,
      startX: e.clientX, startPct: alloc.pct,
      originalMonthIdx: monthIdx, moved: false,
    }
  }

  const startResize = (e: React.MouseEvent, type: 'resize-left' | 'resize-right', alloc: Allocation, personId: string, monthIdx: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()   // don't bubble to bar (would trigger openEditModal on click)
    dragStartRef.current = {
      type, alloc, personId,
      startX: e.clientX, startPct: alloc.pct,
      originalMonthIdx: monthIdx, moved: false,
    }
  }

  // ── Modal helpers (unchanged) ────────────────────────────────────────────
  const openAddModal = (person: Person, month: string) => {
    setEditingAlloc(null)
    setCurrentPerson(person)
    setCurrentMonth(month)
    setProjectId(projects[0]?.id || '')
    setPct(0); setConfirmed(true)
    setIsModalOpen(true)
  }

  const openEditModal = (alloc: Allocation) => {
    setEditingAlloc(alloc)
    setCurrentPerson(people.find(p => p.id === alloc.person_id) || null)
    setCurrentMonth(alloc.month)
    setProjectId(alloc.project_id)
    setPct(alloc.pct)
    setConfirmed(alloc.confirmed)
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (!currentPerson) return
    const base = { person_id: currentPerson.id, month: currentMonth, project_id: projectId, pct, confirmed }
    editingAlloc ? updateAllocation({ ...editingAlloc, ...base }) : addAllocation(base)
    setIsModalOpen(false)
  }

  const handleDeleteAllocation = (id: string) => {
    if (window.confirm('Delete this allocation?')) { deleteAllocation(id); setIsModalOpen(false) }
  }

  React.useEffect(() => { setHoursPerDay((pct / 100) * 8) }, [pct])
  React.useEffect(() => { setPct((hoursPerDay / 8) * 100)  }, [hoursPerDay])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getCustomerColor = (projId: string) => {
    const proj = projectById(projId)
    if (!proj) return BORDER
    return customerById(proj.customer_id)?.color || BORDER
  }

  const filteredPeople = people.filter(person => {
    if (filterCustomer === 'all') return true
    return allocations.some(a => {
      if (a.person_id !== person.id) return false
      return projectById(a.project_id)?.customer_id === filterCustomer
    })
  })

  // Whether any drag is active (disables pointer-events on non-dragged bars)
  const dragging = dragVisual !== null

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>

      {/* ── Page header + filter (unchanged) ───────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h2 style={{ color: TEXT_PRIMARY }}>Timeline</h2>
        <div>
          <label style={{ color: TEXT_SEC, marginRight: '8px' }}>Filter by Customer:</label>
          <select
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            style={{ padding: '6px 12px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}
          >
            <option value="all">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', background: BG_BASE, borderRadius: '8px' }}>
        <div style={{ display: 'flex', minWidth: 'fit-content' }}>

          {/* Sticky left column */}
          <div style={{ width: '180px', flexShrink: 0, position: 'sticky', left: 0, zIndex: 10, background: BG_SURFACE, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ height: '40px', padding: '0 12px', display: 'flex', alignItems: 'center', color: TEXT_SEC, borderBottom: `1px solid ${BORDER}` }}>Name / Role</div>
            {filteredPeople.map(person => (
              <React.Fragment key={person.id}>
                <div style={{ height: '32px', padding: '0 12px', display: 'flex', alignItems: 'center', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>{person.name}</div>
                <div style={{ padding: '2px 12px 4px', display: 'flex', flexDirection: 'column', gap: 1, borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: TEXT_SEC, fontSize: 11 }}>{roleById(person.role_id)?.name}</span>
                  <span style={{ color: '#55555F', fontSize: 10 }}>{person.department}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Scrollable right pane */}
          <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto' }}>

            {/* Month headers */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
              {MONTHS.map(month => (
                <div key={month} style={{ minWidth: `${COLUMN_WIDTH}px`, width: `${COLUMN_WIDTH}px`, height: '40px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG_SURFACE, color: TEXT_SEC, borderLeft: `1px solid ${BORDER}` }}>
                  {fmtMonth(month)}
                </div>
              ))}
            </div>

            {/* Person rows */}
            {filteredPeople.map(person => (
              <React.Fragment key={person.id}>

                {/* Allocation row */}
                <div style={{ display: 'flex', height: '32px', borderBottom: `1px solid ${BORDER}` }}>
                  {MONTHS.map((month, mIdx) => {
                    const { allocs } = utilizationForPersonMonth(person.id, month)

                    // Is this the target cell for an in-flight move?
                    const isMoveTarget = dragVisual?.type === 'move' &&
                      dragVisual.personId === person.id &&
                      dragVisual.monthIdx === mIdx

                    // The alloc being moved (for preview rendering in target cell)
                    const movedAlloc = isMoveTarget
                      ? allocations.find(a => a.id === dragVisual!.allocId)
                      : null

                    return (
                      <div
                        key={month}
                        style={{ minWidth: `${COLUMN_WIDTH}px`, width: `${COLUMN_WIDTH}px`, position: 'relative', background: BG_ELEVATED, borderLeft: `1px solid ${BORDER}`, cursor: dragging ? 'grabbing' : 'pointer' }}
                        onClick={() => { if (!dragging) openAddModal(person, month) }}
                      >
                        {/* Existing alloc bars */}
                        {allocs.map(alloc => {
                          const project        = projectById(alloc.project_id)
                          const color          = getCustomerColor(alloc.project_id)
                          const isTentative    = project?.status === 'tentative'
                          const isDragged      = dragVisual?.allocId === alloc.id
                          const isResizing     = isDragged && dragVisual?.type !== 'move'
                          const isMoving       = isDragged && dragVisual?.type === 'move'
                          const displayPct     = isResizing ? dragVisual!.pct : alloc.pct
                          const isFlashing     = flashId === alloc.id
                          const isHovered      = hoveredId === alloc.id
                          const showHandles    = (isHovered || isDragged) && !isMoving

                          return (
                            <div
                              key={alloc.id}
                              onMouseEnter={() => setHoveredId(alloc.id)}
                              onMouseLeave={() => setHoveredId(null)}
                              onMouseDown={e => startMove(e, alloc, person.id, mIdx)}
                              onClick={e => {
                                e.stopPropagation()
                                if (suppressClick.current) { suppressClick.current = false; return }
                                openEditModal(alloc)
                              }}
                              style={{
                                position: 'absolute',
                                top: 2, bottom: 2,
                                left: 0,
                                width: `${displayPct}%`,
                                minWidth: displayPct > 0 ? 4 : 0,
                                borderRadius: '4px',
                                background: color,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 10px',
                                fontSize: '11px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                color: 'rgba(0,0,0,0.8)',
                                border: isTentative ? '2px dashed rgba(255,255,255,0.3)' : 'none',
                                opacity: isMoving ? 0.25 : isTentative ? 0.6 : 1,
                                cursor: isMoving ? 'grabbing' : showHandles ? 'grab' : 'pointer',
                                // Glow while resizing/dragging
                                boxShadow: isResizing
                                  ? '0 0 0 2px rgba(255,255,255,0.55), 0 4px 14px rgba(0,0,0,0.55)'
                                  : isFlashing
                                    ? `0 0 0 2px ${ACCENT}, 0 0 12px ${ACCENT}55`
                                    : 'none',
                                transition: isFlashing ? 'box-shadow 0.1s' : 'width 0.05s, opacity 0.1s',
                                zIndex: isDragged ? 10 : 1,
                                userSelect: 'none',
                              }}
                            >
                              {/* Left resize handle */}
                              <div
                                onMouseDown={e => startResize(e, 'resize-left', alloc, person.id, mIdx)}
                                style={{
                                  position: 'absolute', left: 0, top: 0, bottom: 0,
                                  width: showHandles ? 7 : 0,
                                  background: showHandles ? 'rgba(255,255,255,0.30)' : 'transparent',
                                  cursor: 'col-resize',
                                  borderRadius: '4px 0 0 4px',
                                  transition: 'width 0.1s, background 0.1s',
                                  zIndex: 2,
                                }}
                              />

                              {/* Label */}
                              <span style={{ paddingLeft: showHandles ? 8 : 0, pointerEvents: 'none', flexShrink: 0 }}>
                                {project?.name.substring(0, 3)}{(project?.name?.length ?? 0) > 3 ? '.' : ''} {displayPct}%
                              </span>

                              {/* Right resize handle */}
                              <div
                                onMouseDown={e => startResize(e, 'resize-right', alloc, person.id, mIdx)}
                                style={{
                                  position: 'absolute', right: 0, top: 0, bottom: 0,
                                  width: showHandles ? 7 : 0,
                                  background: showHandles ? 'rgba(255,255,255,0.30)' : 'transparent',
                                  cursor: 'col-resize',
                                  borderRadius: '0 4px 4px 0',
                                  transition: 'width 0.1s, background 0.1s',
                                  zIndex: 2,
                                }}
                              />
                            </div>
                          )
                        })}

                        {/* Move-preview ghost in target month */}
                        {movedAlloc && movedAlloc.month !== month && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 2, bottom: 2, left: 0,
                              width: `${movedAlloc.pct}%`,
                              borderRadius: '4px',
                              background: getCustomerColor(movedAlloc.project_id),
                              opacity: 0.45,
                              border: '2px dashed rgba(255,255,255,0.5)',
                              pointerEvents: 'none',
                              zIndex: 5,
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Capacity bar row (unchanged) */}
                <div style={{ display: 'flex', height: '20px', borderBottom: `1px solid ${BORDER}` }}>
                  {MONTHS.map(month => {
                    const { totalPct } = utilizationForPersonMonth(person.id, month)
                    const capColor = totalPct >= 100 ? RED : totalPct >= 80 ? AMBER : GREEN
                    return (
                      <div key={month} style={{ minWidth: `${COLUMN_WIDTH}px`, width: `${COLUMN_WIDTH}px`, background: BG_ELEVATED, borderLeft: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 8px', position: 'relative' }}>
                        <div style={{ width: `${Math.min(totalPct, 100)}%`, height: '80%', background: capColor, borderRadius: '2px', position: 'absolute', left: 0, top: '10%' }} />
                        <span style={{ fontSize: '11px', color: TEXT_PRIMARY, zIndex: 1, position: 'relative' }}>{totalPct}%</span>
                      </div>
                    )
                  })}
                </div>

              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Drag tooltip ─────────────────────────────────────────────────── */}
      {dragVisual && (
        <div
          style={{
            position: 'fixed',
            left: dragVisual.tooltipX + 12,
            top:  dragVisual.tooltipY - 36,
            zIndex: 9999,
            background: '#111111',
            border: `1px solid ${dragVisual.type === 'move' ? '#22d3ee' : ACCENT}`,
            borderRadius: 8,
            padding: '5px 11px',
            fontSize: 12,
            fontFamily: 'DM Mono, monospace',
            color: '#e5e5e5',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}
        >
          {dragVisual.type === 'move'
            ? `→ ${fmtMonthLong(MONTHS[dragVisual.monthIdx])}`
            : `${dragVisual.pct}%  ·  ${fmtMonth(MONTHS[dragVisual.monthIdx])}`}
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: toast.kind === 'success' ? '#0f2300' : toast.kind === 'warn' ? '#2a1800' : '#2a0000',
            border: `1px solid ${toast.kind === 'success' ? ACCENT : toast.kind === 'warn' ? AMBER : RED}`,
            borderRadius: 10,
            padding: '10px 20px',
            fontSize: 13,
            fontFamily: 'Syne, sans-serif',
            color: toast.kind === 'success' ? ACCENT : toast.kind === 'warn' ? AMBER : RED,
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          <span>{toast.kind === 'success' ? '✓' : toast.kind === 'warn' ? '⚠' : '✗'}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Modal (unchanged) ─────────────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAlloc ? 'Edit Allocation' : 'Add Allocation'}>
        <FormRow label="Person">
          <input type="text" value={currentPerson?.name || ''} readOnly style={{ width: '100%', padding: '8px', background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Month">
          <input type="text" value={currentMonth ? fmtMonth(currentMonth) : ''} readOnly style={{ width: '100%', padding: '8px', background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Project">
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormRow>
        <FormRow label="Percentage (0–100)">
          <input type="number" value={pct} onChange={e => setPct(Number(e.target.value))} min={0} max={100} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Hours / day (approx)">
          <input type="number" value={hoursPerDay.toFixed(1)} onChange={e => setHoursPerDay(Number(e.target.value))} step={0.1} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Confirmed">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
        </FormRow>
        <ModalActions>
          {editingAlloc && <button className="btn-danger" onClick={() => handleDeleteAllocation(editingAlloc.id)}>Delete</button>}
          <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </ModalActions>
      </Modal>
    </div>
  )
}
