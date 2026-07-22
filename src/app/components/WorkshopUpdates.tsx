import { useEffect, useState } from 'react';
import type { WorkItemNote, Jobcard } from '../../shared/types';
import { driver } from '../lib/driver';
import { formatDateTime } from '../lib/format';

/**
 * Job-card lifecycle statuses relevant to the customer view. Kept local (not imported)
 * because `JobcardStatus` doesn't exist on `src/shared/types.ts` yet — the values are
 * frozen verbatim by docs/JOBCARD_LIFECYCLE_SPEC.md, so this can be coded against ahead
 * of that field landing. Once it lands, `Jobcard['status']` will simply satisfy this
 * narrower local type.
 */
type JobcardLifecycleStatus =
  | 'open'
  | 'in_progress'
  | 'quality_check'
  | 'completed'
  | 'closed'
  | 'void';

/**
 * The ONLY two milestone strings the customer may ever see for a job-card status change.
 * Never add QC checklist details, void status, or void/reopen reasons here — those stay
 * internal per docs/JOBCARD_LIFECYCLE_SPEC.md "Customer-app tie-in".
 */
const CUSTOMER_MILESTONE_COPY: Partial<Record<JobcardLifecycleStatus, string>> = {
  quality_check: 'Final quality check in progress',
  completed: 'Ready for pickup',
};

interface TimelineEntry {
  key: string;
  at: number;
  text: string;
}

/**
 * Chronological, admin-curated progress notes for a booking (customerVisible only),
 * plus an auto-generated milestone line when the linked job card reaches quality_check
 * or completed. Renders nothing when there's nothing to show — no empty-state noise.
 */
export function WorkshopUpdates({
  bookingId,
  jobcardId,
}: {
  bookingId: string;
  jobcardId?: string;
}) {
  const [notes, setNotes] = useState<WorkItemNote[]>([]);
  const [milestone, setMilestone] = useState<TimelineEntry | null>(null);

  useEffect(() => {
    return driver.subscribeCustomerNotes(bookingId, setNotes);
  }, [bookingId]);

  useEffect(() => {
    setMilestone(null);
    if (!jobcardId) return;
    let cancelled = false;

    // NOTE: DataDriver has no live per-id jobcard subscription — this is a best-effort
    // one-shot read via getJobcard, per the task's guidance. In live (Firestore) mode,
    // firestore.rules currently scopes `jobcards/{id}` reads to admin/staff only, so an
    // unauthenticated customer read here will reject; caught below and treated as "no
    // milestone yet" rather than an error. Flagged as a real gap in the build report —
    // needs either a customer-safe read path or a denormalized status mirrored onto the
    // booking, added by whoever owns src/shared/data.ts + firestore.rules.
    driver
      .getJobcard(jobcardId)
      .then((jc) => {
        if (cancelled || !jc) return;
        const status = (jc as Jobcard & { status?: JobcardLifecycleStatus }).status;
        if (!status) return;
        const text = CUSTOMER_MILESTONE_COPY[status];
        if (!text) return; // only these two statuses ever produce a customer-visible line
        const history = (
          jc as Jobcard & { statusHistory?: { status: JobcardLifecycleStatus; at: number }[] }
        ).statusHistory;
        const at = history
          ?.slice()
          .reverse()
          .find((h) => h.status === status)?.at;
        setMilestone({ key: `jobcard-${jobcardId}-${status}`, text, at: at ?? Date.now() });
      })
      .catch(() => {
        /* permission-denied / offline / not found — silently show no milestone line */
      });

    return () => {
      cancelled = true;
    };
  }, [jobcardId]);

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
