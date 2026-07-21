import type { BookingStatus } from '../../shared/types';
import { statusMeta } from '../lib/format';

export function StatusChip({ status }: { status: BookingStatus }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-ui text-xs font-medium ${meta.chip}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
