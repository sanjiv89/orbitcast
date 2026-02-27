import React, { useState } from 'react'
import { useStore } from '../store'
import type { Role } from '../types'
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

export function Roles() {
  const { roles, people, addRole, updateRole, deleteRole } = useStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [hourlyRate, setHourlyRate] = useState(0)

  const openAddModal = () => {
    setEditingRole(null)
    setName('')
    setHourlyRate(0)
    setIsModalOpen(true)
  }

  const openEditModal = (role: Role) => {
    setEditingRole(role)
    setName(role.name)
    setHourlyRate(role.hourly_rate)
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (editingRole) {
      updateRole({ ...editingRole, name, hourly_rate: hourlyRate })
    } else {
      addRole({ name, hourly_rate: hourlyRate })
    }
    setIsModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      deleteRole(id)
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header">
        <h2 style={{ color: TEXT_PRIMARY }}>Roles</h2>
        <button className="btn-primary" onClick={openAddModal}>Add Role</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px' }}>
        <thead style={{ background: BG_SURFACE }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Name</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Hourly Rate</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>People</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(role => (
            <tr key={role.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: '12px', color: TEXT_PRIMARY }}>{role.name}</td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMoney(role.hourly_rate)}/hr</td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>
                {people.filter(p => p.role_id === role.id).length}
              </td>
              <td style={{ padding: '12px' }}>
                <button className="btn-ghost" onClick={() => openEditModal(role)}>Edit</button>
                <button className="btn-danger" onClick={() => handleDelete(role.id)} style={{ marginLeft: '8px' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRole ? 'Edit Role' : 'Add Role'}>
        <FormRow label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}
          />
        </FormRow>
        <FormRow label="Hourly Rate">
          <input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}
          />
        </FormRow>
        <ModalActions>
          <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </ModalActions>
      </Modal>
    </div>
  )
}
