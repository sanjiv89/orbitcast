import React, { useState, useRef, useEffect } from 'react'
import { useStore, useDerived } from '../store'
// @ts-ignore
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// ── Design tokens (matches existing views) ────────────────────────────────────
const BG_BASE      = '#0D0D0F'
const BG_SURFACE   = '#141416'
const BG_ELEVATED  = '#1C1C1F'
const BORDER       = '#2A2A2E'
const ACCENT       = '#a3e635'   // vivid lime — capacity bar + brand accent
const CYAN         = '#22d3ee'   // vivid cyan — booked bar
const AVAIL_COLOR  = '#a3a3a3'   // neutral grey — available stat
const CHART_GRID   = '#262626'   // subtle grid lines
const TOOLTIP_BG   = '#1a1a1a'   // deep dark tooltip
const TEXT_PRIMARY = '#e5e5e5'
const TEXT_SEC     = '#a3a3a3'
const TEXT_MUTED   = '#525252'
const GREEN        = '#4ADE80'
const AMBER        = '#FBBF24'
const RED          = '#f87171'
// Keep VIOLET alias so the existing per-person chart (avatar_color) is unaffected
const VIOLET       = '#a78bfa'

const AVAILABLE_HOURS_PER_MONTH = 160

// ── Helpers ───────────────────────────────────────────────────────────────────

type Granularity = 'month' | 'quarter' | 'year'

