import React from 'react'
import { useStore, useDerived } from '../store'

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

export function Budgets() {
  const { customers, projects } = useStore()
  const { customerById, confirmedSpendForProject, totalSpendForProject } = useDerived()

  const projectsByCustomer = customers.map(customer => ({
    customer,
    projects: projects.filter(p => p.customer_id === customer.id)
  }))

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header">
        <h2 style={{ color: TEXT_PRIMARY }}>Budgets</h2>
      </div>

      <div style={{ marginTop: '24px' }}>
        {projectsByCustomer.map(({ customer, projects }) => (
          <div key={customer.id} style={{ marginBottom: '32px' }}>
            <h3 style={{ color: TEXT_PRIMARY, borderLeft: `4px solid ${customer.color}`, paddingLeft: '8px', marginBottom: '16px' }}>{customer.name}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: BG_SURFACE }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>Budget</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>Confirmed Spend</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>Forecasted Spend</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>Budget Remaining</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: TEXT_SEC, width: '200px' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => {
                  const confirmedSpend = confirmedSpendForProject(project.id)
                  const totalSpend = totalSpendForProject(project.id)
                  const budgetRemaining = project.budget_dollars - totalSpend
                  const confirmedProgress = Math.min(confirmedSpend / project.budget_dollars, 1) * 100
                  const tentativeProgress = Math.min((totalSpend - confirmedSpend) / project.budget_dollars, 1) * 100
                  const isOverBudget = totalSpend > project.budget_dollars

                  return (
                    <tr key={project.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '12px', color: TEXT_PRIMARY }}>
                        {isOverBudget && <span style={{ color: RED, marginRight: '4px' }}>🚨</span>}{project.name}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={`badge status-${project.status}`}>{project.status}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>{fmtMoney(project.budget_dollars)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>{fmtMoney(confirmedSpend)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: TEXT_SEC }}>{fmtMoney(totalSpend)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: isOverBudget ? RED : TEXT_SEC }}>{fmtMoney(budgetRemaining)}</td>
                      <td style={{ padding: '12px' }}>
                        <div className="progress-bar-bg" style={{ background: BORDER, height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                          <div className="progress-bar-fill" style={{ width: `${confirmedProgress}%`, background: GREEN, height: '100%', position: 'relative' }}>
                            <div style={{ width: `${tentativeProgress}%`, background: AMBER, height: '100%', position: 'absolute', left: `${confirmedProgress}%`, top: 0 }}></div>
                          </div>
                          {isOverBudget && (
                            <div style={{ background: RED, height: '8px', borderRadius: '4px', marginTop: '4px' }}></div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
