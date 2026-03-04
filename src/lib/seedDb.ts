/**
 * seedDb.ts — one-time database seed utility
 *
 * Inserts all mock data from seed.ts into Supabase.
 * Called automatically by the store on first run (empty tables),
 * or manually via the Setup panel in the app.
 *
 * Safe to run multiple times — clears all crewcast_ tables first.
 */

import { supabase } from './supabase'
import {
  seedCustomers, seedRoles, seedPeople,
  seedProjects, seedPhases, seedAllocations,
} from '../seed'

export async function seedDatabase(): Promise<{ ok: boolean; error?: string }> {
  // ── Clear existing data (reverse dependency order) ────────────────────────
  const tables = [
    'crewcast_allocations',
    'crewcast_phases',
    'crewcast_projects',
    'crewcast_people',
    'crewcast_roles',
    'crewcast_customers',
  ]
  for (const table of tables) {
    // Delete all rows — neq('id', '') matches every row with a non-empty id
    const { error } = await supabase.from(table).delete().neq('id', '')
    if (error) {
      console.error(`[seed] clear ${table} failed:`, error.message)
      // Don't abort — the table may already be empty
    }
  }

  // ── Insert in dependency order (parents before children) ─────────────────
  const inserts: { table: string; rows: object[] }[] = [
    { table: 'crewcast_customers',  rows: seedCustomers   },
    { table: 'crewcast_roles',      rows: seedRoles       },
    { table: 'crewcast_people',     rows: seedPeople      },
    { table: 'crewcast_projects',   rows: seedProjects    },
    { table: 'crewcast_phases',     rows: seedPhases      },
    { table: 'crewcast_allocations',rows: seedAllocations },
  ]

  for (const { table, rows } of inserts) {
    const { error } = await supabase.from(table).insert(rows)
    if (error) {
      const msg = `Failed to seed ${table}: ${error.message}`
      console.error(`[seed]`, msg)
      return { ok: false, error: msg }
    }
    console.info(`[seed] ${table} ✓ (${rows.length} rows)`)
  }

  console.info('[seed] Database seeded successfully — reload the app.')
  return { ok: true }
}
