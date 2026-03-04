import { useState } from 'react'
import { StoreProvider, useStore } from './store'
import { Sidebar } from './components/Sidebar'
import type { NavView } from './types'
import { Customers } from './setup/Customers'
import { Roles } from './setup/Roles'
import { People } from './setup/People'
import { Projects } from './setup/Projects'
import { Timeline } from './views/Timeline'
import { GridView } from './views/GridView'
import { Spend } from './views/Spend'
import { Budgets } from './views/Budgets'
import { Utilization } from './views/Utilization'

const BG_BASE    = '#0D0D0F'
const BG_SURFACE = '#141416'
const ACCENT     = '#a3e635'
const TEXT_SEC   = '#8A8A96'

// ── Loading screen shown while Supabase data is fetching ─────────────────────
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: BG_BASE, gap: 16,
    }}>
      {/* Simple pulsing dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: ACCENT,
        animation: 'pulse 1.2s ease-in-out infinite',
      }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
      <span style={{ color: TEXT_SEC, fontSize: 13, fontFamily: 'Syne, sans-serif' }}>
        Loading workspace…
      </span>
    </div>
  )
}

// ── Inner app (rendered inside StoreProvider) ─────────────────────────────────
function AppInner() {
  const { loading } = useStore()
  const [currentView, setCurrentView] = useState<NavView>('timeline')

  if (loading) return <LoadingScreen />

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
    <div style={{ display: 'flex', height: '100vh', background: BG_BASE, color: '#F0F0F2' }}>
      <Sidebar active={currentView} onChange={setCurrentView} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderView()}
      </div>
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
