/**
 * allocUtils.ts — date-range allocation calculation utilities
 *
 * All functions are pure (no React, no store deps) so they can be used
 * in both the store (derived helpers) and in view components (live previews).
 */

import type { Allocation } from '../types'

export const CAPACITY_HOURS_PER_MONTH = 160

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse a YYYY-MM-DD string into a local midnight Date */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** First day of a YYYY-MM month */
export function monthStart(monthStr: string): Date {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Last day of a YYYY-MM month */
export function monthEnd(monthStr: string): Date {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m, 0)
}

/** Number of calendar days in a YYYY-MM month */
export function daysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Short label for a month, e.g. "Jan '25" */
export function fmtMonth(m: string): string {
  return new Date(m + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ── Working-day counting ──────────────────────────────────────────────────────

/**
 * Count Mon–Fri days in [start, end] (both inclusive).
 * Uses a fast floor-based formula; O(1) modular arithmetic.
 */
export function countWorkingDays(start: Date, end: Date): number {
  const s = new Date(start); s.setHours(0, 0, 0, 0)
  const e = new Date(end);   e.setHours(0, 0, 0, 0)
  if (s > e) return 0

  const totalDays = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1
  const fullWeeks = Math.floor(totalDays / 7)
  const remainder = totalDays % 7
  const startDow  = s.getDay()   // 0=Sun … 6=Sat

  let weekdays = fullWeeks * 5
  for (let i = 0; i < remainder; i++) {
    const d = (startDow + i) % 7
    if (d !== 0 && d !== 6) weekdays++
  }
  return weekdays
}

// ── Core per-month allocation calculations ────────────────────────────────────

/**
 * Effective hours an allocation contributes to a specific YYYY-MM month.
 *
 * Formula: (overlap working days / total working days in month)
 *          × capacityHours × (allocation_percentage / 100)
 *
 * Returns 0 if the allocation doesn't overlap with the month at all.
 */
export function hoursForAllocationInMonth(
  alloc: Pick<Allocation, 'start_date' | 'end_date' | 'allocation_percentage'>,
  monthStr: string,
  capacityHours = CAPACITY_HOURS_PER_MONTH,
): number {
  const ms = monthStart(monthStr)
  const me = monthEnd(monthStr)
  const as = parseDate(alloc.start_date)
  const ae = parseDate(alloc.end_date)

  const overlapStart = new Date(Math.max(as.getTime(), ms.getTime()))
  const overlapEnd   = new Date(Math.min(ae.getTime(), me.getTime()))
  if (overlapStart > overlapEnd) return 0

  const overlapDays = countWorkingDays(overlapStart, overlapEnd)
  const totalDays   = countWorkingDays(ms, me)
  if (totalDays === 0) return 0

  return Math.round(
    (overlapDays / totalDays) * capacityHours * (alloc.allocation_percentage / 100) * 10
  ) / 10
}

/**
 * Effective utilisation percentage an allocation contributes to a month.
 * This is a fractional value — multiple allocations may sum to > 100.
 */
export function pctForAllocationInMonth(
  alloc: Pick<Allocation, 'start_date' | 'end_date' | 'allocation_percentage'>,
  monthStr: string,
): number {
  const ms = monthStart(monthStr)
  const me = monthEnd(monthStr)
  const as = parseDate(alloc.start_date)
  const ae = parseDate(alloc.end_date)

  const overlapStart = new Date(Math.max(as.getTime(), ms.getTime()))
  const overlapEnd   = new Date(Math.min(ae.getTime(), me.getTime()))
  if (overlapStart > overlapEnd) return 0

  const overlapDays = countWorkingDays(overlapStart, overlapEnd)
  const totalDays   = countWorkingDays(ms, me)
  if (totalDays === 0) return 0

  return (overlapDays / totalDays) * alloc.allocation_percentage
}

/**
 * All YYYY-MM months that overlap with an allocation's date range.
 */
export function monthsInRange(startDate: string, endDate: string): string[] {
  const months: string[] = []
  const ae = parseDate(endDate)
  let d = monthStart(startDate.slice(0, 7))
  while (d <= ae) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return months
}

// ── Timeline pixel ↔ date converters ─────────────────────────────────────────

/**
 * Convert a Date to its pixel offset within the visible timeline.
 * - For the start edge of a bar: pass the start_date Date
 * - For the end edge of a bar: pass a Date one day after end_date so the
 *   bar's right edge falls at the boundary of the next day
 *
 * Returns clamped to [0, months.length × colW].
 */
export function dateToPixel(
  date: Date,
  months: string[],
  colW: number,
): number {
  const yyyyMM = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const mIdx = months.indexOf(yyyyMM)

  if (mIdx === -1) {
    const ms = monthStart(months[0])
    return date < ms ? 0 : months.length * colW
  }

  const dimm   = daysInMonth(yyyyMM)
  const dayIdx = date.getDate() - 1   // 0-based
  return mIdx * colW + (dayIdx / dimm) * colW
}

/**
 * Convert a pixel offset to a calendar Date within the visible timeline.
 * Snaps to whole days.
 */
export function pixelToDate(px: number, months: string[], colW: number): Date {
  const clampedPx = Math.max(0, Math.min(px, months.length * colW - 1))
  const mIdx      = Math.floor(clampedPx / colW)
  const fracInCol = (clampedPx % colW) / colW

  const [y, m] = months[Math.min(mIdx, months.length - 1)].split('-').map(Number)
  const dimm   = new Date(y, m, 0).getDate()
  const day    = Math.max(1, Math.min(dimm, Math.round(fracInCol * dimm) + 1))
  return new Date(y, m - 1, day)
}

/** Duration in calendar days between two date strings (inclusive) */
export function durationDays(startDate: string, endDate: string): number {
  return Math.round(
    (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86_400_000
  )
}

/** Add n calendar days to a YYYY-MM-DD string */
export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
