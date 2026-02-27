import { useState } from 'react'
import { StoreProvider } from './store'
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

function App() {
  const [currentView, setCurrentView] = useState<NavView>('timeline')

  const renderView = () => {
    switch (currentView) {
      case 'timeline': return <Timeline />
      case 'grid': return <GridView />
      case 'spend': return <Spend />
      case 'budgets': return <Budgets />
      case 'utilization': return <Utilization />
      case 'customers': return <Customers />
      case 'projects': return <Projects />
      case 'people': return <People />
      case 'roles': return <Roles />
      default: return <Timeline />
    }
  }

  return (
    <StoreProvider>
      <div style={{ display: 'flex', height: '100vh', background: BG_BASE, color: TEXT_PRIMARY }}>
        <Sidebar active={currentView} onChange={setCurrentView} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderView()}
        </div>
      </div>
    </StoreProvider>
  )
}

export default App
