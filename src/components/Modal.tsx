import React, { useEffect } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
  isOpen?: boolean
}

export function Modal({ title, onClose, children, maxWidth = 480, isOpen }: Props) {
  // If isOpen is explicitly passed as false, don't render
  if (isOpen === false) return null
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#8A8A96', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-row">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid #2A2A2E' }}>
      {children}
    </div>
  )
}
