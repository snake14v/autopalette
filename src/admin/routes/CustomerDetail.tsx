import { useMemo, useState } from 'react';
import type { Booking, Customer, Jobcard } from '../../shared/types';
import { driver, useBookings, useCustomers, useJobcards } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { normalizePhone } from '../../shared/data';
import { formatDate, formatTimestamp, inr, whatsappLink } from '../lib/format';
import { customerWhatsappLink, paymentNudgeText } from '../lib/whatsapp';
import { rollupCustomer } from '../lib/analytics';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  JOBCARD_STATUS_LABEL,
  JOBCARD_STATUS_TONE,
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

  // Most recent job card with a balance still due — the target for a payment nudge.
  const nudgeTarget = useMemo(() => {
    const open = myJobcards
      .filter((j) => j.payment.status !== 'paid' && (j.pricing.balanceDue || 0) > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return open[0] ?? null;
  }, [myJobcards]);

  // docs/WAVE5_SPEC.md section B — "most recent vehicle" for the New Job Card quick action:
  // most recent job card's vehicle, falling back to the most recent booking's, then the
  // registry's first vehicle on file.
  const mostRecentVehicle = useMemo(() => {
    const byJcDate = [...myJobcards].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (byJcDate[0]?.vehicle.regNumber) return byJcDate[0].vehicle;
    const byBookingCreated = [...myBookings].sort((a, b) => b.createdAt - a.createdAt);
    if (byBookingCreated[0]?.vehicle.regNumber) return byBookingCreated[0].vehicle;
    if (customer) {
      const first = customer.vehicles[0];
      if (first) return { regNumber: first.reg, makeModel: first.makeModel };
    }
    return null;
  }, [myJobcards, myBookings, customer]);

  const [notes, setNotes] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [creatingJobcard, setCreatingJobcard] = useState(false);
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

  // docs/WAVE5_SPEC.md section B — per-vehicle history grouping when >1 vehicle on file.
  const multiVehicle = vehicleMap.size > 1;
  const timelineByVehicle = useMemo(() => {
    if (!multiVehicle) return null;
    const groups = new Map<string, TimelineEntry[]>();
    const other: TimelineEntry[] = [];
    for (const e of timeline) {
      const reg = (e.kind === 'booking' ? e.booking.vehicle.regNumber : e.jobcard.vehicle.regNumber)
        ?.toUpperCase()
        .trim();
      if (!reg) {
        other.push(e);
        continue;
      }
      const list = groups.get(reg) ?? [];
      list.push(e);
      groups.set(reg, list);
    }
    return { groups, other };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, multiVehicle]);

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

  // docs/WAVE5_SPEC.md section B — "New job card" quick action: prefilled with this
  // customer + their most recent vehicle. No invoice number allocated yet (same as a walk-in).
  async function newJobcardForCustomer() {
    if (creatingJobcard || !customer) return;
    setCreatingJobcard(true);
    try {
      const jc = await driver.createBlankJobcardFor(
        { name: customer.name, phone: customer.phone },
        mostRecentVehicle ?? { regNumber: '', makeModel: '' }
      );
      navigate(`/jobcards/${jc.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create job card', 'error');
      setCreatingJobcard(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <BackLink />

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <SectionHeading eyebrow="Customer" title={customer.name || 'Unnamed'} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={newJobcardForCustomer} disabled={creatingJobcard}>
            {creatingJobcard ? 'Creating…' : '+ New Job Card'}
          </Button>
          <a
            href={whatsappLink(`Hi ${customer.name || ''}`.trim())}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-pinstripe-emerald/40 px-3 py-1.5 font-ui text-xs text-pinstripe-emerald hover:bg-pinstripe-emerald/10"
          >
            WhatsApp
          </a>
        </div>
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
        {/* Payment nudge (item 4) — review-and-send WhatsApp for the latest unpaid invoice. */}
        {roll.outstanding > 0 &&
          nudgeTarget &&
          (() => {
            const waLink = customerWhatsappLink(customer.phone, paymentNudgeText(nudgeTarget));
            return waLink ? (
              <div className="mt-3">
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-pinstripe-emerald/40 px-3 py-1.5 font-ui text-xs text-pinstripe-emerald transition-colors hover:bg-pinstripe-emerald/10"
                  title="Opens WhatsApp with a payment reminder to review and send"
                >
                  Nudge {nudgeTarget.invoiceNumber || 'invoice'} on WhatsApp
                </a>
              </div>
            ) : null;
          })()}
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

      {/* History — grouped per vehicle when the customer has >1 vehicle on file
          (docs/WAVE5_SPEC.md section B); a flat list otherwise, unchanged from before. */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="History" />
        {timeline.length === 0 ? (
          <p className="mt-2 font-body text-sm text-white/40">No bookings or job cards yet.</p>
        ) : timelineByVehicle ? (
          <div className="mt-3 flex flex-col gap-4">
            {[...timelineByVehicle.groups.entries()].map(([reg, entries]) => (
              <div key={reg}>
                <p className="mb-1.5 font-ui text-[0.65rem] font-semibold uppercase tracking-wider text-white/45">
                  {reg}
                  {vehicleMap.get(reg) ? ` · ${vehicleMap.get(reg)}` : ''}
                </p>
                <ul className="flex flex-col gap-2">
                  {entries.map((e, i) =>
                    e.kind === 'booking' ? (
                      <HistoryBooking key={`b-${e.booking.id}-${i}`} booking={e.booking} />
                    ) : (
                      <HistoryJobcard key={`j-${e.jobcard.id}-${i}`} jobcard={e.jobcard} />
                    )
                  )}
                </ul>
              </div>
            ))}
            {timelineByVehicle.other.length > 0 && (
              <div>
                <p className="mb-1.5 font-ui text-[0.65rem] font-semibold uppercase tracking-wider text-white/45">
                  No reg on file
                </p>
                <ul className="flex flex-col gap-2">
                  {timelineByVehicle.other.map((e, i) =>
                    e.kind === 'booking' ? (
                      <HistoryBooking key={`b-${e.booking.id}-${i}`} booking={e.booking} />
                    ) : (
                      <HistoryJobcard key={`j-${e.jobcard.id}-${i}`} jobcard={e.jobcard} />
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xs font-bold tracking-wide text-goldBright">
              {j.invoiceNumber || 'Unsaved'}
            </span>
            {j.status === 'void' ? (
              <Badge tone={JOBCARD_STATUS_TONE.void}>{JOBCARD_STATUS_LABEL.void}</Badge>
            ) : (
              <Badge tone={PAYMENT_STATUS_TONE[j.payment.status]}>
                {PAYMENT_STATUS_LABEL[j.payment.status]}
              </Badge>
            )}
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
