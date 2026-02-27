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

export function GridView() {
  const { people, projects, allocations, customers, addAllocation, updateAllocation, deleteAllocation } = useStore()
  const { roleById, projectById, customerById, utilizationForPersonMonth } = useDerived()

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

  const getProjectInitials = (id: string) => {
    const project = projectById(id)
    if (!project) return ''
    return project.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()
  }
  const getCustomerColor = (projectId: string) => {
    const project = projectById(projectId)
    if (!project) return BORDER
    return customerById(project.customer_id)?.color || BORDER
  }

  const filteredPeople = people.filter(person => {
    if (filterCustomer === 'all') return true
    return allocations.some(alloc => {
      if (alloc.person_id !== person.id) return false
      const project = projectById(alloc.project_id)
      return project?.customer_id === filterCustomer
    })
  })

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <h2 style={{ color: TEXT_PRIMARY }}>Grid View</h2>
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
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', minWidth: 'fit-content' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ background: BG_SURFACE, padding: '12px', textAlign: 'left', color: TEXT_SEC, minWidth: '180px', width: '180px', borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>Person / Month</th>
              {MONTHS.map(month => (
                <th key={month} style={{ background: BG_SURFACE, padding: '12px', textAlign: 'center', color: TEXT_SEC, minWidth: '130px', borderBottom: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}` }}>{fmtMonth(month)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPeople.map(person => (
              <tr key={person.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ background: BG_SURFACE, padding: '12px', color: TEXT_PRIMARY, position: 'sticky', left: 0, borderRight: `1px solid ${BORDER}` }}>
                  <div>{person.name}</div>
                  <div style={{ fontSize: '12px', color: TEXT_SEC }}>{roleById(person.role_id)?.name}</div>
                </td>
                {MONTHS.map(month => {
                  const { totalPct, allocs } = utilizationForPersonMonth(person.id, month)
                  return (
                    <td key={month} style={{ minWidth: '130px', minHeight: '70px', verticalAlign: 'top', padding: '6px', background: BG_ELEVATED, borderRight: `1px solid ${BORDER}`, cursor: 'pointer' }} onClick={() => openAddModal(person, month)}>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {allocs.map(alloc => {
                          const project = projectById(alloc.project_id)
                          const customerColor = getCustomerColor(alloc.project_id)
                          const isTentative = project?.status === 'tentative'
                          return (
                            <span
                              key={alloc.id}
                              className="badge"
                              onClick={(e) => { e.stopPropagation(); openEditModal(alloc) }}
                              style={{
                                height: '18px', padding: '2px 6px', margin: '2px', fontSize: '10px', borderRadius: '9999px',
                                background: customerColor, color: 'rgba(0,0,0,0.8)', display: 'inline-flex', alignItems: 'center',
                                opacity: isTentative ? 0.6 : 1,
                                border: isTentative ? '1px dashed rgba(255,255,255,0.3)' : 'none',
                              }}
                            >
                              {getProjectInitials(alloc.project_id)} {alloc.pct}%
                            </span>
                          )
                        })}
                      </div>
                      {totalPct > 0 && (
                        <div style={{ fontSize: '11px', color: totalPct > 100 ? RED : TEXT_SEC, marginTop: '4px' }}>
                          Total: {totalPct}%
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
