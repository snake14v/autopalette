import { useEffect, useMemo, useState } from 'react';
import type { Jobcard, JobcardStatus } from '../../shared/types';
import { driver, useEmployees, useJobcards } from '../lib/useDriver';
import { navigate, useRoute } from '../lib/router';
import { formatDate, inr } from '../lib/format';
import { monthKey, monthLabel } from '../lib/dates';
import {
  JOBCARD_FLOW,
  JOBCARD_NEXT_ACTION_LABEL,
  JOBCARD_STATUS_LABEL,
  JOBCARD_STATUS_TONE,
  nextJobcardStatus,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type PaymentStatus,
} from '../lib/status';
import { useOptimisticAction } from '../lib/useOptimisticAction';
import { loadPref, savePref } from '../lib/persist';
import { SERVICE_CATALOG } from '../../shared/catalog';
import {
  ActionMenu,
  Badge,
  BulkBar,
  Button,
  Checkbox,
  EmptyState,
  Panel,
  ReasonDialog,
  SectionHeading,
  Spinner,
  TextInput,
  useToast,
  type ActionMenuItem,
} from '../ui';

const LABEL_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

// 'outstanding' = unpaid OR advance_paid (drill-down target from the Data panel).
type PayFilter = 'all' | PaymentStatus | 'outstanding';
const PAY_FILTERS: PayFilter[] = ['all', 'unpaid', 'advance_paid', 'paid', 'outstanding'];
const PAY_FILTER_LABEL: Record<PayFilter, string> = {
  all: 'All',
  unpaid: 'Unpaid',
  advance_paid: 'Advance Paid',
  paid: 'Paid',
  outstanding: 'Outstanding',
};
const PAY_PREF_KEY = 'jobcards.pay';

// Lifecycle status tabs (mobile fallback) — mirrors BookingsInbox: the side-branch status
// ('void', like 'cancelled' there) has no dedicated tab, only a toggle that reveals its
// kanban column on desktop. "All" still includes void cards, badged, same as Bookings.
type StatusTab = 'all' | JobcardStatus;
const STATUS_TABS: StatusTab[] = ['all', ...JOBCARD_FLOW];
const STATUS_TAB_PREF_KEY = 'jobcards.statusTab';

/** Linear mark-paid cycle: unpaid → advance_paid → paid → unpaid. */
function nextPaymentStatus(s: PaymentStatus): PaymentStatus {
  return s === 'unpaid' ? 'advance_paid' : s === 'advance_paid' ? 'paid' : 'unpaid';
}

function matchesPay(jc: Jobcard, pay: PayFilter): boolean {
  if (pay === 'all') return true;
  if (pay === 'outstanding') return jc.payment.status !== 'paid';
  return jc.payment.status === pay;
}

