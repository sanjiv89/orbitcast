import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Customer, Role, Person, Project, Phase, Allocation } from './types'
import { supabase } from './lib/supabase'
import { seedDatabase } from './lib/seedDb'

// ── Store interface ───────────────────────────────────────────────────────────
interface Store {
  loading: boolean

  customers:   Customer[]
  roles:        Role[]
  people:       Person[]
  projects:     Project[]
  phases:       Phase[]
  allocations:  Allocation[]

  addCustomer:    (c: Omit<Customer,  'id'>) => void
  updateCustomer: (c: Customer)               => void
  deleteCustomer: (id: string)                => void

  addRole:        (r: Omit<Role,    'id'>) => void
  updateRole:     (r: Role)                => void
  deleteRole:     (id: string)             => void

  addPerson:      (p: Omit<Person,  'id'>) => void
  updatePerson:   (p: Person)              => void
  deletePerson:   (id: string)             => void

  addProject:     (p: Omit<Project, 'id'>) => void
  updateProject:  (p: Project)             => void
  deleteProject:  (id: string)             => void

  addPhase:       (p: Omit<Phase,   'id'>) => void
  updatePhase:    (p: Phase)               => void
  deletePhase:    (id: string)             => void

  addAllocation:    (a: Omit<Allocation, 'id'>) => void
  updateAllocation: (a: Allocation)              => void
  deleteAllocation: (id: string)                 => void

  /** Re-fetch all data from Supabase */
  reload: () => Promise<void>
  /** Wipe all crewcast_ tables and re-insert seed data */
  seedDatabase: () => Promise<{ ok: boolean; error?: string }>
}

const Ctx = createContext<Store | null>(null)

// Client-side UUID generation (works in all modern browsers + Vite)
const uid = () => crypto.randomUUID()

