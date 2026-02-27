import React, { useState } from 'react'
import { useStore } from '../store'
import type { Person } from '../types'
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

export function People() {
  const { people, roles, addPerson, updatePerson, deletePerson } = useStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [name, setName] = useState('')
  const [roleId, setRoleId] = useState('')
  const [avatarColor, setAvatarColor] = useState('#ffffff')

  const openAddModal = () => {
    setEditingPerson(null)
    setName('')
    setRoleId(roles[0]?.id || '')
    setAvatarColor('#ffffff')
    setIsModalOpen(true)
  }

  const openEditModal = (person: Person) => {
    setEditingPerson(person)
    setName(person.name)
    setRoleId(person.role_id)
    setAvatarColor(person.avatar_color)
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (editingPerson) {
      updatePerson({ ...editingPerson, name, role_id: roleId, avatar_color: avatarColor })
    } else {
      addPerson({ name, role_id: roleId, avatar_color: avatarColor })
    }
    setIsModalOpen(false)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this person?')) {
      deletePerson(id)
    }
  }

  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || 'Unknown'
  const getRoleRate = (id: string) => roles.find(r => r.id === id)?.hourly_rate || 0

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header">
        <h2 style={{ color: TEXT_PRIMARY }}>People</h2>
        <button className="btn-primary" onClick={openAddModal}>Add Person</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px' }}>
        <thead style={{ background: BG_SURFACE }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}></th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Name</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Role</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Hourly Rate</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {people.map(person => (
            <tr key={person.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: '12px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%', background: person.avatar_color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px'
                }}>
                  {person.name.charAt(0)}
                </div>
              </td>
              <td style={{ padding: '12px', color: TEXT_PRIMARY }}>{person.name}</td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>{getRoleName(person.role_id)}</td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMoney(getRoleRate(person.role_id))}/hr</td>
              <td style={{ padding: '12px' }}>
                <button className="btn-ghost" onClick={() => openEditModal(person)}>Edit</button>
                <button className="btn-danger" onClick={() => handleDelete(person.id)} style={{ marginLeft: '8px' }}>Delete</button>
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
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}
          />
        </FormRow>
        <FormRow label="Role">
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            style={{ width: '100%', padding: '8px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', color: TEXT_PRIMARY }}
          >
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Avatar Color">
          <input
            type="color"
            value={avatarColor}
            onChange={(e) => setAvatarColor(e.target.value)}
            style={{ width: '100%', padding: '4px', background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: '4px', height: '40px' }}
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
