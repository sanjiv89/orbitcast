import React, { useState } from 'react'
import { useStore, useDerived } from '../store'
import type { Allocation, Project, Person } from '../types'
import { Modal, FormRow, ModalActions } from '../components/Modal'

const BG_BASE='#0D0D0F'
const BG_SURFACE='#141416'
const BG_ELEVATED='#1C1C1F'
const BORDER='#2A2A2E'
const ACCENT='#C8F041'
const TEXT_PRIMARY='#F0F0F2'
const TEXT_SEC='#8A8A96'
const TEXT_MUTED='#55555F'
const GREEN='#4ADE80'
const AMBER='#FBBF24'
const RED='#F87171'

const MONTHS = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06']
const fmtMonth = (m: string) => new Date(m + '-15').toLocaleDateString('en-US',{month:'short',year:'2-digit'})
const fmtMoney = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n)

export function Timeline() {
  const { people, projects, allocations, customers, addAllocation, updateAllocation, deleteAllocation } = useStore()
  const { roleById, projectById, customerById, utilizationForPersonMonth, workingDaysInMonth } = useDerived()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null)
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null)
  const [currentMonth, setCurrentMonth] = useState('')
  const [projectId, setProjectId] = useState('')
  const [pct, setPct] = useState(0)
  const [hoursPerDay, setHoursPerDay] = useState(0)
  const [confirmed, setConfirmed] = useState(true)
  const [filterCustomer, setFilterCustomer] = useState<string | 'all'>('all')

  const calculateHours = (percentage: number) => {
    // Assuming 8 hours per day, 5 days a week = 40 hours per week
    // 160 hours per month approx (4 weeks)
    return (percentage / 100) * 8
  }

  const calculatePct = (hours: number) => {
    return (hours / 8) * 100
  }

  React.useEffect(() => {
    setHoursPerDay(calculateHours(pct))
  }, [pct])

  React.useEffect(() => {
    setPct(calculatePct(hoursPerDay))
  }, [hoursPerDay])

  const openAddModal = (person: Person, month: string) => {
    setEditingAllocation(null)
    setCurrentPerson(person)
    setCurrentMonth(month)
    setProjectId(projects[0]?.id || '')
    setPct(0)
    setConfirmed(true)
    setIsModalOpen(true)
  }

  const openEditModal = (allocation: Allocation) => {
    setEditingAllocation(allocation)
    setCurrentPerson(people.find(p => p.id === allocation.person_id) || null)
    setCurrentMonth(allocation.month)
    setProjectId(allocation.project_id)
    setPct(allocation.pct)
    setConfirmed(allocation.confirmed)
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (!currentPerson) return
    const baseAllocation = { person_id: currentPerson.id, month: currentMonth, project_id: projectId, pct, confirmed }
    if (editingAllocation) {
      updateAllocation({ ...editingAllocation, ...baseAllocation })
    } else {
      addAllocation(baseAllocation)
    }
    setIsModalOpen(false)
  }

  const handleDeleteAllocation = (id: string) => {
    if (window.confirm('Are you sure you want to delete this allocation?')) {
      deleteAllocation(id)
      setIsModalOpen(false)
    }
  }

  const getProjectName = (id: string) => projectById(id)?.name || ''
  const getCustomerColor = (projectId: string) => {
    const project = projectById(projectId)
    if (!project) return BORDER
    return customerById(project.customer_id)?.color || BORDER
  }

  const filteredPeople = people.filter(person => {
    if (filterCustomer === 'all') return true
    // Check if the person has any allocations to projects of the filtered customer
    return allocations.some(alloc => {
      if (alloc.person_id !== person.id) return false
      const project = projectById(alloc.project_id)
      return project?.customer_id === filterCustomer
    })
  })

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h2 style={{ color: TEXT_PRIMARY }}>Timeline</h2>
        <div>
          <label style={{ color: TEXT_SEC, marginRight: '8px' }}>Filter by Customer:</label>
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            style={{ padding: '6px 12px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}
          >
            <option value="all">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: BG_BASE, borderRadius: '8px' }}>
        <div style={{ display: 'flex', minWidth: 'fit-content' }}>
          {/* Sticky Left Column */}
          <div style={{ width: '180px', flexShrink: 0, position: 'sticky', left: 0, zIndex: 10, background: BG_SURFACE, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ height: '40px', padding: '0 12px', display: 'flex', alignItems: 'center', color: TEXT_SEC, borderBottom: `1px solid ${BORDER}` }}>Name / Role</div>
            {filteredPeople.map(person => (
              <React.Fragment key={person.id}>
                <div style={{ height: '26px', padding: '0 12px', display: 'flex', alignItems: 'center', color: TEXT_PRIMARY, borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>{person.name}</div>
                <div style={{ padding: '2px 12px 2px', display: 'flex', flexDirection: 'column', gap: 1, borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: TEXT_SEC, fontSize: 11 }}>{roleById(person.role_id)?.name}</span>
                  <span style={{ color: '#55555F', fontSize: 10, letterSpacing: '0.02em' }}>{person.department}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Scrollable Right Content */}
          <div style={{ flex: 1, overflowX: 'auto' }}>
            {/* Month Headers */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
              {MONTHS.map(month => (
                <div key={month} style={{ minWidth: '170px', width: '170px', height: '40px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG_SURFACE, color: TEXT_SEC, borderLeft: `1px solid ${BORDER}` }}>
                  {fmtMonth(month)}
                </div>
              ))}
            </div>

            {/* Allocations and Capacity Rows */}
            {filteredPeople.map(person => (
              <React.Fragment key={person.id}>
                {/* Allocations Row */}
                <div style={{ display: 'flex', height: '26px', borderBottom: `1px solid ${BORDER}` }}>
                  {MONTHS.map(month => {
                    const { allocs } = utilizationForPersonMonth(person.id, month)
                    return (
                      <div key={month} style={{ minWidth: '170px', width: '170px', position: 'relative', background: BG_ELEVATED, borderLeft: `1px solid ${BORDER}`, cursor: 'pointer' }} onClick={() => openAddModal(person, month)}>
                        {allocs.map(alloc => {
                          const project = projectById(alloc.project_id)
                          const customerColor = getCustomerColor(alloc.project_id)
                          const isTentative = project?.status === 'tentative'
                          return (
                            <div
                              key={alloc.id}
                              onClick={(e) => { e.stopPropagation(); openEditModal(alloc) }}
                              style={{
                                height: '26px', width: `${alloc.pct}%`, borderRadius: '4px', background: customerColor, position: 'absolute',
                                display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                color: 'rgba(0,0,0,0.8)', // Dark text for contrast
                                border: isTentative ? '2px dashed rgba(255,255,255,0.3)' : 'none',
                                opacity: isTentative ? 0.6 : 1,
                              }}
                            >
                              {project?.name.substring(0, 3)}{(project?.name?.length ?? 0) > 3 ? '.' : ''} {alloc.pct}%
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                {/* Capacity Row */}
                <div style={{ display: 'flex', height: '20px', borderBottom: `1px solid ${BORDER}` }}>
                  {MONTHS.map(month => {
                    const { totalPct } = utilizationForPersonMonth(person.id, month)
                    let capacityColor = GREEN
                    if (totalPct >= 100) capacityColor = RED
                    else if (totalPct >= 80) capacityColor = AMBER

                    return (
                      <div key={month} style={{ minWidth: '170px', width: '170px', background: BG_ELEVATED, borderLeft: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 8px', position: 'relative' }}>
                        <div style={{ width: `${Math.min(totalPct, 100)}%`, height: '80%', background: capacityColor, borderRadius: '2px', position: 'absolute', left: '0', top: '10%' }}></div>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAllocation ? 'Edit Allocation' : 'Add Allocation'}>
        <FormRow label="Person">
          <input type="text" value={currentPerson?.name || ''} readOnly style={{ width: '100%', padding: '8px', background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Month">
          <input type="text" value={fmtMonth(currentMonth)} readOnly style={{ width: '100%', padding: '8px', background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Project">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormRow>
        <FormRow label="Percentage (0-100)">
          <input type="number" value={pct} onChange={(e) => setPct(Number(e.target.value))} min={0} max={100} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Hours / Day (approx)">
          <input type="number" value={hoursPerDay.toFixed(1)} onChange={(e) => setHoursPerDay(Number(e.target.value))} step={0.1} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Confirmed">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
        </FormRow>
        <ModalActions>
          {editingAllocation && <button className="btn-danger" onClick={() => handleDeleteAllocation(editingAllocation.id)}>Delete</button>}
          <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </ModalActions>
      </Modal>
    </div>
  )
}