function fmtMonth(m: string) {
  return new Date(m + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function fmtMonthShort(m: string) {
  return new Date(m + '-15').toLocaleDateString('en-US', { month: 'short' })
}

function fmtDateFull(d: Date) {
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Returns YYYY-MM strings for the active period
function getMonthsForOffset(granularity: Granularity, offset: number): string[] {
  if (granularity === 'month') {
    // 6-month windows starting from Jan 2025
    const base = { year: 2025, month: 0 } // Jan 2025 = index 0
    const startIdx = offset * 6
    return Array.from({ length: 6 }, (_, i) => {
      const totalMonths = base.month + startIdx + i
      const y = base.year + Math.floor(totalMonths / 12)
      const m = ((totalMonths % 12) + 12) % 12 + 1
      return `${y}-${String(m).padStart(2, '0')}`
    })
  }
  if (granularity === 'quarter') {
    const year = 2025 + offset
    return Array.from({ length: 12 }, (_, i) =>
      `${year}-${String(i + 1).padStart(2, '0')}`)
  }
  // year: show a 3-year window
  const baseYear = 2025 + offset * 3
  return Array.from({ length: 36 }, (_, i) => {
    const y = baseYear + Math.floor(i / 12)
    const m = (i % 12) + 1
    return `${y}-${String(m).padStart(2, '0')}`
  })
}

interface PeriodBucket { label: string; months: string[] }

function bucketByGranularity(months: string[], granularity: Granularity): PeriodBucket[] {
  if (granularity === 'month') {
    return months.map(m => ({ label: fmtMonthShort(m), months: [m] }))
  }
  if (granularity === 'quarter') {
    return [
      { label: 'Q1', months: months.slice(0, 3) },
      { label: 'Q2', months: months.slice(3, 6) },
      { label: 'Q3', months: months.slice(6, 9) },
      { label: 'Q4', months: months.slice(9, 12) },
    ]
  }
  // year: one bar per year
  const years: Record<string, string[]> = {}
  months.forEach(m => {
    const y = m.split('-')[0]
    if (!years[y]) years[y] = []
    years[y].push(m)
  })
  return Object.entries(years).map(([y, ms]) => ({ label: y, months: ms }))
}

function getPeriodLabel(months: string[], granularity: Granularity): string {
  if (!months.length) return ''
  const first = new Date(months[0] + '-01')
  const lastStr = months[months.length - 1]
  const [ly, lm] = lastStr.split('-').map(Number)
  const last = new Date(ly, lm, 0) // last day of last month

  if (granularity === 'quarter') {
    return `${first.getFullYear()}: Q1 – Q4`
  }
  if (granularity === 'year') {
    const ys = first.getFullYear()
    const ye = last.getFullYear()
    return ys === ye ? `${ys}` : `${ys} – ${ye}`
  }
  return `${fmtDateFull(first)} – ${fmtDateFull(last)}`
}

function getPeriodOptions(granularity: Granularity): { label: string; offset: number }[] {
  if (granularity === 'month') {
    return [-1, 0, 1, 2].map(o => {
      const ms = getMonthsForOffset('month', o)
      return { label: getPeriodLabel(ms, 'month'), offset: o }
    })
  }
  if (granularity === 'quarter') {
    return [-1, 0, 1].map(o => ({
      label: `${2025 + o}`,
      offset: o,
    }))
  }
  return [-1, 0, 1].map(o => {
    const base = 2025 + o * 3
    return { label: `${base} – ${base + 2}`, offset: o }
  })
}

function cellBg(pct: number) {
  if (pct >= 100) return `rgba(248,113,113,0.12)`
  if (pct >= 80)  return `rgba(251,191,36,0.08)`
  if (pct > 0)    return `rgba(74,222,128,0.05)`
  return 'transparent'
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────

function CapacityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const cap   = payload.find((p: any) => p.dataKey === 'capacity')?.value ?? 0
  const booked= payload.find((p: any) => p.dataKey === 'booked')?.value ?? 0
  const util  = cap > 0 ? ((booked / cap) * 100).toFixed(1) : '0.0'
  const avail = cap - booked

  return (
    <div style={{
      background: TOOLTIP_BG,
      border: `1px solid ${Number(util) > 100 ? RED : CYAN}`,
      borderRadius: 10, padding: '12px 16px', fontSize: 12, minWidth: 190,
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    }}>
      <div style={{ color: '#ffffff', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 10, fontSize: 12, letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 5 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT_SEC }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: ACCENT, display: 'inline-block' }} />
          Capacity
        </span>
        <span style={{ color: ACCENT, fontFamily: 'monospace', fontWeight: 600 }}>{cap.toFixed(0)}h</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 5 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT_SEC }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: CYAN, display: 'inline-block' }} />
          Booked
        </span>
        <span style={{ color: CYAN, fontFamily: 'monospace', fontWeight: 600 }}>{booked.toFixed(0)}h</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT_SEC }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: AVAIL_COLOR, display: 'inline-block' }} />
          Available
        </span>
        <span style={{ color: '#e5e5e5', fontFamily: 'monospace' }}>{Math.max(0, avail).toFixed(0)}h</span>
      </div>
      <div style={{
        borderTop: `1px solid #2a2a2a`, paddingTop: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: TEXT_SEC }}>Utilization</span>
        <span style={{
          fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
          color: Number(util) > 100 ? RED : Number(util) >= 70 ? ACCENT : CYAN,
        }}>
          {util}%
        </span>
      </div>
    </div>
  )
}

// ── Period dropdown ───────────────────────────────────────────────────────────

