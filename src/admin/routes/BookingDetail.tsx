import { useState } from 'react';
import type { BookingStatus } from '../../shared/types';
import { driver, useBooking } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { formatDate, formatTimestamp } from '../lib/format';
import {
  BOOKING_FLOW,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  nextBookingStatus,
} from '../lib/status';
import { SERVICE_CATALOG } from '../../shared/catalog';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Panel,
  SectionHeading,
  Spinner,
  Textarea,
  useToast,
} from '../ui';

const LABEL_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

export default function BookingDetail({ id }: { id: string }) {
  const booking = useBooking(id);
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (booking === undefined) return <Spinner label="Loading booking…" />;
  if (booking === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <BackLink />
        <EmptyState title="Booking not found" hint="It may have been removed or the link is stale." />
      </div>
    );
  }

  const next = nextBookingStatus(booking.status);
  const isCancelled = booking.status === 'cancelled';

  async function advance(to: BookingStatus) {
    if (busy) return;
    setBusy(true);
    try {
      await driver.updateBookingStatus(booking!.id, to, note.trim() || undefined);
      setNote('');
      toast(`Status → ${BOOKING_STATUS_LABEL[to]}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (busy) return;
    if (booking!.jobcardId) {
      navigate(`/jobcards/${booking!.jobcardId}`);
      return;
    }
    setBusy(true);
    try {
      const jc = await driver.createJobcardFromBooking(booking!.id);
      toast('Job card created');
      navigate(`/jobcards/${jc.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create job card', 'error');
      setBusy(false);
    }
  }

  const services = booking.serviceIds.map((sid) => LABEL_BY_ID.get(sid) ?? sid);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <BackLink />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <SectionHeading eyebrow="Booking" title={booking.customer.name || 'Unnamed customer'} />
        <div className="flex items-center gap-3">
          {booking.customer.phone.trim() && (
            <button
              onClick={() => navigate(`/customers/${encodeURIComponent(booking.customer.phone)}`)}
              className="font-ui text-xs text-pinstripe-cyan/80 hover:text-pinstripe-cyan"
            >
              View customer →
            </button>
          )}
          <Badge tone={BOOKING_STATUS_TONE[booking.status]}>
            {BOOKING_STATUS_LABEL[booking.status]}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <Panel className="mt-4 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Detail label="Phone" value={booking.customer.phone || '—'} />
          <Detail label="Reg Number" value={booking.vehicle.regNumber || '—'} />
          <Detail label="Make / Model" value={booking.vehicle.makeModel || '—'} />
          <Detail
            label="Odometer"
            value={booking.vehicle.odometer != null ? `${booking.vehicle.odometer} km` : '—'}
          />
          <Detail label="Preferred Date" value={formatDate(booking.preferredDate)} />
          <Detail label="Requested" value={formatTimestamp(booking.createdAt)} />
        </dl>

        <div className="mt-4">
          <p className="font-ui text-xs font-medium uppercase tracking-wider text-white/50">
            Services Requested
          </p>
          {services.length === 0 ? (
            <p className="mt-1 font-body text-sm text-white/45">None listed.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {services.map((s, i) => (
                <span
                  key={i}
                  className="rounded-md border border-white/12 bg-char3/70 px-2 py-1 font-body text-xs text-white/80"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          {booking.otherRequest && (
            <p className="mt-2 font-body text-sm text-white/70">
              <span className="text-white/45">Note: </span>
              {booking.otherRequest}
            </p>
          )}
        </div>
      </Panel>

      {/* Status stepper */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Status" />
        <ol className="mt-3 flex flex-wrap items-center gap-1.5">
          {BOOKING_FLOW.map((s, i) => {
            const currentIdx = BOOKING_FLOW.indexOf(booking.status);
            const reached = !isCancelled && currentIdx >= i;
            const isCurrent = booking.status === s;
            return (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  className={`rounded-full border px-2.5 py-1 font-ui text-[0.7rem] font-medium tracking-wide ${
                    isCurrent
                      ? BOOKING_STATUS_TONE[s]
                      : reached
                        ? 'border-pinstripe-emerald/30 bg-pinstripe-emerald/5 text-pinstripe-emerald/70'
                        : 'border-white/10 text-white/35'
                  }`}
                >
                  {BOOKING_STATUS_LABEL[s]}
                </span>
                {i < BOOKING_FLOW.length - 1 && (
                  <span aria-hidden="true" className="text-white/20">
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {isCancelled ? (
          <p className="mt-4 font-body text-sm text-pinstripe-red">
            This booking was cancelled. No further status changes.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <label className="font-ui text-xs font-medium uppercase tracking-wider text-white/50">
              Note for this update <span className="text-white/30">(optional, shown to customer)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Vehicle received, work starting tomorrow morning."
            />
            <div className="flex flex-wrap gap-2">
              {next && (
                <Button onClick={() => advance(next)} disabled={busy}>
                  Advance to {BOOKING_STATUS_LABEL[next]}
                </Button>
              )}
              <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={busy}>
                Cancel Booking
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Job card link */}
      <Panel className="mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-ui text-sm font-semibold text-white">Job Card</p>
            <p className="font-body text-xs text-white/50">
              {booking.jobcardId
                ? 'A job card is linked to this booking.'
                : 'Convert this booking into a job card to begin billing.'}
            </p>
          </div>
          <Button variant={booking.jobcardId ? 'secondary' : 'primary'} onClick={convert} disabled={busy}>
            {booking.jobcardId ? 'Open Job Card' : 'Convert to Job Card'}
          </Button>
        </div>
      </Panel>

      {/* History */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="History" />
        <ul className="mt-3 flex flex-col gap-2">
          {[...booking.statusHistory].reverse().map((h, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold/60" aria-hidden="true" />
              <div>
                <p className="font-ui text-sm text-white/85">{BOOKING_STATUS_LABEL[h.status]}</p>
                <p className="font-body text-[0.7rem] text-white/45">{formatTimestamp(h.at)}</p>
                {h.note && <p className="font-body text-xs text-white/60">{h.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this booking?"
        body="The customer's tracking timeline will show it as cancelled. This can't advance further."
        confirmLabel="Cancel Booking"
        cancelLabel="Keep"
        danger
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          advance('cancelled');
        }}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-ui text-[0.7rem] font-medium uppercase tracking-wider text-white/45">
        {label}
      </dt>
      <dd className="mt-0.5 font-body text-sm text-white/85">{value}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <button
      onClick={() => navigate('/bookings')}
      className="font-ui text-xs text-white/50 transition-colors hover:text-goldBright focus:outline-none focus-visible:text-goldBright"
    >
      ← Bookings
    </button>
  );
}
