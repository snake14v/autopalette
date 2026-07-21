import { useEffect, useState } from 'react';
import type { WorkItemNote } from '../../shared/types';
import { driver } from '../lib/driver';
import { formatDateTime } from '../lib/format';

/**
 * Chronological, admin-curated progress notes for a booking (customerVisible only).
 * Renders nothing when there are no notes yet — no empty-state noise.
 * Live-updating via driver.subscribeCustomerNotes.
 */
export function WorkshopUpdates({ bookingId }: { bookingId: string }) {
  const [notes, setNotes] = useState<WorkItemNote[]>([]);

  useEffect(() => {
    return driver.subscribeCustomerNotes(bookingId, setNotes);
  }, [bookingId]);

  if (notes.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-4 font-ui text-sm font-semibold uppercase tracking-wide text-white/50">
        Workshop updates
      </h2>
      <ol className="space-y-3">
        {notes.map((note, i) => (
          <li
            key={`${note.at}-${i}`}
            className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
          >
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-body text-sm text-white/80">{note.text}</p>
              <p className="mt-1 font-ui text-xs text-white/40">{formatDateTime(note.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
