import { useState } from 'react'
import { StoreProvider, useStore } from './store'
import { Sidebar } from './components/Sidebar'
import type { NavView } from './types'
import { Customers }   from './setup/Customers'
import { Roles }       from './setup/Roles'
import { People }      from './setup/People'
import { Projects }    from './setup/Projects'
import { Timeline }    from './views/Timeline'
import { GridView }    from './views/GridView'
import { Spend }       from './views/Spend'
import { Budgets }     from './views/Budgets'
import { Utilization } from './views/Utilization'

const BG_BASE    = '#0D0D0F'
const BG_SURFACE = '#141416'
const BG_CARD    = '#1C1C1F'
const BORDER     = '#2A2A2E'
const ACCENT     = '#a3e635'
const TEXT_PRI   = '#e5e5e5'
const TEXT_SEC   = '#8A8A96'
const RED        = '#f87171'

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen({ message = 'Loading workspace…' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: BG_BASE, gap: 16 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: ACCENT, animation: 'pulse 1.2s ease-in-out infinite' }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
      <span style={{ color: TEXT_SEC, fontSize: 13, fontFamily: 'Syne, sans-serif' }}>{message}</span>
    </div>
  )
}

// ── First-run setup panel (shown when DB tables are empty / not migrated) ─────
function SetupPanel() {
  const { seedDatabase, reload } = useStore()
  const [state, setState] = useState<'idle' | 'seeding' | 'error'>('idle')
  const [errMsg, setErrMsg]   = useState('')

  const run = async () => {
    setState('seeding')
    const { ok, error } = await seedDatabase()
    if (!ok) { setState('error'); setErrMsg(error ?? 'Unknown error'); return }
    await reload()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: BG_BASE }}>
      <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '40px 48px', maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🚀</div>
        <h2 style={{ color: TEXT_PRI, fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
          Set up Crewcast
        </h2>
        <p style={{ color: TEXT_SEC, fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>
          The database tables are empty or haven't been created yet.
        </p>
        <p style={{ color: TEXT_SEC, fontSize: 13, lineHeight: 1.6, margin: '0 0 28px' }}>
          First, paste <code style={{ color: ACCENT, background: 'rgba(163,230,53,0.1)', padding: '1px 5px', borderRadius: 4 }}>supabase/migration.sql</code> into the{' '}
          <strong style={{ color: TEXT_PRI }}>Supabase SQL Editor</strong> and run it.
          Then click below to seed demo data.
        </p>

        {state === 'error' && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: `1px solid ${RED}`, borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: RED, textAlign: 'left' }}>
            <strong>Error:</strong> {errMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={run}
            disabled={state === 'seeding'}
            style={{ background: state === 'seeding' ? '#333' : ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, cursor: state === 'seeding' ? 'not-allowed' : 'pointer' }}
          >
            {state === 'seeding' ? 'Seeding…' : '⚡ Seed Database'}
          </button>
          {state === 'error' && (
            <button
              onClick={() => reload()}
              style={{ background: 'transparent', color: TEXT_SEC, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 18px', fontFamily: 'Syne, sans-serif', fontSize: 13, cursor: 'pointer' }}
            >
              Retry load
            </button>
          )}
        </div>
        <p style={{ color: TEXT_SEC, fontSize: 11, marginTop: 20, opacity: 0.6 }}>
          This panel disappears automatically once data is loaded.
        </p>
      </div>
    </div>
  )
}

// ── Seed button (dev utility — shows in bottom of sidebar) ───────────────────
// Remove this component once the initial seed has been done.
function DevSeedButton() {
  const { seedDatabase, reload } = useStore()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'err'>('idle')

  const run = async () => {
    if (state === 'running') return
    if (!window.confirm('This will WIPE all crewcast_ tables and re-insert demo data. Continue?')) return
    setState('running')
    const { ok, error } = await seedDatabase()
    if (!ok) { console.error('[Dev seed]', error); setState('err'); return }
    setState('done')
    setTimeout(() => setState('idle'), 3000)
    await reload()
  }

  const label = state === 'running' ? '⏳ Seeding…' : state === 'done' ? '✓ Done' : state === 'err' ? '✗ Failed' : '⚙ Re-seed DB'
  const color = state === 'done' ? ACCENT : state === 'err' ? RED : TEXT_SEC

  return (
    <button
      onClick={run}
      title="Dev utility: wipe and re-seed the database with demo data"
      style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 999,
        background: BG_CARD, border: `1px dashed ${BORDER}`,
        borderRadius: 7, padding: '5px 12px',
        fontSize: 11, fontFamily: 'DM Mono, monospace',
        color, cursor: 'pointer', opacity: 0.7,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7' }}
    >
      {label}
    </button>
  )
}

// ── Inner app ─────────────────────────────────────────────────────────────────
function AppInner() {
  const { loading, customers, people } = useStore()
  const [currentView, setCurrentView]  = useState<NavView>('timeline')

  if (loading) return <LoadingScreen />

  // Tables exist but are empty (migration not run, or fresh DB)
  if (customers.length === 0 && people.length === 0) return <SetupPanel />

  const renderView = () => {
    switch (currentView) {
      case 'timeline':    return <Timeline />
      case 'grid':        return <GridView />
      case 'spend':       return <Spend />
      case 'budgets':     return <Budgets />
      case 'utilization': return <Utilization />
      case 'customers':   return <Customers />
      case 'projects':    return <Projects />
      case 'people':      return <People />
      case 'roles':       return <Roles />
      default:            return <Timeline />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: BG_BASE, color: TEXT_PRI }}>
      <Sidebar active={currentView} onChange={setCurrentView} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderView()}
      </div>
      {/* Dev utility — remove after initial seed is confirmed */}
      <DevSeedButton />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}
