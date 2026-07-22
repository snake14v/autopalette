import { useEffect, useMemo, useState } from 'react';
import type { Customer } from '../../shared/types';
import { driver, useCustomers, useJobcards } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { normalizePhone } from '../../shared/data';
import { formatDate, inr } from '../lib/format';
import { rollupCustomer } from '../lib/analytics';
import { loadPref, savePref } from '../lib/persist';
import {
  Button,
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
import type { Jobcard } from '../../shared/types';

// docs/WAVE5_SPEC.md section C — persisted per-route sort control.
type CustomerSort = 'name' | 'last-visit' | 'outstanding';
const CUSTOMER_SORTS: CustomerSort[] = ['name', 'last-visit', 'outstanding'];
const CUSTOMER_SORT_LABEL: Record<CustomerSort, string> = {
  name: 'Name A–Z',
  'last-visit': 'Last Visit',
  outstanding: 'Outstanding',
};
const CUSTOMER_SORT_PREF_KEY = 'customers.sort';

function sortCustomers(list: Customer[], jobcards: Jobcard[], sort: CustomerSort): Customer[] {
  const arr = [...list];
  switch (sort) {
    case 'name':
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'last-visit':
      arr.sort((a, b) => {
        const av = rollupCustomer(a.phone, jobcards).lastVisit ?? '';
        const bv = rollupCustomer(b.phone, jobcards).lastVisit ?? '';
        return bv.localeCompare(av); // most recent first
      });
      break;
    case 'outstanding':
      arr.sort(
        (a, b) => rollupCustomer(b.phone, jobcards).outstanding - rollupCustomer(a.phone, jobcards).outstanding
      );
      break;
  }
  return arr;
}

// Customers panel (Wave 2): searchable registry with per-customer chips (visits, last visit,
// outstanding). Admin can also add a walk-in who never booked online.
export default function Customers() {
  const customers = useCustomers();
  const jobcards = useJobcards();
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [sort, setSort] = useState<CustomerSort>(
    () => loadPref(CUSTOMER_SORT_PREF_KEY, 'name') as CustomerSort
  );

  useEffect(() => {
    savePref(CUSTOMER_SORT_PREF_KEY, sort);
  }, [sort]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = customers ?? [];
    const matched = !needle
      ? list
      : list.filter((c) => {
          if (c.name.toLowerCase().includes(needle)) return true;
          if (c.phone.includes(needle.replace(/\D/g, ''))) return true;
          return c.vehicles.some((v) => v.reg.toLowerCase().includes(needle));
        });
    return sortCustomers(matched, jobcards ?? [], sort);
  }, [customers, q, jobcards, sort]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <SectionHeading
        eyebrow="CRM"
        title="Customers"
        right={<Button onClick={() => setAddOpen(true)}>+ Add Customer</Button>}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          type="search"
          placeholder="Search by name, phone, or reg number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search customers"
          className="flex-1"
        />
        {/* docs/WAVE5_SPEC.md section C — persisted sort control. */}
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as CustomerSort)}
          aria-label="Sort customers"
          className="sm:w-48"
        >
          {CUSTOMER_SORTS.map((s) => (
            <option key={s} value={s}>
              Sort: {CUSTOMER_SORT_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-5">
        {customers === null || jobcards === null ? (
          <Spinner label="Loading customers…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={q ? 'No matching customers' : 'No customers yet'}
            hint={
              q
                ? 'Try a different name, phone, or reg.'
                : 'Customers are added automatically when a booking or job card is saved.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((c) => (
              <CustomerRow key={c.phone} customer={c} jobcards={jobcards} />
            ))}
          </ul>
        )}
      </div>

      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function CustomerRow({ customer: c, jobcards }: { customer: Customer; jobcards: Jobcard[] }) {
  const roll = rollupCustomer(c.phone, jobcards);
  return (
    <li>
      <Panel as="div" className="p-0">
        <button
          onClick={() => navigate(`/customers/${encodeURIComponent(c.phone)}`)}
          className="flex w-full flex-col gap-2 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate font-ui text-sm font-semibold text-white">
              {c.name || 'Unnamed'}
            </p>
            <p className="mt-0.5 truncate font-body text-xs text-white/50">
              {c.phone || 'No phone'}
              {c.vehicles.length > 0 && ` · ${c.vehicles.map((v) => v.reg).join(', ')}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Chip label={`${roll.visits} visit${roll.visits === 1 ? '' : 's'}`} />
            {roll.lastVisit && <Chip label={`Last ${formatDate(roll.lastVisit)}`} />}
            {roll.outstanding > 0 ? (
              <Chip label={`${inr(roll.outstanding)} due`} tone="text-pinstripe-red border-pinstripe-red/40 bg-pinstripe-red/10" />
            ) : (
              <Chip label="Settled" tone="text-pinstripe-emerald border-pinstripe-emerald/35 bg-pinstripe-emerald/10" />
            )}
          </div>
        </button>
      </Panel>
    </li>
  );
}

function Chip({ label, tone = 'text-white/70 border-white/15 bg-white/5' }: { label: string; tone?: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 font-ui text-[0.65rem] font-medium ${tone}`}>
      {label}
    </span>
  );
}

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [reg, setReg] = useState('');
  const [makeModel, setMakeModel] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const key = normalizePhone(phone);
    if (!key) {
      toast('A 10-digit phone is required', 'error');
      return;
    }
    setBusy(true);
    try {
      const rec: Customer = {
        phone: key,
        name: name.trim(),
        altPhone: altPhone.trim() || undefined,
        vehicles: reg.trim() ? [{ reg: reg.trim().toUpperCase(), makeModel: makeModel.trim() }] : [],
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
      };
      await driver.saveCustomer(rec);
      toast('Customer added');
      onClose();
      navigate(`/customers/${encodeURIComponent(key)}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
      setBusy(false);
    }
  }

  return (
    <Modal open title="Add Customer" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            {(id) => (
              <TextInput
                id={id}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit"
              />
            )}
          </Field>
          <Field label="Alt Phone">
            {(id) => (
              <TextInput id={id} type="tel" inputMode="tel" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reg Number">
            {(id) => (
              <TextInput
                id={id}
                value={reg}
                onChange={(e) => setReg(e.target.value.toUpperCase())}
                className="uppercase"
              />
            )}
          </Field>
          <Field label="Make / Model">
            {(id) => <TextInput id={id} value={makeModel} onChange={(e) => setMakeModel(e.target.value)} />}
          </Field>
        </div>
        <Field label="Notes">
          {(id) => <TextInput id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Add Customer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
