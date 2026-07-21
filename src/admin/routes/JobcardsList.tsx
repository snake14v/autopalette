import { useMemo, useState } from 'react';
import type { Jobcard } from '../../shared/types';
import { driver, useJobcards } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { formatDate, inr } from '../lib/format';
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, type PaymentStatus } from '../lib/status';
import { Badge, Button, EmptyState, Panel, SectionHeading, Spinner, TextInput, useToast } from '../ui';

type Filter = 'all' | PaymentStatus;
const FILTERS: Filter[] = ['all', 'unpaid', 'advance_paid', 'paid'];

export default function JobcardsList() {
  const jobcards = useJobcards();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobcards?.length ?? 0 };
    for (const j of jobcards ?? []) c[j.payment.status] = (c[j.payment.status] ?? 0) + 1;
    return c;
  }, [jobcards]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (jobcards ?? [])
      .filter((j) => (filter === 'all' ? true : j.payment.status === filter))
      .filter((j) => {
        if (!needle) return true;
        return (
          j.customer.phone.toLowerCase().includes(needle) ||
          j.vehicle.regNumber.toLowerCase().includes(needle) ||
          j.invoiceNumber.toLowerCase().includes(needle) ||
          j.customer.name.toLowerCase().includes(needle)
        );
      });
  }, [jobcards, q, filter]);

  async function newWalkIn() {
    if (creating) return;
    setCreating(true);
    try {
      const jc = await driver.createBlankJobcard();
      navigate(`/jobcards/${jc.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create job card', 'error');
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <SectionHeading
        eyebrow="Billing"
        title="Job Cards"
        right={
          <Button onClick={newWalkIn} disabled={creating}>
            {creating ? 'Creating…' : '+ New Job Card'}
          </Button>
        }
      />

      <div className="mt-4 flex flex-col gap-3">
        <TextInput
          type="search"
          placeholder="Search by invoice no, phone, reg, or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search job cards"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by payment status">
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                aria-pressed={active}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 font-ui text-xs font-medium tracking-wide transition-colors ${
                  active
                    ? 'border-gold bg-gold/15 text-goldBright'
                    : 'border-white/12 text-white/55 hover:border-white/25 hover:text-white/80'
                }`}
              >
                {f === 'all' ? 'All' : PAYMENT_STATUS_LABEL[f]}
                <span className="ml-1.5 text-white/35">{counts[f] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        {jobcards === null ? (
          <Spinner label="Loading job cards…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={q || filter !== 'all' ? 'No matching job cards' : 'No job cards yet'}
            hint={
              q || filter !== 'all'
                ? 'Try clearing the search or filter.'
                : 'Convert a booking, or create a walk-in job card to get started.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((j) => (
              <JobcardRow key={j.id} jobcard={j} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function JobcardRow({ jobcard: j }: { jobcard: Jobcard }) {
  return (
    <li>
      <Panel as="div" className="p-0">
        <button
          onClick={() => navigate(`/jobcards/${j.id}`)}
          className="flex w-full flex-col gap-2 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold tracking-wide text-goldBright">
                {j.invoiceNumber || 'Unsaved'}
              </span>
              <Badge tone={PAYMENT_STATUS_TONE[j.payment.status]}>
                {PAYMENT_STATUS_LABEL[j.payment.status]}
              </Badge>
            </div>
            <p className="mt-0.5 truncate font-body text-xs text-white/60">
              {j.customer.name || 'Unnamed'} · {j.vehicle.regNumber || 'No reg'} ·{' '}
              {j.vehicle.makeModel || 'Vehicle n/a'}
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="font-ui text-sm font-semibold text-white">{inr(j.pricing.totalAmount)}</p>
            <p className="font-body text-[0.7rem] text-white/45">{formatDate(j.date)}</p>
          </div>
        </button>
      </Panel>
    </li>
  );
}
