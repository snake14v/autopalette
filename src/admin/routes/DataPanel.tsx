import { useMemo } from 'react';
import { useJobcards, useWorkItems } from '../lib/useDriver';
import { buildQuery, navigate } from '../lib/router';
import { inr } from '../lib/format';
import { fmtHours, monthLabel } from '../lib/dates';
import {
  hoursByWeek,
  monthlyJobCounts,
  repeatCustomerRate,
  revenueByMonth,
  topServices,
  totalOutstanding,
} from '../lib/analytics';
import { Panel, SectionHeading, Spinner } from '../ui';

// Admin dashboard home = Data panel (Wave 2). Every figure is computed ONLY from real
// recorded job cards / work items, each labelled with its date range. Empty inputs show
// "No data yet" — never placeholder numbers.
export default function DataPanel() {
  const jobcards = useJobcards();
  const workItems = useWorkItems();

  const loading = jobcards === null || workItems === null;

  const stats = useMemo(() => {
    const jc = jobcards ?? [];
    const wi = workItems ?? [];
    return {
      counts: monthlyJobCounts(jc),
      revenue: revenueByMonth(jc, 6),
      outstanding: totalOutstanding(jc),
      services: topServices(jc, 5),
      repeat: repeatCustomerRate(jc),
      hours: hoursByWeek(wi, 6),
      totalJobs: jc.length,
    };
  }, [jobcards, workItems]);

  if (loading) return <Spinner label="Loading dashboard…" />;

  const monthDelta = stats.counts.thisMonth - stats.counts.lastMonth;
  const hasAnyData = stats.totalJobs > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <SectionHeading eyebrow="Overview" title="Studio Dashboard" />

      {!hasAnyData ? (
        <div className="mt-5">
          <Panel className="p-8 text-center">
            <p className="font-display text-sm uppercase tracking-wide text-white/55">No data yet</p>
            <p className="mx-auto mt-2 max-w-md font-body text-xs text-white/40">
              Metrics appear here once you save job cards and log work. Nothing is estimated or
              filled in — every number traces to a real record.
            </p>
          </Panel>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Jobs this month vs last — drills to the month-filtered job cards. */}
          <Panel className="p-0">
            <button
              onClick={() => navigate(`/jobcards${buildQuery({ month: stats.counts.thisKey })}`)}
              className="block w-full rounded-xl p-4 text-left transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            >
              <CardHead
                title="Jobs This Month"
                sub={`${monthLabel(stats.counts.thisKey)} vs ${monthLabel(stats.counts.lastKey)}`}
                drill
              />
              <div className="mt-3 flex items-end gap-4">
                <div>
                  <p className="font-display text-4xl font-bold text-goldBright">
                    {stats.counts.thisMonth}
                  </p>
                  <p className="font-body text-xs text-white/45">this month</p>
                </div>
                <div className="pb-1">
                  <p className="font-ui text-sm text-white/70">{stats.counts.lastMonth} last</p>
                  <p
                    className={`font-body text-xs ${
                      monthDelta > 0
                        ? 'text-pinstripe-emerald'
                        : monthDelta < 0
                          ? 'text-pinstripe-red'
                          : 'text-white/40'
                    }`}
                  >
                    {monthDelta > 0 ? '▲' : monthDelta < 0 ? '▼' : '—'} {Math.abs(monthDelta)}
                  </p>
                </div>
              </div>
            </button>
          </Panel>

          {/* Outstanding + repeat rate */}
          <Panel className="p-4">
            <CardHead title="Money & Loyalty" sub="All job cards to date" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate(`/jobcards${buildQuery({ pay: 'outstanding' })}`)}
                className="rounded-lg p-1 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              >
                <p className="font-ui text-[0.65rem] uppercase tracking-wider text-white/45">
                  Outstanding <span aria-hidden="true" className="text-pinstripe-cyan/70">→</span>
                </p>
                <p
                  className={`mt-0.5 font-ui text-xl font-bold ${
                    stats.outstanding > 0 ? 'text-pinstripe-red' : 'text-pinstripe-emerald'
                  }`}
                >
                  {inr(stats.outstanding)}
                </p>
              </button>
              <div className="p-1">
                <p className="font-ui text-[0.65rem] uppercase tracking-wider text-white/45">
                  Repeat Customers
                </p>
                <p className="mt-0.5 font-ui text-xl font-bold text-goldBright">
                  {Math.round(stats.repeat.rate * 100)}%
                </p>
                <p className="font-body text-[0.65rem] text-white/40">
                  {stats.repeat.repeat} of {stats.repeat.total} with &gt;1 job
                </p>
              </div>
            </div>
          </Panel>

          {/* Revenue by month */}
          <Panel className="p-4">
            <CardHead title="Revenue by Month" sub="Σ job-card totals · last 6 months" />
            <BarChart
              data={stats.revenue.map((r) => ({ label: monthLabel(r.key), value: r.total }))}
              format={(v) => inr(v)}
              emptyLabel="No revenue recorded yet"
            />
          </Panel>

          {/* Hours logged per week — drills to the Day Board. */}
          <Panel className="p-0">
            <button
              onClick={() => navigate('/dayboard')}
              className="block w-full rounded-xl p-4 text-left transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            >
              <BarChart
                data={stats.hours.map((h) => ({ label: h.key.replace(/^\d{4}-/, ''), value: h.hours }))}
                format={(v) => fmtHours(v)}
                tone="bg-pinstripe-cyan/60"
                emptyLabel="No hours logged yet"
              />
            </button>
          </Panel>

          {/* Top services — each row drills to job cards filtered by that service. */}
          <Panel className="p-4 md:col-span-2">
            <CardHead title="Top Services" sub="By frequency across all job cards · tap a row to view" />
            {stats.services.length === 0 ? (
              <p className="mt-3 font-body text-sm text-white/40">No services billed yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {stats.services.map((s) => {
                  const max = stats.services[0].count || 1;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => navigate(`/jobcards${buildQuery({ service: s.id })}`)}
                        className="flex w-full items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                      >
                        <span className="w-40 shrink-0 truncate font-body text-sm text-white/75">
                          {s.label}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gold/60"
                            style={{ width: `${Math.max(6, (s.count / max) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-ui text-sm text-white/80">
                          {s.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* Quick jump */}
      <div className="mt-6 flex flex-wrap gap-2">
        <QuickLink label="Bookings" onClick={() => navigate('/bookings')} />
        <QuickLink label="Job Cards" onClick={() => navigate('/jobcards')} />
        <QuickLink label="Day Board" onClick={() => navigate('/dayboard')} />
        <QuickLink label="Customers" onClick={() => navigate('/customers')} />
      </div>
    </div>
  );
}

function CardHead({ title, sub, drill }: { title: string; sub: string; drill?: boolean }) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-goldBright">
        {title}
        {drill && <span aria-hidden="true" className="ml-1.5 text-pinstripe-cyan/70">→</span>}
      </h3>
      <p className="mt-0.5 font-body text-[0.65rem] text-white/40">{sub}</p>
    </div>
  );
}

function BarChart({
  data,
  format,
  tone = 'bg-gold/60',
  emptyLabel,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  tone?: string;
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <p className="mt-3 font-body text-sm text-white/40">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="mt-3 flex h-32 items-end gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="font-body text-[0.6rem] text-white/50">{format(d.value)}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t ${tone}`}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${format(d.value)}`}
            />
          </div>
          <span className="font-body text-[0.6rem] text-white/45">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-white/12 px-3 py-1.5 font-ui text-xs text-white/65 transition-colors hover:border-gold/40 hover:text-goldBright"
    >
      {label} →
    </button>
  );
}
