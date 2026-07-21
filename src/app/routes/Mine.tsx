import { Shell } from '../components/Shell';
import { Button } from '../components/Button';
import { StatusChip } from '../components/StatusChip';
import { CarIcon, CalendarIcon, ChevronRightIcon } from '../components/icons';
import { navigate } from '../lib/router';
import { useMyBookingIds, removeMyBookingId } from '../lib/storage';
import { useBookingsByIds } from '../lib/useBookings';
import { formatDateTime } from '../lib/format';

export function Mine() {
  const ids = useMyBookingIds();
  const { items, loading } = useBookingsByIds(ids);

  return (
    <Shell back="/" title="My bookings">
      <h1 className="mb-1 font-display text-2xl font-bold text-white">My bookings</h1>
      <p className="mb-6 font-body text-sm text-white/55">
        Bookings saved on this device.
      </p>

      {loading && ids.length > 0 && (
        <div className="flex justify-center py-16 text-white/40">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold/40 border-t-transparent" />
        </div>
      )}

      {!loading && ids.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold/70">
            <CalendarIcon width={26} height={26} />
          </div>
          <p className="font-ui text-base font-semibold text-white">No bookings yet</p>
          <p className="mx-auto mt-1.5 max-w-xs font-body text-sm text-white/50">
            When you book a service, its ID is saved here so you can track it anytime.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate('/book')}>Book a service</Button>
          </div>
        </div>
      )}

      {!loading && ids.length > 0 && (
        <ul className="space-y-2.5">
          {items.map(({ id, booking }) =>
            booking ? (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => navigate(`/track/${encodeURIComponent(id)}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
                >
                  <CarIcon className="shrink-0 text-gold/70" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-sm font-medium text-white">
                      {booking.vehicle.regNumber || booking.vehicle.makeModel || 'Your vehicle'}
                    </span>
                    <span className="block truncate font-mono text-xs text-white/40">{id}</span>
                    <span className="mt-0.5 block font-ui text-xs text-white/35">
                      Booked {formatDateTime(booking.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusChip status={booking.status} />
                    <ChevronRightIcon width={16} height={16} className="text-white/30" />
                  </span>
                </button>
              </li>
            ) : (
              <li
                key={id}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-ui text-sm text-white/50">Booking unavailable</span>
                  <span className="block truncate font-mono text-xs text-white/30">{id}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeMyBookingId(id)}
                  className="rounded-lg px-2 py-1 font-ui text-xs text-white/40 hover:text-pinstripe-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
                >
                  Remove
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </Shell>
  );
}
