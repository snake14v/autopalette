import { useMemo, useState } from 'react';
import type { Booking, BookingStatus } from '../../shared/types';
import { useBookings } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { formatDate, formatTimestamp } from '../lib/format';
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from '../lib/status';
import { SERVICE_CATALOG } from '../../shared/catalog';
import { Badge, EmptyState, Panel, SectionHeading, Spinner, TextInput } from '../ui';

const LABEL_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

type Tab = 'all' | BookingStatus;
const TABS: Tab[] = ['all', 'requested', 'confirmed', 'in_progress', 'ready', 'delivered', 'cancelled'];

export default function BookingsInbox() {
  const bookings = useBookings();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings?.length ?? 0 };
    for (const b of bookings ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [bookings]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (bookings ?? [])
      .filter((b) => (tab === 'all' ? true : b.status === tab))
      .filter((b) => {
        if (!needle) return true;
        return (
          b.customer.phone.toLowerCase().includes(needle) ||
          b.vehicle.regNumber.toLowerCase().includes(needle) ||
          b.customer.name.toLowerCase().includes(needle)
        );
      });
  }, [bookings, tab, q]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <SectionHeading eyebrow="Studio Operations" title="Bookings Inbox" />

      <div className="mt-4 flex flex-col gap-3">
        <TextInput
          type="search"
          placeholder="Search by phone, reg number, or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search bookings"
        />

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
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
      </div>

      <div className="mt-5">
        {bookings === null ? (
          <Spinner label="Loading bookings…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={q || tab !== 'all' ? 'No matching bookings' : 'No bookings yet'}
            hint={
              q || tab !== 'all'
                ? 'Try clearing the search or switching tabs.'
                : 'New bookings from the customer app will appear here in real time.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BookingRow({ booking: b }: { booking: Booking }) {
  const services = b.serviceIds.map((id) => LABEL_BY_ID.get(id) ?? id);
  const serviceSummary =
    services.length === 0
      ? 'No services listed'
      : services.length <= 2
        ? services.join(', ')
        : `${services.slice(0, 2).join(', ')} +${services.length - 2}`;

  return (
    <li>
      <Panel as="div" className="p-0">
        <button
          onClick={() => navigate(`/bookings/${b.id}`)}
          className="flex w-full flex-col gap-2 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
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
            <p className="mt-0.5 truncate font-body text-xs text-white/40">{serviceSummary}</p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="font-body text-[0.7rem] text-white/45">{formatTimestamp(b.createdAt)}</p>
            {b.preferredDate && (
              <p className="font-body text-[0.7rem] text-pinstripe-cyan/70">
                Preferred: {formatDate(b.preferredDate)}
              </p>
            )}
          </div>
        </button>
      </Panel>
    </li>
  );
}
