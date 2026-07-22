import { useEffect, useRef, useState } from 'react';
import type { Booking } from '../../shared/types';
import { Shell } from '../components/Shell';
import { Button } from '../components/Button';
import { StatusChip } from '../components/StatusChip';
import { StatusTimeline } from '../components/StatusTimeline';
import { WorkshopUpdates, StageProgressBar } from '../components/WorkshopUpdates';
import { Field, inputClass } from '../components/Field';
import { CarIcon, AlertIcon, CopyIcon, CheckIcon } from '../components/icons';
import { SERVICE_CATALOG } from '../../shared/catalog';
import { driver } from '../lib/driver';
import { navigate } from '../lib/router';
import { formatDate } from '../lib/format';
import { saveMyBookingId } from '../lib/storage';

const CATALOG_LABELS = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

function serviceLabels(booking: Booking): string[] {
  return booking.serviceIds.map((id) => CATALOG_LABELS.get(id) ?? id);
}

export function Track({ id: routeId }: { id?: string }) {
  const [input, setInput] = useState(routeId ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Enter your booking ID to track your service.');
      return;
    }
    setError(null);
    navigate(`/track/${encodeURIComponent(trimmed)}`);
  }

  // Route carries an id → show the live tracking view.
  if (routeId) {
    return <TrackDetail id={routeId} />;
  }

  // No id → show the input form.
  return (
    <Shell back="/" title="Track">
      <h1 className="mb-1 font-display text-2xl font-bold text-white">Track your service</h1>
      <p className="mb-6 font-body text-sm text-white/55">
        Enter the booking ID from your confirmation.
      </p>

      <form onSubmit={submit} noValidate>
        <Field label="Booking ID" error={error ?? undefined} hint="Looks like bk_xxxxxxxx">
          {(fid, describedBy) => (
            <input
              id={fid}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="bk_..."
              className={`${inputClass(!!error)} font-mono`}
            />
          )}
        </Field>
        <Button type="submit" full>
          Track service
        </Button>
      </form>
    </Shell>
  );
}

function TrackDetail({ id }: { id: string }) {
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined); // undefined = loading
  const known = useRef(false);

  useEffect(() => {
    known.current = false;
    setBooking(undefined);
    const unsub = driver.subscribeBooking(id, (b) => {
      setBooking(b);
      if (b && !known.current) {
        known.current = true;
        saveMyBookingId(id); // keep any tracked booking on this device
      }
    });
    return unsub;
  }, [id]);

  return (
    <Shell back="/track" title="Track">
      {booking === undefined && (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold/40 border-t-transparent" />
          <p className="mt-3 font-ui text-sm">Loading booking…</p>
        </div>
      )}

      {booking === null && (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pinstripe-red/10 text-pinstripe-red">
            <AlertIcon width={28} height={28} />
          </div>
          <h1 className="font-display text-xl font-bold text-white">Booking not found</h1>
          <p className="mx-auto mt-2 max-w-xs font-body text-sm text-white/55">
            We couldn&apos;t find a booking with the ID{' '}
            <span className="font-mono text-white/70">{id}</span>. Double-check the ID from your
            confirmation and try again.
          </p>
          <div className="mt-6">
            <Button variant="secondary" onClick={() => navigate('/track')}>
              Try another ID
            </Button>
          </div>
        </div>
      )}

      {booking && <TrackedBooking booking={booking} />}
    </Shell>
  );
}

function TrackedBooking({ booking }: { booking: Booking }) {
  const [copied, setCopied] = useState(false);
  const labels = serviceLabels(booking);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(booking.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div>
      {/* Vehicle + status header */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CarIcon className="shrink-0 text-gold/70" />
            <div className="min-w-0">
              <p className="truncate font-ui text-base font-semibold text-white">
                {booking.vehicle.regNumber || 'Vehicle'}
              </p>
              {booking.vehicle.makeModel ? (
                <p className="truncate font-body text-sm text-white/50">
                  {booking.vehicle.makeModel}
                </p>
              ) : null}
            </div>
          </div>
          <StatusChip status={booking.status} />
        </div>

        <button
          type="button"
          onClick={copyId}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-char2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
          aria-label="Copy booking ID"
        >
          <span className="min-w-0">
            <span className="block font-ui text-[11px] uppercase tracking-wide text-white/40">
              Booking ID
            </span>
            <span className="block truncate font-mono text-sm text-white/80">{booking.id}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-ui text-xs text-goldBright">
            {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>

        {(labels.length > 0 || booking.preferredDate) && (
          <dl className="mt-3 space-y-1.5 border-t border-white/8 pt-3 text-sm">
            {labels.length > 0 && (
              <div className="flex gap-2">
                <dt className="shrink-0 font-ui text-white/40">Services</dt>
                <dd className="text-right font-body text-white/75">{labels.join(', ')}</dd>
              </div>
            )}
            {booking.preferredDate && (
              <div className="flex justify-between gap-2">
                <dt className="font-ui text-white/40">Preferred date</dt>
                <dd className="font-body text-white/75">{formatDate(booking.preferredDate)}</dd>
              </div>
            )}
            {booking.otherRequest && (
              <div className="flex gap-2">
                <dt className="shrink-0 font-ui text-white/40">Requests</dt>
                <dd className="text-right font-body text-white/75">{booking.otherRequest}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <h2 className="mb-4 font-ui text-sm font-semibold uppercase tracking-wide text-white/50">
        Progress
      </h2>
      <StageProgressBar booking={booking} />
      <StatusTimeline booking={booking} />
      <WorkshopUpdates booking={booking} />
    </div>
  );
}
