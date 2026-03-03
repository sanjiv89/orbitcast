import type { Customer, Role, Person, Project, Phase, Allocation } from './types'

export const seedCustomers: Customer[] = [
  { id: 'c1', name: 'Apex Dynamics', color: '#C8F041' },
  { id: 'c2', name: 'Novu Health',   color: '#60A5FA' },
  { id: 'c3', name: 'Ironforge Co',  color: '#F97316' },
]

export const seedRoles: Role[] = [
  { id: 'r1', name: 'Engineering Lead',  hourly_rate: 185 },
  { id: 'r2', name: 'Senior Engineer',   hourly_rate: 150 },
  { id: 'r3', name: 'Product Designer',  hourly_rate: 130 },
  { id: 'r4', name: 'Project Manager',   hourly_rate: 120 },
]

export const seedPeople: Person[] = [
  { id: 'p1', name: 'Sam Rivera',   role_id: 'r1', avatar_color: '#C8F041', department: 'Platform Engineer'  },
  { id: 'p2', name: 'Jordan Kim',   role_id: 'r2', avatar_color: '#60A5FA', department: 'Product Engineer'   },
  { id: 'p3', name: 'Alex Chen',    role_id: 'r3', avatar_color: '#F97316', department: 'Design'             },
  { id: 'p4', name: 'Morgan Patel', role_id: 'r4', avatar_color: '#A78BFA', department: 'Delivery Manager'   },
]

export const seedProjects: Project[] = [
  {
    id: 'proj1', name: 'Platform Relaunch', customer_id: 'c1',
    start_month: '2025-01-06', end_month: '2025-06-27',
    budget_dollars: 180000, status: 'active', billable: true,
  },
  {
    id: 'proj2', name: 'Patient Portal v2', customer_id: 'c2',
    start_month: '2025-02-03', end_month: '2025-07-31',
    budget_dollars: 120000, status: 'active', billable: true,
  },
  {
    id: 'proj3', name: 'Design System', customer_id: 'c3',
    start_month: '2025-03-10', end_month: '2025-08-29',
    budget_dollars: 75000, status: 'tentative', billable: true,
  },
]

export const seedPhases: Phase[] = [
  { id: 'ph1', project_id: 'proj1', name: 'Discovery',    start_month: '2025-01-06', end_month: '2025-02-28' },
  { id: 'ph2', project_id: 'proj1', name: 'Build',        start_month: '2025-03-03', end_month: '2025-06-27' },
  { id: 'ph3', project_id: 'proj2', name: 'Research',     start_month: '2025-02-03', end_month: '2025-03-28' },
  { id: 'ph4', project_id: 'proj2', name: 'Development',  start_month: '2025-04-01', end_month: '2025-07-31' },
  { id: 'ph5', project_id: 'proj3', name: 'Foundations',  start_month: '2025-03-10', end_month: '2025-05-30' },
  { id: 'ph6', project_id: 'proj3', name: 'Components',   start_month: '2025-06-02', end_month: '2025-08-29' },
]

export const seedAllocations: Allocation[] = [
  // Sam Rivera — Engineering Lead
  { id: 'a1',  person_id: 'p1', project_id: 'proj1', month: '2025-01', pct: 80, confirmed: true  },
  { id: 'a2',  person_id: 'p1', project_id: 'proj1', month: '2025-02', pct: 80, confirmed: true  },
  { id: 'a3',  person_id: 'p1', project_id: 'proj1', month: '2025-03', pct: 60, confirmed: true  },
  { id: 'a4',  person_id: 'p1', project_id: 'proj2', month: '2025-03', pct: 30, confirmed: false },
  { id: 'a5',  person_id: 'p1', project_id: 'proj1', month: '2025-04', pct: 100,confirmed: true  },

  // Jordan Kim — Senior Engineer
  { id: 'a6',  person_id: 'p2', project_id: 'proj1', month: '2025-01', pct: 50, confirmed: true  },
  { id: 'a7',  person_id: 'p2', project_id: 'proj2', month: '2025-02', pct: 60, confirmed: true  },
  { id: 'a8',  person_id: 'p2', project_id: 'proj2', month: '2025-03', pct: 80, confirmed: true  },
  { id: 'a9',  person_id: 'p2', project_id: 'proj3', month: '2025-04', pct: 40, confirmed: false },
  { id: 'a10', person_id: 'p2', project_id: 'proj2', month: '2025-05', pct: 70, confirmed: true  },

  // Alex Chen — Product Designer
  { id: 'a11', person_id: 'p3', project_id: 'proj2', month: '2025-02', pct: 50, confirmed: true  },
  { id: 'a12', person_id: 'p3', project_id: 'proj3', month: '2025-03', pct: 80, confirmed: false },
  { id: 'a13', person_id: 'p3', project_id: 'proj3', month: '2025-04', pct: 80, confirmed: false },
  { id: 'a14', person_id: 'p3', project_id: 'proj1', month: '2025-05', pct: 40, confirmed: true  },

  // Morgan Patel — Project Manager
  { id: 'a15', person_id: 'p4', project_id: 'proj1', month: '2025-01', pct: 30, confirmed: true  },
  { id: 'a16', person_id: 'p4', project_id: 'proj2', month: '2025-02', pct: 50, confirmed: true  },
  { id: 'a17', person_id: 'p4', project_id: 'proj3', month: '2025-03', pct: 40, confirmed: false },
  { id: 'a18', person_id: 'p4', project_id: 'proj1', month: '2025-04', pct: 60, confirmed: true  },
  { id: 'a19', person_id: 'p4', project_id: 'proj2', month: '2025-05', pct: 50, confirmed: true  },
]
