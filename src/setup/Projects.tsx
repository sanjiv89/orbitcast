import React, { useState } from 'react'
import { useStore, useDerived } from '../store'
import type { Project, Phase } from '../types'
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

export function Projects() {
  const { projects, customers, phases, addProject, updateProject, deleteProject, addPhase, updatePhase, deletePhase } = useStore()
  const { customerById, confirmedSpendForProject, totalSpendForProject } = useDerived()

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectCustomerId, setProjectCustomerId] = useState('')
  const [projectStartMonth, setProjectStartMonth] = useState('')
  const [projectEndMonth, setProjectEndMonth] = useState('')
  const [projectBudget, setProjectBudget] = useState(0)
  const [projectStatus, setProjectStatus] = useState<'active' | 'tentative' | 'complete'>('active')
  const [projectBillable, setProjectBillable] = useState(true)

  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false)
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null)
  const [phaseName, setPhaseName] = useState('')
  const [phaseStartMonth, setPhaseStartMonth] = useState('')
  const [phaseEndMonth, setPhaseEndMonth] = useState('')
  const [currentProjectIdForPhase, setCurrentProjectIdForPhase] = useState<string | null>(null)

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})

  const toggleExpand = (projectId: string) => {
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }))
  }

  const openAddProjectModal = () => {
    setEditingProject(null)
    setProjectName('')
    setProjectCustomerId(customers[0]?.id || '')
    setProjectStartMonth(MONTHS[0])
    setProjectEndMonth(MONTHS[0])
    setProjectBudget(0)
    setProjectStatus('active')
    setProjectBillable(true)
    setIsProjectModalOpen(true)
  }

  const openEditProjectModal = (project: Project) => {
    setEditingProject(project)
    setProjectName(project.name)
    setProjectCustomerId(project.customer_id)
    setProjectStartMonth(project.start_month)
    setProjectEndMonth(project.end_month)
    setProjectBudget(project.budget_dollars)
    setProjectStatus(project.status)
    setProjectBillable(project.billable)
    setIsProjectModalOpen(true)
  }

  const handleSaveProject = () => {
    if (editingProject) {
      updateProject({ ...editingProject, name: projectName, customer_id: projectCustomerId, start_month: projectStartMonth, end_month: projectEndMonth, budget_dollars: projectBudget, status: projectStatus, billable: projectBillable })
    } else {
      addProject({ name: projectName, customer_id: projectCustomerId, start_month: projectStartMonth, end_month: projectEndMonth, budget_dollars: projectBudget, status: projectStatus, billable: projectBillable })
    }
    setIsProjectModalOpen(false)
  }

  const handleDeleteProject = (id: string) => {
    if (window.confirm('Are you sure you want to delete this project and all its phases and allocations?')) {
      deleteProject(id)
    }
  }

  const openAddPhaseModal = (projectId: string) => {
    setEditingPhase(null)
    setPhaseName('')
    setPhaseStartMonth(MONTHS[0])
    setPhaseEndMonth(MONTHS[0])
    setCurrentProjectIdForPhase(projectId)
    setIsPhaseModalOpen(true)
  }

  const openEditPhaseModal = (phase: Phase) => {
    setEditingPhase(phase)
    setPhaseName(phase.name)
    setPhaseStartMonth(phase.start_month)
    setPhaseEndMonth(phase.end_month)
    setCurrentProjectIdForPhase(phase.project_id)
    setIsPhaseModalOpen(true)
  }

  const handleSavePhase = () => {
    if (currentProjectIdForPhase) {
      if (editingPhase) {
        updatePhase({ ...editingPhase, name: phaseName, start_month: phaseStartMonth, end_month: phaseEndMonth })
      } else {
        addPhase({ project_id: currentProjectIdForPhase, name: phaseName, start_month: phaseStartMonth, end_month: phaseEndMonth })
      }
    }
    setIsPhaseModalOpen(false)
  }

  const handleDeletePhase = (id: string) => {
    if (window.confirm('Are you sure you want to delete this phase?')) {
      deletePhase(id)
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header">
        <h2 style={{ color: TEXT_PRIMARY }}>Projects</h2>
        <button className="btn-primary" onClick={openAddProjectModal}>Add Project</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px' }}>
        <thead style={{ background: BG_SURFACE }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC, width: '30px' }}></th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Name</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Customer</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Start</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>End</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Budget</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Status</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Confirmed Spend</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Budget Remaining</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Actions</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}></th>
          </tr>
        </thead>
        <tbody>
          {projects.map(project => {
            const customer = customerById(project.customer_id)
            const confirmedSpend = confirmedSpendForProject(project.id)
            const totalSpend = totalSpendForProject(project.id)
            const budgetRemaining = project.budget_dollars - totalSpend
            const isTentative = project.status === 'tentative'

            return (
              <React.Fragment key={project.id}>
                <tr style={{
                  borderBottom: `1px solid ${BORDER}`,
                  opacity: isTentative ? 0.65 : 1,
                }}>
                  <td style={{ padding: '12px' }}>
                    <button className="btn-ghost" onClick={() => toggleExpand(project.id)}>
                      {expandedProjects[project.id] ? '▼' : '▶'}
                    </button>
                  </td>
                  <td style={{ padding: '12px', color: TEXT_PRIMARY }}>{project.name}</td>
                  <td style={{ padding: '12px', color: TEXT_SEC, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: customer?.color, marginRight: '8px' }}></div>
                    {customer?.name}
                  </td>
                  <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMonth(project.start_month)}</td>
                  <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMonth(project.end_month)}</td>
                  <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMoney(project.budget_dollars)}</td>
                  <td style={{ padding: '12px' }}>
                    <span className={`badge status-${project.status}`}>{project.status}</span>
                  </td>
                  <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMoney(confirmedSpend)}</td>
                  <td style={{ padding: '12px', color: budgetRemaining < 0 ? RED : TEXT_SEC }}>
                    {fmtMoney(budgetRemaining)}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button className="btn-ghost" onClick={() => openEditProjectModal(project)}>Edit</button>
                    <button className="btn-danger" onClick={() => handleDeleteProject(project.id)} style={{ marginLeft: '8px' }}>Delete</button>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button className="btn-primary" onClick={() => openAddPhaseModal(project.id)}>Add Phase</button>
                  </td>
                </tr>
                {expandedProjects[project.id] && phases.filter(p => p.project_id === project.id).map(phase => (
                  <tr key={phase.id} style={{ borderBottom: `1px solid ${BORDER}`, background: BG_ELEVATED }}>
                    <td style={{ padding: '12px', borderLeft: `4px solid ${customer?.color}`, marginLeft: '20px' }}></td>
                    <td style={{ padding: '12px', color: TEXT_PRIMARY, paddingLeft: '32px' }}>{phase.name}</td>
                    <td style={{ padding: '12px' }}></td>
                    <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMonth(phase.start_month)}</td>
                    <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMonth(phase.end_month)}</td>
                    <td style={{ padding: '12px' }}></td>
                    <td style={{ padding: '12px' }}></td>
                    <td style={{ padding: '12px' }}></td>
                    <td style={{ padding: '12px' }}></td>
                    <td style={{ padding: '12px' }}>
                      <button className="btn-ghost" onClick={() => openEditPhaseModal(phase)}>Edit</button>
                      <button className="btn-danger" onClick={() => handleDeletePhase(phase.id)} style={{ marginLeft: '8px' }}>Delete</button>
                    </td>
                    <td></td>
                  </tr>
                ))}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>

      <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title={editingProject ? 'Edit Project' : 'Add Project'}>
        <FormRow label="Name">
          <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Customer">
          <select value={projectCustomerId} onChange={(e) => setProjectCustomerId(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormRow>
        <FormRow label="Start Month">
          <input type="month" value={projectStartMonth} onChange={(e) => setProjectStartMonth(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="End Month">
          <input type="month" value={projectEndMonth} onChange={(e) => setProjectEndMonth(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Budget Dollars">
          <input type="number" value={projectBudget} onChange={(e) => setProjectBudget(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Status">
          <select value={projectStatus} onChange={(e) => setProjectStatus(e.target.value as any)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}>
            <option value="active">Active</option>
            <option value="tentative">Tentative</option>
            <option value="complete">Complete</option>
          </select>
        </FormRow>
        <FormRow label="Billable">
          <input type="checkbox" checked={projectBillable} onChange={(e) => setProjectBillable(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
        </FormRow>
        <ModalActions>
          <button className="btn-ghost" onClick={() => setIsProjectModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSaveProject}>Save</button>
        </ModalActions>
      </Modal>

      <Modal isOpen={isPhaseModalOpen} onClose={() => setIsPhaseModalOpen(false)} title={editingPhase ? 'Edit Phase' : 'Add Phase'}>
        <FormRow label="Name">
          <input type="text" value={phaseName} onChange={(e) => setPhaseName(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="Start Month">
          <input type="month" value={phaseStartMonth} onChange={(e) => setPhaseStartMonth(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <FormRow label="End Month">
          <input type="month" value={phaseEndMonth} onChange={(e) => setPhaseEndMonth(e.target.value)} style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }} />
        </FormRow>
        <ModalActions>
          <button className="btn-ghost" onClick={() => setIsPhaseModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSavePhase}>Save</button>
        </ModalActions>
      </Modal>
    </div>
  )
}
