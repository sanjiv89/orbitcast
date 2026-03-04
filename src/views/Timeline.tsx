import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useStore, useDerived } from '../store'
import type { Allocation, Person } from '../types'
import { Modal, FormRow, ModalActions } from '../components/Modal'
import {
  CAPACITY_HOURS_PER_MONTH,
  dateToPixel, pixelToDate,
  durationDays, addDays,
  toDateStr, parseDate,
  hoursForAllocationInMonth,
  pctForAllocationInMonth,
  monthsInRange, fmtMonth,
  countWorkingDays, monthStart as calcMonthStart, monthEnd as calcMonthEnd,
} from '../lib/allocUtils'

// ── Design tokens ─────────────────────────────────────────────────────────────
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
const COLUMN_WIDTH = 170
const DRAG_THRESH  = 5      // px before a move is considered a drag

const fmtMonthLong = (m: string) =>
  new Date(m + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
const fmtDateShort = (s: string) => {
  const d = parseDate(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Drag types ────────────────────────────────────────────────────────────────
type DragType = 'resize-left' | 'resize-right' | 'move'

interface DragStart {
  type:             DragType
  alloc:            Allocation
  personId:         string
  startX:           number          // initial clientX
  origStartDate:    string          // YYYY-MM-DD
  origEndDate:      string          // YYYY-MM-DD
  origStartPx:      number          // pixel offset of start_date
  origEndPx:        number          // pixel offset of end_date+1day
  durationDays:     number          // for move: preserve this span
  moved:            boolean
}

interface DragVisual {
  allocId:        string
  personId:       string
  type:           DragType
  previewStartPx: number
  previewEndPx:   number
  previewStart:   string            // YYYY-MM-DD for tooltip / save
  previewEnd:     string            // YYYY-MM-DD
  tooltipX:       number
  tooltipY:       number
}

interface ToastData { kind: 'success' | 'warn' | 'error'; msg: string }

// ── Pixel helpers (uses module-level MONTHS constant) ─────────────────────────
const dateToPx = (d: Date) => dateToPixel(d, MONTHS, COLUMN_WIDTH)

// End-of-bar pixel: end of end_date = start of (end_date + 1 day)
const endDateToPx = (dateStr: string) => {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + 1)
  return Math.min(dateToPx(d), MONTHS.length * COLUMN_WIDTH)
}

const pxToDate = (px: number) => pixelToDate(px, MONTHS, COLUMN_WIDTH)

// ── Overallocation warning (shared between modal and drag) ────────────────────
function overallocationMonths(
  personId: string,
  startDate: string,
  endDate: string,
  pct: number,
  excludeId: string | null,
  allAllocations: Allocation[],
): { month: string; total: number }[] {
  if (!startDate || !endDate || startDate > endDate) return []
  const months = monthsInRange(startDate, endDate)
  return months.flatMap(m => {
    const others = allAllocations.filter(a => a.person_id === personId && a.id !== excludeId)
    const existingPct = others.reduce((sum, a) => sum + pctForAllocationInMonth(a, m), 0)
    const total = existingPct + pct
    return total > 100 ? [{ month: m, total: Math.round(total) }] : []
  })
}

// ── Live monthly preview (modal) ──────────────────────────────────────────────
function AllocationPreview({ startDate, endDate, pct }: { startDate: string; endDate: string; pct: number }) {
  if (!startDate || !endDate || startDate > endDate || pct <= 0) return null
  const rows = monthsInRange(startDate, endDate).map(m => ({
    m, hrs: hoursForAllocationInMonth({ start_date: startDate, end_date: endDate, allocation_percentage: pct }, m),
  }))
  return (
    <div style={{ marginTop: 12, padding: '10px 12px', background: BG_BASE, borderRadius: 6, border: `1px solid ${BORDER}` }}>
      <div style={{ color: TEXT_SEC, fontSize: 11, marginBottom: 6, fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Hours per month
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {rows.map(({ m, hrs }) => (
          <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 58, padding: '4px 8px', background: BG_ELEVATED, borderRadius: 4 }}>
            <div style={{ color: TEXT_MUTED, fontSize: 10 }}>{fmtMonth(m)}</div>
            <div style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{hrs}h</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Timeline() {
  const { people, projects, allocations, customers,
          addAllocation, updateAllocation, deleteAllocation } = useStore()
  const { roleById, projectById, customerById, utilizationForPersonMonth } = useDerived()

  // ── Modal state ──────────────────────────────────────────────────────────
  const [isModalOpen,    setIsModalOpen]  = useState(false)
  const [editingAlloc,   setEditingAlloc] = useState<Allocation | null>(null)
  const [currentPerson,  setCurrentPerson] = useState<Person | null>(null)
  const [startDate,      setStartDate]    = useState('')
  const [endDate,        setEndDate]      = useState('')
  const [pct,            setPct]          = useState(100)
  const [projectId,      setProjectId]    = useState('')
  const [confirmed,      setConfirmed]    = useState(true)
  const [filterCustomer, setFilterCustomer] = useState<string | 'all'>('all')

  // ── Drag state ───────────────────────────────────────────────────────────
  const dragStartRef  = useRef<DragStart | null>(null)
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const dragVisualRef = useRef<DragVisual | null>(null)
  dragVisualRef.current = dragVisual

  const allocationsRef      = useRef(allocations)
  allocationsRef.current    = allocations
  const updateAllocRef      = useRef(updateAllocation)
  updateAllocRef.current    = updateAllocation
  const suppressClick       = useRef(false)
  const scrollRef           = useRef<HTMLDivElement>(null)

  // ── Flash / toast ────────────────────────────────────────────────────────
  const [flashId, setFlashId] = useState<string | null>(null)
  const [toast,   setToast]   = useState<ToastData | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const showToast = (kind: ToastData['kind'], msg: string) => {
    setToast({ kind, msg }); setTimeout(() => setToast(null), 2800)
  }
  const flashBar = (id: string) => {
    setFlashId(id); setTimeout(() => setFlashId(null), 700)
  }

  // ── Document-level drag listeners (attached once) ────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragStartRef.current
      if (!d) return
      if (!d.moved) {
        if (Math.abs(e.clientX - d.startX) < DRAG_THRESH) return
        d.moved = true
      }

      const pane    = scrollRef.current
      const rect    = pane?.getBoundingClientRect()
      const xInPane = pane ? e.clientX - (rect?.left ?? 0) + pane.scrollLeft : e.clientX

      if (d.type === 'resize-right') {
        // Right handle → update end_date
        const rawEndPx   = d.origEndPx + (xInPane - (d.origEndPx + (pane?.getBoundingClientRect().left ?? 0)))
        // Actually: the right edge in pane coords = origEndPx + deltaX
        const deltaX     = xInPane - (d.origStartPx + (d.origEndPx - d.origStartPx) + (e.clientX - d.startX - (xInPane - (d.origEndPx + (e.clientX - d.startX)))))

        // Simpler: track delta from mousedown
        const delta      = e.clientX - d.startX
        const newEndPxRaw = d.origEndPx + delta
        const newEndPx   = Math.max(d.origStartPx + COLUMN_WIDTH / 31, Math.min(newEndPxRaw, MONTHS.length * COLUMN_WIDTH))
        // Convert to date: end_date is one day before the pixel position
        const nextDay    = pxToDate(newEndPx)
        const newEnd     = toDateStr(new Date(nextDay.getTime() - 86_400_000))
        const finalEnd   = newEnd < d.origStartDate ? d.origStartDate : newEnd

        setDragVisual({ allocId: d.alloc.id, personId: d.personId, type: 'resize-right',
          previewStartPx: d.origStartPx, previewEndPx: Math.max(d.origStartPx + 4, newEndPx),
          previewStart: d.origStartDate, previewEnd: finalEnd,
          tooltipX: e.clientX, tooltipY: e.clientY })

      } else if (d.type === 'resize-left') {
        // Left handle → update start_date
        const delta        = e.clientX - d.startX
        const newStartPxRaw = d.origStartPx + delta
        const newStartPx   = Math.max(0, Math.min(newStartPxRaw, d.origEndPx - COLUMN_WIDTH / 31))
        const newStart     = toDateStr(pxToDate(newStartPx))
        const finalStart   = newStart > d.origEndDate ? d.origEndDate : newStart

        setDragVisual({ allocId: d.alloc.id, personId: d.personId, type: 'resize-left',
          previewStartPx: Math.min(newStartPx, d.origEndPx - 4), previewEndPx: d.origEndPx,
          previewStart: finalStart, previewEnd: d.origEndDate,
          tooltipX: e.clientX, tooltipY: e.clientY })

      } else {
        // Move — shift both dates by delta
        const delta        = e.clientX - d.startX
        const newStartPxRaw = d.origStartPx + delta
        const clampedStart = Math.max(0, Math.min(newStartPxRaw, MONTHS.length * COLUMN_WIDTH - (d.origEndPx - d.origStartPx)))
        const newStartDate = toDateStr(pxToDate(clampedStart))
        const newEndDate   = addDays(newStartDate, d.durationDays)

        setDragVisual({ allocId: d.alloc.id, personId: d.personId, type: 'move',
          previewStartPx: clampedStart,
          previewEndPx:   clampedStart + (d.origEndPx - d.origStartPx),
          previewStart: newStartDate, previewEnd: newEndDate,
          tooltipX: e.clientX, tooltipY: e.clientY })
      }
    }

    const onUp = () => {
      const d      = dragStartRef.current
      const visual = dragVisualRef.current
      dragStartRef.current = null

      if (!d || !d.moved || !visual) {
        setDragVisual(null); return
      }

      suppressClick.current = true
      setDragVisual(null)

      const newStart = visual.previewStart
      const newEnd   = visual.previewEnd

      if (newStart === d.origStartDate && newEnd === d.origEndDate) return  // no change

      // Warn (don't block) if over-allocation results
      const warnings = overallocationMonths(
        d.personId, newStart, newEnd, d.alloc.allocation_percentage,
        d.alloc.id, allocationsRef.current,
      )
      if (warnings.length > 0) {
        showToast('warn', `Over 100% in ${warnings.map(w => fmtMonth(w.month)).join(', ')}`)
      }

      updateAllocRef.current({ ...d.alloc, start_date: newStart, end_date: newEnd })
      flashBar(d.alloc.id)
      if (warnings.length === 0) {
        const label = d.type === 'move'
          ? `${fmtDateShort(newStart)} – ${fmtDateShort(newEnd)}`
          : d.type === 'resize-right' ? `Ends ${fmtDateShort(newEnd)}` : `Starts ${fmtDateShort(newStart)}`
        showToast('success', label)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ── Drag initiators ──────────────────────────────────────────────────────
  const startMove = (e: React.MouseEvent, alloc: Allocation, personId: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    const startPx = dateToPx(parseDate(alloc.start_date))
    const endPx   = endDateToPx(alloc.end_date)
    dragStartRef.current = {
      type: 'move', alloc, personId,
      startX: e.clientX,
      origStartDate: alloc.start_date, origEndDate: alloc.end_date,
      origStartPx: startPx, origEndPx: endPx,
      durationDays: durationDays(alloc.start_date, alloc.end_date),
      moved: false,
    }
  }

  const startResize = (
    e: React.MouseEvent, type: 'resize-left' | 'resize-right',
    alloc: Allocation, personId: string,
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startPx = dateToPx(parseDate(alloc.start_date))
    const endPx   = endDateToPx(alloc.end_date)
    dragStartRef.current = {
      type, alloc, personId,
      startX: e.clientX,
      origStartDate: alloc.start_date, origEndDate: alloc.end_date,
      origStartPx: startPx, origEndPx: endPx,
      durationDays: durationDays(alloc.start_date, alloc.end_date),
      moved: false,
    }
  }

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openAddModal = (person: Person, month: string) => {
    setEditingAlloc(null)
    setCurrentPerson(person)
    setStartDate(toDateStr(calcMonthStart(month)))
    setEndDate(toDateStr(calcMonthEnd(month)))
    setProjectId(projects[0]?.id || '')
    setPct(100)
    setConfirmed(true)
    setIsModalOpen(true)
  }

  const openEditModal = (alloc: Allocation) => {
    setEditingAlloc(alloc)
    setCurrentPerson(people.find(p => p.id === alloc.person_id) || null)
    setStartDate(alloc.start_date)
    setEndDate(alloc.end_date)
    setProjectId(alloc.project_id)
    setPct(alloc.allocation_percentage)
    setConfirmed(alloc.confirmed)
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (!currentPerson || !startDate || !endDate || startDate > endDate) return
    const base = {
      person_id: currentPerson.id,
      project_id: projectId,
      start_date: startDate,
      end_date: endDate,
      allocation_percentage: pct,
      confirmed,
    }
    editingAlloc
      ? updateAllocation({ ...editingAlloc, ...base })
      : addAllocation(base)
    setIsModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this allocation?')) { deleteAllocation(id); setIsModalOpen(false) }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getCustomerColor = (projId: string) => {
    const p = projectById(projId); if (!p) return BORDER
    return customerById(p.customer_id)?.color ?? BORDER
  }

  const filteredPeople = people.filter(person => {
    if (filterCustomer === 'all') return true
    return allocations.some(a => a.person_id === person.id &&
      projectById(a.project_id)?.customer_id === filterCustomer)
  })

  // Over-allocation warnings for the open modal
  const modalWarnings = useMemo(() => {
    if (!isModalOpen || !currentPerson || !startDate || !endDate || startDate > endDate) return []
    return overallocationMonths(currentPerson.id, startDate, endDate, pct, editingAlloc?.id ?? null, allocations)
  }, [isModalOpen, currentPerson, startDate, endDate, pct, editingAlloc, allocations])

  const dragging = dragVisual !== null
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px', background: BG_ELEVATED,
    border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT_PRIMARY,
    colorScheme: 'dark',
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h2 style={{ color: TEXT_PRIMARY }}>Timeline</h2>
        <div>
          <label style={{ color: TEXT_SEC, marginRight: '8px' }}>Filter:</label>
          <select
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            style={{ padding: '6px 12px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT_PRIMARY }}
          >
            <option value="all">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', background: BG_BASE, borderRadius: 8 }}>
        <div style={{ display: 'flex', minWidth: 'fit-content' }}>

          {/* Sticky left column */}
          <div style={{ width: 180, flexShrink: 0, position: 'sticky', left: 0, zIndex: 10, background: BG_SURFACE, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', color: TEXT_SEC, borderBottom: `1px solid ${BORDER}` }}>Name / Role</div>
            {filteredPeople.map(person => (
              <React.Fragment key={person.id}>
                <div style={{ height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>{person.name}</div>
                <div style={{ padding: '2px 12px 4px', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ color: TEXT_SEC, fontSize: 11 }}>{roleById(person.role_id)?.name}</div>
                  <div style={{ color: TEXT_MUTED, fontSize: 10 }}>{person.department}</div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Scrollable right pane */}
          <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', cursor: dragging ? 'grabbing' : 'default' }}>

            {/* Month headers */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
              {MONTHS.map(month => (
                <div key={month} style={{ minWidth: COLUMN_WIDTH, width: COLUMN_WIDTH, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG_SURFACE, color: TEXT_SEC, borderLeft: `1px solid ${BORDER}` }}>
                  {fmtMonth(month)}
                </div>
              ))}
            </div>

            {/* Person rows */}
            {filteredPeople.map(person => {
              const personAllocs = allocations.filter(a => a.person_id === person.id)

              return (
                <React.Fragment key={person.id}>

                  {/* ── Allocation row — bars are absolute overlays ── */}
                  <div
                    style={{
                      display: 'flex',
                      height: 36,
                      borderBottom: `1px solid ${BORDER}`,
                      position: 'relative',   // ← bars position against this
                    }}
                  >
                    {/* Background month cells — grid lines + click-to-add */}
                    {MONTHS.map((month, mIdx) => (
                      <div
                        key={month}
                        style={{
                          minWidth: COLUMN_WIDTH, width: COLUMN_WIDTH, height: '100%',
                          background: BG_ELEVATED,
                          borderLeft: `1px solid ${BORDER}`,
                          flexShrink: 0,
                          cursor: dragging ? 'grabbing' : 'crosshair',
                        }}
                        onClick={() => {
                          if (dragging || suppressClick.current) { suppressClick.current = false; return }
                          openAddModal(person, month)
                        }}
                      />
                    ))}

                    {/* Allocation bars (absolute-positioned overlay) */}
                    {personAllocs.map((alloc, aIdx) => {
                      const isDragged = dragVisual?.allocId === alloc.id
                      const visual    = isDragged ? dragVisual! : null

                      const leftPx  = visual ? visual.previewStartPx : dateToPx(parseDate(alloc.start_date))
                      const rightPx = visual ? visual.previewEndPx   : endDateToPx(alloc.end_date)
                      const widthPx = Math.max(8, rightPx - leftPx)

                      // Clamp to visible range
                      const visLeft  = Math.max(0, leftPx)
                      const visRight = Math.min(MONTHS.length * COLUMN_WIDTH, rightPx)
                      if (visLeft >= visRight) return null

                      const color      = getCustomerColor(alloc.project_id)
                      const project    = projectById(alloc.project_id)
                      const isTentative = project?.status === 'tentative'
                      const isFlashing  = flashId === alloc.id
                      const isHovered   = hoveredId === alloc.id
                      const showHandles = (isHovered || isDragged) && !dragging
                      const TOP_OFFSET  = 2 + aIdx * 0   // could stack if needed

                      return (
                        <div
                          key={alloc.id}
                          onMouseEnter={() => setHoveredId(alloc.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onMouseDown={e => startMove(e, alloc, person.id)}
                          onClick={e => {
                            e.stopPropagation()
                            if (suppressClick.current) { suppressClick.current = false; return }
                            openEditModal(alloc)
                          }}
                          style={{
                            position: 'absolute',
                            left:     visLeft,
                            width:    Math.max(8, visRight - visLeft),
                            top:      2,
                            bottom:   2,
                            zIndex:   isDragged ? 10 : 2,
                            borderRadius: 4,
                            background: color,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            fontSize: 11,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            color: 'rgba(0,0,0,0.85)',
                            border: isTentative ? '2px dashed rgba(255,255,255,0.3)' : 'none',
                            opacity: isDragged ? 0.85 : isTentative ? 0.65 : 1,
                            cursor: 'grab',
                            boxShadow: isFlashing
                              ? `0 0 0 2px ${ACCENT}, 0 0 12px ${ACCENT}55`
                              : isDragged
                                ? '0 0 0 2px rgba(255,255,255,0.5), 0 4px 14px rgba(0,0,0,0.6)'
                                : 'none',
                            transition: isFlashing ? 'box-shadow 0.1s' : 'left 0.04s, width 0.04s',
                            userSelect: 'none',
                          }}
                        >
                          {/* Left resize handle */}
                          <div
                            onMouseDown={e => startResize(e, 'resize-left', alloc, person.id)}
                            style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: showHandles ? 7 : 4,
                              background: showHandles ? 'rgba(0,0,0,0.25)' : 'transparent',
                              cursor: 'col-resize',
                              borderRadius: '4px 0 0 4px',
                              transition: 'width 0.1s',
                              zIndex: 3,
                            }}
                          />

                          {/* Label */}
                          <span style={{ paddingLeft: showHandles ? 4 : 0, pointerEvents: 'none', flexShrink: 0, fontSize: 10 }}>
                            {project?.name.substring(0, 4)}{(project?.name?.length ?? 0) > 4 ? '.' : ''}
                            {' '}{alloc.allocation_percentage}%
                          </span>

                          {/* Right resize handle */}
                          <div
                            onMouseDown={e => startResize(e, 'resize-right', alloc, person.id)}
                            style={{
                              position: 'absolute', right: 0, top: 0, bottom: 0,
                              width: showHandles ? 7 : 4,
                              background: showHandles ? 'rgba(0,0,0,0.25)' : 'transparent',
                              cursor: 'col-resize',
                              borderRadius: '0 4px 4px 0',
                              transition: 'width 0.1s',
                              zIndex: 3,
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Capacity bar row ────────────────────────────────── */}
                  <div style={{ display: 'flex', height: 20, borderBottom: `1px solid ${BORDER}` }}>
                    {MONTHS.map(month => {
                      const { totalPct } = utilizationForPersonMonth(person.id, month)
                      const capColor = totalPct >= 100 ? RED : totalPct >= 80 ? AMBER : GREEN
                      return (
                        <div key={month} style={{ minWidth: COLUMN_WIDTH, width: COLUMN_WIDTH, background: BG_ELEVATED, borderLeft: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: '10%', height: '80%', width: `${Math.min(totalPct, 100)}%`, background: capColor, borderRadius: 2, transition: 'width 0.2s' }} />
                          <span style={{ fontSize: 10, color: TEXT_SEC, zIndex: 1, paddingLeft: 6 }}>{totalPct > 0 ? `${totalPct}%` : ''}</span>
                        </div>
                      )
                    })}
                  </div>

                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Drag tooltip ─────────────────────────────────────────────────── */}
      {dragVisual && (
        <div style={{
          position: 'fixed',
          left: dragVisual.tooltipX + 14, top: dragVisual.tooltipY - 40,
          zIndex: 9999,
          background: '#111',
          border: `1px solid ${dragVisual.type === 'move' ? '#22d3ee' : ACCENT}`,
          borderRadius: 8, padding: '5px 11px',
          fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#e5e5e5',
          pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          {dragVisual.type === 'resize-right'
            ? `→ ${fmtDateShort(dragVisual.previewEnd)}`
            : dragVisual.type === 'resize-left'
              ? `← ${fmtDateShort(dragVisual.previewStart)}`
              : `${fmtDateShort(dragVisual.previewStart)} – ${fmtDateShort(dragVisual.previewEnd)}`}
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          background: toast.kind === 'success' ? '#0f2300' : toast.kind === 'warn' ? '#2a1800' : '#2a0000',
          border: `1px solid ${toast.kind === 'success' ? ACCENT : toast.kind === 'warn' ? AMBER : RED}`,
          borderRadius: 10, padding: '10px 20px',
          fontSize: 13, fontFamily: 'Syne, sans-serif',
          color: toast.kind === 'success' ? ACCENT : toast.kind === 'warn' ? AMBER : RED,
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none',
        }}>
          <span>{toast.kind === 'success' ? '✓' : toast.kind === 'warn' ? '⚠' : '✗'}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Allocation modal ────────────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAlloc ? 'Edit Allocation' : 'New Allocation'}>
        <FormRow label="Person">
          <input type="text" value={currentPerson?.name || ''} readOnly style={inputStyle} />
        </FormRow>
        <FormRow label="Project">
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormRow>
        <FormRow label="Start date">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
        </FormRow>
        <FormRow label="End date">
          <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        </FormRow>
        {startDate && endDate && startDate > endDate && (
          <div style={{ color: RED, fontSize: 12, marginBottom: 8 }}>End date must be after start date</div>
        )}
        <FormRow label="Allocation %">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={5} max={100} step={5} value={pct} onChange={e => setPct(Number(e.target.value))} style={{ flex: 1 }} />
            <input type="number" min={1} max={100} value={pct} onChange={e => setPct(Math.max(1, Math.min(100, Number(e.target.value))))} style={{ ...inputStyle, width: 64 }} />
            <span style={{ color: TEXT_SEC }}>%</span>
          </div>
        </FormRow>
        <FormRow label="Confirmed">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ transform: 'scale(1.3)' }} />
        </FormRow>

        <AllocationPreview startDate={startDate} endDate={endDate} pct={pct} />

        {modalWarnings.length > 0 && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(251,191,36,0.1)', border: `1px solid ${AMBER}`, borderRadius: 6, color: AMBER, fontSize: 12 }}>
            ⚠️ Over 100% in: {modalWarnings.map(w => `${fmtMonth(w.month)} (${w.total}%)`).join(', ')}
          </div>
        )}

        <ModalActions>
          {editingAlloc && (
            <button className="btn-danger" onClick={() => handleDelete(editingAlloc.id)}>Delete</button>
          )}
          <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!startDate || !endDate || startDate > endDate}
          >
            Save
          </button>
        </ModalActions>
      </Modal>
    </div>
  )
}
