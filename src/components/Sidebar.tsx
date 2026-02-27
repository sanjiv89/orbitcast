import type { NavView } from '../types'

interface Props {
  active: NavView
  onChange: (v: NavView) => void
}

const views: { id: NavView; label: string; icon: string }[] = [
  { id: 'timeline',    label: 'Timeline',    icon: '▬' },
  { id: 'grid',        label: 'Grid',        icon: '⊞' },
  { id: 'spend',       label: 'Spend',       icon: '$' },
  { id: 'budgets',     label: 'Budgets',     icon: '◎' },
  { id: 'utilization', label: 'Utilization', icon: '≋' },
]

const setup: { id: NavView; label: string; icon: string }[] = [
  { id: 'customers', label: 'Customers', icon: '●' },
  { id: 'projects',  label: 'Projects',  icon: '◆' },
  { id: 'people',    label: 'People',    icon: '◉' },
  { id: 'roles',     label: 'Roles',     icon: '◈' },
]

export function Sidebar({ active, onChange }: Props) {
  return (
    <nav style={{
      width: 200, minWidth: 200, background: '#0D0D0F',
      borderRight: '1px solid #1E1E22', display: 'flex',
      flexDirection: 'column', padding: '20px 0',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #1E1E22' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#C8F041', letterSpacing: '-0.5px' }}>
          Orbitcast
        </div>
        <div style={{ fontSize: 11, color: '#55555F', marginTop: 2 }}>Resource Forecasting</div>
      </div>

      {/* Views section */}
      <div style={{ padding: '20px 12px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#55555F', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>
          Views
        </div>
        {views.map(v => (
          <NavItem key={v.id} item={v} active={active === v.id} onClick={() => onChange(v.id)} />
        ))}
      </div>

      {/* Setup section */}
      <div style={{ padding: '12px 12px 8px', marginTop: 8, borderTop: '1px solid #1E1E22' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#55555F', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>
          Setup
        </div>
        {setup.map(v => (
          <NavItem key={v.id} item={v} active={active === v.id} onClick={() => onChange(v.id)} />
        ))}
      </div>
    </nav>
  )
}

function NavItem({ item, active, onClick }: { item: { icon: string; label: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 10px', borderRadius: 7,
        background: active ? 'rgba(200,240,65,0.1)' : 'transparent',
        color: active ? '#C8F041' : '#8A8A96',
        fontFamily: 'DM Mono, monospace', fontSize: 13,
        fontWeight: active ? 600 : 400,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.12s',
        marginBottom: 1,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#F0F0F2' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#8A8A96' }}
    >
      <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
      {item.label}
    </button>
  )
}
