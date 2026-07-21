import { useEffect, useMemo, useState } from 'react';
import type { Booking, BookingStatus } from '../../shared/types';
import { driver, useBookings } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { formatDate, formatTimestamp } from '../lib/format';
import {
  BOOKING_FLOW,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  nextBookingStatus,
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
  ConfirmDialog,
  EmptyState,
  Panel,
  SectionHeading,
  Spinner,
  TextInput,
  useToast,
  type ActionMenuItem,
} from '../ui';

const LABEL_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

type Tab = 'all' | BookingStatus;
const TABS: Tab[] = ['all', 'requested', 'confirmed', 'in_progress', 'ready', 'delivered', 'cancelled'];
const TAB_PREF_KEY = 'bookings.tab';

function serviceSummary(b: Booking): string {
  const services = b.serviceIds.map((id) => LABEL_BY_ID.get(id) ?? id);
  if (services.length === 0) return 'No services listed';
  if (services.length <= 2) return services.join(', ');
  return `${services.slice(0, 2).join(', ')} +${services.length - 2}`;
}

export default function BookingsInbox() {
  const bookings = useBookings();
  const toast = useToast();
  const optimistic = useOptimisticAction();

  const [q, setQ] = useState('');
  // Mobile tab is the persisted "last-used filter" for this route (kanban is desktop-only).
  const [tab, setTab] = useState<Tab>(() => loadPref(TAB_PREF_KEY, 'all') as Tab);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Pending cancel confirmation for a single booking or a bulk set.
  const [cancelIds, setCancelIds] = useState<string[] | null>(null);

  useEffect(() => {
    savePref(TAB_PREF_KEY, tab);
  }, [tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings?.length ?? 0 };
    for (const b of bookings ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [bookings]);

  const bySearch = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (bookings ?? []).filter((b) => {
      if (!needle) return true;
      return (
        b.customer.phone.toLowerCase().includes(needle) ||
        b.vehicle.regNumber.toLowerCase().includes(needle) ||
        b.customer.name.toLowerCase().includes(needle)
      );
    });
  }, [bookings, q]);

  // Mobile list = search + tab filter.
  const mobileList = useMemo(
    () => bySearch.filter((b) => (tab === 'all' ? true : b.status === tab)),
    [bySearch, tab]
  );

  // --- selection --------------------------------------------------------------------------
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  // --- single-booking actions -------------------------------------------------------------
  function advance(b: Booking) {
    const next = nextBookingStatus(b.status);
    if (!next) return;
    const prev = b.status;
    optimistic.run({
      do: () => driver.updateBookingStatus(b.id, next),
      undo: () => driver.updateBookingStatus(b.id, prev),
      message: `${b.vehicle.regNumber || 'Booking'} → ${BOOKING_STATUS_LABEL[next]}`,
      undoneMessage: `Reverted to ${BOOKING_STATUS_LABEL[prev]}`,
    });
  }

  function actionItems(b: Booking): ActionMenuItem[] {
    const next = nextBookingStatus(b.status);
    const items: ActionMenuItem[] = [];
    if (next) items.push({ label: `Advance to ${BOOKING_STATUS_LABEL[next]}`, onClick: () => advance(b) });
    items.push({ label: 'Open booking', onClick: () => navigate(`/bookings/${b.id}`) });
    if (b.jobcardId)
      items.push({ label: 'Open job card', onClick: () => navigate(`/jobcards/${b.jobcardId}`) });
    if (b.status !== 'cancelled')
      items.push({ label: 'Cancel booking', danger: true, onClick: () => setCancelIds([b.id]) });
    return items;
  }

  // --- bulk actions -----------------------------------------------------------------------
  async function bulkAdvance() {
    const targets = (bookings ?? []).filter((b) => selected.has(b.id) && nextBookingStatus(b.status));
    if (targets.length === 0) {
      toast('No selected bookings can advance', 'error');
      return;
    }
    const prevById = new Map(targets.map((b) => [b.id, b.status]));
    try {
      await Promise.all(
        targets.map((b) => driver.updateBookingStatus(b.id, nextBookingStatus(b.status)!))
      );
      clearSelection();
      toast(`Advanced ${targets.length} booking${targets.length === 1 ? '' : 's'}`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await Promise.all(
                [...prevById.entries()].map(([id, status]) => driver.updateBookingStatus(id, status))
              );
              toast('Bulk advance undone');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Undo failed', 'error');
            }
          },
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bulk advance failed', 'error');
    }
  }

  async function confirmCancel() {
    const ids = cancelIds ?? [];
    setCancelIds(null);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => driver.updateBookingStatus(id, 'cancelled')));
      clearSelection();
      toast(`Cancelled ${ids.length} booking${ids.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Cancel failed', 'error');
    }
  }

  const selectedCount = selected.size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SectionHeading eyebrow="Studio Operations" title="Bookings Inbox" />

      <div className="mt-4 flex flex-col gap-3">
        <TextInput
          type="search"
          placeholder="Search by phone, reg number, or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search bookings"
        />

        {/* Mobile: status tabs (kanban is a desktop win). */}
        <div className="flex flex-wrap gap-2 md:hidden" role="tablist" aria-label="Filter by status">
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t)}
                className={`rounded-full border px-3 py-1 font-ui text-xs font-medium tracking-wide transition-colors ${
                  active
                    ? 'border-gold bg-gold/15 text-goldBright'
                    : 'border-white/12 text-white/55 hover:border-white/25 hover:text-white/80'
                }`}
              >
                {t === 'all' ? 'All' : BOOKING_STATUS_LABEL[t]}
                <span className="ml-1.5 text-white/35">{counts[t] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop: cancelled-column toggle for the kanban. */}
        <div className="hidden items-center justify-end md:flex">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            aria-pressed={showCancelled}
            className={`rounded-full border px-3 py-1 font-ui text-xs font-medium transition-colors ${
              showCancelled
                ? 'border-pinstripe-red/50 text-pinstripe-red'
                : 'border-white/12 text-white/50 hover:border-white/25 hover:text-white/80'
            }`}
          >
            {showCancelled ? 'Hide' : 'Show'} cancelled ({counts.cancelled ?? 0})
          </button>
        </div>
      </div>

      <div className="mt-5">
        {bookings === null ? (
          <Spinner label="Loading bookings…" />
        ) : (bookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            hint="New bookings from the customer app will appear here in real time."
          />
        ) : (
          <>
            {/* Kanban (md+) */}
            <div className="hidden md:block">
              <KanbanBoard
                bookings={bySearch}
                showCancelled={showCancelled}
                selected={selected}
                onToggleSelect={toggleSelect}
                actionItems={actionItems}
              />
            </div>

            {/* List (mobile) */}
            <div className="md:hidden">
              {mobileList.length === 0 ? (
                <EmptyState title="No matching bookings" hint="Try clearing the search or switching tabs." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {mobileList.map((b) => (
                    <BookingRow
                      key={b.id}
                      booking={b}
                      selected={selected.has(b.id)}
                      onToggleSelect={() => toggleSelect(b.id)}
                      actionItems={actionItems(b)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        ))}
      </div>

      <BulkBar count={selectedCount} onClear={clearSelection}>
        <Button variant="secondary" onClick={bulkAdvance}>
          Advance
        </Button>
        <Button variant="danger" onClick={() => setCancelIds([...selected])}>
          Cancel
        </Button>
      </BulkBar>

      <ConfirmDialog
        open={cancelIds !== null}
        title={
          (cancelIds?.length ?? 0) > 1
            ? `Cancel ${cancelIds?.length} bookings?`
            : 'Cancel this booking?'
        }
        body="Cancelled bookings show as cancelled on the customer timeline and can't advance further."
        confirmLabel="Cancel Booking"
        cancelLabel="Keep"
        danger
        onCancel={() => setCancelIds(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

// --- Kanban -------------------------------------------------------------------------------

function KanbanBoard({
  bookings,
  showCancelled,
  selected,
  onToggleSelect,
  actionItems,
}: {
  bookings: Booking[];
  showCancelled: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  actionItems: (b: Booking) => ActionMenuItem[];
}) {
  const columns: BookingStatus[] = showCancelled ? [...BOOKING_FLOW, 'cancelled'] : BOOKING_FLOW;
  const byStatus = useMemo(() => {
    const map = new Map<BookingStatus, Booking[]>();
    for (const s of columns) map.set(s, []);
    for (const b of bookings) map.get(b.status)?.push(b);
    return map;
  }, [bookings, columns]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((s) => {
        const items = byStatus.get(s) ?? [];
        return (
          <section key={s} className="flex w-64 shrink-0 flex-col">
            <header className="mb-2 flex items-center justify-between px-1">
              <span className="font-ui text-xs font-semibold uppercase tracking-wide text-white/70">
                {BOOKING_STATUS_LABEL[s]}
              </span>
              <span className="font-ui text-xs text-white/35">{items.length}</span>
            </header>
            <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.015] p-2">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center font-body text-[0.7rem] text-white/25">Empty</p>
              ) : (
                items.map((b) => (
                  <KanbanCard
                    key={b.id}
                    booking={b}
                    selected={selected.has(b.id)}
                    onToggleSelect={() => onToggleSelect(b.id)}
                    actionItems={actionItems(b)}
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

function KanbanCard({
  booking: b,
  selected,
  onToggleSelect,
  actionItems,
}: {
  booking: Booking;
  selected: boolean;
  onToggleSelect: () => void;
  actionItems: ActionMenuItem[];
}) {
  return (
    <Panel as="div" className="p-0">
      <div className="flex items-start gap-2 rounded-xl px-3 py-2.5">
        <div className="pt-0.5">
          <Checkbox checked={selected} onChange={onToggleSelect} label={`Select ${b.customer.name || b.id}`} />
        </div>
        <button
          onClick={() => navigate(`/bookings/${b.id}`)}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          <p className="truncate font-ui text-sm font-semibold text-white">
            {b.customer.name || 'Unnamed customer'}
          </p>
          <p className="mt-0.5 truncate font-body text-xs text-white/50">
            {b.vehicle.regNumber || 'No reg'} · {b.customer.phone || 'No phone'}
          </p>
          <p className="mt-0.5 truncate font-body text-[0.7rem] text-white/35">{serviceSummary(b)}</p>
          {b.preferredDate && (
            <p className="mt-0.5 font-body text-[0.65rem] text-pinstripe-cyan/70">
              Preferred: {formatDate(b.preferredDate)}
            </p>
          )}
        </button>
        <ActionMenu items={actionItems} label={`Actions for ${b.customer.name || 'booking'}`} />
      </div>
    </Panel>
  );
}

// --- Mobile list row ----------------------------------------------------------------------

function BookingRow({
  booking: b,
  selected,
  onToggleSelect,
  actionItems,
}: {
  booking: Booking;
  selected: boolean;
  onToggleSelect: () => void;
  actionItems: ActionMenuItem[];
}) {
  return (
    <li>
      <Panel as="div" className="p-0">
        <div className="flex items-center gap-2 rounded-xl px-3 py-3">
          <Checkbox checked={selected} onChange={onToggleSelect} label={`Select ${b.customer.name || b.id}`} />
          <button
            onClick={() => navigate(`/bookings/${b.id}`)}
            className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-ui text-sm font-semibold text-white">
                {b.customer.name || 'Unnamed customer'}
              </span>
              <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
            </div>
            <p className="mt-0.5 truncate font-body text-xs text-white/50">
              {b.vehicle.regNumber || 'No reg'} · {b.vehicle.makeModel || 'Vehicle n/a'} ·{' '}
              {b.customer.phone || 'No phone'}
            </p>
            <p className="mt-0.5 truncate font-body text-xs text-white/40">
              {serviceSummary(b)} · {formatTimestamp(b.createdAt)}
            </p>
          </button>
          <ActionMenu items={actionItems} label={`Actions for ${b.customer.name || 'booking'}`} />
        </div>
      </Panel>
    </li>
  );
}
