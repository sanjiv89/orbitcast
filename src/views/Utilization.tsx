import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useStore, useDerived } from '../store'
import { currentMonthOffset } from '../lib/allocUtils'
// @ts-ignore
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG_BASE      = '#0D0D0F'
const BG_SURFACE   = '#141416'
const BG_ELEVATED  = '#1C1C1F'
const BORDER       = '#2A2A2E'
const ACCENT       = '#a3e635'
const CYAN         = '#22d3ee'
const AVAIL_COLOR  = '#a3a3a3'
const CHART_GRID   = '#262626'
const TOOLTIP_BG   = '#1a1a1a'
const TEXT_PRIMARY = '#e5e5e5'
const TEXT_SEC     = '#a3a3a3'
const TEXT_MUTED   = '#525252'
const GREEN        = '#4ADE80'
const RED          = '#f87171'
const VIOLET       = '#a78bfa'

const AVAILABLE_HOURS_PER_MONTH = 160

// Color palette for roles / departments (entities that have no assigned color)
const PALETTE = ['#a3e635','#22d3ee','#f97316','#a78bfa','#f43f5e','#14b8a6','#eab308','#6366f1','#ec4899','#84cc16']

// ── Types ─────────────────────────────────────────────────────────────────────
type Granularity = 'month' | 'quarter' | 'year'
type Tab         = 'people' | 'roles' | 'departments' | 'projects'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMonth(m: string) {
  return new Date(m + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
function fmtMonthShort(m: string) {
  return new Date(m + '-15').toLocaleDateString('en-US', { month: 'short' })
}
function fmtDateFull(d: Date) {
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getMonthsForOffset(granularity: Granularity, offset: number): string[] {
  if (granularity === 'month') {
    // 12 months per page = one full calendar year
    const startIdx = offset * 12
    return Array.from({ length: 12 }, (_, i) => {
      const total = startIdx + i
      const y = 2025 + Math.floor(total / 12)
      const m = ((total % 12) + 12) % 12 + 1
      return `${y}-${String(m).padStart(2, '0')}`
    })
  }
  if (granularity === 'quarter') {
    const year = 2025 + offset
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  }
  const baseYear = 2025 + offset * 3
  return Array.from({ length: 36 }, (_, i) => {
    const y = baseYear + Math.floor(i / 12)
    const m = (i % 12) + 1
    return `${y}-${String(m).padStart(2, '0')}`
  })
}

interface PeriodBucket { label: string; months: string[] }
function bucketByGranularity(months: string[], granularity: Granularity): PeriodBucket[] {
  if (granularity === 'month') return months.map(m => ({ label: fmtMonthShort(m), months: [m] }))
  if (granularity === 'quarter') return [
    { label: 'Q1', months: months.slice(0, 3) },
    { label: 'Q2', months: months.slice(3, 6) },
    { label: 'Q3', months: months.slice(6, 9) },
    { label: 'Q4', months: months.slice(9, 12) },
  ]
  const years: Record<string, string[]> = {}
  months.forEach(m => { const y = m.split('-')[0]; if (!years[y]) years[y] = []; years[y].push(m) })
  return Object.entries(years).map(([y, ms]) => ({ label: y, months: ms }))
}

function getPeriodLabel(months: string[], granularity: Granularity): string {
  if (!months.length) return ''
  const first = new Date(months[0] + '-01')
  const [ly, lm] = months[months.length - 1].split('-').map(Number)
  const last = new Date(ly, lm, 0)
  if (granularity === 'month')  return `${first.getFullYear()}`   // 12-month page = one year
  if (granularity === 'quarter') return `${first.getFullYear()}: Q1 – Q4`
  if (granularity === 'year') {
    const ys = first.getFullYear(), ye = last.getFullYear()
    return ys === ye ? `${ys}` : `${ys} – ${ye}`
  }
  return `${fmtDateFull(first)} – ${fmtDateFull(last)}`
}

function getPeriodOptions(granularity: Granularity, curOffset = 0): { label: string; offset: number }[] {
  if (granularity === 'month') {
    // Show 4 years around the current page — each offset = one calendar year
    return [curOffset - 1, curOffset, curOffset + 1, curOffset + 2]
      .map(o => ({ label: `${2025 + Math.max(0, o)}`, offset: Math.max(0, o) }))
  }
  if (granularity === 'quarter') return [-1, 0, 1].map(o => ({ label: `${2025 + o}`, offset: o }))
  return [-1, 0, 1].map(o => { const b = 2025 + o * 3; return { label: `${b} – ${b + 2}`, offset: o } })
}

function cellBg(pct: number) {
  if (pct >= 100) return 'rgba(248,113,113,0.12)'
  if (pct >= 80)  return 'rgba(251,191,36,0.08)'
  if (pct > 0)    return 'rgba(74,222,128,0.05)'
  return 'transparent'
}

// ── Shared table styles ───────────────────────────────────────────────────────
const TH: React.CSSProperties = { padding: '10px 12px', textAlign: 'left',  color: TEXT_SEC, whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: BG_SURFACE, borderBottom: `1px solid ${BORDER}` }
const TH_C: React.CSSProperties = { ...TH, textAlign: 'center' }
const TD: React.CSSProperties  = { padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'middle' }
const TD_C: React.CSSProperties = { ...TD, textAlign: 'center' }

function UtilCell({ allocated, available }: { allocated: number; available: number }) {
  const pct = available > 0 ? (allocated / available) * 100 : 0
  return (
    <td style={{ ...TD_C, background: cellBg(pct), minWidth: 90 }}>
      <div style={{ color: TEXT_PRIMARY, fontSize: 12, fontFamily: 'DM Mono, monospace' }}>
        {allocated.toFixed(0)}h / {available.toFixed(0)}h
      </div>
      <div style={{ color: TEXT_SEC, fontSize: 11, marginTop: 2 }}>{pct.toFixed(0)}%</div>
    </td>
  )
}

function AvgCell({ pct }: { pct: number }) {
  return (
    <td style={{ ...TD_C, background: 'rgba(255,255,255,0.03)', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: pct >= 100 ? RED : pct >= 70 ? GREEN : TEXT_PRIMARY }}>
      {pct.toFixed(0)}%
    </td>
  )
}

// ── CapacityTooltip ───────────────────────────────────────────────────────────
function CapacityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const cap    = payload.find((p: any) => p.dataKey === 'capacity')?.value ?? 0
  const booked = payload.find((p: any) => p.dataKey === 'booked')?.value ?? 0
  const util   = cap > 0 ? ((booked / cap) * 100).toFixed(1) : '0.0'
  const avail  = cap - booked
  return (
    <div style={{ background: TOOLTIP_BG, border: `1px solid ${Number(util) > 100 ? RED : CYAN}`, borderRadius: 10, padding: '12px 16px', fontSize: 12, minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
      <div style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 10, fontSize: 12 }}>{label}</div>
      {[{ color: ACCENT, label: 'Capacity', val: `${cap.toFixed(0)}h` }, { color: CYAN, label: 'Booked', val: `${booked.toFixed(0)}h` }, { color: AVAIL_COLOR, label: 'Available', val: `${Math.max(0, avail).toFixed(0)}h` }].map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 5 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT_SEC }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: 'inline-block' }} />
            {r.label}
          </span>
          <span style={{ color: r.color, fontFamily: 'monospace', fontWeight: 600 }}>{r.val}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
        <span style={{ color: TEXT_SEC }}>Utilization</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: Number(util) > 100 ? RED : Number(util) >= 70 ? ACCENT : CYAN }}>{util}%</span>
      </div>
    </div>
  )
}

