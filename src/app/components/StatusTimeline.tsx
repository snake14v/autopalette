import type { Booking, BookingStatus } from '../../shared/types';
import { TIMELINE_STEPS, statusMeta, formatDateTime } from '../lib/format';
import { CheckIcon, AlertIcon } from './icons';

/** Map each timeline step to the most recent history entry for that status (if any). */
function historyFor(booking: Booking, status: BookingStatus) {
  const matches = booking.statusHistory.filter((h) => h.status === status);
  return matches.length ? matches[matches.length - 1] : undefined;
}

export function StatusTimeline({ booking }: { booking: Booking }) {
  if (booking.status === 'cancelled') {
    const cancelEntry = historyFor(booking, 'cancelled');
    return (
      <div>
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-pinstripe-red/30 bg-pinstripe-red/10 p-4">
          <AlertIcon className="mt-0.5 shrink-0 text-pinstripe-red" />
          <div>
            <p className="font-ui font-semibold text-pinstripe-red">This booking was cancelled</p>
            {cancelEntry?.note ? (
              <p className="mt-1 font-body text-sm text-white/70">{cancelEntry.note}</p>
            ) : null}
            {cancelEntry ? (
              <p className="mt-1 font-ui text-xs text-white/40">{formatDateTime(cancelEntry.at)}</p>
            ) : null}
          </div>
        </div>
        <p className="font-ui text-xs text-white/40">
          Please contact the studio if you have any questions about this booking.
        </p>
      </div>
    );
  }

  const currentIndex = TIMELINE_STEPS.indexOf(booking.status);

  return (
    <ol className="relative" aria-label="Service progress">
      {TIMELINE_STEPS.map((step, i) => {
        const entry = historyFor(booking, step);
        const done = i < currentIndex;
        const current = i === currentIndex;
        const meta = statusMeta(step);
        const isLast = i === TIMELINE_STEPS.length - 1;

        const dot = done
          ? 'border-gold bg-gold text-char'
          : current
            ? `border-goldBright bg-char ${meta.tone}`
            : 'border-white/15 bg-char text-white/25';

        return (
          <li key={step} className="relative flex gap-3.5 pb-6 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px ${done ? 'bg-gold/50' : 'bg-white/10'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${dot} ${current ? 'ring-4 ring-goldBright/15' : ''}`}
              aria-hidden="true"
            >
              {done ? <CheckIcon width={16} height={16} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 pt-1">
              <p className={`font-ui text-sm font-semibold ${done ? 'text-white' : current ? meta.tone : 'text-white/40'}`}>
                {meta.label}
                {current ? <span className="ml-2 font-normal text-white/40">· current</span> : null}
              </p>
              {entry ? (
                <p className="mt-0.5 font-ui text-xs text-white/40">{formatDateTime(entry.at)}</p>
              ) : (
                <p className="mt-0.5 font-ui text-xs text-white/25">Pending</p>
              )}
              {entry?.note ? (
                <p className="mt-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 font-body text-sm text-white/75">
                  {entry.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
