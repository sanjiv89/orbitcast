import React from 'react'
import { useStore, useDerived } from '../store'
// @ts-ignore
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

const MONTHS = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06']
const fmtMonth = (m: string) => new Date(m + '-15').toLocaleDateString('en-US',{month:'short',year:'2-digit'})
const fmtMoney = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n)

const AVAILABLE_HOURS_PER_MONTH = 160

export function Utilization() {
  const { people, roles } = useStore()
  const { roleById, utilizationForPersonMonth } = useDerived()

  const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || 'Unknown'

  const personMonthlyUtilization = people.map(person => {
    const monthlyData: Record<string, {
      allocatedHours: number,
      utilizationPct: number
    }> = {}
    let totalAllocatedHours = 0

    MONTHS.forEach(month => {
      const { totalPct } = utilizationForPersonMonth(person.id, month)
      const allocatedHours = (totalPct / 100) * AVAILABLE_HOURS_PER_MONTH
      const utilizationPct = (allocatedHours / AVAILABLE_HOURS_PER_MONTH) * 100
      monthlyData[month] = { allocatedHours, utilizationPct }
      totalAllocatedHours += allocatedHours
    })

    const avgUtilizationPct = (totalAllocatedHours / (AVAILABLE_HOURS_PER_MONTH * MONTHS.length)) * 100

    return { person, monthlyData, avgUtilizationPct }
  })

  const teamAverageMonthly = MONTHS.map(month => {
    const totalAllocatedHoursInMonth = personMonthlyUtilization.reduce((sum, { person, monthlyData }) => {
      return sum + monthlyData[month].allocatedHours
    }, 0)
    const totalAvailableHoursInMonth = people.length * AVAILABLE_HOURS_PER_MONTH
    const teamUtilizationPct = (totalAllocatedHoursInMonth / totalAvailableHoursInMonth) * 100
    return { month, teamUtilizationPct }
  })

  const overallTeamAverage = teamAverageMonthly.reduce((sum, m) => sum + m.teamUtilizationPct, 0) / MONTHS.length

  // Chart Data preparation
  const chartData = MONTHS.map(month => {
    const monthData: { month: string, [key: string]: string | number } = { month: fmtMonth(month) }
    personMonthlyUtilization.forEach(({ person, monthlyData }) => {
      monthData[person.name] = parseFloat(monthlyData[month].utilizationPct.toFixed(1))
    })
    return monthData
  })

  const barColors = people.map(p => p.avatar_color)

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header">
        <h2 style={{ color: TEXT_PRIMARY }}>Utilization</h2>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px' }}>
        <thead style={{ background: BG_SURFACE }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Person</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Role</th>
            {MONTHS.map(month => (
              <th key={month} style={{ padding: '12px', textAlign: 'center', color: TEXT_SEC }}>{fmtMonth(month)}</th>
            ))}
            <th style={{ padding: '12px', textAlign: 'center', color: TEXT_SEC }}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {personMonthlyUtilization.map(({ person, monthlyData, avgUtilizationPct }) => (
            <tr key={person.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: '12px', color: TEXT_PRIMARY }}>{person.name}</td>
              <td style={{ padding: '12px', color: TEXT_SEC }}>{getRoleName(person.role_id)}</td>
              {MONTHS.map(month => {
                const { allocatedHours, utilizationPct } = monthlyData[month]
                let bgColor = 'transparent'
                if (utilizationPct < 80) bgColor = 'rgba(74,222,128,0.05)'
                else if (utilizationPct >= 100) bgColor = 'rgba(248,113,113,0.12)'
                else if (utilizationPct >= 80) bgColor = 'rgba(251,191,36,0.08)'

                return (
                  <td key={month} style={{ padding: '8px 12px', textAlign: 'center', background: bgColor }}>
                    <div style={{ color: TEXT_PRIMARY, fontSize: '14px' }}>{allocatedHours.toFixed(0)}h / 160h</div>
                    <div style={{ color: TEXT_SEC, fontSize: '12px', marginTop: '4px' }}>({utilizationPct.toFixed(0)}%)</div>
                  </td>
                )
              })}
              <td style={{ padding: '8px 12px', textAlign: 'center', color: TEXT_PRIMARY, background: 'rgba(255,255,255,0.05)' }}>
                {avgUtilizationPct.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ background: BG_SURFACE, borderTop: `1px solid ${BORDER}` }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_PRIMARY }}>Team Average</th>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_PRIMARY }}></th>
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

      <div style={{ marginTop: '32px', width: '100%', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20, right: 30, left: 20, bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="month" stroke={TEXT_SEC} />
            <YAxis stroke={TEXT_SEC} />
            <Tooltip
              contentStyle={{ background: BG_SURFACE, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
              itemStyle={{ color: TEXT_PRIMARY }}
              labelStyle={{ color: TEXT_SEC }}
            />
            <Legend wrapperStyle={{ color: TEXT_PRIMARY, paddingTop: '8px' }} />
            {people.map((person, index) => (
              <Bar key={person.id} dataKey={person.name} fill={barColors[index % barColors.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
