import { useMemo, useState } from 'react';
import type { Booking, Customer, Jobcard } from '../../shared/types';
import { driver, useBookings, useCustomers, useJobcards } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { normalizePhone } from '../../shared/data';
import { formatDate, formatTimestamp, inr, whatsappLink } from '../lib/format';
import { rollupCustomer } from '../lib/analytics';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '../lib/status';
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  SectionHeading,
  Spinner,
  Textarea,
  useToast,
} from '../ui';

type TimelineEntry =
  | { kind: 'booking'; at: number; booking: Booking }
  | { kind: 'jobcard'; at: number; jobcard: Jobcard };

export default function CustomerDetail({ phone }: { phone: string }) {
  const key = normalizePhone(decodeURIComponent(phone));
  const customers = useCustomers();
  const bookings = useBookings();
  const jobcards = useJobcards();
  const toast = useToast();

  const customer = useMemo(
    () => (customers ?? []).find((c) => c.phone === key) ?? null,
    [customers, key]
  );

  const myBookings = useMemo(
    () => (bookings ?? []).filter((b) => normalizePhone(b.customer.phone) === key),
    [bookings, key]
  );
  const myJobcards = useMemo(
    () => (jobcards ?? []).filter((j) => normalizePhone(j.customer.phone) === key),
    [jobcards, key]
  );

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];
    for (const b of myBookings) entries.push({ kind: 'booking', at: b.createdAt, booking: b });
    for (const j of myJobcards) {
      const at = new Date(`${j.date}T00:00:00`).getTime();
      entries.push({ kind: 'jobcard', at: Number.isNaN(at) ? 0 : at, jobcard: j });
    }
    return entries.sort((a, b) => b.at - a.at);
  }, [myBookings, myJobcards]);

  const roll = useMemo(() => rollupCustomer(key, jobcards ?? []), [key, jobcards]);

  const [notes, setNotes] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const notesValue = notes ?? customer?.notes ?? '';
  const notesDirty = notes !== null && notes !== (customer?.notes ?? '');

  if (customers === null || bookings === null || jobcards === null) {
    return <Spinner label="Loading customer…" />;
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <BackLink />
        <EmptyState title="Customer not found" hint="No registry record for this phone number." />
      </div>
    );
  }

  // Vehicles = registry vehicles, unioned with any seen on job cards / bookings.
  const vehicleMap = new Map<string, string>();
  for (const v of customer.vehicles) vehicleMap.set(v.reg.toUpperCase(), v.makeModel);
  for (const j of myJobcards)
    if (j.vehicle.regNumber) vehicleMap.set(j.vehicle.regNumber.toUpperCase(), j.vehicle.makeModel);
  for (const b of myBookings)
    if (b.vehicle.regNumber) vehicleMap.set(b.vehicle.regNumber.toUpperCase(), b.vehicle.makeModel);

  async function saveNotes() {
    if (savingNotes || !customer) return;
    setSavingNotes(true);
    try {
      await driver.saveCustomer({ ...customer, notes: notesValue.trim() || undefined });
      toast('Notes saved');
      setNotes(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <BackLink />

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <SectionHeading eyebrow="Customer" title={customer.name || 'Unnamed'} />
        <a
          href={whatsappLink(`Hi ${customer.name || ''}`.trim())}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-pinstripe-emerald/40 px-3 py-1.5 font-ui text-xs text-pinstripe-emerald hover:bg-pinstripe-emerald/10"
        >
          WhatsApp
        </a>
      </div>

      {/* Summary chips */}
      <Panel className="mt-4 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label="Phone" value={customer.phone} />
          <Stat label="Visits" value={String(roll.visits)} />
          <Stat label="Lifetime Spend" value={inr(roll.lifetimeSpend)} />
          <Stat
            label="Outstanding"
            value={inr(roll.outstanding)}
            accent={roll.outstanding > 0 ? 'text-pinstripe-red' : 'text-pinstripe-emerald'}
          />
        </dl>
        {customer.altPhone && (
          <p className="mt-3 font-body text-xs text-white/45">Alt phone: {customer.altPhone}</p>
        )}
      </Panel>

      {/* Vehicles */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Vehicles" />
        {vehicleMap.size === 0 ? (
          <p className="mt-2 font-body text-sm text-white/40">No vehicles on file.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...vehicleMap.entries()].map(([reg, mm]) => (
              <li
                key={reg}
                className="rounded-md border border-white/12 bg-char3/70 px-3 py-1.5 font-body text-sm"
              >
                <span className="font-ui font-semibold text-white/90">{reg}</span>
                {mm && <span className="text-white/50"> · {mm}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Admin notes */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Admin Notes" />
        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            value={notesValue}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes about this customer (preferences, history, cautions)…"
            aria-label="Admin notes"
          />
          <div className="flex justify-end">
            <Button onClick={saveNotes} disabled={savingNotes || !notesDirty}>
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </Button>
          </div>
        </div>
      </Panel>

      {/* History */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="History" />
        {timeline.length === 0 ? (
          <p className="mt-2 font-body text-sm text-white/40">No bookings or job cards yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {timeline.map((e, i) =>
              e.kind === 'booking' ? (
                <HistoryBooking key={`b-${e.booking.id}-${i}`} booking={e.booking} />
              ) : (
                <HistoryJobcard key={`j-${e.jobcard.id}-${i}`} jobcard={e.jobcard} />
              )
            )}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function HistoryBooking({ booking: b }: { booking: Booking }) {
  return (
    <li>
      <button
        onClick={() => navigate(`/bookings/${b.id}`)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-char3/50 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-ui text-xs uppercase tracking-wide text-white/40">Booking</span>
            <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Badge>
          </div>
          <p className="mt-0.5 truncate font-body text-xs text-white/55">
            {b.vehicle.regNumber || 'No reg'} · {formatTimestamp(b.createdAt)}
          </p>
        </div>
        <span className="shrink-0 font-ui text-xs text-pinstripe-cyan/70">Open →</span>
      </button>
    </li>
  );
}

function HistoryJobcard({ jobcard: j }: { jobcard: Jobcard }) {
  return (
    <li>
      <button
        onClick={() => navigate(`/jobcards/${j.id}`)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-char3/50 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-bold tracking-wide text-goldBright">
              {j.invoiceNumber || 'Unsaved'}
            </span>
            <Badge tone={PAYMENT_STATUS_TONE[j.payment.status]}>
              {PAYMENT_STATUS_LABEL[j.payment.status]}
            </Badge>
          </div>
          <p className="mt-0.5 truncate font-body text-xs text-white/55">
            {j.vehicle.regNumber || 'No reg'} · {formatDate(j.date)}
          </p>
        </div>
        <span className="shrink-0 font-ui text-sm font-semibold text-white/85">
          {inr(j.pricing.totalAmount)}
        </span>
      </button>
    </li>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <dt className="font-ui text-[0.65rem] font-medium uppercase tracking-wider text-white/45">
        {label}
      </dt>
      <dd className={`mt-0.5 font-ui text-sm font-semibold ${accent ?? 'text-white/90'}`}>{value}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <button
      onClick={() => navigate('/customers')}
      className="font-ui text-xs text-white/50 transition-colors hover:text-goldBright focus:outline-none focus-visible:text-goldBright"
    >
      ← Customers
    </button>
  );
}