// ── PeriodDropdown ────────────────────────────────────────────────────────────
function PeriodDropdown({ granularity, offset, onSelect }: { granularity: Granularity; offset: number; onSelect: (o: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = getPeriodOptions(granularity, offset)
  const current = getPeriodLabel(getMonthsForOffset(granularity, offset), granularity)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'transparent', border: '1px solid #404040', borderRadius: 7, padding: '6px 12px', color: '#e5e5e5', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        {current}<span style={{ color: TEXT_MUTED, fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: BG_ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 8, marginTop: 4, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
          {options.map(opt => (
            <button key={opt.offset} onClick={() => { onSelect(opt.offset); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: opt.offset === offset ? 'rgba(200,240,65,0.08)' : 'transparent', color: opt.offset === offset ? ACCENT : TEXT_SEC, fontFamily: 'DM Mono, monospace', fontSize: 12, border: 'none', cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}
              onMouseEnter={e => { if (opt.offset !== offset) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (opt.offset !== offset) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >{opt.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function Utilization() {
  const { people, roles, projects, customers, allocations } = useStore()
  const { utilizationForPersonMonth, hoursForAllocationInMonth, allocOverlapsMonth } = useDerived()

  const [granularity, setGranularity] = useState<Granularity>('month')
  const [offset, setOffset]           = useState(() => currentMonthOffset(12))
  const [tab, setTab]                 = useState<Tab>('people')

  const allMonths   = getMonthsForOffset(granularity, offset)
  const tableMonths = allMonths
  const buckets     = bucketByGranularity(allMonths, granularity)

  // ── Overview chart data ──────────────────────────────────────────────────
  const overviewChartData = useMemo(() => buckets.map(bucket => {
    const capacity = people.length * AVAILABLE_HOURS_PER_MONTH * bucket.months.length
    const booked   = bucket.months.reduce((t, month) =>
      t + people.reduce((s, p) => s + (utilizationForPersonMonth(p.id, month).totalPct / 100) * AVAILABLE_HOURS_PER_MONTH, 0), 0)
    return { label: bucket.label, capacity: Math.round(capacity), booked: Math.round(booked) }
  }), [buckets, people, utilizationForPersonMonth])

  const periodCapacity = overviewChartData.reduce((s, d) => s + d.capacity, 0)
  const periodBooked   = overviewChartData.reduce((s, d) => s + d.booked, 0)
  const periodAvail    = periodCapacity - periodBooked
  const periodUtil     = periodCapacity > 0 ? (periodBooked / periodCapacity) * 100 : 0

  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || 'Unknown'

  // ── Tab 1: People ────────────────────────────────────────────────────────
  const peopleData = useMemo(() => people.map(person => {
    const monthlyData: Record<string, { allocated: number; available: number; pct: number }> = {}
    let totalAllocated = 0
    tableMonths.forEach(month => {
      const allocated = (utilizationForPersonMonth(person.id, month).totalPct / 100) * AVAILABLE_HOURS_PER_MONTH
      const available = AVAILABLE_HOURS_PER_MONTH
      monthlyData[month] = { allocated, available, pct: (allocated / available) * 100 }
      totalAllocated += allocated
    })
    const avgPct = (totalAllocated / (AVAILABLE_HOURS_PER_MONTH * tableMonths.length)) * 100
    return { person, monthlyData, avgPct }
  }), [people, tableMonths, utilizationForPersonMonth])

  // ── Tab 2: Roles ─────────────────────────────────────────────────────────
  const rolesData = useMemo(() => {
    const uniqueRoleIds = [...new Set(people.map(p => p.role_id))]
    return uniqueRoleIds.map((roleId, idx) => {
      const role        = roles.find(r => r.id === roleId)
      const inRole      = people.filter(p => p.role_id === roleId)
      const monthlyData: Record<string, { allocated: number; available: number; pct: number }> = {}
      let totalAllocated = 0
      tableMonths.forEach(month => {
        const allocated = inRole.reduce((s, p) => s + (utilizationForPersonMonth(p.id, month).totalPct / 100) * AVAILABLE_HOURS_PER_MONTH, 0)
        const available = inRole.length * AVAILABLE_HOURS_PER_MONTH
        monthlyData[month] = { allocated, available, pct: available > 0 ? (allocated / available) * 100 : 0 }
        totalAllocated += allocated
      })
      const totalAvailable = inRole.length * AVAILABLE_HOURS_PER_MONTH * tableMonths.length
      return { label: role?.name ?? roleId, count: inRole.length, monthlyData, avgPct: totalAvailable > 0 ? (totalAllocated / totalAvailable) * 100 : 0, color: PALETTE[idx % PALETTE.length] }
    })
  }, [people, roles, tableMonths, utilizationForPersonMonth])

  // ── Tab 3: Departments ───────────────────────────────────────────────────
  const deptsData = useMemo(() => {
    const uniqueDepts = [...new Set(people.map(p => p.department))]
    return uniqueDepts.map((dept, idx) => {
      const inDept = people.filter(p => p.department === dept)
      const monthlyData: Record<string, { allocated: number; available: number; pct: number }> = {}
      let totalAllocated = 0
      tableMonths.forEach(month => {
        const allocated = inDept.reduce((s, p) => s + (utilizationForPersonMonth(p.id, month).totalPct / 100) * AVAILABLE_HOURS_PER_MONTH, 0)
        const available = inDept.length * AVAILABLE_HOURS_PER_MONTH
        monthlyData[month] = { allocated, available, pct: available > 0 ? (allocated / available) * 100 : 0 }
        totalAllocated += allocated
      })
      const totalAvailable = inDept.length * AVAILABLE_HOURS_PER_MONTH * tableMonths.length
      return { label: dept, count: inDept.length, monthlyData, avgPct: totalAvailable > 0 ? (totalAllocated / totalAvailable) * 100 : 0, color: PALETTE[(idx + 2) % PALETTE.length] }
    })
  }, [people, tableMonths, utilizationForPersonMonth])

  // ── Tab 4: Projects ──────────────────────────────────────────────────────
  const projectsData = useMemo(() => {
    return projects.map(project => {
      const customer = customers.find(c => c.id === project.customer_id)
      const monthlyHours: Record<string, number> = {}
      let total = 0
      tableMonths.forEach(month => {
        const hrs = allocations
          .filter(a => a.project_id === project.id && allocOverlapsMonth(a, month))
          .reduce((s, a) => s + hoursForAllocationInMonth(a, month), 0)
        monthlyHours[month] = hrs
        total += hrs
      })
      return { project, customer, monthlyHours, total }
    }).filter(g => g.total > 0)
  }, [projects, customers, allocations, tableMonths])

  // ── Bottom chart data (dynamic per tab) ──────────────────────────────────
  const bottomChartData = useMemo(() => {
    if (tab === 'people') {
      return tableMonths.map(month => {
        const row: Record<string, string | number> = { month: fmtMonth(month) }
        peopleData.forEach(({ person, monthlyData }) => {
          row[person.name] = parseFloat(monthlyData[month].pct.toFixed(1))
        })
        return row
      })
    }
    if (tab === 'roles') {
      return tableMonths.map(month => {
        const row: Record<string, string | number> = { month: fmtMonth(month) }
        rolesData.forEach(r => { row[r.label] = parseFloat(r.monthlyData[month].pct.toFixed(1)) })
        return row
      })
    }
    if (tab === 'departments') {
      return tableMonths.map(month => {
        const row: Record<string, string | number> = { month: fmtMonth(month) }
        deptsData.forEach(d => { row[d.label] = parseFloat(d.monthlyData[month].pct.toFixed(1)) })
        return row
      })
    }
    // projects
    return tableMonths.map(month => {
      const row: Record<string, string | number> = { month: fmtMonth(month) }
      projectsData.forEach(({ project, monthlyHours }) => { row[project.name] = parseFloat(monthlyHours[month].toFixed(1)) })
      return row
    })
  }, [tab, tableMonths, peopleData, rolesData, deptsData, projectsData])

  const bottomChartBars = useMemo(() => {
    if (tab === 'people')      return peopleData.map(d => ({ key: d.person.name,  color: d.person.avatar_color }))
    if (tab === 'roles')       return rolesData.map(d => ({ key: d.label,          color: d.color }))
    if (tab === 'departments') return deptsData.map(d => ({ key: d.label,          color: d.color }))
    return projectsData.map(d => ({ key: d.project.name, color: d.customer?.color ?? PALETTE[0] }))
  }, [tab, peopleData, rolesData, deptsData, projectsData])

  // ── Team totals row for People tab ──────────────────────────────────────
  const teamMonthlyTotals = useMemo(() => tableMonths.map(month => {
    const allocated = peopleData.reduce((s, d) => s + d.monthlyData[month].allocated, 0)
    const available = people.length * AVAILABLE_HOURS_PER_MONTH
    return { month, pct: available > 0 ? (allocated / available) * 100 : 0 }
  }), [peopleData, tableMonths, people])

  const overallTeamAvg = teamMonthlyTotals.reduce((s, m) => s + m.pct, 0) / (teamMonthlyTotals.length || 1)

  // ── Project totals row ───────────────────────────────────────────────────
  const projectMonthTotals = useMemo(() => tableMonths.map(month =>
    projectsData.reduce((s, d) => s + d.monthlyHours[month], 0)
  ), [projectsData, tableMonths])

  return (
    <div style={{ padding: '24px' }}>

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <h2 style={{ color: TEXT_PRIMARY, fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, margin: 0 }}>Utilization</h2>
        <span style={{ color: TEXT_MUTED, fontSize: 12 }}>Company-wide capacity overview</span>
      </div>

      {/* ── Timeframe nav ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG_SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px 10px 0 0', padding: '12px 16px', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[{ dir: -1, icon: '‹' }, { dir: 1, icon: '›' }].map(({ dir, icon }) => (
            <button key={icon} onClick={() => setOffset(o => o + dir)}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', color: '#737373', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color='#e5e5e5'; b.style.borderColor='#555' }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color='#737373'; b.style.borderColor='#333' }}
            >{icon}</button>
          ))}
          <PeriodDropdown granularity={granularity} offset={offset} onSelect={setOffset} />
          <button onClick={() => setOffset(currentMonthOffset(granularity === 'quarter' ? 12 : granularity === 'year' ? 36 : 12))}
            style={{ background: 'transparent', border: '1px solid #333', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#525252', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color='#e5e5e5'; b.style.borderColor='#555' }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color='#525252'; b.style.borderColor='#333' }}
          >Today</button>
        </div>
        <div style={{ display: 'flex', background: '#111', border: '1px solid #2a2a2a', borderRadius: 7, padding: 2 }}>
          {(['month', 'quarter', 'year'] as const).map(g => (
            <button key={g} onClick={() => { setGranularity(g); setOffset(currentMonthOffset(g === 'quarter' ? 12 : g === 'year' ? 36 : 12)) }}
              style={{ background: granularity === g ? ACCENT : '#262626', border: 'none', borderRadius: 5, padding: '5px 14px', cursor: 'pointer', color: granularity === g ? '#0a0a0a' : '#737373', fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: granularity === g ? 700 : 500, transition: 'all 0.12s', textTransform: 'capitalize' }}
            >{g === 'month' ? 'Months' : g === 'quarter' ? 'Quarters' : 'Year'}</button>
          ))}
        </div>
      </div>

      {/* ── Overview bar chart ────────────────────────────────────────────── */}
      <div style={{ background: BG_SURFACE, border: `1px solid ${BORDER}`, borderTop: 'none', borderBottom: 'none', padding: '20px 16px 8px' }}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, paddingLeft: 4 }}>
          {[{ color: ACCENT, label: 'Total Capacity' }, { color: CYAN, label: 'Hours Booked' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ color: TEXT_SEC, fontSize: 12 }}>{label}</span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={overviewChartData.map(d => ({ ...d, month: d.label }))} barGap={4} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="0" />
            <XAxis dataKey="month" tick={{ fill: '#737373', fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#737373', fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}h`} width={48} />
            <Tooltip content={<CapacityTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="capacity" name="Total Capacity" fill={ACCENT} fillOpacity={0.30} radius={[3,3,0,0]} />
            <Bar dataKey="booked"   name="Hours Booked"   fill={CYAN}   fillOpacity={0.90} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Summary stat cards ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: BG_SURFACE, border: `1px solid ${BORDER}`, borderTop: `1px solid ${BORDER}`, borderRadius: '0 0 10px 10px' }}>
        {[
          { label: 'Total Capacity', value: `${periodCapacity.toLocaleString()}h`, sub: `${people.length} people · ${allMonths.length} month${allMonths.length !== 1 ? 's' : ''}`, valueColor: '#e5e5e5', borderColor: ACCENT },
          { label: 'Hours Booked',   value: `${periodBooked.toLocaleString()}h`,   sub: `${periodUtil.toFixed(1)}% utilization`,                                                      valueColor: '#e5e5e5', borderColor: CYAN  },
          { label: 'Hours Available',value: `${Math.max(0, periodAvail).toLocaleString()}h`, sub: `${Math.max(0, 100 - periodUtil).toFixed(1)}% remaining`,                            valueColor: periodAvail < 0 ? RED : '#e5e5e5', borderColor: periodAvail < 0 ? RED : '#404040' },
        ].map((card, i, arr) => (
          <div key={card.label} style={{ padding: '16px 20px', borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none', borderLeft: `3px solid ${card.borderColor}`, borderRadius: i === 0 ? '0 0 0 10px' : i === arr.length - 1 ? '0 0 10px 0' : '0' }}>
            <div style={{ color: '#525252', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 5 }}>{card.label}</div>
            <div style={{ color: card.valueColor, fontSize: 22, fontFamily: 'DM Mono, monospace', fontWeight: 600, lineHeight: 1.2 }}>{card.value}</div>
            <div style={{ color: '#525252', fontSize: 11, marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  TABBED BREAKDOWN                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, marginTop: 32, borderBottom: `1px solid ${CHART_GRID}` }}>
        {(['people', 'roles', 'departments', 'projects'] as const).map(t => {
          const active = tab === t
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '8px 20px 10px',
                fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? ACCENT : '#525252',
                borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                marginBottom: -1,
                textTransform: 'capitalize',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#a3a3a3' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#525252' }}
            >
              {t}
              {t === 'people'      && <span style={{ marginLeft: 6, fontSize: 10, color: active ? ACCENT : '#3a3a3a', background: active ? 'rgba(163,230,53,0.12)' : '#1a1a1a', padding: '1px 6px', borderRadius: 99 }}>{people.length}</span>}
              {t === 'roles'       && <span style={{ marginLeft: 6, fontSize: 10, color: active ? ACCENT : '#3a3a3a', background: active ? 'rgba(163,230,53,0.12)' : '#1a1a1a', padding: '1px 6px', borderRadius: 99 }}>{rolesData.length}</span>}
              {t === 'departments' && <span style={{ marginLeft: 6, fontSize: 10, color: active ? ACCENT : '#3a3a3a', background: active ? 'rgba(163,230,53,0.12)' : '#1a1a1a', padding: '1px 6px', borderRadius: 99 }}>{deptsData.length}</span>}
              {t === 'projects'    && <span style={{ marginLeft: 6, fontSize: 10, color: active ? ACCENT : '#3a3a3a', background: active ? 'rgba(163,230,53,0.12)' : '#1a1a1a', padding: '1px 6px', borderRadius: 99 }}>{projectsData.length}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Tab: People ───────────────────────────────────────────────────── */}
      {tab === 'people' && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead><tr>
              <th style={TH}>Person</th>
              <th style={TH}>Department</th>
              <th style={TH}>Role</th>
              {tableMonths.map(m => <th key={m} style={TH_C}>{fmtMonth(m)}</th>)}
              <th style={TH_C}>Avg</th>
            </tr></thead>
            <tbody>
              {peopleData.map(({ person, monthlyData, avgPct }) => (
                <tr key={person.id}>
                  <td style={{ ...TD, color: TEXT_PRIMARY, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: person.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#0a0a0a', flexShrink: 0 }}>
                        {person.name.charAt(0)}
                      </div>
                      {person.name}
                    </div>
                  </td>
                  <td style={TD}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(163,230,53,0.08)', color: '#7aaa24', whiteSpace: 'nowrap' }}>{person.department}</span></td>
                  <td style={{ ...TD, color: TEXT_SEC, whiteSpace: 'nowrap' }}>{getRoleName(person.role_id)}</td>
                  {tableMonths.map(m => <UtilCell key={m} allocated={monthlyData[m].allocated} available={monthlyData[m].available} />)}
                  <AvgCell pct={avgPct} />
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: BG_SURFACE, borderTop: `2px solid ${BORDER}` }}>
              <tr>
                <th style={{ ...TH, color: TEXT_PRIMARY, fontSize: 12 }} colSpan={3}>Team Average</th>
                {teamMonthlyTotals.map(({ month, pct }) => (
                  <th key={month} style={{ ...TH_C, color: pct >= 100 ? RED : pct >= 70 ? GREEN : TEXT_PRIMARY, fontFamily: 'DM Mono, monospace' }}>{pct.toFixed(0)}%</th>
                ))}
                <th style={{ ...TH_C, color: overallTeamAvg >= 100 ? RED : overallTeamAvg >= 70 ? GREEN : TEXT_PRIMARY, fontFamily: 'DM Mono, monospace' }}>{overallTeamAvg.toFixed(0)}%</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Tab: Roles ────────────────────────────────────────────────────── */}
      {tab === 'roles' && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead><tr>
              <th style={TH}>Role</th>
              <th style={{ ...TH, textAlign: 'center' }}>People</th>
              {tableMonths.map(m => <th key={m} style={TH_C}>{fmtMonth(m)}</th>)}
              <th style={TH_C}>Avg</th>
            </tr></thead>
            <tbody>
              {rolesData.map(row => (
                <tr key={row.label}>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
                      <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{row.label}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, textAlign: 'center', color: TEXT_SEC }}>{row.count}</td>
                  {tableMonths.map(m => <UtilCell key={m} allocated={row.monthlyData[m].allocated} available={row.monthlyData[m].available} />)}
                  <AvgCell pct={row.avgPct} />
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: BG_SURFACE, borderTop: `2px solid ${BORDER}` }}>
              <tr>
                <th style={{ ...TH, color: TEXT_PRIMARY, fontSize: 12 }}>All Roles</th>
                <th style={{ ...TH_C, color: TEXT_SEC, fontFamily: 'DM Mono, monospace' }}>{people.length}</th>
                {tableMonths.map(m => {
                  const alloc = rolesData.reduce((s, r) => s + r.monthlyData[m].allocated, 0)
                  const avail = people.length * AVAILABLE_HOURS_PER_MONTH
                  const pct   = avail > 0 ? (alloc / avail) * 100 : 0
                  return <th key={m} style={{ ...TH_C, color: pct >= 100 ? RED : pct >= 70 ? GREEN : TEXT_PRIMARY, fontFamily: 'DM Mono, monospace' }}>{pct.toFixed(0)}%</th>
                })}
                <th style={{ ...TH_C, color: TEXT_PRIMARY, fontFamily: 'DM Mono, monospace' }}>
                  {(rolesData.reduce((s, r) => s + r.avgPct, 0) / (rolesData.length || 1)).toFixed(0)}%
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Tab: Departments ──────────────────────────────────────────────── */}
      {tab === 'departments' && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead><tr>
              <th style={TH}>Department</th>
              <th style={{ ...TH, textAlign: 'center' }}>People</th>
              {tableMonths.map(m => <th key={m} style={TH_C}>{fmtMonth(m)}</th>)}
              <th style={TH_C}>Avg</th>
            </tr></thead>
            <tbody>
              {deptsData.map(row => (
                <tr key={row.label}>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
                      <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{row.label}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, textAlign: 'center', color: TEXT_SEC }}>{row.count}</td>
                  {tableMonths.map(m => <UtilCell key={m} allocated={row.monthlyData[m].allocated} available={row.monthlyData[m].available} />)}
                  <AvgCell pct={row.avgPct} />
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: BG_SURFACE, borderTop: `2px solid ${BORDER}` }}>
              <tr>
                <th style={{ ...TH, color: TEXT_PRIMARY, fontSize: 12 }}>All Departments</th>
                <th style={{ ...TH_C, color: TEXT_SEC, fontFamily: 'DM Mono, monospace' }}>{people.length}</th>
                {tableMonths.map(m => {
                  const alloc = deptsData.reduce((s, d) => s + d.monthlyData[m].allocated, 0)
                  const avail = people.length * AVAILABLE_HOURS_PER_MONTH
                  const pct   = avail > 0 ? (alloc / avail) * 100 : 0
                  return <th key={m} style={{ ...TH_C, color: pct >= 100 ? RED : pct >= 70 ? GREEN : TEXT_PRIMARY, fontFamily: 'DM Mono, monospace' }}>{pct.toFixed(0)}%</th>
                })}
                <th style={{ ...TH_C, color: TEXT_PRIMARY, fontFamily: 'DM Mono, monospace' }}>
                  {(deptsData.reduce((s, d) => s + d.avgPct, 0) / (deptsData.length || 1)).toFixed(0)}%
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Tab: Projects ─────────────────────────────────────────────────── */}
      {tab === 'projects' && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead><tr>
              <th style={TH}>Project</th>
              <th style={TH}>Customer</th>
              {tableMonths.map(m => <th key={m} style={TH_C}>{fmtMonth(m)}</th>)}
              <th style={TH_C}>Total</th>
            </tr></thead>
            <tbody>
              {projectsData.map(({ project, customer, monthlyHours, total }) => (
                <tr key={project.id}>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: customer?.color ?? '#555', flexShrink: 0 }} />
                      <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{project.name}</span>
                      {project.status === 'tentative' && <span style={{ fontSize: 10, color: '#737373', border: '1px dashed #3a3a3a', borderRadius: 4, padding: '1px 5px' }}>tentative</span>}
                    </div>
                  </td>
                  <td style={{ ...TD, color: TEXT_SEC, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: customer?.color ?? '#555' }} />
                      {customer?.name ?? '—'}
                    </div>
                  </td>
                  {tableMonths.map(m => (
                    <td key={m} style={{ ...TD_C, minWidth: 80, fontFamily: 'DM Mono, monospace', color: monthlyHours[m] > 0 ? TEXT_PRIMARY : TEXT_MUTED }}>
                      {monthlyHours[m] > 0 ? `${monthlyHours[m].toFixed(0)}h` : '—'}
                    </td>
                  ))}
                  <td style={{ ...TD_C, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: ACCENT, background: 'rgba(163,230,53,0.05)' }}>
                    {total.toFixed(0)}h
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: BG_SURFACE, borderTop: `2px solid ${BORDER}` }}>
              <tr>
                <th style={{ ...TH, color: TEXT_PRIMARY, fontSize: 12 }} colSpan={2}>All Projects</th>
                {projectMonthTotals.map((total, i) => (
                  <th key={i} style={{ ...TH_C, fontFamily: 'DM Mono, monospace', color: total > 0 ? TEXT_PRIMARY : TEXT_MUTED }}>{total > 0 ? `${total.toFixed(0)}h` : '—'}</th>
                ))}
                <th style={{ ...TH_C, fontFamily: 'DM Mono, monospace', color: ACCENT }}>
                  {projectsData.reduce((s, d) => s + d.total, 0).toFixed(0)}h
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Bottom bar chart (dynamic) ─────────────────────────────────────── */}
      <div style={{ marginTop: 32, marginBottom: 8, color: TEXT_MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
        {tab === 'people' ? 'Utilization by Person' : tab === 'roles' ? 'Utilization by Role' : tab === 'departments' ? 'Utilization by Department' : 'Hours Booked by Project'}
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bottomChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="month" stroke={TEXT_SEC} tick={{ fill: TEXT_SEC, fontSize: 11 }} />
            <YAxis stroke={TEXT_SEC} tick={{ fill: TEXT_SEC, fontSize: 11 }} tickFormatter={v => tab === 'projects' ? `${v}h` : `${v}%`} />
            <Tooltip contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY, fontSize: 12, borderRadius: 8 }} itemStyle={{ color: TEXT_PRIMARY }} labelStyle={{ color: TEXT_SEC }} />
            <Legend wrapperStyle={{ color: TEXT_PRIMARY, paddingTop: 8, fontSize: 12 }} />
            {bottomChartBars.map(({ key, color }) => (
              <Bar key={key} dataKey={key} fill={color} radius={[2,2,0,0]} fillOpacity={0.85} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