function PeriodDropdown({
  granularity, offset, onSelect,
}: { granularity: Granularity; offset: number; onSelect: (o: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = getPeriodOptions(granularity)
  const months  = getMonthsForOffset(granularity, offset)
  const current = getPeriodLabel(months, granularity)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'transparent', border: '1px solid #404040',
          borderRadius: 7, padding: '6px 12px',
          color: '#e5e5e5', fontFamily: 'Syne, sans-serif',
          fontWeight: 600, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {current}
        <span style={{ color: TEXT_MUTED, fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          background: BG_ELEVATED, border: `1px solid ${BORDER}`,
          borderRadius: 8, marginTop: 4, minWidth: 220,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          {options.map(opt => (
            <button
              key={opt.offset}
              onClick={() => { onSelect(opt.offset); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', background: opt.offset === offset ? `rgba(200,240,65,0.08)` : 'transparent',
                color: opt.offset === offset ? ACCENT : TEXT_SEC,
                fontFamily: 'DM Mono, monospace', fontSize: 12,
                border: 'none', cursor: 'pointer',
                borderBottom: `1px solid ${BORDER}`,
              }}
              onMouseEnter={e => { if (opt.offset !== offset) (e.currentTarget as HTMLElement).style.background = `rgba(255,255,255,0.04)` }}
              onMouseLeave={e => { if (opt.offset !== offset) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function Utilization() {
  const { people, roles, allocations } = useStore()
  const { utilizationForPersonMonth }  = useDerived()

  // ── Timeframe state
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [offset, setOffset]           = useState(0)

  // Recompute months whenever granularity / offset changes
  const allMonths = getMonthsForOffset(granularity, offset)

  // For the per-person table, always show individual months
  const tableMonths = granularity === 'month' ? allMonths : allMonths

  // ── Company-wide chart data
  const buckets = bucketByGranularity(allMonths, granularity)

  const chartData = buckets.map(bucket => {
    const capacity = people.length * AVAILABLE_HOURS_PER_MONTH * bucket.months.length
    const booked   = bucket.months.reduce((total, month) => {
      return total + people.reduce((pSum, person) => {
        const { totalPct } = utilizationForPersonMonth(person.id, month)
        return pSum + (totalPct / 100) * AVAILABLE_HOURS_PER_MONTH
      }, 0)
    }, 0)
    return { label: bucket.label, capacity: Math.round(capacity), booked: Math.round(booked) }
  })

  // ── Period summary stats
  const periodCapacity = chartData.reduce((s, d) => s + d.capacity, 0)
  const periodBooked   = chartData.reduce((s, d) => s + d.booked, 0)
  const periodAvail    = periodCapacity - periodBooked
  const periodUtil     = periodCapacity > 0 ? (periodBooked / periodCapacity) * 100 : 0

  // ── Per-person table (existing logic, now dynamic)
  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || 'Unknown'

  const personMonthlyUtilization = people.map(person => {
    const monthlyData: Record<string, { allocatedHours: number; utilizationPct: number }> = {}
    let totalAllocatedHours = 0
    tableMonths.forEach(month => {
      const { totalPct } = utilizationForPersonMonth(person.id, month)
      const allocatedHours  = (totalPct / 100) * AVAILABLE_HOURS_PER_MONTH
      const utilizationPct  = (allocatedHours / AVAILABLE_HOURS_PER_MONTH) * 100
      monthlyData[month]    = { allocatedHours, utilizationPct }
      totalAllocatedHours  += allocatedHours
    })
    const avgUtilizationPct = (totalAllocatedHours / (AVAILABLE_HOURS_PER_MONTH * tableMonths.length)) * 100
    return { person, monthlyData, avgUtilizationPct }
  })

  const teamAverageMonthly = tableMonths.map(month => {
    const totalAllocated = personMonthlyUtilization.reduce((s, { monthlyData }) =>
      s + monthlyData[month].allocatedHours, 0)
    const totalAvailable = people.length * AVAILABLE_HOURS_PER_MONTH
    return { month, teamUtilizationPct: (totalAllocated / totalAvailable) * 100 }
  })

  const overallTeamAverage = teamAverageMonthly.reduce((s, m) => s + m.teamUtilizationPct, 0) / tableMonths.length

  // Per-person stacked chart (existing)
  const stackedChartData = tableMonths.map(month => {
    const row: { month: string; [k: string]: string | number } = { month: fmtMonth(month) }
    personMonthlyUtilization.forEach(({ person, monthlyData }) => {
      row[person.name] = parseFloat(monthlyData[month].utilizationPct.toFixed(1))
    })
    return row
  })

  return (
    <div style={{ padding: '24px' }}>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  COMPANY-WIDE CAPACITY OVERVIEW                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
        <h2 style={{ color: TEXT_PRIMARY, fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, margin: 0 }}>
          Utilization
        </h2>
        <span style={{ color: TEXT_MUTED, fontSize: 12 }}>Company-wide capacity overview</span>
      </div>

      {/* ── Timeframe navigation bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: BG_SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: '10px 10px 0 0', padding: '12px 16px',
        borderBottom: 'none',
      }}>
        {/* Prev / label / Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setOffset(o => o - 1)}
            style={{
              background: '#1a1a1a', border: '1px solid #333333',
              borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
              color: '#737373', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e5e5e5'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#737373'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#333333' }}
          >‹</button>

          <PeriodDropdown granularity={granularity} offset={offset} onSelect={setOffset} />

          <button
            onClick={() => setOffset(o => o + 1)}
            style={{
              background: '#1a1a1a', border: '1px solid #333333',
              borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
              color: '#737373', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e5e5e5'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#737373'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#333333' }}
          >›</button>

          <button
            onClick={() => setOffset(0)}
            style={{
              background: 'transparent', border: '1px solid #333333',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              color: '#525252', fontSize: 11, fontFamily: 'DM Mono, monospace',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e5e5e5'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#525252'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#333333' }}
          >Today</button>
        </div>

        {/* Granularity segmented toggle */}
        <div style={{
          display: 'flex', background: '#111111',
          border: '1px solid #2a2a2a', borderRadius: 7, padding: 2,
        }}>
          {(['month', 'quarter', 'year'] as const).map(g => (
            <button
              key={g}
              onClick={() => { setGranularity(g); setOffset(0) }}
              style={{
                background: granularity === g ? ACCENT : '#262626',
                border: 'none', borderRadius: 5,
                padding: '5px 14px', cursor: 'pointer',
                color: granularity === g ? '#0a0a0a' : '#737373',
                fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: granularity === g ? 700 : 500,
                transition: 'all 0.12s',
                textTransform: 'capitalize',
              }}
            >
              {g === 'month' ? 'Months' : g === 'quarter' ? 'Quarters' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grouped bar chart ─────────────────────────────────────────────── */}
      <div style={{
        background: BG_SURFACE, border: `1px solid ${BORDER}`,
        borderTop: 'none', borderBottom: 'none',
        padding: '20px 16px 8px',
      }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, paddingLeft: 4 }}>
          {[
            { color: ACCENT, label: 'Total Capacity' },
            { color: CYAN,   label: 'Hours Booked'   },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ color: TEXT_SEC, fontSize: 12 }}>{label}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData.map(d => ({ ...d, month: d.label }))} barGap={4} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="0" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#737373', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fill: '#737373', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}h`}
              width={48}
            />
            <Tooltip content={<CapacityTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="capacity" name="Total Capacity" fill={ACCENT} fillOpacity={0.30} radius={[3,3,0,0]} />
            <Bar dataKey="booked"   name="Hours Booked"   fill={CYAN}   fillOpacity={0.90} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Summary stats row ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: BG_SURFACE, border: `1px solid ${BORDER}`,
        borderTop: `1px solid ${BORDER}`, borderRadius: '0 0 10px 10px',
      }}>
        {[
          {
            label:       'Total Capacity',
            value:       `${periodCapacity.toLocaleString()}h`,
            sub:         `${people.length} people · ${allMonths.length} month${allMonths.length !== 1 ? 's' : ''}`,
            valueColor:  '#e5e5e5',
            borderColor: ACCENT,
          },
          {
            label:       'Hours Booked',
            value:       `${periodBooked.toLocaleString()}h`,
            sub:         `${periodUtil.toFixed(1)}% utilization`,
            valueColor:  '#e5e5e5',
            borderColor: CYAN,
          },
          {
            label:       'Hours Available',
            value:       `${Math.max(0, periodAvail).toLocaleString()}h`,
            sub:         `${Math.max(0, 100 - periodUtil).toFixed(1)}% remaining`,
            valueColor:  periodAvail < 0 ? RED : '#e5e5e5',
            borderColor: periodAvail < 0 ? RED : '#404040',
          },
        ].map((card, i, arr) => (
          <div
            key={card.label}
            style={{
              padding: '16px 20px',
              borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
              borderLeft: `3px solid ${card.borderColor}`,
              // first card: left border is also the outer border-radius boundary
              borderRadius: i === 0 ? '0 0 0 10px' : i === arr.length - 1 ? '0 0 10px 0' : '0',
            }}
          >
            <div style={{ color: '#525252', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 5 }}>
              {card.label}
            </div>
            <div style={{ color: card.valueColor, fontSize: 22, fontFamily: 'DM Mono, monospace', fontWeight: 600, lineHeight: 1.2 }}>
              {card.value}
            </div>
            <div style={{ color: '#525252', fontSize: 11, marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/*  EXISTING: per-person table + stacked chart (unchanged logic)      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <div style={{ marginTop: 32, color: TEXT_MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Syne, sans-serif', fontWeight: 600, marginBottom: 12 }}>
        Individual Breakdown
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead style={{ background: BG_SURFACE }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC, whiteSpace: 'nowrap' }}>Person</th>
              <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC, whiteSpace: 'nowrap' }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC, whiteSpace: 'nowrap' }}>Role</th>
              {tableMonths.map(month => (
                <th key={month} style={{ padding: '12px', textAlign: 'center', color: TEXT_SEC, whiteSpace: 'nowrap', minWidth: 90 }}>
                  {fmtMonth(month)}
                </th>
              ))}
              <th style={{ padding: '12px', textAlign: 'center', color: TEXT_SEC, whiteSpace: 'nowrap' }}>Avg</th>
            </tr>
          </thead>
          <tbody>
            {personMonthlyUtilization.map(({ person, monthlyData, avgUtilizationPct }) => (
              <tr key={person.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: '12px', color: TEXT_PRIMARY, fontWeight: 500, whiteSpace: 'nowrap' }}>{person.name}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(200,240,65,0.08)', color: '#A8D030', whiteSpace: 'nowrap' }}>
                    {person.department}
                  </span>
                </td>
                <td style={{ padding: '12px', color: TEXT_SEC, whiteSpace: 'nowrap' }}>{getRoleName(person.role_id)}</td>
                {tableMonths.map(month => {
                  const { allocatedHours, utilizationPct } = monthlyData[month]
                  return (
                    <td key={month} style={{ padding: '8px 12px', textAlign: 'center', background: cellBg(utilizationPct), minWidth: 90 }}>
                      <div style={{ color: TEXT_PRIMARY, fontSize: 13 }}>{allocatedHours.toFixed(0)}h / 160h</div>
                      <div style={{ color: TEXT_SEC, fontSize: 11, marginTop: 3 }}>{utilizationPct.toFixed(0)}%</div>
                    </td>
                  )
                })}
                <td style={{ padding: '8px 12px', textAlign: 'center', color: TEXT_PRIMARY, background: 'rgba(255,255,255,0.04)' }}>
                  {avgUtilizationPct.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot style={{ background: BG_SURFACE, borderTop: `2px solid ${BORDER}` }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', color: TEXT_PRIMARY }}>Team Average</th>
              <th style={{ padding: '12px' }} />
              <th style={{ padding: '12px' }} />
              {teamAverageMonthly.map(({ month, teamUtilizationPct }) => (
                <th key={month} style={{ padding: '12px', textAlign: 'center', color: TEXT_PRIMARY }}>
                  {teamUtilizationPct.toFixed(0)}%
                </th>
              ))}
              <th style={{ padding: '12px', textAlign: 'center', color: TEXT_PRIMARY }}>
                {overallTeamAverage.toFixed(0)}%
              </th>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Stacked per-person bar chart (existing) */}
      <div style={{ marginTop: 32, marginBottom: 8, color: TEXT_MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
        Utilization by Person
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stackedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="month" stroke={TEXT_SEC} tick={{ fill: TEXT_SEC, fontSize: 11 }} />
            <YAxis stroke={TEXT_SEC} tick={{ fill: TEXT_SEC, fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: BG_SURFACE, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
              itemStyle={{ color: TEXT_PRIMARY }}
              labelStyle={{ color: TEXT_SEC }}
            />
            <Legend wrapperStyle={{ color: TEXT_PRIMARY, paddingTop: 8, fontSize: 12 }} />
            {people.map(person => (
              <Bar key={person.id} dataKey={person.name} fill={person.avatar_color} radius={[2,2,0,0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
