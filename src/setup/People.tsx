import React, { useState } from 'react'
import { useStore } from '../store'
import type { Person, Department } from '../types'
import { DEPARTMENTS } from '../types'
import { Modal, FormRow, ModalActions } from '../components/Modal'

const BG_SURFACE='#141416'
const BG_ELEVATED='#1C1C1F'
const BORDER='#2A2A2E'
const TEXT_PRIMARY='#F0F0F2'
const TEXT_SEC='#8A8A96'

const fmtMoney = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n)

export function People() {
  const { people, roles, addPerson, updatePerson, deletePerson } = useStore()

  const [isModalOpen, setIsModalOpen]     = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [name, setName]                   = useState('')
  const [roleId, setRoleId]               = useState('')
  const [avatarColor, setAvatarColor]     = useState('#C8F041')
  const [department, setDepartment]       = useState<Department>(DEPARTMENTS[0])

  const openAddModal = () => {
    setEditingPerson(null)
    setName('')
    setRoleId(roles[0]?.id || '')
    setAvatarColor('#C8F041')
    setDepartment(DEPARTMENTS[0])
    setIsModalOpen(true)
  }

  const openEditModal = (person: Person) => {
    setEditingPerson(person)
    setName(person.name)
    setRoleId(person.role_id)
    setAvatarColor(person.avatar_color)
    setDepartment(person.department)
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (editingPerson) {
      updatePerson({ ...editingPerson, name, role_id: roleId, avatar_color: avatarColor, department })
    } else {
      addPerson({ name, role_id: roleId, avatar_color: avatarColor, department })
    }
    setIsModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this person?')) {
      deletePerson(id)
    }
  }

  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || '—'
  const getRoleRate = (id: string) => roles.find(r => r.id === id)?.hourly_rate || 0

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header">
        <div>
          <h2 style={{ color: TEXT_PRIMARY }}>People</h2>
          <div className="page-subtitle">{people.length} team member{people.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn-primary" onClick={openAddModal}>Add Person</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
        <thead style={{ background: BG_SURFACE }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC, width: 36 }}></th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Name</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Department</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Role</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Rate</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {people.map(person => (
            <tr key={person.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: '12px' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: person.avatar_color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#0D0D0F', fontSize: 12, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {person.name.charAt(0).toUpperCase()}
                </div>
              </td>
              <td style={{ padding: '12px', color: TEXT_PRIMARY, fontWeight: 500 }}>{person.name}</td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  background: 'rgba(200,240,65,0.08)',
                  color: '#A8D030',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}>
                  {person.department}
                </span>
              </td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>{getRoleName(person.role_id)}</td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMoney(getRoleRate(person.role_id))}/hr</td>
              <td style={{ padding: '12px' }}>
                <button className="btn-ghost" onClick={() => openEditModal(person)}>Edit</button>
                <button className="btn-danger" onClick={() => handleDelete(person.id)} style={{ marginLeft: 8 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPerson ? 'Edit Person' : 'Add Person'}>
        <FormRow label="Name">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
          />
        </FormRow>
        <FormRow label="Department">
          <select value={department} onChange={e => setDepartment(e.target.value as Department)}>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Role">
          <select value={roleId} onChange={e => setRoleId(e.target.value)}>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Avatar Color">
          <input
            type="color"
            value={avatarColor}
            onChange={e => setAvatarColor(e.target.value)}
            style={{ height: 40 }}
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
