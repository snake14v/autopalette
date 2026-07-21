import { Shell } from '../components/Shell';
import { Button } from '../components/Button';
import { StatusChip } from '../components/StatusChip';
import { InstallButton } from '../components/InstallButton';
import { CalendarIcon, TrackIcon, CarIcon, ChevronRightIcon } from '../components/icons';
import { href, navigate } from '../lib/router';
import { useMyBookingIds } from '../lib/storage';
import { useBookingsByIds } from '../lib/useBookings';

export function Home() {
  const ids = useMyBookingIds();
  const { items } = useBookingsByIds(ids);
  const recent = items.filter((i) => i.booking).slice(0, 3);

  return (
    <Shell>
      {/* Compact brand hero */}
      <section className="mb-7 mt-2">
        <p className="font-ui text-xs uppercase tracking-[0.25em] text-gold/70">
          JP Nagar · Bengaluru
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-white">
          We don&apos;t detail.
          <br />
          <span className="text-goldBright">We perfect.</span>
        </h1>
        <p className="mt-3 font-body text-[15px] leading-relaxed text-white/60">
          Book a detailing, PPF, ceramic coating or body-shop service and track its progress
          from your phone.
        </p>
      </section>

      {/* Big primary actions */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate('/book')}
          className="group flex w-full items-center gap-4 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/15 to-transparent p-4 text-left transition-colors hover:from-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-goldBright">
            <CalendarIcon width={24} height={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-ui text-base font-semibold text-white">Book a service</span>
            <span className="block font-body text-sm text-white/55">
              Pick services, add your vehicle, done in a minute
            </span>
          </span>
          <ChevronRightIcon className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/track')}
          className="group flex w-full items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <TrackIcon width={24} height={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-ui text-base font-semibold text-white">Track my service</span>
            <span className="block font-body text-sm text-white/55">
              Enter your booking ID to see live status
            </span>
          </span>
          <ChevronRightIcon className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* My bookings (only when this device has some) */}
      {recent.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-ui text-sm font-semibold uppercase tracking-wide text-white/50">
              My bookings
            </h2>
            {ids.length > recent.length && (
              <a
                href={href('/mine')}
                className="font-ui text-xs text-goldBright hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
              >
                View all ({ids.length})
              </a>
            )}
          </div>
          <ul className="space-y-2">
            {recent.map(({ id, booking }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => navigate(`/track/${encodeURIComponent(id)}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
                >
                  <CarIcon className="shrink-0 text-gold/70" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-sm font-medium text-white">
                      {booking!.vehicle.regNumber || booking!.vehicle.makeModel || 'Your vehicle'}
                    </span>
                    <span className="block truncate font-mono text-xs text-white/40">{id}</span>
                  </span>
                  <StatusChip status={booking!.status} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <InstallButton full />
          </div>
        </section>
      )}

      {recent.length === 0 && (
        <div className="mt-8">
          <InstallButton full />
        </div>
      )}
    </Shell>
  );
}
