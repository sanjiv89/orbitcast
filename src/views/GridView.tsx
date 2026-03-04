import React, { useState, useMemo } from 'react'
import { useStore, useDerived } from '../store'
import type { Allocation, Person } from '../types'
import { Modal, FormRow, ModalActions } from '../components/Modal'
import {
  CAPACITY_HOURS_PER_MONTH,
  hoursForAllocationInMonth,
  monthsInRange,
  fmtMonth,
  monthStart as calcMonthStart,
  monthEnd as calcMonthEnd,
  toDateStr,
  countWorkingDays,
  parseDate,
  currentMonthOffset,
  monthsForOffset,
} from '../lib/allocUtils'

const MONTHS_PER_PAGE = 6
const BG_BASE      = '#0D0D0F'
const BG_SURFACE   = '#141416'
const BG_ELEVATED  = '#1C1C1F'
const BORDER       = '#2A2A2E'
const TEXT_PRIMARY = '#F0F0F2'
const TEXT_SEC     = '#8A8A96'
const TEXT_MUTED   = '#55555F'
const RED          = '#F87171'
const AMBER        = '#FBBF24'

// MONTHS is now dynamic — see offset state inside GridView component
const fmtMoney = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n)

// ── Live monthly preview ──────────────────────────────────────────────────────
function AllocationPreview({
  startDate, endDate, pct, capacityH = CAPACITY_HOURS_PER_MONTH,
}: { startDate: string; endDate: string; pct: number; capacityH?: number }) {
  if (!startDate || !endDate || startDate > endDate || pct <= 0) return null

  const months = monthsInRange(startDate, endDate)
  const rows = months.map(m => {
    const hrs = hoursForAllocationInMonth({ start_date: startDate, end_date: endDate, allocation_percentage: pct }, m, capacityH)
    return { m, hrs }
  })

  return (
    <div style={{ marginTop: 12, padding: '10px 12px', background: BG_BASE, borderRadius: 6, border: `1px solid ${BORDER}` }}>
      <div style={{ color: TEXT_SEC, fontSize: 11, marginBottom: 6, fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Hours per month
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {rows.map(({ m, hrs }) => (
          <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60, padding: '4px 8px', background: BG_ELEVATED, borderRadius: 4 }}>
            <div style={{ color: TEXT_MUTED, fontSize: 10 }}>{fmtMonth(m)}</div>
            <div style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{hrs}h</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Overallocation warning ────────────────────────────────────────────────────
function OverallocationWarning({
  personId, startDate, endDate, pct, excludeId, allocations,
}: {
  personId: string
  startDate: string
  endDate: string
  pct: number
  excludeId: string | null
  allocations: Allocation[]
}) {
  const warnings = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return []
    const months = monthsInRange(startDate, endDate)
    return months.flatMap(m => {
      const others = allocations.filter(a => a.person_id === personId && a.id !== excludeId)
      const existingPct = others.reduce((sum, a) => {
        // Compute effective pct for this alloc in month m
        const [y, mo] = m.split('-').map(Number)
        const ms = new Date(y, mo - 1, 1)
        const me = new Date(y, mo, 0)
        const as_ = parseDate(a.start_date)
        const ae  = parseDate(a.end_date)
        const os  = new Date(Math.max(as_.getTime(), ms.getTime()))
        const oe  = new Date(Math.min(ae.getTime(),  me.getTime()))
        if (os > oe) return sum
        const od = countWorkingDays(os, oe)
        const td = countWorkingDays(ms, me)
        return sum + (td > 0 ? (od / td) * a.allocation_percentage : 0)
      }, 0)
      const total = existingPct + pct
      if (total > 100) return [{ month: m, total: Math.round(total) }]
      return []
    })
  }, [personId, startDate, endDate, pct, excludeId, allocations])

  if (warnings.length === 0) return null
  return (
    <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(251,191,36,0.1)', border: `1px solid ${AMBER}`, borderRadius: 6, color: AMBER, fontSize: 12 }}>
      ⚠️ Over 100% in: {warnings.map(w => `${fmtMonth(w.month)} (${w.total}%)`).join(', ')}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function GridView() {
  const { people, projects, allocations, customers, addAllocation, updateAllocation, deleteAllocation } = useStore()
  const { roleById, projectById, customerById, utilizationForPersonMonth } = useDerived()

  // Month range — defaults to window containing today
  const [offset, setOffset]                 = useState(() => currentMonthOffset(MONTHS_PER_PAGE))
  const MONTHS                              = monthsForOffset(offset, MONTHS_PER_PAGE)

  const [isModalOpen, setIsModalOpen]       = useState(false)
  const [editingAllocation, setEditingAlloc] = useState<Allocation | null>(null)
  const [currentPerson, setCurrentPerson]   = useState<Person | null>(null)
  const [startDate, setStartDate]           = useState('')
  const [endDate, setEndDate]               = useState('')
  const [pct, setPct]                       = useState(100)
  const [projectId, setProjectId]           = useState('')
  const [confirmed, setConfirmed]           = useState(true)
  const [filterCustomer, setFilterCustomer] = useState<string | 'all'>('all')

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
    if (!currentPerson || !startDate || !endDate || startDate > endDate || pct <= 0 || !projectId) return
    const base = {
      person_id: currentPerson.id,
      project_id: projectId,
      start_date: startDate,
      end_date: endDate,
      allocation_percentage: pct,
      confirmed,
    }
    if (editingAllocation) {
      updateAllocation({ ...editingAllocation, ...base })
    } else {
      addAllocation(base)
    }
    setIsModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this allocation?')) {
      deleteAllocation(id)
      setIsModalOpen(false)
    }
  }

  const getProjectInitials = (id: string) => {
    const p = projectById(id)
    return p ? p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : ''
  }
  const getCustomerColor = (projId: string) => {
    const p = projectById(projId)
    return p ? customerById(p.customer_id)?.color ?? BORDER : BORDER
  }

  const filteredPeople = people.filter(person => {
    if (filterCustomer === 'all') return true
    return allocations.some(a => {
      if (a.person_id !== person.id) return false
      return projectById(a.project_id)?.customer_id === filterCustomer
    })
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px', background: BG_ELEVATED,
    border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT_PRIMARY,
    colorScheme: 'dark',
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: TEXT_PRIMARY }}>Grid View</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setOffset(o => Math.max(0, o - 1))}
              style={{ background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT_PRIMARY, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>‹</button>
            <span style={{ color: TEXT_SEC, fontSize: 12, fontFamily: 'DM Mono, monospace', minWidth: 130, textAlign: 'center' }}>
              {fmtMonth(MONTHS[0])} – {fmtMonth(MONTHS[MONTHS.length - 1])}
            </span>
            <button onClick={() => setOffset(o => o + 1)}
              style={{ background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT_PRIMARY, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>›</button>
          </div>
        </div>
        <div>
          <label style={{ color: TEXT_SEC, marginRight: '8px' }}>Filter by Customer:</label>
          <select
            value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}
            style={{ padding: '6px 12px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT_PRIMARY }}
          >
            <option value="all">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: BG_BASE, borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 'fit-content' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ background: BG_SURFACE, padding: '12px', textAlign: 'left', color: TEXT_SEC, minWidth: 180, width: 180, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>
                Person / Month
              </th>
              {MONTHS.map(m => (
                <th key={m} style={{ background: BG_SURFACE, padding: '12px', textAlign: 'center', color: TEXT_SEC, minWidth: 130, borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>
                  {fmtMonth(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPeople.map(person => (
              <tr key={person.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ background: BG_SURFACE, padding: '12px', color: TEXT_PRIMARY, position: 'sticky', left: 0, borderRight: `1px solid ${BORDER}` }}>
                  <div style={{ fontWeight: 500 }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: TEXT_SEC }}>{roleById(person.role_id)?.name}</div>
                  <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 1 }}>{person.department}</div>
                </td>
                {MONTHS.map(month => {
                  const { totalPct, totalHours, allocs } = utilizationForPersonMonth(person.id, month)
                  return (
                    <td
                      key={month}
                      style={{ minWidth: 130, verticalAlign: 'top', padding: '6px', background: BG_ELEVATED, borderRight: `1px solid ${BORDER}`, cursor: 'pointer' }}
                      onClick={() => openAddModal(person, month)}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {allocs.map(alloc => {
                          const project = projectById(alloc.project_id)
                          const color   = getCustomerColor(alloc.project_id)
                          const hrs     = hoursForAllocationInMonth(alloc, month)
                          return (
                            <span
                              key={alloc.id}
                              onClick={e => { e.stopPropagation(); openEditModal(alloc) }}
                              style={{
                                height: 18, padding: '2px 6px', fontSize: 10, borderRadius: 9999,
                                background: color, color: 'rgba(0,0,0,0.8)', display: 'inline-flex', alignItems: 'center',
                                opacity: project?.status === 'tentative' ? 0.6 : 1,
                                border: project?.status === 'tentative' ? '1px dashed rgba(255,255,255,0.3)' : 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {getProjectInitials(alloc.project_id)} {alloc.allocation_percentage}% · {hrs}h
                            </span>
                          )
                        })}
                      </div>
                      {totalPct > 0 && (
                        <div style={{ fontSize: 10, color: totalPct > 100 ? RED : TEXT_MUTED, marginTop: 3 }}>
                          {totalPct}% · {totalHours.toFixed(1)}h
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Allocation modal ────────────────────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAllocation ? 'Edit Allocation' : 'New Allocation'}>
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
        <OverallocationWarning
          personId={currentPerson?.id || ''}
          startDate={startDate} endDate={endDate} pct={pct}
          excludeId={editingAllocation?.id ?? null}
          allocations={allocations}
        />

        <ModalActions>
          {editingAllocation && (
            <button className="btn-danger" onClick={() => handleDelete(editingAllocation.id)}>Delete</button>
          )}
          <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!startDate || !endDate || startDate > endDate || pct <= 0 || !projectId}
          >
            Save
          </button>
        </ModalActions>
      </Modal>
    </div>
  )
}