// ── StoreProvider ─────────────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading,      setLoading]      = useState(true)
  const [customers,    setCustomers]    = useState<Customer[]>([])
  const [roles,        setRoles]        = useState<Role[]>([])
  const [people,       setPeople]       = useState<Person[]>([])
  const [projects,     setProjects]     = useState<Project[]>([])
  const [phases,       setPhases]       = useState<Phase[]>([])
  const [allocations,  setAllocations]  = useState<Allocation[]>([])

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => { loadAll() }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [custR, roleR, pplR, projR, phR, allocR] = await Promise.all([
        supabase.from('crewcast_customers').select('*'),
        supabase.from('crewcast_roles').select('*'),
        supabase.from('crewcast_people').select('*'),
        supabase.from('crewcast_projects').select('*'),
        supabase.from('crewcast_phases').select('*'),
        supabase.from('crewcast_allocations').select('*'),
      ])

      // Surface any Supabase errors immediately — don't swallow silently
      for (const res of [custR, roleR, pplR, projR, phR, allocR]) {
        if (res.error) {
          console.error('[Crewcast] Supabase load error:', res.error.message)
          throw res.error
        }
      }

      // First run after migration: tables are empty → auto-seed with demo data
      if ((custR.data?.length ?? 0) === 0 && (roleR.data?.length ?? 0) === 0) {
        console.info('[Crewcast] Empty DB detected — auto-seeding demo data…')
        const result = await seedDatabase()
        if (!result.ok) {
          console.error('[Crewcast] Auto-seed failed:', result.error)
          console.error('[Crewcast] Hint: run supabase/migration.sql in the Supabase SQL Editor first.')
          setLoading(false)
          return
        }
        // Re-fetch after seed
        await loadAll()
        return
      }

      setCustomers(custR.data  as Customer[])
      setRoles(roleR.data      as Role[])
      setPeople(pplR.data      as Person[])
      setProjects(projR.data   as Project[])
      setPhases(phR.data       as Phase[])
      setAllocations(allocR.data as Allocation[])
    } catch (err: any) {
      console.error('[Crewcast] loadAll failed:', err?.message ?? err)
      console.error('[Crewcast] Ensure migration.sql has been run in Supabase SQL Editor.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Optimistic mutation helpers ────────────────────────────────────────────
  //
  // Pattern: update local React state immediately (snappy UI), then fire
  // the Supabase mutation in the background.  If Supabase returns an error,
  // log it clearly and revert local state so the user sees the real value.
  //
  // This means: any update that doesn't actually save will visually revert
  // within a network round-trip (~100–300 ms) instead of being silently lost.

  // ── Customers ──────────────────────────────────────────────────────────────
  const addCustomer = (c: Omit<Customer, 'id'>) => {
    const rec: Customer = { ...c, id: uid() }
    setCustomers(p => [...p, rec])
    supabase.from('crewcast_customers').insert(rec).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] addCustomer failed:', error.message)
        setCustomers(p => p.filter(x => x.id !== rec.id))
      }
    })
  }

  const updateCustomer = (c: Customer) => {
    const old = customers.find(x => x.id === c.id)
    setCustomers(p => p.map(x => x.id === c.id ? c : x))
    supabase.from('crewcast_customers').update(c).eq('id', c.id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] updateCustomer failed:', error.message, '— reverting')
        if (old) setCustomers(p => p.map(x => x.id === c.id ? old : x))
      }
    })
  }

  const deleteCustomer = (id: string) => {
    const backup = customers.find(x => x.id === id)
    setCustomers(p => p.filter(x => x.id !== id))
    supabase.from('crewcast_customers').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] deleteCustomer failed:', error.message, '— reverting')
        if (backup) setCustomers(p => [...p, backup])
      }
    })
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  const addRole = (r: Omit<Role, 'id'>) => {
    const rec: Role = { ...r, id: uid() }
    setRoles(p => [...p, rec])
    supabase.from('crewcast_roles').insert(rec).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] addRole failed:', error.message)
        setRoles(p => p.filter(x => x.id !== rec.id))
      }
    })
  }

  const updateRole = (r: Role) => {
    const old = roles.find(x => x.id === r.id)
    setRoles(p => p.map(x => x.id === r.id ? r : x))
    supabase.from('crewcast_roles').update(r).eq('id', r.id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] updateRole failed:', error.message, '— reverting')
        if (old) setRoles(p => p.map(x => x.id === r.id ? old : x))
      }
    })
  }

  const deleteRole = (id: string) => {
    const backup = roles.find(x => x.id === id)
    setRoles(p => p.filter(x => x.id !== id))
    supabase.from('crewcast_roles').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] deleteRole failed:', error.message, '— reverting')
        if (backup) setRoles(p => [...p, backup])
      }
    })
  }

  // ── People ─────────────────────────────────────────────────────────────────
  const addPerson = (p: Omit<Person, 'id'>) => {
    const rec: Person = { ...p, id: uid() }
    setPeople(prev => [...prev, rec])
    supabase.from('crewcast_people').insert(rec).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] addPerson failed:', error.message)
        setPeople(prev => prev.filter(x => x.id !== rec.id))
      }
    })
  }

  const updatePerson = (p: Person) => {
    const old = people.find(x => x.id === p.id)
    setPeople(prev => prev.map(x => x.id === p.id ? p : x))
    supabase.from('crewcast_people').update(p).eq('id', p.id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] updatePerson failed:', error.message, '— reverting')
        if (old) setPeople(prev => prev.map(x => x.id === p.id ? old : x))
      }
    })
  }

  const deletePerson = (id: string) => {
    const backup = people.find(x => x.id === id)
    setPeople(prev => prev.filter(x => x.id !== id))
    // Cascade: remove allocations for this person locally
    setAllocations(prev => prev.filter(x => x.person_id !== id))
    supabase.from('crewcast_people').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] deletePerson failed:', error.message, '— reverting')
        if (backup) setPeople(prev => [...prev, backup])
        // Restore allocations too — re-fetch them
        supabase.from('crewcast_allocations').select('*').eq('person_id', id)
          .then(({ data }) => { if (data?.length) setAllocations(prev => [...prev, ...data as Allocation[]]) })
      }
    })
  }

  // ── Projects ───────────────────────────────────────────────────────────────
  const addProject = (p: Omit<Project, 'id'>) => {
    const rec: Project = { ...p, id: uid() }
    setProjects(prev => [...prev, rec])
    supabase.from('crewcast_projects').insert(rec).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] addProject failed:', error.message)
        setProjects(prev => prev.filter(x => x.id !== rec.id))
      }
    })
  }

  const updateProject = (p: Project) => {
    const old = projects.find(x => x.id === p.id)
    setProjects(prev => prev.map(x => x.id === p.id ? p : x))
    supabase.from('crewcast_projects').update(p).eq('id', p.id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] updateProject failed:', error.message, '— reverting')
        if (old) setProjects(prev => prev.map(x => x.id === p.id ? old : x))
      }
    })
  }

  const deleteProject = (id: string) => {
    const backup = projects.find(x => x.id === id)
    setProjects(prev => prev.filter(x => x.id !== id))
    setPhases(prev => prev.filter(x => x.project_id !== id))
    setAllocations(prev => prev.filter(x => x.project_id !== id))
    supabase.from('crewcast_projects').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] deleteProject failed:', error.message, '— reverting')
        if (backup) setProjects(prev => [...prev, backup])
        // Re-fetch phases and allocations for this project
        Promise.all([
          supabase.from('crewcast_phases').select('*').eq('project_id', id),
          supabase.from('crewcast_allocations').select('*').eq('project_id', id),
        ]).then(([ph, al]) => {
          if (ph.data?.length) setPhases(prev => [...prev, ...ph.data as Phase[]])
          if (al.data?.length) setAllocations(prev => [...prev, ...al.data as Allocation[]])
        })
      }
    })
  }

  // ── Phases ─────────────────────────────────────────────────────────────────
  const addPhase = (p: Omit<Phase, 'id'>) => {
    const rec: Phase = { ...p, id: uid() }
    setPhases(prev => [...prev, rec])
    supabase.from('crewcast_phases').insert(rec).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] addPhase failed:', error.message)
        setPhases(prev => prev.filter(x => x.id !== rec.id))
      }
    })
  }

  const updatePhase = (p: Phase) => {
    const old = phases.find(x => x.id === p.id)
    setPhases(prev => prev.map(x => x.id === p.id ? p : x))
    supabase.from('crewcast_phases').update(p).eq('id', p.id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] updatePhase failed:', error.message, '— reverting')
        if (old) setPhases(prev => prev.map(x => x.id === p.id ? old : x))
      }
    })
  }

  const deletePhase = (id: string) => {
    const backup = phases.find(x => x.id === id)
    setPhases(prev => prev.filter(x => x.id !== id))
    supabase.from('crewcast_phases').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] deletePhase failed:', error.message, '— reverting')
        if (backup) setPhases(prev => [...prev, backup])
      }
    })
  }

  // ── Allocations ────────────────────────────────────────────────────────────
  const addAllocation = (a: Omit<Allocation, 'id'>) => {
    const rec: Allocation = { ...a, id: uid() }
    setAllocations(prev => [...prev, rec])
    supabase.from('crewcast_allocations').insert(rec).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] addAllocation failed:', error.message)
        setAllocations(prev => prev.filter(x => x.id !== rec.id))
      }
    })
  }

  const updateAllocation = (a: Allocation) => {
    const old = allocations.find(x => x.id === a.id)
    setAllocations(prev => prev.map(x => x.id === a.id ? a : x))
    supabase.from('crewcast_allocations').update(a).eq('id', a.id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] updateAllocation failed:', error.message, '— reverting')
        if (old) setAllocations(prev => prev.map(x => x.id === a.id ? old : x))
      }
    })
  }

  const deleteAllocation = (id: string) => {
    const backup = allocations.find(x => x.id === id)
    setAllocations(prev => prev.filter(x => x.id !== id))
    supabase.from('crewcast_allocations').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('[Crewcast] deleteAllocation failed:', error.message, '— reverting')
        if (backup) setAllocations(prev => [...prev, backup])
      }
    })
  }

  // ── Public seed + reload ───────────────────────────────────────────────────
  const runSeedDatabase = async (): Promise<{ ok: boolean; error?: string }> => {
    setLoading(true)
    const result = await seedDatabase()
    if (result.ok) await loadAll()
    else setLoading(false)
    return result
  }

  // ── Assemble store ─────────────────────────────────────────────────────────
  const store: Store = {
    loading,
    customers, roles, people, projects, phases, allocations,
    addCustomer, updateCustomer, deleteCustomer,
    addRole, updateRole, deleteRole,
    addPerson, updatePerson, deletePerson,
    addProject, updateProject, deleteProject,
    addPhase, updatePhase, deletePhase,
    addAllocation, updateAllocation, deleteAllocation,
    reload: loadAll,
    seedDatabase: runSeedDatabase,
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

  // Basic look-ups
  const customerById  = (id: string) => s.customers.find(c => c.id === id)
  const roleById      = (id: string) => s.roles.find(r => r.id === id)
  const personById    = (id: string) => s.people.find(p => p.id === id)
  const projectById   = (id: string) => s.projects.find(p => p.id === id)

  const rateForPerson = (personId: string) => {
    const person = personById(personId)
    if (!person) return 0
    return roleById(person.role_id)?.hourly_rate ?? 0
  }

  // ── Date-range calculation helpers ────────────────────────────────────────

  /** Count Mon–Fri weekdays in [start, end] inclusive */
  const countWorkingDays = (start: Date, end: Date): number => {
    const s = new Date(start); s.setHours(0, 0, 0, 0)
    const e = new Date(end);   e.setHours(0, 0, 0, 0)
    if (s > e) return 0
    const total   = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1
    const weeks   = Math.floor(total / 7)
    const rem     = total % 7
    const startDow = s.getDay()
    let wd = weeks * 5
    for (let i = 0; i < rem; i++) { const d = (startDow + i) % 7; if (d !== 0 && d !== 6) wd++ }
    return wd
  }

  /**
   * Effective HOURS an allocation contributes to a YYYY-MM month.
   * Uses working-day overlap formula:
   *   (overlap working days / total working days in month) × 160h × (pct / 100)
   */
  const hoursForAllocationInMonth = (a: Allocation, monthStr: string, capacityH = 160): number => {
    const [y, m]     = monthStr.split('-').map(Number)
    const ms         = new Date(y, m - 1, 1)
    const me         = new Date(y, m, 0)
    const as_        = new Date(a.start_date + 'T00:00:00')
    const ae         = new Date(a.end_date   + 'T00:00:00')
    const os         = new Date(Math.max(as_.getTime(), ms.getTime()))
    const oe         = new Date(Math.min(ae.getTime(),  me.getTime()))
    if (os > oe) return 0
    const overlapDays = countWorkingDays(os, oe)
    const totalDays   = countWorkingDays(ms, me)
    if (totalDays === 0) return 0
    return Math.round((overlapDays / totalDays) * capacityH * (a.allocation_percentage / 100) * 10) / 10
  }

  /**
   * Effective utilisation PERCENTAGE an allocation contributes to a month.
   * Prorated by working-day overlap — the display % per month for partial months.
   */
  const pctForAllocationInMonth = (a: Allocation, monthStr: string): number => {
    const [y, m]   = monthStr.split('-').map(Number)
    const ms       = new Date(y, m - 1, 1)
    const me       = new Date(y, m, 0)
    const as_      = new Date(a.start_date + 'T00:00:00')
    const ae       = new Date(a.end_date   + 'T00:00:00')
    const os       = new Date(Math.max(as_.getTime(), ms.getTime()))
    const oe       = new Date(Math.min(ae.getTime(),  me.getTime()))
    if (os > oe) return 0
    const overlapDays = countWorkingDays(os, oe)
    const totalDays   = countWorkingDays(ms, me)
    if (totalDays === 0) return 0
    return (overlapDays / totalDays) * a.allocation_percentage
  }

  /**
   * Whether a given allocation overlaps with a YYYY-MM month at all.
   */
  const allocOverlapsMonth = (a: Allocation, monthStr: string): boolean => {
    const [y, m] = monthStr.split('-').map(Number)
    const ms     = new Date(y, m - 1, 1)
    const me     = new Date(y, m, 0)
    const as_    = new Date(a.start_date + 'T00:00:00')
    const ae     = new Date(a.end_date   + 'T00:00:00')
    return as_ <= me && ae >= ms
  }

  /**
   * Utilisation summary for a person × month.
   * Returns all overlapping allocations + summed effective pct.
   */
  const utilizationForPersonMonth = (personId: string, month: string) => {
    const allocs  = s.allocations.filter(a => a.person_id === personId && allocOverlapsMonth(a, month))
    const totalPct = Math.round(allocs.reduce((sum, a) => sum + pctForAllocationInMonth(a, month), 0))
    const totalHours = allocs.reduce((sum, a) => sum + hoursForAllocationInMonth(a, month), 0)
    return { totalPct, totalHours, allocs }
  }

  /** Total spend (hours × rate) for one allocation across its full date range */
  const spendForAllocation = (a: Allocation): number => {
    const rate = rateForPerson(a.person_id)
    if (rate === 0) return 0
    // Iterate over every YYYY-MM the allocation spans
    const [sy, sm] = a.start_date.slice(0, 7).split('-').map(Number)
    const ae       = new Date(a.end_date + 'T00:00:00')
    let total = 0
    let y = sy, m = sm
    while (true) {
      const monthStr = `${y}-${String(m).padStart(2, '0')}`
      const ms       = new Date(y, m - 1, 1)
      if (ms > ae) break
      total += hoursForAllocationInMonth(a, monthStr) * rate
      m++; if (m > 12) { m = 1; y++ }
      if (y > 2100) break   // safety valve
    }
    return total
  }

  /** Spend for one allocation in a specific YYYY-MM month */
  const spendForAllocationInMonth = (a: Allocation, monthStr: string): number =>
    hoursForAllocationInMonth(a, monthStr) * rateForPerson(a.person_id)

  const confirmedSpendForProject = (projectId: string) =>
    s.allocations
      .filter(a => a.project_id === projectId && a.confirmed)
      .reduce((sum, a) => sum + spendForAllocation(a), 0)

  const totalSpendForProject = (projectId: string) =>
    s.allocations
      .filter(a => a.project_id === projectId)
      .reduce((sum, a) => sum + spendForAllocation(a), 0)

  /** List of YYYY-MM strings from start to end (inclusive) */
  const monthsBetween = (start: string, end: string): string[] => {
    const months: string[] = []
    let [y, m] = start.split('-').map(Number)
    const [ey, em] = end.split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++; if (m > 12) { m = 1; y++ }
    }
    return months
  }

  /** Working days in a full calendar month (compatibility shim for Spend/Util) */
  const workingDaysInMonth = (yyyyMM: string): number => {
    const [y, mo] = yyyyMM.split('-').map(Number)
    return countWorkingDays(new Date(y, mo - 1, 1), new Date(y, mo, 0))
  }

  return {
    customerById, roleById, personById, projectById,
    rateForPerson, workingDaysInMonth,
    countWorkingDays, hoursForAllocationInMonth, pctForAllocationInMonth,
    allocOverlapsMonth,
    spendForAllocation, spendForAllocationInMonth,
    confirmedSpendForProject, totalSpendForProject,
    monthsBetween, utilizationForPersonMonth,
  }
}