export default function JobcardsList() {
  const jobcards = useJobcards();
  const employees = useEmployees();
  const route = useRoute();
  const toast = useToast();
  const optimistic = useOptimisticAction();

  const [q, setQ] = useState('');
  const [pay, setPay] = useState<PayFilter>(() => {
    const fromQuery = route.query.pay as PayFilter | undefined;
    if (fromQuery && PAY_FILTERS.includes(fromQuery)) return fromQuery;
    return loadPref(PAY_PREF_KEY, 'all') as PayFilter;
  });
  const [statusTab, setStatusTab] = useState<StatusTab>(() => {
    const fromQuery = route.query.status as StatusTab | undefined;
    if (fromQuery && STATUS_TABS.includes(fromQuery)) return fromQuery;
    if (route.query.status === 'void') return 'all'; // void has no tab — the toggle below reveals it
    return loadPref(STATUS_TAB_PREF_KEY, 'all') as StatusTab;
  });
  const [showVoid, setShowVoid] = useState(() => route.query.status === 'void');
  const [month, setMonth] = useState<string>(route.query.month ?? '');
  const [service, setService] = useState<string>(route.query.service ?? '');
  const [assignee, setAssignee] = useState<string>(route.query.assignee ?? '');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [voidTarget, setVoidTarget] = useState<Jobcard | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Jobcard | null>(null);

  // Apply drill-down filters when the hash query changes (Data-panel tiles navigate here with
  // params). Only fires when the query carries relevant keys, so navbar visits to plain
  // /jobcards leave the admin's current filters untouched.
  const querySig = `${route.query.pay ?? ''}|${route.query.month ?? ''}|${route.query.service ?? ''}|${route.query.assignee ?? ''}|${route.query.status ?? ''}`;
  useEffect(() => {
    if (querySig === '||||') return;
    const p = route.query.pay as PayFilter | undefined;
    setPay(p && PAY_FILTERS.includes(p) ? p : 'all');
    setMonth(route.query.month ?? '');
    setService(route.query.service ?? '');
    setAssignee(route.query.assignee ?? '');
    const s = route.query.status as StatusTab | undefined;
    if (s === 'void') {
      setStatusTab('all');
      setShowVoid(true);
    } else {
      setStatusTab(s && STATUS_TABS.includes(s) ? s : 'all');
      setShowVoid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [querySig]);

  useEffect(() => {
    savePref(PAY_PREF_KEY, pay);
  }, [pay]);

  useEffect(() => {
    savePref(STATUS_TAB_PREF_KEY, statusTab);
  }, [statusTab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobcards?.length ?? 0 };
    for (const j of jobcards ?? []) c[j.payment.status] = (c[j.payment.status] ?? 0) + 1;
    return c;
  }, [jobcards]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: jobcards?.length ?? 0 };
    for (const j of jobcards ?? []) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobcards]);

  // Employees that appear on at least one job card's assignedTo — the assignee filter chips.
  const assigneeChips = useMemo(() => {
    const ids = new Set<string>();
    for (const j of jobcards ?? []) for (const id of j.assignedTo ?? []) ids.add(id);
    const byId = new Map((employees ?? []).map((e) => [e.id, e]));
    return [...ids].map((id) => ({ id, name: byId.get(id)?.name || byId.get(id)?.loginId || 'Unknown' }));
  }, [jobcards, employees]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (jobcards ?? [])
      .filter((j) => matchesPay(j, pay))
      .filter((j) => (month ? monthKey(j.date) === month : true))
      .filter((j) => (service ? j.services.some((s) => s.serviceId === service) : true))
      .filter((j) => (assignee ? (j.assignedTo ?? []).includes(assignee) : true))
      .filter((j) => {
        if (!needle) return true;
        return (
          j.customer.phone.toLowerCase().includes(needle) ||
          j.vehicle.regNumber.toLowerCase().includes(needle) ||
          j.invoiceNumber.toLowerCase().includes(needle) ||
          j.customer.name.toLowerCase().includes(needle)
        );
      });
  }, [jobcards, q, pay, month, service, assignee]);

  // Mobile list = all the above filters + the lifecycle status tab.
  const mobileList = useMemo(
    () => filtered.filter((j) => (statusTab === 'all' ? true : j.status === statusTab)),
    [filtered, statusTab]
  );

  async function newWalkIn() {
    if (creating) return;
    setCreating(true);
    try {
      const jc = await driver.createBlankJobcard();
      navigate(`/jobcards/${jc.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create job card', 'error');
      setCreating(false);
    }
  }

  // --- selection --------------------------------------------------------------------------
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  // --- single mark-paid -------------------------------------------------------------------
  function cyclePayment(jc: Jobcard) {
    const from = jc.payment.status;
    const to = nextPaymentStatus(from);
    optimistic.run({
      do: () => driver.setJobcardPaymentStatus(jc.id, to),
      undo: () => driver.setJobcardPaymentStatus(jc.id, from),
      message: `${jc.invoiceNumber || 'Job card'} → ${PAYMENT_STATUS_LABEL[to]}`,
      undoneMessage: `Reverted to ${PAYMENT_STATUS_LABEL[from]}`,
    });
  }

  // --- lifecycle quick actions (docs/JOBCARD_LIFECYCLE_SPEC.md) ---------------------------
  // open->in_progress and in_progress->quality_check need no extra data, so they fire
  // straight from the card. quality_check->completed (QC gate) and completed->closed
  // (delivery sign-off) need form data the kanban card doesn't carry, so those open the
  // editor's lifecycle panels instead of transitioning blind.
  async function quickAdvance(jc: Jobcard) {
    const next = nextJobcardStatus(jc.status);
    if (!next) return;
    if (jc.status === 'quality_check' || jc.status === 'completed') {
      navigate(`/jobcards/${jc.id}`);
      return;
    }
    try {
      await driver.setJobcardStatus(jc.id, next);
      toast(`${jc.invoiceNumber || 'Job card'} → ${JOBCARD_STATUS_LABEL[next]}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Status update failed', 'error');
    }
  }

  async function confirmVoid(reason: string) {
    const jc = voidTarget;
    setVoidTarget(null);
    if (!jc) return;
    try {
      await driver.setJobcardStatus(jc.id, 'void', { reason });
      toast(`${jc.invoiceNumber || 'Job card'} voided`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Void failed', 'error');
    }
  }

  async function confirmReopen(reason: string) {
    const jc = reopenTarget;
    setReopenTarget(null);
    if (!jc) return;
    try {
      await driver.setJobcardStatus(jc.id, 'in_progress', { reason });
      toast(`${jc.invoiceNumber || 'Job card'} reopened`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Reopen failed', 'error');
    }
  }

  function actionItems(jc: Jobcard): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    const next = nextJobcardStatus(jc.status);
    if (next) {
      items.push({
        label: JOBCARD_NEXT_ACTION_LABEL[jc.status] ?? `Advance to ${JOBCARD_STATUS_LABEL[next]}`,
        onClick: () => quickAdvance(jc),
      });
    }
    items.push({ label: 'Open job card', onClick: () => navigate(`/jobcards/${jc.id}`) });
    items.push({ label: 'Open invoice', onClick: () => navigate(`/jobcards/${jc.id}/invoice`) });
    if (jc.status !== 'void') {
      const toPay = nextPaymentStatus(jc.payment.status);
      items.push({ label: `Mark ${PAYMENT_STATUS_LABEL[toPay]}`, onClick: () => cyclePayment(jc) });
    }
    if (jc.status === 'completed' || jc.status === 'closed') {
      items.push({ label: 'Reopen this job card', onClick: () => setReopenTarget(jc) });
    }
    if (jc.status === 'open' || jc.status === 'in_progress' || jc.status === 'quality_check') {
      // Deliberately NOT `danger` — void gets a muted/grey treatment, distinct from the red
      // used for Cancel elsewhere (owner directive: internal record correction, not a failure).
      items.push({ label: 'Void job card', onClick: () => setVoidTarget(jc) });
    }
    return items;
  }

  // --- bulk payment set -------------------------------------------------------------------
  async function bulkSetPayment(to: PaymentStatus) {
    const targets = (jobcards ?? []).filter((j) => selected.has(j.id));
    if (targets.length === 0) return;
    const prevById = new Map(targets.map((j) => [j.id, j.payment.status]));
    try {
      await Promise.all(targets.map((j) => driver.setJobcardPaymentStatus(j.id, to)));
      clearSelection();
      toast(`Set ${targets.length} job card${targets.length === 1 ? '' : 's'} → ${PAYMENT_STATUS_LABEL[to]}`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await Promise.all(
                [...prevById.entries()].map(([id, status]) => driver.setJobcardPaymentStatus(id, status))
              );
              toast('Bulk payment change undone');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Undo failed', 'error');
            }
          },
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bulk update failed', 'error');
    }
  }

  const activeDrill = Boolean(month || service || assignee);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SectionHeading
        eyebrow="Billing"
        title="Job Cards"
        right={
          <Button onClick={newWalkIn} disabled={creating}>
            {creating ? 'Creating…' : '+ New Job Card'}
          </Button>
        }
      />

      <div className="mt-4 flex flex-col gap-3">
        <TextInput
          type="search"
          placeholder="Search by invoice no, phone, reg, or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search job cards"
        />

        {/* Mobile: lifecycle-status tabs (kanban is a desktop win) — reuses BookingsInbox's
            mobile-tab-fallback pattern. */}
        <div className="flex flex-wrap gap-2 md:hidden" role="tablist" aria-label="Filter by lifecycle status">
          {STATUS_TABS.map((t) => {
            const active = statusTab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                onClick={() => setStatusTab(t)}
                className={`rounded-full border px-3 py-1 font-ui text-xs font-medium tracking-wide transition-colors ${
                  active
                    ? 'border-gold bg-gold/15 text-goldBright'
                    : 'border-white/12 text-white/55 hover:border-white/25 hover:text-white/80'
                }`}
              >
                {t === 'all' ? 'All' : JOBCARD_STATUS_LABEL[t]}
                <span className="ml-1.5 text-white/35">{statusCounts[t] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop: void-column toggle for the kanban. */}
        <div className="hidden items-center justify-end md:flex">
          <button
            onClick={() => setShowVoid((v) => !v)}
            aria-pressed={showVoid}
            className={`rounded-full border px-3 py-1 font-ui text-xs font-medium transition-colors ${
              showVoid
                ? 'border-white/40 text-white/70'
                : 'border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
            }`}
          >
            {showVoid ? 'Hide' : 'Show'} void ({statusCounts.void ?? 0})
          </button>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by payment status">
          {PAY_FILTERS.map((f) => {
            const active = pay === f;
            return (
              <button
                key={f}
                aria-pressed={active}
                onClick={() => setPay(f)}
                className={`rounded-full border px-3 py-1 font-ui text-xs font-medium tracking-wide transition-colors ${
                  active
                    ? 'border-gold bg-gold/15 text-goldBright'
                    : 'border-white/12 text-white/55 hover:border-white/25 hover:text-white/80'
                }`}
              >
                {PAY_FILTER_LABEL[f]}
                {f !== 'all' && f !== 'outstanding' && (
                  <span className="ml-1.5 text-white/35">{counts[f] ?? 0}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Assignee (technician workload) chips — only when someone is assigned to a job. */}
        {assigneeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by assignee">
            <span className="font-ui text-[0.65rem] uppercase tracking-wider text-white/40">Assignee</span>
            <button
              aria-pressed={assignee === ''}
              onClick={() => setAssignee('')}
              className={`rounded-full border px-2.5 py-0.5 font-ui text-xs transition-colors ${
                assignee === ''
                  ? 'border-gold bg-gold/15 text-goldBright'
                  : 'border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
              }`}
            >
              All
            </button>
            {assigneeChips.map((a) => (
              <button
                key={a.id}
                aria-pressed={assignee === a.id}
                onClick={() => setAssignee(assignee === a.id ? '' : a.id)}
                className={`rounded-full border px-2.5 py-0.5 font-ui text-xs transition-colors ${
                  assignee === a.id
                    ? 'border-gold bg-gold/15 text-goldBright'
                    : 'border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}

        {/* Active drill-down filters from the Data panel — removable. */}
        {activeDrill && (
          <div className="flex flex-wrap items-center gap-2">
            {month && (
              <FilterPill label={`Month: ${monthLabel(month)}`} onClear={() => setMonth('')} />
            )}
            {service && (
              <FilterPill
                label={`Service: ${LABEL_BY_ID.get(service) ?? service}`}
                onClear={() => setService('')}
              />
            )}
            {assignee && (
              <FilterPill
                label={`Assignee: ${assigneeChips.find((a) => a.id === assignee)?.name ?? assignee}`}
                onClear={() => setAssignee('')}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        {jobcards === null ? (
          <Spinner label="Loading job cards…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={q || pay !== 'all' || activeDrill ? 'No matching job cards' : 'No job cards yet'}
            hint={
              q || pay !== 'all' || activeDrill
                ? 'Try clearing the search or filters.'
                : 'Convert a booking, or create a walk-in job card to get started.'
            }
          />
        ) : (
          <>
            {/* Kanban (md+) — by lifecycle status */}
            <div className="hidden md:block">
              <StatusKanbanBoard
                jobcards={filtered}
                showVoid={showVoid}
                selected={selected}
                onToggleSelect={toggleSelect}
                actionItems={actionItems}
              />
            </div>

            {/* List (mobile) */}
            <div className="md:hidden">
              {mobileList.length === 0 ? (
                <EmptyState title="No matching job cards" hint="Try clearing the search or switching tabs." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {mobileList.map((j) => (
                    <JobcardRow
                      key={j.id}
                      jobcard={j}
                      selected={selected.has(j.id)}
                      onToggleSelect={() => toggleSelect(j.id)}
                      actionItems={actionItems(j)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <BulkBar count={selected.size} onClear={clearSelection}>
        <span className="font-ui text-xs text-white/50">Set payment:</span>
        <Button variant="ghost" onClick={() => bulkSetPayment('unpaid')}>
          Unpaid
        </Button>
        <Button variant="ghost" onClick={() => bulkSetPayment('advance_paid')}>
          Advance
        </Button>
        <Button variant="secondary" onClick={() => bulkSetPayment('paid')}>
          Paid
        </Button>
      </BulkBar>

      <ReasonDialog
        open={voidTarget !== null}
        title="Void this job card?"
        body="Voided job cards keep the record (the invoice number stays traceable) but are excluded from revenue and job-count totals. This cannot be done from Completed or Closed."
        placeholder="Reason (e.g. mis-created, customer walked away before work started)…"
        confirmLabel="Void Job Card"
        onCancel={() => setVoidTarget(null)}
        onConfirm={confirmVoid}
      />

      <ReasonDialog
        open={reopenTarget !== null}
        title="Reopen this job card?"
        body="Moves the job card back to In Progress. Logged in its status history with your reason."
        placeholder="Reason (e.g. customer reported a defect, missed a panel)…"
        confirmLabel="Reopen"
        onCancel={() => setReopenTarget(null)}
        onConfirm={confirmReopen}
      />
    </div>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-pinstripe-cyan/40 bg-pinstripe-cyan/10 px-2.5 py-0.5 font-ui text-xs text-pinstripe-cyan">
      {label}
      <button onClick={onClear} aria-label={`Clear ${label}`} className="text-pinstripe-cyan/70 hover:text-pinstripe-cyan">
        ✕
      </button>
    </span>
  );
}

// --- Kanban (lifecycle status) -------------------------------------------------------------

function StatusKanbanBoard({
  jobcards,
  showVoid,
  selected,
  onToggleSelect,
  actionItems,
}: {
  jobcards: Jobcard[];
  showVoid: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  actionItems: (j: Jobcard) => ActionMenuItem[];
}) {
  const columns: JobcardStatus[] = showVoid ? [...JOBCARD_FLOW, 'void'] : JOBCARD_FLOW;
  const byStatus = useMemo(() => {
    const map = new Map<JobcardStatus, Jobcard[]>();
    for (const s of columns) map.set(s, []);
    for (const j of jobcards) map.get(j.status)?.push(j);
    return map;
  }, [jobcards, columns]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((s) => {
        const items = byStatus.get(s) ?? [];
        return (
          <section key={s} className="flex w-64 shrink-0 flex-col">
            <header className="mb-2 flex items-center justify-between px-1">
              <span className="font-ui text-xs font-semibold uppercase tracking-wide text-white/70">
                {JOBCARD_STATUS_LABEL[s]}
              </span>
              <span className="font-ui text-xs text-white/35">{items.length}</span>
            </header>
            <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.015] p-2">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center font-body text-[0.7rem] text-white/25">Empty</p>
              ) : (
                items.map((j) => (
                  <JobcardKanbanCard
                    key={j.id}
                    jobcard={j}
                    selected={selected.has(j.id)}
                    onToggleSelect={() => onToggleSelect(j.id)}
                    actionItems={actionItems(j)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function JobcardKanbanCard({
  jobcard: j,
  selected,
  onToggleSelect,
  actionItems,
}: {
  jobcard: Jobcard;
  selected: boolean;
  onToggleSelect: () => void;
  actionItems: ActionMenuItem[];
}) {
  return (
    <Panel as="div" className="p-0">
      <div className="flex items-start gap-2 rounded-xl px-3 py-2.5">
        <div className="pt-0.5">
          <Checkbox checked={selected} onChange={onToggleSelect} label={`Select ${j.invoiceNumber || j.id}`} />
        </div>
        <button
          onClick={() => navigate(`/jobcards/${j.id}`)}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-sm font-bold tracking-wide text-goldBright">
              {j.invoiceNumber || 'Unsaved'}
            </span>
            {j.status === 'void' && <Badge tone={JOBCARD_STATUS_TONE.void}>Voided</Badge>}
          </div>
          <p className="mt-0.5 truncate font-body text-xs text-white/50">
            {j.customer.name || 'Unnamed'} · {j.vehicle.regNumber || 'No reg'}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Badge tone={PAYMENT_STATUS_TONE[j.payment.status]}>{PAYMENT_STATUS_LABEL[j.payment.status]}</Badge>
            <span className="font-ui text-xs font-semibold text-white/80">{inr(j.pricing.totalAmount)}</span>
          </div>
        </button>
        <ActionMenu items={actionItems} label={`Actions for ${j.invoiceNumber || 'job card'}`} />
      </div>
    </Panel>
  );
}

// --- Mobile list row ----------------------------------------------------------------------

function JobcardRow({
  jobcard: j,
  selected,
  onToggleSelect,
  actionItems,
}: {
  jobcard: Jobcard;
  selected: boolean;
  onToggleSelect: () => void;
  actionItems: ActionMenuItem[];
}) {
  return (
    <li>
      <Panel as="div" className="p-0">
        <div className="flex items-center gap-2 rounded-xl px-3 py-3 sm:px-4">
          <Checkbox checked={selected} onChange={onToggleSelect} label={`Select ${j.invoiceNumber || j.id}`} />
          <button
            onClick={() => navigate(`/jobcards/${j.id}`)}
            className="flex min-w-0 flex-1 flex-col gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-bold tracking-wide text-goldBright">
                  {j.invoiceNumber || 'Unsaved'}
                </span>
                <Badge tone={JOBCARD_STATUS_TONE[j.status]}>{JOBCARD_STATUS_LABEL[j.status]}</Badge>
                <Badge tone={PAYMENT_STATUS_TONE[j.payment.status]}>
                  {PAYMENT_STATUS_LABEL[j.payment.status]}
                </Badge>
              </div>
              <p className="mt-0.5 truncate font-body text-xs text-white/60">
                {j.customer.name || 'Unnamed'} · {j.vehicle.regNumber || 'No reg'} ·{' '}
                {j.vehicle.makeModel || 'Vehicle n/a'}
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="font-ui text-sm font-semibold text-white">{inr(j.pricing.totalAmount)}</p>
              <p className="font-body text-[0.7rem] text-white/45">{formatDate(j.date)}</p>
            </div>
          </button>
          <ActionMenu items={actionItems} label={`Actions for ${j.invoiceNumber || 'job card'}`} />
        </div>
      </Panel>
    </li>
  );
}
