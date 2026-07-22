import { useEffect, useState } from 'react';
import type { WorkItemNote, Booking } from '../../shared/types';
import { driver } from '../lib/driver';
import { formatDateTime } from '../lib/format';

type JobcardStage = NonNullable<Booking['jobcardStage']>;

/**
 * The ONLY two milestone strings the customer may ever see for a job-card stage change.
 * 'working' has no line of its own here — it exists only to drive the coarse progress
 * indicator (see `StageProgressBar` below), never a standalone timeline entry. Never add QC
 * checklist details, void status, or void/reopen reasons here — those stay internal per
 * docs/JOBCARD_LIFECYCLE_SPEC.md "Customer-app tie-in".
 */
const STAGE_MILESTONE_COPY: Partial<Record<JobcardStage, string>> = {
  quality_check: 'Final quality check in progress',
  ready: 'Ready for pickup',
};

interface TimelineEntry {
  key: string;
  at: number;
  text: string;
}

/**
 * `booking.jobcardStage` is a point-in-time mirror (not an event log), so there's no real
 * "changed at" timestamp to show. Rather than fabricate one (or silently reuse an unrelated
 * timestamp), this records — once, per device, per stage — when THIS device first observed
 * the milestone, purely to order it sensibly among the real-timestamped workshop notes.
 */
function firstSeenAt(bookingId: string, stage: JobcardStage): number {
  const key = `ap:milestone-seen:${bookingId}:${stage}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return Number(existing);
  } catch {
    /* storage unavailable — fall through to "now" without persisting */
  }
  const now = Date.now();
  try {
    localStorage.setItem(key, String(now));
  } catch {
    /* ignore */
  }
  return now;
}

/**
 * Chronological, admin-curated progress notes for a booking (customerVisible only), plus an
 * auto-generated milestone line derived from `booking.jobcardStage` — a customer-safe field
 * denormalized onto the booking by the admin-side driver whenever the linked job card's
 * lifecycle status changes (docs/WAVE5_SPEC.md section D). This replaces the old getJobcard()
 * read, which silently failed for every real customer under the live Firestore rules
 * (`jobcards/{id}` reads are admin/staff only) — the customer app now reads only the booking
 * it already has access to. Renders nothing when there's nothing to show.
 */
export function WorkshopUpdates({ booking }: { booking: Booking }) {
  const [notes, setNotes] = useState<WorkItemNote[]>([]);

  useEffect(() => {
    return driver.subscribeCustomerNotes(booking.id, setNotes);
  }, [booking.id]);

  const stage = booking.jobcardStage;
  let milestone: TimelineEntry | null = null;
  if (stage) {
    const text = STAGE_MILESTONE_COPY[stage];
    if (text) milestone = { key: `stage-${booking.id}-${stage}`, text, at: firstSeenAt(booking.id, stage) };
  }

  const items: TimelineEntry[] = [
    ...notes.map((note, i) => ({ key: `note-${note.at}-${i}`, at: note.at, text: note.text })),
    ...(milestone ? [milestone] : []),
  ].sort((a, b) => a.at - b.at);

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-4 font-ui text-sm font-semibold uppercase tracking-wide text-white/50">
        Workshop updates
      </h2>
      <ol className="space-y-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
          >
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-body text-sm text-white/80">{item.text}</p>
              <p className="mt-1 font-ui text-xs text-white/40">{formatDateTime(item.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Coarse progress indicator (WAVE5_SPEC section D) — derived from booking status +
// jobcardStage only. No task counts, no internals: just how far along the visit is.
// ---------------------------------------------------------------------------------------

const STAGE_STEPS = ['requested', 'confirmed', 'in_progress', 'quality_check', 'ready', 'delivered'] as const;

/** Returns a 0..1 fraction, or null when there's nothing meaningful to show (cancelled, or
 * a booking with no progress signal yet beyond "requested"). */
function coarseProgressFraction(booking: Booking): number | null {
  if (booking.status === 'cancelled') return null;
  if (booking.status === 'delivered') return 1;
  if (booking.status === 'ready' || booking.jobcardStage === 'ready') return 4 / (STAGE_STEPS.length - 1);
  if (booking.jobcardStage === 'quality_check') return 3 / (STAGE_STEPS.length - 1);
  if (booking.status === 'in_progress') return 2 / (STAGE_STEPS.length - 1); // covers 'working' or no stage yet
  if (booking.status === 'confirmed') return 1 / (STAGE_STEPS.length - 1);
  return 0; // requested
}

export function StageProgressBar({ booking }: { booking: Booking }) {
  const fraction = coarseProgressFraction(booking);
  if (fraction === null) return null;

  return (
    <div className="mt-3" aria-hidden="true">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-goldBright transition-[width] duration-500"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
    </div>
  );
}
