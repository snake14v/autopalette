import { useMemo, useState } from 'react';
import type { Employee } from '../../shared/types';
import { driver, isDemo, useEmployees, useWorkItems } from '../lib/useDriver';
import { EMPLOYEE_PALETTE, employeeColor } from '../../shared/colors';
import {
  Badge,
  Button,
  ColorDot,
  EmptyState,
  Field,
  Modal,
  Panel,
  SectionHeading,
  Spinner,
  TextInput,
  Toggle,
  useToast,
} from '../ui';

// Roster CRUD (Wave 2). loginId (AP-EMP1…) is assigned in slot order and shown read-only;
// the display name is freely renameable. Active toggle gates login. PIN is demo-mode only
// (live mode authenticates against the Firebase account, so no PIN field is shown).
export default function Employees() {
  const employees = useEmployees();
  const workItems = useWorkItems();
  const toast = useToast();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  // Open work items (assigned/in_progress, any date) per employee — the workload badge.
  const openByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of workItems ?? []) {
      if (w.status === 'assigned' || w.status === 'in_progress') {
        map.set(w.assignedTo, (map.get(w.assignedTo) ?? 0) + 1);
      }
    }
    return map;
  }, [workItems]);

  // Lowest free AP-EMP index (1-based), so a new hire fills the first open slot.
  const nextLoginId = useMemo(() => {
    const used = new Set<number>();
    for (const e of employees ?? []) {
      const m = /^AP-EMP(\d+)$/i.exec(e.loginId);
      if (m) used.add(Number(m[1]));
    }
    let n = 1;
    while (used.has(n)) n++;
    return `AP-EMP${n}`;
  }, [employees]);

  async function toggleActive(emp: Employee, active: boolean) {
    try {
      await driver.saveEmployee({ ...emp, active });
      toast(active ? 'Employee activated' : 'Employee deactivated');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <SectionHeading
        eyebrow="Team"
        title="Employees"
        right={
          <Button onClick={() => setCreating(true)}>+ Add Employee</Button>
        }
      />

      <p className="mt-2 font-body text-xs text-white/45">
        Each employee gets a stable login ID ({nextLoginId} is next). Rename them freely — the
        login ID never changes. {isDemo ? 'Demo PIN signs them in on the Employee login tab.' : ''}
      </p>

      <div className="mt-5">
        {employees === null ? (
          <Spinner label="Loading roster…" />
        ) : employees.length === 0 ? (
          <EmptyState
            title="No employees yet"
            hint="Add your crew — each gets a login ID (AP-EMP1, AP-EMP2…) and can install the panel on their phone."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {employees.map((emp) => (
              <li key={emp.id}>
                <Panel as="div" className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ColorDot
                        color={employeeColor(emp, employees ?? [])}
                        label={`${emp.name || emp.loginId}'s colour`}
                      />
                      <span className="font-ui text-sm font-semibold text-white">
                        {emp.name || 'Unnamed'}
                      </span>
                      <Badge tone="text-goldBright border-gold/40 bg-gold/10">{emp.loginId}</Badge>
                      {!emp.active && (
                        <Badge tone="text-white/50 border-white/20 bg-white/5">Inactive</Badge>
                      )}
                      {(openByEmployee.get(emp.id) ?? 0) > 0 && (
                        <Badge tone="text-neonGold border-neonGold/40 bg-neonGold/10">
                          {openByEmployee.get(emp.id)} open
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 font-body text-xs text-white/50">
                      {emp.phone || 'No phone'}
                      {isDemo && emp.pin ? ` · PIN set` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle
                      checked={emp.active}
                      onChange={(v) => toggleActive(emp, v)}
                      label={emp.active ? 'Active' : 'Inactive'}
                    />
                    <Button variant="ghost" onClick={() => setEditing(emp)}>
                      Edit
                    </Button>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <EmployeeForm
          employee={editing}
          nextLoginId={nextLoginId}
          roster={employees ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeForm({
  employee,
  nextLoginId,
  roster,
  onClose,
}: {
  employee: Employee | null;
  nextLoginId: string;
  /** Full roster (unfiltered) — used to auto-assign a colour by position when none is set. */
  roster: Employee[];
  onClose: () => void;
}) {
  const toast = useToast();
  const isNew = employee === null;
  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [pin, setPin] = useState(employee?.pin ?? '');
  const [active, setActive] = useState(employee?.active ?? true);
  // docs/WAVE5_SPEC.md section A — swatch picker. Defaults to the same auto-assigned colour
  // shown elsewhere (employeeColor()) so opening the picker never looks like a change until
  // the admin actually picks a different swatch.
  const [color, setColor] = useState(employee?.color ?? employeeColor(employee, roster));
  const [busy, setBusy] = useState(false);

  const loginId = employee?.loginId ?? nextLoginId;

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const rec: Employee = {
        id: employee?.id ?? '',
        loginId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        active,
        pin: isDemo ? (pin.trim() || undefined) : employee?.pin,
        color,
      };
      await driver.saveEmployee(rec);
      toast(isNew ? 'Employee added' : 'Employee updated');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
      setBusy(false);
    }
  }

  return (
    <Modal open title={isNew ? 'Add Employee' : 'Edit Employee'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Login ID" hint="Assigned automatically; never changes.">
          {(id) => <TextInput id={id} value={loginId} readOnly aria-readonly="true" />}
        </Field>
        <Field label="Name">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ravi Kumar"
              autoFocus
            />
          )}
        </Field>
        <Field label="Phone">
          {(id) => (
            <TextInput
              id={id}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
            />
          )}
        </Field>
        {isDemo && (
          <Field label="Demo PIN" hint="Blank = last 4 digits of phone, or 2468 if no phone.">
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="e.g. 4321"
              />
            )}
          </Field>
        )}
        <div>
          <p className="font-ui text-xs font-medium uppercase tracking-wider text-white/60">Colour</p>
          <p className="mt-1 font-body text-[0.7rem] text-white/40">
            Shown on the Day Board, My Day, job cards, and kanban assignee dots.
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Employee colour">
            {EMPLOYEE_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={color === swatch}
                aria-label={swatch}
                onClick={() => setColor(swatch)}
                className={`h-8 w-8 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  color === swatch ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
        <Toggle checked={active} onChange={setActive} label="Active" hint="Inactive employees can't sign in." />
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Add Employee' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
