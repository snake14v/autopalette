import { useMemo, useState } from 'react';
import type { Employee, WorkItem, WorkItemStatus } from '../../shared/types';
import { driver, useBookings, useEmployees, useJobcards, useWorkItems } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { fmtHours, isSameWeek, todayISO } from '../lib/dates';
import { formatDate } from '../lib/format';
import { WORKITEM_STATUS_LABEL, WORKITEM_STATUS_TONE } from '../lib/status';
import { canEditWorkItem, editWorkItemLocal } from '../lib/workItemEdit';
import { employeeColor } from '../../shared/colors';
import {
  Badge,
  Button,
  ColorDot,
  EmptyState,
  Field,
  Modal,
  Panel,
  SectionHeading,
  Select,
  Spinner,
  TextInput,
  useToast,
} from '../ui';

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Admin Day Board (Wave 2): pick a date, see every employee's timetable for it, create /
// assign / confirm / adjust work items, with day + week hour totals per employee.
export default function DayBoard() {
  const [date, setDate] = useState(todayISO());
  const employees = useEmployees();
  const allItems = useWorkItems(); // all items — we derive the day + week views client-side
  const [createOpen, setCreateOpen] = useState(false);

  const dayItems = useMemo(
    () => (allItems ?? []).filter((w) => w.date === date),
    [allItems, date]
  );

  const activeEmployees = useMemo(() => (employees ?? []).filter((e) => e.active), [employees]);

  // Employees to show as groups: active roster + anyone with an item today (covers deactivated).
  const groups = useMemo(() => {
    const byId = new Map<string, Employee>();
    for (const e of employees ?? []) byId.set(e.id, e);
    const ids = new Set<string>(activeEmployees.map((e) => e.id));
    for (const w of dayItems) ids.add(w.assignedTo);
    return [...ids].map((id) => ({
      id,
      employee: byId.get(id) ?? null,
      items: dayItems.filter((w) => w.assignedTo === id),
    }));
  }, [employees, activeEmployees, dayItems]);

  const loading = employees === null || allItems === null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <SectionHeading
        eyebrow="Workshop"
        title="Day Board"
        right={
          <Button onClick={() => setCreateOpen(true)} disabled={loading}>
            + Assign Work
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Field label="Date" className="w-auto">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="w-auto"
            />
          )}
        </Field>
        <div className="flex gap-2 pt-5">
          <Button variant="ghost" onClick={() => setDate(todayISO())}>
            Today
          </Button>
        </div>
        <p className="pt-5 font-body text-xs text-white/45">{formatDate(date)}</p>
      </div>

      <div className="mt-5">
        {loading ? (
          <Spinner label="Loading day board…" />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No employees to schedule"
            hint="Add active employees under Employees, then assign work here."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <EmployeeColumn
                key={g.id}
                employee={g.employee}
                employeeId={g.id}
                items={g.items}
                allItems={allItems ?? []}
                date={date}
                employees={employees ?? []}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateWorkItemModal
          date={date}
          employees={activeEmployees}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

function EmployeeColumn({
  employee,
  employeeId,
  items,
  allItems,
  date,
  employees,
}: {
  employee: Employee | null;
  employeeId: string;
  items: WorkItem[];
  allItems: WorkItem[];
  date: string;
  employees: Employee[];
}) {
  const dayHours = items.reduce((s, w) => s + (w.hoursLogged || 0), 0);
  const weekHours = allItems
    .filter((w) => w.assignedTo === employeeId && isSameWeek(w.date, date))
    .reduce((s, w) => s + (w.hoursLogged || 0), 0);
  // docs/WAVE5_SPEC.md section D — Day Board load view: est-hours total vs logged, in the
  // employee's colour. No estimate on any of today's items -> no bar (not a fake 0%).
  const dayEstHours = items.reduce((s, w) => s + (w.estHours || 0), 0);
  const color = employeeColor(employee, employees);

  return (
    <Panel as="div" className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <ColorDot color={color} label={employee ? `${employee.name || employee.loginId}'s colour` : undefined} />
          <span className="font-ui text-sm font-semibold text-white">
            {employee?.name || 'Unknown / removed'}
          </span>
          {employee && (
            <Badge tone="text-goldBright border-gold/40 bg-gold/10">{employee.loginId}</Badge>
          )}
          {employee && !employee.active && (
            <Badge tone="text-white/50 border-white/20 bg-white/5">Inactive</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 font-ui text-xs text-white/55">
          <span>
            Day <span className="text-white/85">{fmtHours(dayHours)}</span>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Week <span className="text-white/85">{fmtHours(weekHours)}</span>
          </span>
        </div>
      </div>

      {dayEstHours > 0 && (
        <div className="mt-2.5 flex items-center gap-2" title={`${fmtHours(dayHours)} logged of ${fmtHours(dayEstHours)} estimated`}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (dayHours / dayEstHours) * 100)}%`, backgroundColor: color }}
            />
          </div>
          <span className="shrink-0 font-body text-[0.65rem] text-white/40">
            {fmtHours(dayHours)} / {fmtHours(dayEstHours)} est
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-3 font-body text-sm text-white/40">No work assigned for this date.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((w) => (
            <WorkItemCard key={w.id} item={w} employees={employees} color={color} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WorkItemCard({
  item,
  employees,
  color,
}: {
  item: WorkItem;
  employees: Employee[];
  /** The assigned employee's resolved colour (docs/WAVE5_SPEC.md section A) — left border. */
  color: string;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: WorkItemStatus) {
    setBusy(true);
    try {
      await driver.updateWorkItemStatus(item.id, status);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      await driver.confirmWorkItem(item.id);
      toast('Work item confirmed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Confirm failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  const customerNotes = item.notes.filter((n) => n.customerVisible).length;

  return (
    <li
      className="rounded-lg border border-white/10 bg-char3/60 p-3 border-l-4"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-ui text-sm font-medium text-white/90">{item.title}</p>
        <Badge tone={WORKITEM_STATUS_TONE[item.status]}>{WORKITEM_STATUS_LABEL[item.status]}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 font-body text-[0.7rem] text-white/50">
        <span>
          Est {item.estHours != null ? fmtHours(item.estHours) : '—'} · Logged{' '}
          <span className="text-white/75">{fmtHours(item.hoursLogged)}</span>
        </span>
        {item.jobcardId && (
          <button
            onClick={() => navigate(`/jobcards/${item.jobcardId}`)}
            className="rounded border border-pinstripe-cyan/30 bg-pinstripe-cyan/10 px-1.5 py-0.5 text-pinstripe-cyan/90 hover:bg-pinstripe-cyan/20"
          >
            Job card →
          </button>
        )}
        {item.bookingId && (
          <button
            onClick={() => navigate(`/bookings/${item.bookingId}`)}
            className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-white/70 hover:bg-white/10"
          >
            Booking →
          </button>
        )}
        {customerNotes > 0 && (
          <span className="text-pinstripe-emerald/70">{customerNotes} customer note(s)</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.status === 'finished' && (
          <Button variant="secondary" onClick={confirm} disabled={busy} className="px-2.5 py-1 text-xs">
            Confirm
          </Button>
        )}
        {item.status !== 'confirmed' && (
          <Button variant="ghost" onClick={() => setEditing(true)} className="px-2.5 py-1 text-xs">
            Edit
          </Button>
        )}
        {item.status === 'confirmed' && (
          <Button
            variant="ghost"
            onClick={() => setStatus('finished')}
            disabled={busy}
            className="px-2.5 py-1 text-xs"
            title="Reopen for further edits"
          >
            Reopen
          </Button>
        )}
      </div>

      {editing && (
        <EditWorkItemModal item={item} employees={employees} onClose={() => setEditing(false)} />
      )}
    </li>
  );
}

// --- create ------------------------------------------------------------------------------

type LinkKind = 'task' | 'jobcard' | 'booking';

function CreateWorkItemModal({
  date,
  employees,
  onClose,
}: {
  date: string;
  employees: Employee[];
  onClose: () => void;
}) {
  const toast = useToast();
  const jobcards = useJobcards();
  const bookings = useBookings();
  const [kind, setKind] = useState<LinkKind>('task');
  const [linkId, setLinkId] = useState('');
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState(employees[0]?.id ?? '');
  const [estHours, setEstHours] = useState('');
  const [busy, setBusy] = useState(false);

  // Default the title from the linked record so the operator rarely has to type it.
  function pickLink(kind: LinkKind, id: string) {
    setKind(kind);
    setLinkId(id);
    if (!id) return;
    if (kind === 'jobcard') {
      const jc = jobcards?.find((j) => j.id === id);
      if (jc && !title) setTitle(`${jc.invoiceNumber || 'Job card'} — ${jc.customer.name || jc.vehicle.regNumber || ''}`.trim());
    } else if (kind === 'booking') {
      const b = bookings?.find((x) => x.id === id);
      if (b && !title) setTitle(`${b.customer.name || 'Booking'} — ${b.vehicle.regNumber || ''}`.trim());
    }
  }

  async function save() {
    if (busy) return;
    if (!assignedTo) {
      toast('Pick an employee', 'error');
      return;
    }
    const finalTitle = title.trim() || 'Untitled task';
    setBusy(true);
    try {
      await driver.createWorkItem({
        date,
        title: finalTitle,
        assignedTo,
        estHours: estHours.trim() ? num(estHours) : undefined,
        jobcardId: kind === 'jobcard' && linkId ? linkId : undefined,
        bookingId: kind === 'booking' && linkId ? linkId : undefined,
      });
      toast('Work assigned');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not assign', 'error');
      setBusy(false);
    }
  }

  return (
    <Modal open title="Assign Work" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Link to" hint="Attach a job card or booking, or leave as a free-text task.">
          {(id) => (
            <Select
              id={id}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as LinkKind);
                setLinkId('');
              }}
            >
              <option value="task">Free-text task</option>
              <option value="jobcard">Job card</option>
              <option value="booking">Booking</option>
            </Select>
          )}
        </Field>

        {kind === 'jobcard' && (
          <Field label="Job card">
            {(id) => (
              <Select id={id} value={linkId} onChange={(e) => pickLink('jobcard', e.target.value)}>
                <option value="">Select a job card…</option>
                {(jobcards ?? []).map((jc) => (
                  <option key={jc.id} value={jc.id}>
                    {jc.invoiceNumber || 'Unsaved'} · {jc.customer.name || jc.vehicle.regNumber || '—'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {kind === 'booking' && (
          <Field label="Booking">
            {(id) => (
              <Select id={id} value={linkId} onChange={(e) => pickLink('booking', e.target.value)}>
                <option value="">Select a booking…</option>
                {(bookings ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.customer.name || 'Unnamed'} · {b.vehicle.regNumber || '—'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label="Task title">
          {(id) => (
            <TextInput
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Paint correction stage 1"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee">
            {(id) => (
              <Select id={id} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                {employees.length === 0 && <option value="">No active employees</option>}
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name || e.loginId}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Est. hours">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                step="0.5"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                placeholder="e.g. 3"
              />
            )}
          </Field>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || employees.length === 0}>
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- edit / reassign / adjust hours -----------------------------------------------------

function EditWorkItemModal({
  item,
  employees,
  onClose,
}: {
  item: WorkItem;
  employees: Employee[];
  onClose: () => void;
}) {
  const toast = useToast();
  const editable = canEditWorkItem();
  const [title, setTitle] = useState(item.title);
  const [assignedTo, setAssignedTo] = useState(item.assignedTo);
  const [estHours, setEstHours] = useState(item.estHours != null ? String(item.estHours) : '');
  const [date, setDate] = useState(item.date);
  const [hoursLogged, setHoursLogged] = useState(String(item.hoursLogged));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      // Adjust logged hours — a first-class driver method (admin-only), works in both modes.
      const newHours = num(hoursLogged);
      if (newHours !== item.hoursLogged) {
        await driver.adjustWorkItemHours(item.id, newHours);
      }
      // Title / assignee / est / date — no driver method exists (flagged), demo-only patch.
      if (editable) {
        editWorkItemLocal(item.id, {
          title: title.trim() || item.title,
          assignedTo,
          estHours: estHours.trim() ? num(estHours) : undefined,
          date,
        });
      }
      toast('Work item updated');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
      setBusy(false);
    }
  }

  return (
    <Modal open title="Edit Work Item" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {!editable && (
          <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 font-body text-xs text-white/70">
            Live mode: only logged hours can be adjusted here. Title / reassign / est / date
            editing needs a driver method (flagged for the backend).
          </p>
        )}
        <Field label="Task title">
          {(id) => (
            <TextInput
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!editable}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned to">
            {(id) => (
              <Select
                id={id}
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={!editable}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name || e.loginId}
                  </option>
                ))}
                {!employees.some((e) => e.id === assignedTo) && (
                  <option value={assignedTo}>Current assignee</option>
                )}
              </Select>
            )}
          </Field>
          <Field label="Date">
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!editable}
              />
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Est. hours">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                step="0.5"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                disabled={!editable}
              />
            )}
          </Field>
          <Field label="Logged hours" hint="Admin adjustment">
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={0}
                step="0.25"
                value={hoursLogged}
                onChange={(e) => setHoursLogged(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
