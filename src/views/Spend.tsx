import React, { useState } from 'react'
import { useStore, useDerived } from '../store'
import type { Customer, Project } from '../types'

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

export function Spend() {
  const { customers, projects, allocations } = useStore()
  const { customerById, projectById, spendForAllocation, spendForAllocationInMonth } = useDerived()

  const [viewBy, setViewBy] = useState<'customer' | 'project'>('customer')

  // Calculate total forecasted spend for summary cards
  const totalSpendByCustomer = customers.map(customer => {
    const totalForecastedSpend = allocations
      .filter(alloc => projectById(alloc.project_id)?.customer_id === customer.id)
      .reduce((sum, alloc) => sum + spendForAllocation(alloc), 0)
    return { customer, totalForecastedSpend }
  })

  // Group allocations by customer or project for the table
  const getGroupedData = () => {
    if (viewBy === 'customer') {
      return customers.map(customer => {
        const monthlySpend: Record<string, { confirmed: number, tentative: number }> = {}
        let totalConfirmed = 0
        let totalTentative = 0

        MONTHS.forEach(month => { monthlySpend[month] = { confirmed: 0, tentative: 0 } })

        allocations.forEach(alloc => {
          const project = projectById(alloc.project_id)
          if (project?.customer_id !== customer.id) return
          // Distribute this allocation's spend across the months it overlaps
          MONTHS.forEach(month => {
            const spend = spendForAllocationInMonth(alloc, month)
            if (spend === 0) return
            if (alloc.confirmed) {
              monthlySpend[month].confirmed += spend
              totalConfirmed += spend
            } else {
              monthlySpend[month].tentative += spend
              totalTentative += spend
            }
          })
        })
        return { id: customer.id, name: customer.name, color: customer.color, monthlySpend, totalConfirmed, totalTentative }
      })
    } else { // viewBy === 'project'
      return projects.map(project => {
        const customer = customerById(project.customer_id)
        const monthlySpend: Record<string, { confirmed: number, tentative: number }> = {}
        let totalConfirmed = 0
        let totalTentative = 0

        MONTHS.forEach(month => { monthlySpend[month] = { confirmed: 0, tentative: 0 } })

        allocations.forEach(alloc => {
          if (alloc.project_id !== project.id) return
          MONTHS.forEach(month => {
            const spend = spendForAllocationInMonth(alloc, month)
            if (spend === 0) return
            if (alloc.confirmed) {
              monthlySpend[month].confirmed += spend
              totalConfirmed += spend
            } else {
              monthlySpend[month].tentative += spend
              totalTentative += spend
            }
          })
        })
        return { id: project.id, name: project.name, color: customer?.color || BORDER, monthlySpend, totalConfirmed, totalTentative }
      })
    }
  }

  const groupedData = getGroupedData()

  const grandTotalConfirmed = groupedData.reduce((sum, item) => sum + item.totalConfirmed, 0)
  const grandTotalTentative = groupedData.reduce((sum, item) => sum + item.totalTentative, 0)

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header">
        <h2 style={{ color: TEXT_PRIMARY }}>Spend Analysis</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn-ghost ${viewBy === 'customer' ? 'btn-primary' : ''}`} onClick={() => setViewBy('customer')}>By Customer</button>
          <button className={`btn-ghost ${viewBy === 'project' ? 'btn-primary' : ''}`} onClick={() => setViewBy('project')}>By Project</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
        {totalSpendByCustomer.map(item => (
          <div key={item.customer.id} className="summary-card" style={{ background: BG_SURFACE, padding: '16px', borderRadius: '8px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', color: TEXT_SEC, fontSize: '14px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.customer.color, marginRight: '8px' }}></div>
              {item.customer.name}
            </div>
            <div style={{ color: TEXT_PRIMARY, fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>
              {fmtMoney(item.totalForecastedSpend)}
            </div>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '32px' }}>
        <thead style={{ background: BG_SURFACE }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>{viewBy === 'customer' ? 'Customer' : 'Project'}</th>
            {MONTHS.map(month => (
              <th key={month} style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>{fmtMonth(month)}</th>
            ))}
            <th style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {groupedData.map(item => (
            <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}`, borderLeft: `4px solid ${item.color}` }}>
              <td style={{ padding: '12px', color: TEXT_PRIMARY }}>{item.name}</td>
              {MONTHS.map(month => (
                <td key={month} style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ color: TEXT_PRIMARY }}>{fmtMoney(item.monthlySpend[month].confirmed)}</div>
                  {item.monthlySpend[month].tentative > 0 && (
                    <div style={{ color: TEXT_MUTED, fontSize: '12px' }}>({fmtMoney(item.monthlySpend[month].tentative)})</div>
                  )}
                </td>
              ))}
              <td style={{ padding: '12px', textAlign: 'right' }}>
                <div style={{ color: TEXT_PRIMARY }}>{fmtMoney(item.totalConfirmed)}</div>
                {item.totalTentative > 0 && (
                  <div style={{ color: TEXT_MUTED, fontSize: '12px' }}>({fmtMoney(item.totalTentative)})</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ background: BG_SURFACE, borderTop: `1px solid ${BORDER}` }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', color: TEXT_PRIMARY }}>Grand Total</th>
            {MONTHS.map(month => {
              const monthlyConfirmedTotal = groupedData.reduce((sum, item) => sum + item.monthlySpend[month].confirmed, 0)
              const monthlyTentativeTotal = groupedData.reduce((sum, item) => sum + item.monthlySpend[month].tentative, 0)
              return (
                <th key={month} style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ color: TEXT_PRIMARY }}>{fmtMoney(monthlyConfirmedTotal)}</div>
                  {monthlyTentativeTotal > 0 && (
                    <div style={{ color: TEXT_MUTED, fontSize: '12px' }}>({fmtMoney(monthlyTentativeTotal)})</div>
                  )}
                </th>
              )
            })}
            <th style={{ padding: '12px', textAlign: 'right' }}>
              <div style={{ color: TEXT_PRIMARY }}>{fmtMoney(grandTotalConfirmed)}</div>
              {grandTotalTentative > 0 && (
                <div style={{ color: TEXT_MUTED, fontSize: '12px' }}>({fmtMoney(grandTotalTentative)})</div>
              )}
            </th>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
