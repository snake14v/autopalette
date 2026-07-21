import { useEffect, useMemo, useRef, useState } from 'react';
import type { Booking, Employee, Jobcard, WorkItem } from '../../shared/types';
import { computeJobcardPricing } from '../../shared/data';
import { CATEGORIES, SERVICE_CATALOG } from '../../shared/catalog';
import { driver, useEmployees, useJobcardOnce, useWorkItems } from '../lib/useDriver';
import { navigate, setNavGuard } from '../lib/router';
import { fmtHours, todayISO } from '../lib/dates';
import { inr } from '../lib/format';
import { WORKITEM_STATUS_LABEL, WORKITEM_STATUS_TONE } from '../lib/status';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Panel,
  SectionHeading,
  Select,
  Spinner,
  TextInput,
  Textarea,
  useToast,
} from '../ui';

const LABEL_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

// Free-text datalist of common Indian makes — vehicle make/model stays free text.
const COMMON_MAKES = [
  'Maruti Suzuki',
  'Hyundai',
  'Tata',
  'Mahindra',
  'Toyota',
  'Kia',
  'Honda',
  'Renault',
  'Volkswagen',
  'Skoda',
  'MG',
  'Nissan',
  'Ford',
  'BMW',
  'Mercedes-Benz',
  'Audi',
  'Volvo',
  'Jeep',
  'Royal Enfield',
];

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export default function JobcardEditor({ id }: { id: string }) {
  const { jobcard } = useJobcardOnce(id);
  const toast = useToast();
  const [draft, setDraft] = useState<Jobcard | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const loadedId = useRef<string | null>(null);

  // Seed the working copy once per loaded job card.
  useEffect(() => {
    if (jobcard && loadedId.current !== jobcard.id) {
      setDraft(structuredClone(jobcard));
      setDirty(false);
      loadedId.current = jobcard.id;
    }
  }, [jobcard]);

  // Fetch the source booking (for the "import services" affordance).
  useEffect(() => {
    let cancelled = false;
    if (jobcard?.bookingId) {
      driver.getBooking(jobcard.bookingId).then((b) => {
        if (!cancelled) setBooking(b);
      });
    } else {
      setBooking(null);
    }
    return () => {
      cancelled = true;
    };
  }, [jobcard?.bookingId]);

  // Unsaved-changes guard: blocks in-app nav and browser back/forward while dirty.
  useEffect(() => {
    if (!dirty) {
      setNavGuard(null);
      return;
    }
    setNavGuard(() =>
      window.confirm('You have unsaved changes on this job card. Leave without saving?')
    );
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      setNavGuard(null);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);

  const pricing = useMemo(
    () => (draft ? computeJobcardPricing(draft.services, draft.pricing) : null),
    [draft]
  );

  if (jobcard === undefined || (jobcard && !draft)) return <Spinner label="Loading job card…" />;
  if (jobcard === null || !draft || !pricing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <BackLink />
        <EmptyState title="Job card not found" hint="It may have been removed or the link is stale." />
      </div>
    );
  }

  // --- mutators -------------------------------------------------------------------------
  const patch = (fn: (d: Jobcard) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev);
      fn(copy);
      return copy;
    });
    setDirty(true);
  };

  const addCatalogRow = (serviceId: string) => {
    if (!serviceId) return;
    const entry = SERVICE_CATALOG.find((s) => s.id === serviceId);
    if (!entry) return;
    patch((d) => {
      d.services.push({
        serviceId: entry.id,
        label: entry.label,
        qty: 1,
        unitPrice: entry.startingPrice ?? 0,
      });
    });
  };

  const addCustomRow = () =>
    patch((d) => {
      d.services.push({ serviceId: 'custom', label: '', qty: 1, unitPrice: 0 });
    });

  const importBookingServices = () => {
    if (!booking) return;
    patch((d) => {
      for (const sid of booking.serviceIds) {
        const entry = SERVICE_CATALOG.find((s) => s.id === sid);
        d.services.push({
          serviceId: sid,
          label: entry?.label ?? sid,
          qty: 1,
          unitPrice: entry?.startingPrice ?? 0,
        });
      }
    });
  };

  async function save(thenInvoice = false) {
    if (saving || !draft) return;
    setSaving(true);
    try {
      const saved = await driver.saveJobcard(draft);
      setDraft(structuredClone(saved));
      setDirty(false);
      loadedId.current = saved.id;
      toast('Job card saved');
      if (thenInvoice) {
        setNavGuard(null);
        navigate(`/jobcards/${saved.id}/invoice`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const canImport = booking != null && booking.serviceIds.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 sm:px-6">
      <BackLink />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          eyebrow="Job Card"
          title={draft.invoiceNumber || 'New Job Card'}
        />
        <div className="flex flex-wrap items-center gap-3">
          {draft.customer.phone.trim() && (
            <button
              onClick={() => navigate(`/customers/${encodeURIComponent(draft.customer.phone)}`)}
              className="font-ui text-xs text-pinstripe-cyan/80 hover:text-pinstripe-cyan"
            >
              View customer →
            </button>
          )}
          {draft.bookingId && (
            <button
              onClick={() => navigate(`/bookings/${draft.bookingId}`)}
              className="font-ui text-xs text-pinstripe-cyan/80 hover:text-pinstripe-cyan"
            >
              View source booking →
            </button>
          )}
        </div>
      </div>

      {/* Customer Details */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Customer Details" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Invoice Number" hint={draft.invoiceNumber ? undefined : 'Allocated on first save'}>
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.invoiceNumber || 'Pending'}
                readOnly
                aria-readonly="true"
              />
            )}
          </Field>
          <Field label="Date">
            {(fid) => (
              <TextInput
                id={fid}
                type="date"
                value={draft.date}
                onChange={(e) => patch((d) => (d.date = e.target.value))}
              />
            )}
          </Field>
          <Field label="Customer Name">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.customer.name}
                onChange={(e) => patch((d) => (d.customer.name = e.target.value))}
              />
            )}
          </Field>
          <Field label="Phone">
            {(fid) => (
              <TextInput
                id={fid}
                type="tel"
                inputMode="tel"
                value={draft.customer.phone}
                onChange={(e) => patch((d) => (d.customer.phone = e.target.value))}
              />
            )}
          </Field>
          <Field label="Reg Number">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.vehicle.regNumber}
                onChange={(e) => patch((d) => (d.vehicle.regNumber = e.target.value.toUpperCase()))}
                className="uppercase"
              />
            )}
          </Field>
          <Field label="Make / Model">
            {(fid) => (
              <>
                <TextInput
                  id={fid}
                  list="ap-makes"
                  value={draft.vehicle.makeModel}
                  onChange={(e) => patch((d) => (d.vehicle.makeModel = e.target.value))}
                />
                <datalist id="ap-makes">
                  {COMMON_MAKES.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Odometer (km)">
            {(fid) => (
              <TextInput
                id={fid}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.vehicle.odometer ?? ''}
                onChange={(e) =>
                  patch(
                    (d) =>
                      (d.vehicle.odometer = e.target.value === '' ? undefined : num(e.target.value))
                  )
                }
              />
            )}
          </Field>
        </div>
      </Panel>

      {/* Services Performed */}
      <Panel className="mt-4 p-4">
        <SectionHeading
          title="Services Performed"
          right={
            canImport ? (
              <Button variant="ghost" onClick={importBookingServices}>
                Import {booking!.serviceIds.length} from booking
              </Button>
            ) : undefined
          }
        />

        {draft.services.length === 0 ? (
          <p className="mt-3 font-body text-sm text-white/45">
            No services added yet. Pick from the catalog or add a custom item below.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left font-ui text-[0.7rem] uppercase tracking-wider text-white/45">
                  <th className="pb-2 pr-2 font-medium">Service</th>
                  <th className="pb-2 px-2 font-medium">Qty</th>
                  <th className="pb-2 px-2 font-medium">Unit ₹</th>
                  <th className="pb-2 px-2 text-right font-medium">Line ₹</th>
                  <th className="pb-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {draft.services.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 align-middle">
                    <td className="py-2 pr-2">
                      {row.serviceId === 'custom' ? (
                        <TextInput
                          value={row.label}
                          placeholder="Custom item description"
                          onChange={(e) => patch((d) => (d.services[i].label = e.target.value))}
                          aria-label={`Custom item ${i + 1} description`}
                        />
                      ) : (
                        <span className="font-body text-white/85">
                          {LABEL_BY_ID.get(row.serviceId) ?? row.label}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <TextInput
                        type="number"
                        min={0}
                        step="0.5"
                        className="w-16"
                        value={row.qty}
                        onChange={(e) => patch((d) => (d.services[i].qty = num(e.target.value)))}
                        aria-label={`Row ${i + 1} quantity`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <TextInput
                        type="number"
                        min={0}
                        className="w-24"
                        value={row.unitPrice}
                        onChange={(e) => patch((d) => (d.services[i].unitPrice = num(e.target.value)))}
                        aria-label={`Row ${i + 1} unit price`}
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-ui text-white/85">
                      {inr(row.qty * row.unitPrice)}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <button
                        onClick={() => patch((d) => d.services.splice(i, 1))}
                        aria-label={`Remove row ${i + 1}`}
                        className="rounded p-1 text-white/40 transition-colors hover:text-pinstripe-red focus:outline-none focus-visible:ring-1 focus-visible:ring-pinstripe-red"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Add from catalog" className="min-w-[220px] flex-1">
            {(fid) => (
              <Select
                id={fid}
                value=""
                onChange={(e) => {
                  addCatalogRow(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Select a service…</option>
                {CATEGORIES.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {SERVICE_CATALOG.filter((s) => s.category === cat).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
          <Button variant="secondary" onClick={addCustomRow}>
            + Add custom item
          </Button>
        </div>
      </Panel>

      {/* Materials Used */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Materials Used" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="PPF Brand">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.materials.ppfBrand ?? ''}
                onChange={(e) => patch((d) => (d.materials.ppfBrand = e.target.value))}
              />
            )}
          </Field>
          <Field label="Ceramic Brand">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.materials.ceramicBrand ?? ''}
                onChange={(e) => patch((d) => (d.materials.ceramicBrand = e.target.value))}
              />
            )}
          </Field>
          <Field label="Paint Code / Colour">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.materials.paintCode ?? ''}
                onChange={(e) => patch((d) => (d.materials.paintCode = e.target.value))}
              />
            )}
          </Field>
          <Field label="Other Materials">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.materials.other ?? ''}
                onChange={(e) => patch((d) => (d.materials.other = e.target.value))}
              />
            )}
          </Field>
        </div>
      </Panel>

      {/* Pricing */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Pricing" />
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Field label="Labour Charges (₹)">
              {(fid) => (
                <TextInput
                  id={fid}
                  type="number"
                  min={0}
                  value={draft.pricing.labourCharges}
                  onChange={(e) => patch((d) => (d.pricing.labourCharges = num(e.target.value)))}
                />
              )}
            </Field>
            <Field label="Material Charges (₹)">
              {(fid) => (
                <TextInput
                  id={fid}
                  type="number"
                  min={0}
                  value={draft.pricing.materialCharges}
                  onChange={(e) => patch((d) => (d.pricing.materialCharges = num(e.target.value)))}
                />
              )}
            </Field>
            <Field label="Discount (₹)">
              {(fid) => (
                <TextInput
                  id={fid}
                  type="number"
                  min={0}
                  value={draft.pricing.discount}
                  onChange={(e) => patch((d) => (d.pricing.discount = num(e.target.value)))}
                />
              )}
            </Field>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.pricing.gstEnabled}
                  onChange={(e) => patch((d) => (d.pricing.gstEnabled = e.target.checked))}
                  className="h-4 w-4 accent-gold"
                />
                <span className="font-ui text-xs font-medium uppercase tracking-wider text-white/60">
                  Apply GST
                </span>
              </label>
              {draft.pricing.gstEnabled && (
                <div className="flex items-center gap-1.5">
                  <TextInput
                    type="number"
                    min={0}
                    step="0.1"
                    className="w-20"
                    value={draft.pricing.gstRate}
                    onChange={(e) => patch((d) => (d.pricing.gstRate = num(e.target.value)))}
                    aria-label="GST rate percent"
                  />
                  <span className="font-ui text-sm text-white/50">%</span>
                </div>
              )}
            </div>
            <Field label="Advance Paid (₹)">
              {(fid) => (
                <TextInput
                  id={fid}
                  type="number"
                  min={0}
                  value={draft.pricing.advancePaid}
                  onChange={(e) => patch((d) => (d.pricing.advancePaid = num(e.target.value)))}
                />
              )}
            </Field>
          </div>

          {/* Live computed totals (read-only, via the shared totals function) */}
          <div className="rounded-lg border border-white/10 bg-char3/50 p-4">
            <p className="font-ui text-[0.7rem] uppercase tracking-wider text-white/45">Live Totals</p>
            <dl className="mt-2 flex flex-col gap-1.5 font-body text-sm">
              <TotalRow label="Subtotal" value={inr(pricing.subtotal)} />
              {pricing.gstEnabled && (
                <TotalRow label={`GST (${pricing.gstRate}%)`} value={inr(pricing.gstAmount)} />
              )}
              <TotalRow label="Total" value={inr(pricing.totalAmount)} strong />
              <TotalRow label="Advance Paid" value={inr(pricing.advancePaid)} />
              <TotalRow label="Balance Due" value={inr(pricing.balanceDue)} strong accent />
            </dl>
          </div>
        </div>
      </Panel>

      {/* Payment Details */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Payment Details" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Mode">
            {(fid) => (
              <Select
                id={fid}
                value={draft.payment.mode}
                onChange={(e) =>
                  patch((d) => (d.payment.mode = e.target.value as Jobcard['payment']['mode']))
                }
              >
                <option value="">—</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </Select>
            )}
          </Field>
          <Field label="Transaction ID">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.payment.transactionId ?? ''}
                onChange={(e) => patch((d) => (d.payment.transactionId = e.target.value))}
              />
            )}
          </Field>
          <Field label="Status">
            {(fid) => (
              <Select
                id={fid}
                value={draft.payment.status}
                onChange={(e) =>
                  patch((d) => (d.payment.status = e.target.value as Jobcard['payment']['status']))
                }
              >
                <option value="unpaid">Unpaid</option>
                <option value="advance_paid">Advance Paid</option>
                <option value="paid">Paid</option>
              </Select>
            )}
          </Field>
        </div>
      </Panel>

      {/* Warranty */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Warranty" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Period">
            {(fid) => (
              <TextInput
                id={fid}
                placeholder="e.g. 5 years"
                value={draft.warranty.period ?? ''}
                onChange={(e) => patch((d) => (d.warranty.period = e.target.value))}
              />
            )}
          </Field>
          <Field label="Terms">
            {(fid) => (
              <TextInput
                id={fid}
                value={draft.warranty.terms ?? ''}
                onChange={(e) => patch((d) => (d.warranty.terms = e.target.value))}
              />
            )}
          </Field>
        </div>
      </Panel>

      {/* Remarks */}
      <Panel className="mt-4 p-4">
        <SectionHeading title="Remarks" />
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Field label="Before / After Condition">
            {(fid) => (
              <Textarea
                id={fid}
                value={draft.remarks.beforeAfterCondition ?? ''}
                onChange={(e) => patch((d) => (d.remarks.beforeAfterCondition = e.target.value))}
              />
            )}
          </Field>
          <Field label="Customer Requests">
            {(fid) => (
              <Textarea
                id={fid}
                value={draft.remarks.customerRequests ?? ''}
                onChange={(e) => patch((d) => (d.remarks.customerRequests = e.target.value))}
              />
            )}
          </Field>
          <Field label="Delivery Date & Time">
            {(fid) => (
              <TextInput
                id={fid}
                type="datetime-local"
                value={draft.remarks.deliveryDateTime ?? ''}
                onChange={(e) => patch((d) => (d.remarks.deliveryDateTime = e.target.value))}
              />
            )}
          </Field>
        </div>
      </Panel>

      {/* Project Assignment (Wave 2) */}
      <ProjectAssignment
        jobcardId={draft.id}
        assignedTo={draft.assignedTo ?? []}
        onToggle={(empId) =>
          patch((d) => {
            const set = new Set(d.assignedTo ?? []);
            if (set.has(empId)) set.delete(empId);
            else set.add(empId);
            d.assignedTo = [...set];
          })
        }
        projectLabel={
          draft.customer.name || draft.vehicle.regNumber || draft.invoiceNumber || 'this job'
        }
        onSaveDraft={() => save(false)}
      />

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-char2/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="font-body text-xs text-white/50">
            {dirty ? (
              <span className="text-goldBright">Unsaved changes</span>
            ) : (
              'All changes saved'
            )}
            <span className="mx-2 text-white/20">·</span>
            Total <span className="text-white/80">{inr(pricing.totalAmount)}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => save(true)}
              disabled={saving}
              title="Save and open the printable invoice"
            >
              Save &amp; Invoice
            </Button>
            <Button onClick={() => save(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? 'text-white/80' : 'text-white/55'}>{label}</dt>
      <dd
        className={`font-ui ${strong ? 'font-semibold' : ''} ${
          accent ? 'text-goldBright' : 'text-white/90'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function BackLink() {
  return (
    <button
      onClick={() => navigate('/jobcards')}
      className="font-ui text-xs text-white/50 transition-colors hover:text-goldBright focus:outline-none focus-visible:text-goldBright"
    >
      ← Job Cards
    </button>
  );
}

// --- Project assignment + inline work items (Wave 2) ------------------------------------

function ProjectAssignment({
  jobcardId,
  assignedTo,
  onToggle,
  projectLabel,
  onSaveDraft,
}: {
  jobcardId: string;
  assignedTo: string[];
  onToggle: (employeeId: string) => void;
  projectLabel: string;
  onSaveDraft: () => Promise<void>;
}) {
  const employees = useEmployees();
  const allItems = useWorkItems();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);

  const active = useMemo(() => (employees ?? []).filter((e) => e.active), [employees]);
  const byId = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);

  const projectItems = useMemo(
    () => (allItems ?? []).filter((w) => w.jobcardId === jobcardId),
    [allItems, jobcardId]
  );

  // Assigned employees that don't yet have any work item on this job card — the "offer to seed".
  const seededEmployeeIds = useMemo(
    () => new Set(projectItems.map((w) => w.assignedTo)),
    [projectItems]
  );
  const unseeded = assignedTo.filter((id) => !seededEmployeeIds.has(id));

  async function seed() {
    if (seeding || unseeded.length === 0) return;
    setSeeding(true);
    try {
      // Persist assignedTo first so the project-level assignment survives.
      await onSaveDraft();
      const title = `Full project — ${projectLabel}`;
      for (const empId of unseeded) {
        await driver.createWorkItem({ date: todayISO(), title, assignedTo: empId, jobcardId });
      }
      toast(`Seeded ${unseeded.length} work item(s)`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not seed work items', 'error');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Panel className="mt-4 p-4">
      <SectionHeading
        eyebrow="Wave 2"
        title="Assign Project"
        right={
          unseeded.length > 0 ? (
            <Button variant="secondary" onClick={seed} disabled={seeding}>
              {seeding ? 'Seeding…' : `Seed ${unseeded.length} work item(s)`}
            </Button>
          ) : undefined
        }
      />
      <p className="mt-2 font-body text-xs text-white/45">
        Assign the whole job to one or more employees. Seeding creates one full-project work
        item per selected employee (they also appear on the Day Board and their My Day).
      </p>

      {/* Employee multi-select */}
      {employees === null ? (
        <p className="mt-3 font-body text-sm text-white/45">Loading roster…</p>
      ) : active.length === 0 ? (
        <p className="mt-3 font-body text-sm text-white/45">
          No active employees. Add crew under Employees first.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {active.map((emp) => {
            const on = assignedTo.includes(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(emp.id)}
                className={`rounded-full border px-3 py-1.5 font-ui text-xs font-medium transition-colors ${
                  on
                    ? 'border-gold bg-gold/15 text-goldBright'
                    : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/85'
                }`}
              >
                {on ? '✓ ' : ''}
                {emp.name || emp.loginId}
              </button>
            );
          })}
        </div>
      )}

      {/* Inline work items for this job card */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="font-ui text-xs font-medium uppercase tracking-wider text-white/50">
          Work Items ({projectItems.length})
        </p>
        {projectItems.length === 0 ? (
          <p className="mt-2 font-body text-sm text-white/40">
            None yet. Assign crew above and seed, or add items on the Day Board.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {projectItems.map((w) => (
              <WorkItemInline key={w.id} item={w} employee={byId.get(w.assignedTo) ?? null} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function WorkItemInline({ item, employee }: { item: WorkItem; employee: Employee | null }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-char3/50 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-body text-sm text-white/85">{item.title}</p>
        <p className="font-body text-[0.7rem] text-white/45">
          {employee?.name || employee?.loginId || 'Unknown'} · {item.date} · Est{' '}
          {item.estHours != null ? fmtHours(item.estHours) : '—'} · Logged {fmtHours(item.hoursLogged)}
        </p>
      </div>
      <Badge tone={WORKITEM_STATUS_TONE[item.status]}>{WORKITEM_STATUS_LABEL[item.status]}</Badge>
    </li>
  );
}
