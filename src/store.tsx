import React, { createContext, useContext, useState } from 'react'
import type { Customer, Role, Person, Project, Phase, Allocation } from './types'
import {
  seedCustomers, seedRoles, seedPeople,
  seedProjects, seedPhases, seedAllocations,
} from './seed'

interface Store {
  customers:   Customer[]
  roles:        Role[]
  people:       Person[]
  projects:     Project[]
  phases:       Phase[]
  allocations:  Allocation[]

  addCustomer:    (c: Omit<Customer,  'id'>) => void
  updateCustomer: (c: Customer) => void
  deleteCustomer: (id: string) => void

  addRole:        (r: Omit<Role,    'id'>) => void
  updateRole:     (r: Role) => void
  deleteRole:     (id: string) => void

  addPerson:      (p: Omit<Person,  'id'>) => void
  updatePerson:   (p: Person) => void
  deletePerson:   (id: string) => void

  addProject:     (p: Omit<Project, 'id'>) => void
  updateProject:  (p: Project) => void
  deleteProject:  (id: string) => void

  addPhase:       (p: Omit<Phase,   'id'>) => void
  updatePhase:    (p: Phase) => void
  deletePhase:    (id: string) => void

  addAllocation:    (a: Omit<Allocation, 'id'>) => void
  updateAllocation: (a: Allocation) => void
  deleteAllocation: (id: string) => void
}

const Ctx = createContext<Store | null>(null)

let _id = 1000
const uid = () => String(++_id)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [customers,  setCustomers]  = useState<Customer[]>(seedCustomers)
  const [roles,      setRoles]      = useState<Role[]>(seedRoles)
  const [people,     setPeople]     = useState<Person[]>(seedPeople)
  const [projects,   setProjects]   = useState<Project[]>(seedProjects)
  const [phases,     setPhases]     = useState<Phase[]>(seedPhases)
  const [allocations,setAllocations]= useState<Allocation[]>(seedAllocations)

  const store: Store = {
    customers, roles, people, projects, phases, allocations,

    addCustomer:    (c) => setCustomers(p => [...p, { ...c, id: uid() }]),
    updateCustomer: (c) => setCustomers(p => p.map(x => x.id === c.id ? c : x)),
    deleteCustomer: (id)=> setCustomers(p => p.filter(x => x.id !== id)),

    addRole:    (r) => setRoles(p => [...p, { ...r, id: uid() }]),
    updateRole: (r) => setRoles(p => p.map(x => x.id === r.id ? r : x)),
    deleteRole: (id)=> setRoles(p => p.filter(x => x.id !== id)),

    addPerson:    (p) => setPeople(prev => [...prev, { ...p, id: uid() }]),
    updatePerson: (p) => setPeople(prev => prev.map(x => x.id === p.id ? p : x)),
    deletePerson: (id)=> setPeople(prev => prev.filter(x => x.id !== id)),

    addProject:    (p) => setProjects(prev => [...prev, { ...p, id: uid() }]),
    updateProject: (p) => setProjects(prev => prev.map(x => x.id === p.id ? p : x)),
    deleteProject: (id)=> {
      setProjects(prev => prev.filter(x => x.id !== id))
      setPhases(prev => prev.filter(x => x.project_id !== id))
      setAllocations(prev => prev.filter(x => x.project_id !== id))
    },

    addPhase:    (p) => setPhases(prev => [...prev, { ...p, id: uid() }]),
    updatePhase: (p) => setPhases(prev => prev.map(x => x.id === p.id ? p : x)),
    deletePhase: (id)=> setPhases(prev => prev.filter(x => x.id !== id)),

    addAllocation:    (a) => setAllocations(prev => [...prev, { ...a, id: uid() }]),
    updateAllocation: (a) => setAllocations(prev => prev.map(x => x.id === a.id ? a : x)),
    deleteAllocation: (id)=> setAllocations(prev => prev.filter(x => x.id !== id)),
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const useStore = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export function useDerived() {
  const s = useStore()

  const customerById  = (id: string) => s.customers.find(c => c.id === id)
  const roleById      = (id: string) => s.roles.find(r => r.id === id)
  const personById    = (id: string) => s.people.find(p => p.id === id)
  const projectById   = (id: string) => s.projects.find(p => p.id === id)

  const rateForPerson = (personId: string) => {
    const person = personById(personId)
    if (!person) return 0
    return roleById(person.role_id)?.hourly_rate ?? 0
  }

  // Working days in a month (approx: weekdays only)
  const workingDaysInMonth = (yyyyMM: string) => {
    const [y, m] = yyyyMM.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    let weekdays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(y, m - 1, d).getDay()
      if (dow !== 0 && dow !== 6) weekdays++
    }
    return weekdays
  }

  // Spend for one allocation (confirmed allocations only for budget burn; use this separately)
  const spendForAllocation = (a: Allocation) => {
    const rate = rateForPerson(a.person_id)
    const days = workingDaysInMonth(a.month)
    return (days / 5) * 40 * (a.pct / 100) * rate
  }

  // Total confirmed spend for a project
  const confirmedSpendForProject = (projectId: string) => {
    return s.allocations
      .filter(a => a.project_id === projectId && a.confirmed)
      .reduce((sum, a) => sum + spendForAllocation(a), 0)
  }

  // Total forecasted spend (confirmed + tentative)
  const totalSpendForProject = (projectId: string) => {
    return s.allocations
      .filter(a => a.project_id === projectId)
      .reduce((sum, a) => sum + spendForAllocation(a), 0)
  }

  // Months between two YYYY-MM strings (inclusive)
  const monthsBetween = (start: string, end: string) => {
    const months: string[] = []
    let [y, m] = start.split('-').map(Number)
    const [ey, em] = end.split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }
    return months
  }

  // Utilization for a person in a month (pct of 160h available)
  const utilizationForPersonMonth = (personId: string, month: string) => {
    const allocs = s.allocations.filter(a => a.person_id === personId && a.month === month)
    const totalPct = allocs.reduce((s, a) => s + a.pct, 0)
    return { totalPct, allocs }
  }

  return {
    customerById, roleById, personById, projectById,
    rateForPerson, workingDaysInMonth, spendForAllocation,
    confirmedSpendForProject, totalSpendForProject,
    monthsBetween, utilizationForPersonMonth,
  }
}
