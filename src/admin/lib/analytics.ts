// Data-panel computations (Wave 2 admin dashboard home). PURE functions over the real
// recorded records only — no projections, no invented benchmarks. Every figure here traces
// to a saved Jobcard / WorkItem / Customer. Callers label each with its date range and show
// "No data yet" empty states when the inputs are empty.

import type { Customer, Employee, Jobcard, JobcardStatus, WorkItem } from '../../shared/types';
import { SERVICE_CATALOG } from '../../shared/catalog';
import { monthKey, monthKeyOffset, weekKey } from './dates';

const LABEL_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

/**
 * Voided job cards (docs/JOBCARD_LIFECYCLE_SPEC.md) are cancelled records — excluded from
 * every revenue/job-count/spend roll-up below (spec item 7), while still appearing,
 * clearly badged, in job-card lists and per-customer history. Filtered once here so every
 * analytics function is void-safe by construction, not by each call site remembering to ask.
 */
function excludeVoid(jobcards: Jobcard[]): Jobcard[] {
  return jobcards.filter((jc) => jc.status !== 'void');
}

/** Jobs counted this-vs-last calendar month, keyed off Jobcard.date. Void jobs excluded. */
export function monthlyJobCounts(jobcards: Jobcard[]): {
  thisMonth: number;
  lastMonth: number;
  thisKey: string;
  lastKey: string;
} {
  const thisKey = monthKeyOffset(0);
  const lastKey = monthKeyOffset(-1);
  let thisMonth = 0;
  let lastMonth = 0;
  for (const jc of excludeVoid(jobcards)) {
    const k = monthKey(jc.date);
    if (k === thisKey) thisMonth++;
    else if (k === lastKey) lastMonth++;
  }
  return { thisMonth, lastMonth, thisKey, lastKey };
}

/**
 * Revenue (Σ totalAmount) bucketed by month, most-recent last. Optionally limited to N
 * months. Void jobs excluded.
 */
export function revenueByMonth(
  jobcards: Jobcard[],
  limit = 6
): { key: string; total: number }[] {
  const byMonth = new Map<string, number>();
  for (const jc of excludeVoid(jobcards)) {
    const k = monthKey(jc.date);
    byMonth.set(k, (byMonth.get(k) ?? 0) + (jc.pricing.totalAmount || 0));
  }
  const sorted = [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const tail = sorted.slice(-limit);
  return tail.map(([key, total]) => ({ key, total }));
}

/** Total outstanding = Σ balanceDue over non-void job cards not marked fully paid. */
export function totalOutstanding(jobcards: Jobcard[]): number {
  return excludeVoid(jobcards).reduce(
    (sum, jc) => (jc.payment.status === 'paid' ? sum : sum + Math.max(0, jc.pricing.balanceDue || 0)),
    0
  );
}

/**
 * Count of non-void job cards per lifecycle stage (incl. 'void' itself, so the Data panel
 * can show it as its own line rather than silently dropping it). Real recorded data only.
 */
export function statusBreakdown(jobcards: Jobcard[]): Record<JobcardStatus, number> {
  const counts: Record<JobcardStatus, number> = {
    open: 0,
    in_progress: 0,
    quality_check: 0,
    completed: 0,
    closed: 0,
    void: 0,
  };
  for (const jc of jobcards) counts[jc.status] = (counts[jc.status] ?? 0) + 1;
  return counts;
}

/** Top-N services by how many job-card line rows reference them (catalog rows only). Void jobs excluded. */
export function topServices(
  jobcards: Jobcard[],
  n = 5
): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const jc of excludeVoid(jobcards)) {
    for (const row of jc.services) {
      if (row.serviceId === 'custom') continue; // ad-hoc extras aren't catalog services
      counts.set(row.serviceId, (counts.get(row.serviceId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: LABEL_BY_ID.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, n);
}

/**
 * Repeat-customer rate = customers with >1 job card ÷ customers with ≥1 job card.
 * Grouped by normalized phone from Jobcard.customer.phone (already normalized when the
 * registry upserts, but we normalize here too for job cards saved before that).
 */
export function repeatCustomerRate(jobcards: Jobcard[]): {
  repeat: number;
  total: number;
  rate: number;
} {
  const byPhone = new Map<string, number>();
  for (const jc of excludeVoid(jobcards)) {
    const key = (jc.customer.phone || '').replace(/\D/g, '').slice(-10);
    if (!key) continue;
    byPhone.set(key, (byPhone.get(key) ?? 0) + 1);
  }
  const total = byPhone.size;
  let repeat = 0;
  for (const count of byPhone.values()) if (count > 1) repeat++;
  return { repeat, total, rate: total === 0 ? 0 : repeat / total };
}

/** Hours logged bucketed by ISO week (Monday-based), most-recent last, limited to N weeks. */
export function hoursByWeek(
  workItems: WorkItem[],
  limit = 6
): { key: string; hours: number }[] {
  const byWeek = new Map<string, number>();
  for (const wi of workItems) {
    if (!wi.hoursLogged) continue;
    const k = weekKey(wi.date);
    byWeek.set(k, (byWeek.get(k) ?? 0) + wi.hoursLogged);
  }
  const sorted = [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.slice(-limit).map(([key, hours]) => ({ key, hours: Math.round(hours * 100) / 100 }));
}

/**
 * docs/WAVE5_SPEC.md section A — "DataPanel hours rows": total hoursLogged per employee,
 * all-time, desc by hours. Real recorded data only (per the honesty-gate discipline already
 * governing this file) — an employee with zero logged hours simply doesn't appear.
 */
export function hoursByEmployee(
  workItems: WorkItem[],
  employees: Employee[]
): { employee: Employee; hours: number }[] {
  const byId = new Map<string, number>();
  for (const wi of workItems) {
    if (!wi.hoursLogged) continue;
    byId.set(wi.assignedTo, (byId.get(wi.assignedTo) ?? 0) + wi.hoursLogged);
  }
  const empById = new Map(employees.map((e) => [e.id, e]));
  return [...byId.entries()]
    .map(([id, hours]) => ({ employee: empById.get(id), hours }))
    .filter((r): r is { employee: Employee; hours: number } => Boolean(r.employee))
    .sort((a, b) => b.hours - a.hours);
}

// --- per-customer roll-ups (Customers panel chips + detail) ------------------------------

export interface CustomerRollup {
  visits: number; // job cards attributed to this phone
  lastVisit?: string; // most recent jobcard date (YYYY-MM-DD)
  lifetimeSpend: number; // Σ totalAmount
  outstanding: number; // Σ balanceDue where not paid
}

/** Roll up a single customer's job-card history by matching normalized phone. Void jobs excluded. */
export function rollupCustomer(phone: string, jobcards: Jobcard[]): CustomerRollup {
  const key = (phone || '').replace(/\D/g, '').slice(-10);
  let visits = 0;
  let lastVisit: string | undefined;
  let lifetimeSpend = 0;
  let outstanding = 0;
  for (const jc of excludeVoid(jobcards)) {
    const jcKey = (jc.customer.phone || '').replace(/\D/g, '').slice(-10);
    if (jcKey !== key) continue;
    visits++;
    lifetimeSpend += jc.pricing.totalAmount || 0;
    if (jc.payment.status !== 'paid') outstanding += Math.max(0, jc.pricing.balanceDue || 0);
    if (!lastVisit || jc.date > lastVisit) lastVisit = jc.date;
  }
  return { visits, lastVisit, lifetimeSpend, outstanding };
}
