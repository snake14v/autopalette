import { useMemo, useState } from 'react';
import type { WorkItem, WorkItemNote } from '../../shared/types';
import { driver, useAuth, useWorkItems } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { fmtHours, isBeforeToday, todayISO } from '../lib/dates';
import { formatDate, formatTimestamp } from '../lib/format';
import { WORKITEM_STATUS_LABEL, WORKITEM_STATUS_TONE } from '../lib/status';
import { useOptimisticAction } from '../lib/useOptimisticAction';
import { Badge, Button, EmptyState, Panel, Spinner, Textarea, Toggle, useToast } from '../ui';

// Staff "My Day" (Wave 2): the signed-in employee's own items — today plus an overdue
// backlog. Big touch targets; used on phones in the workshop. Start → in_progress,
// Finish → auto-logs hours, notes with an explicit customer-visible toggle (default OFF),
// read-only once an admin confirms.
export default function MyDay() {
  const auth = useAuth();
  const employeeId = auth?.employeeId;
  const items = useWorkItems(employeeId ? { employeeId } : undefined);

  const { today, overdue } = useMemo(() => {
    const t: WorkItem[] = [];
    const o: WorkItem[] = [];
    const now = todayISO();
    for (const w of items ?? []) {
      if (w.date === now) t.push(w);
      else if (isBeforeToday(w.date) && w.status !== 'confirmed') o.push(w);
    }
    // Overdue newest-first is confusing for a backlog; show oldest first so it's worked down.
    o.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { today: t, overdue: o };
  }, [items]);

  if (auth === undefined || items === null) return <Spinner label="Loading your day…" />;

  if (!employeeId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <EmptyState title="No employee profile" hint="This account isn't linked to a roster member." />
      </div>
    );
  }

  const empty = today.length === 0 && overdue.length === 0;

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4">
        <p className="font-ui text-[0.65rem] uppercase tracking-[0.25em] text-pinstripe-cyan/80">
          {formatDate(todayISO())}
        </p>
        <h1 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-goldBright">
          My Day
        </h1>
      </div>

      {empty ? (
        <EmptyState
          title="Nothing assigned"
          hint="When the admin assigns you work, it shows up here. Check back soon."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {overdue.length > 0 && (
            <Section title="Overdue" tone="text-pinstripe-red">
              {overdue.map((w) => (
                <StaffCard key={w.id} item={w} overdue />
              ))}
            </Section>
          )}
          <Section title="Today">
            {today.length === 0 ? (
              <p className="font-body text-sm text-white/40">No items scheduled for today.</p>
            ) : (
              today.map((w) => <StaffCard key={w.id} item={w} />)
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  tone = 'text-white/60',
  children,
}: {
  title: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className={`mb-2 font-ui text-xs font-semibold uppercase tracking-widest ${tone}`}>
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function StaffCard({ item, overdue = false }: { item: WorkItem; overdue?: boolean }) {
  const optimistic = useOptimisticAction();
  const [noteOpen, setNoteOpen] = useState(false);
  const busy = optimistic.busy;

  const readOnly = item.status === 'confirmed';

  // Optimistic Start/Finish with an Undo that reverts the status (item 6). Hours re-log on a
  // fresh Finish; Undo restores the prior stage.
  function move(status: 'in_progress' | 'finished') {
    const prev = item.status;
    optimistic.run({
      do: () => driver.updateWorkItemStatus(item.id, status),
      undo: () => driver.updateWorkItemStatus(item.id, prev),
      message: status === 'in_progress' ? 'Started' : 'Finished — hours logged',
      undoneMessage: `Reverted to ${WORKITEM_STATUS_LABEL[prev]}`,
    });
  }

  return (
    <Panel as="div" className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ui text-base font-semibold text-white">{item.title}</p>
          <p className="mt-0.5 font-body text-xs text-white/50">
            {overdue && <span className="text-pinstripe-red">{formatDate(item.date)} · </span>}
            Est {item.estHours != null ? fmtHours(item.estHours) : '—'}
            {item.hoursLogged > 0 && ` · Logged ${fmtHours(item.hoursLogged)}`}
          </p>
        </div>
        <Badge tone={WORKITEM_STATUS_TONE[item.status]}>{WORKITEM_STATUS_LABEL[item.status]}</Badge>
      </div>

      {(item.jobcardId || item.bookingId) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.jobcardId && (
            <button
              onClick={() => navigate(`/jobcards/${item.jobcardId}`)}
              className="rounded border border-pinstripe-cyan/30 bg-pinstripe-cyan/10 px-2 py-1 font-body text-xs text-pinstripe-cyan/90"
            >
              Job card →
            </button>
          )}
          {item.bookingId && (
            <button
              onClick={() => navigate(`/bookings/${item.bookingId}`)}
              className="rounded border border-white/15 bg-white/5 px-2 py-1 font-body text-xs text-white/70"
            >
              Booking →
            </button>
          )}
        </div>
      )}

      {/* Notes so far */}
      {item.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-white/10 pt-3">
          {item.notes.map((n, i) => (
            <NoteRow key={`${n.at}-${i}`} note={n} />
          ))}
        </ul>
      )}

      {/* Actions — big touch targets */}
      {!readOnly && (
        <div className="mt-4 flex flex-col gap-2">
          {item.status === 'assigned' && (
            <Button onClick={() => move('in_progress')} disabled={busy} className="w-full py-3 text-base">
              ▶ Start
            </Button>
          )}
          {item.status === 'in_progress' && (
            <Button onClick={() => move('finished')} disabled={busy} className="w-full py-3 text-base">
              ✓ Finish
            </Button>
          )}
          {item.status === 'finished' && (
            <p className="rounded-lg border border-pinstripe-cyan/25 bg-pinstripe-cyan/5 px-3 py-2 text-center font-body text-xs text-pinstripe-cyan/80">
              Finished — awaiting admin confirmation.
            </p>
          )}
          <Button
            variant="ghost"
            onClick={() => setNoteOpen((v) => !v)}
            className="w-full py-2.5"
          >
            {noteOpen ? 'Close note' : '+ Add progress note'}
          </Button>
          {noteOpen && <NoteForm itemId={item.id} onDone={() => setNoteOpen(false)} />}
        </div>
      )}

      {readOnly && (
        <p className="mt-4 rounded-lg border border-pinstripe-emerald/25 bg-pinstripe-emerald/5 px-3 py-2 text-center font-body text-xs text-pinstripe-emerald/80">
          Confirmed by admin · read-only
        </p>
      )}
    </Panel>
  );
}

function NoteRow({ note }: { note: WorkItemNote }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
          note.customerVisible ? 'bg-pinstripe-emerald' : 'bg-white/30'
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-body text-sm text-white/75">{note.text}</p>
        <p className="font-body text-[0.65rem] text-white/40">
          {formatTimestamp(note.at)}
          {note.customerVisible && (
            <span className="ml-1.5 text-pinstripe-emerald/70">· visible to customer</span>
          )}
        </p>
      </div>
    </li>
  );
}

function NoteForm({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [customerVisible, setCustomerVisible] = useState(false); // default OFF (internal)
  const [busy, setBusy] = useState(false);

  async function add() {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      await driver.addWorkNote(itemId, text.trim(), customerVisible);
      toast(customerVisible ? 'Note added (customer will see it)' : 'Internal note added');
      setText('');
      setCustomerVisible(false);
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add note', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-char3/50 p-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Paint correction stage 2 done, PPF tomorrow."
        aria-label="Progress note"
        autoFocus
      />
      <Toggle
        checked={customerVisible}
        onChange={setCustomerVisible}
        label="Visible to customer"
        hint="Off = internal only. On = shows on the customer's tracking timeline."
      />
      <Button onClick={add} disabled={busy || !text.trim()} className="w-full py-2.5">
        {busy ? 'Adding…' : 'Add note'}
      </Button>
    </div>
  );
}
