import React, { useState, useMemo } from 'react'
import { useStore } from '../store'
import type { Person, Department } from '../types'
import { DEPARTMENTS } from '../types'
import { Modal, FormRow, ModalActions } from '../components/Modal'

const BG_SURFACE   = '#141416'
const BG_ELEVATED  = '#1C1C1F'
const BORDER       = '#2A2A2E'
const ACCENT       = '#a3e635'
const TEXT_PRIMARY = '#F0F0F2'
const TEXT_SEC     = '#8A8A96'
const TEXT_MUTED   = '#525252'

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ── Shared select style ───────────────────────────────────────────────────────
const filterSelect: React.CSSProperties = {
  background: BG_ELEVATED,
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  color: TEXT_PRIMARY,
  padding: '6px 32px 6px 10px',
  fontSize: 13,
  fontFamily: 'Syne, sans-serif',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23525252' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  minWidth: 160,
}

const filterSelectActive: React.CSSProperties = {
  ...filterSelect,
  border: `1px solid ${ACCENT}`,
  color: ACCENT,
}

export function People() {
  const { people, roles, addPerson, updatePerson, deletePerson } = useStore()

  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterDept, setFilterDept] = useState<string>('')
  const [filterRole, setFilterRole] = useState<string>('')

  // ── Modal state ──────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen]     = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [name, setName]                   = useState('')
  const [roleId, setRoleId]               = useState('')
  const [avatarColor, setAvatarColor]     = useState('#C8F041')
  const [department, setDepartment]       = useState<Department>(DEPARTMENTS[0])

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredPeople = useMemo(() => people.filter(p => {
    if (filterDept && p.department !== filterDept) return false
    if (filterRole && p.role_id !== filterRole)   return false
    return true
  }), [people, filterDept, filterRole])

  const filtersActive = filterDept !== '' || filterRole !== ''

  // ── Departments / roles available in current filtered set ────────────────
  // (For dept dropdown, show all; for role dropdown, show only roles present
  //  in the dept-filtered set so the options stay relevant)
  const rolesInDeptFilter = useMemo(() => {
    const base = filterDept ? people.filter(p => p.department === filterDept) : people
    const ids  = new Set(base.map(p => p.role_id))
    return roles.filter(r => ids.has(r.id))
  }, [people, roles, filterDept])

  // ── Modal helpers ────────────────────────────────────────────────────────
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

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h2 style={{ color: TEXT_PRIMARY }}>People</h2>
          <div className="page-subtitle">
            {filteredPeople.length !== people.length
              ? `${filteredPeople.length} of ${people.length} team member${people.length !== 1 ? 's' : ''}`
              : `${people.length} team member${people.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="btn-primary" onClick={openAddModal}>Add Person</button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {/* Department filter */}
        <div style={{ position: 'relative' }}>
          <select
            value={filterDept}
            onChange={e => { setFilterDept(e.target.value); setFilterRole('') }}
            style={filterDept ? filterSelectActive : filterSelect}
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Role filter */}
        <div style={{ position: 'relative' }}>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            style={filterRole ? filterSelectActive : filterSelect}
          >
            <option value="">All Roles</option>
            {rolesInDeptFilter.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Clear button — only visible when a filter is active */}
        {filtersActive && (
          <button
            onClick={() => { setFilterDept(''); setFilterRole('') }}
            style={{
              background: 'transparent',
              border: `1px solid #3a3a3a`,
              borderRadius: 7,
              padding: '6px 12px',
              color: TEXT_MUTED,
              fontSize: 12,
              fontFamily: 'Syne, sans-serif',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = TEXT_PRIMARY; (e.currentTarget as HTMLButtonElement).style.borderColor = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = TEXT_MUTED;   (e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3a3a' }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>×</span> Clear filters
          </button>
        )}

        {/* Active filter pills */}
        {filterDept && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(163,230,53,0.08)', border: `1px solid rgba(163,230,53,0.2)`,
            borderRadius: 99, padding: '3px 10px 3px 8px', fontSize: 11, color: ACCENT,
          }}>
            <span style={{ opacity: 0.6 }}>Dept:</span> {filterDept}
            <span
              style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.6, fontSize: 14, lineHeight: 1 }}
              onClick={() => setFilterDept('')}
            >×</span>
          </div>
        )}
        {filterRole && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(34,211,238,0.08)', border: `1px solid rgba(34,211,238,0.2)`,
            borderRadius: 99, padding: '3px 10px 3px 8px', fontSize: 11, color: '#22d3ee',
          }}>
            <span style={{ opacity: 0.6 }}>Role:</span> {getRoleName(filterRole)}
            <span
              style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.6, fontSize: 14, lineHeight: 1 }}
              onClick={() => setFilterRole('')}
            >×</span>
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
          {filteredPeople.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '40px 12px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
                No people match the current filters.{' '}
                <span
                  style={{ color: ACCENT, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { setFilterDept(''); setFilterRole('') }}
                >Clear filters</span>
              </td>
            </tr>
          ) : filteredPeople.map(person => (
            <tr key={person.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: '12px' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: person.avatar_color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#0D0D0F', fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {person.name.charAt(0).toUpperCase()}
                </div>
              </td>
              <td style={{ padding: '12px', color: TEXT_PRIMARY, fontWeight: 500 }}>{person.name}</td>
              <td style={{ padding: '12px' }}>
                <span
                  style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: filterDept === person.department ? 'rgba(163,230,53,0.15)' : 'rgba(200,240,65,0.08)',
                    color: '#A8D030', fontWeight: 500, letterSpacing: '0.02em', cursor: 'pointer',
                  }}
                  title={`Filter by ${person.department}`}
                  onClick={() => setFilterDept(filterDept === person.department ? '' : person.department)}
                >
                  {person.department}
                </span>
              </td>
              <td style={{ padding: '12px' }}>
                <span
                  style={{
                    color: filterRole === person.role_id ? '#22d3ee' : TEXT_SEC,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                  title={`Filter by ${getRoleName(person.role_id)}`}
                  onClick={() => setFilterRole(filterRole === person.role_id ? '' : person.role_id)}
                >
                  {getRoleName(person.role_id)}
                </span>
              </td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>{fmtMoney(getRoleRate(person.role_id))}/hr</td>
              <td style={{ padding: '12px' }}>
                <button className="btn-ghost" onClick={() => openEditModal(person)}>Edit</button>
                <button className="btn-danger" onClick={() => handleDelete(person.id)} style={{ marginLeft: 8 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
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
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </FormRow>
        <FormRow label="Role">
          <select value={roleId} onChange={e => setRoleId(e.target.value)}>
            {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
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
