export interface Customer {
  id: string
  name: string
  color: string
}

export interface Role {
  id: string
  name: string
  hourly_rate: number
}

export const DEPARTMENTS = [
  'Partner Success',
  'Delivery Manager',
  'Product',
  'Design',
  'UXR',
  'Clinical Solutions',
  'Application Developer',
  'Platform Engineer',
  'Product Engineer',
  'Data Eng',
] as const

export type Department = typeof DEPARTMENTS[number]

export interface Person {
  id: string
  name: string
  role_id: string
  avatar_color: string
  department: Department
}

export interface Project {
  id: string
  name: string
  customer_id: string
  start_month: string  // YYYY-MM
  end_month: string
  budget_dollars: number
  status: 'active' | 'tentative' | 'complete'
  billable: boolean
}

export interface Phase {
  id: string
  project_id: string
  name: string
  start_month: string
  end_month: string
}

export interface Allocation {
  id: string
  person_id: string
  project_id: string
  month: string       // YYYY-MM
  pct: number         // 0–100
  confirmed: boolean
}

export type NavView =
  | 'timeline'
  | 'grid'
  | 'spend'
  | 'budgets'
  | 'utilization'
  | 'customers'
  | 'projects'
  | 'people'
  | 'roles'
