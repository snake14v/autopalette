import { computeJobcardPricing } from '../../shared/data';
import type { Jobcard } from '../../shared/types';
import { SERVICE_CATALOG } from '../../shared/catalog';
import { useJobcardOnce } from '../lib/useDriver';
import { navigate } from '../lib/router';
import { amountInWords, formatDate, formatDateTime, inr } from '../lib/format';
import { PAYMENT_MODE_LABEL, PAYMENT_STATUS_LABEL } from '../lib/status';
import { Button, EmptyState, Spinner } from '../ui';

const LABEL_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));

// Studio identity — CONTACT POLICY (owner directive 2026-07-22): one number for call +
// WhatsApp, plus the studio email. The old second number is retired — never reintroduce.
const STUDIO = {
  name: 'Autopalette',
  tagline: "We don't detail. We perfect.",
  address: 'JP Nagar 9th Phase, Bengaluru 560108',
  phone: '+91 88844 71117',
  email: 'autopalette23@gmail.com',
  site: 'autopalette.in',
};

export default function Invoice({ id }: { id: string }) {
  const { jobcard } = useJobcardOnce(id);

  if (jobcard === undefined) return <Spinner label="Loading invoice…" />;
  if (jobcard === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button
          onClick={() => navigate('/jobcards')}
          className="font-ui text-xs text-white/50 hover:text-goldBright"
        >
          ← Job Cards
        </button>
        <EmptyState title="Invoice not found" hint="This job card may have been removed." />
      </div>
    );
  }

  return <InvoiceSheet jc={jobcard} />;
}

function InvoiceSheet({ jc }: { jc: Jobcard }) {
  const pricing = computeJobcardPricing(jc.services, jc.pricing);
  const servicesTotal = jc.services.reduce((sum, s) => sum + s.qty * s.unitPrice, 0);
  const materials = [
    jc.materials.ppfBrand && ['PPF Brand', jc.materials.ppfBrand],
    jc.materials.ceramicBrand && ['Ceramic Brand', jc.materials.ceramicBrand],
    jc.materials.paintCode && ['Paint Code / Colour', jc.materials.paintCode],
    jc.materials.other && ['Other', jc.materials.other],
  ].filter(Boolean) as [string, string][];

  return (
    <>
      {/* Screen-only toolbar */}
      <div className="mx-auto flex max-w-[210mm] items-center justify-between px-4 py-4 print:hidden">
        <button
          onClick={() => navigate(`/jobcards/${jc.id}`)}
          className="font-ui text-xs text-white/60 transition-colors hover:text-goldBright"
        >
          ← Back to editor
        </button>
        <Button onClick={() => window.print()}>Print / Save PDF</Button>
      </div>

      {/* On narrow screens the fixed-width A4 sheet scrolls inside this container so the
          page body never scrolls horizontally; print restores natural flow. */}
      <div className="w-full overflow-x-auto px-4 pb-16 print:overflow-visible print:p-0">
        <article className="invoice-sheet px-[16mm] py-[14mm] font-body">
          {/* Header */}
          <header className="inv-no-break flex items-start justify-between gap-6 border-b inv-hairline pb-5">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Autopalette" className="h-16 w-auto" />
              <div>
                <h1
                  className="text-2xl font-bold uppercase tracking-widest text-[#1a1a1a]"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  {STUDIO.name}
                </h1>
                <p className="mt-0.5 text-xs italic text-[#666]">{STUDIO.tagline}</p>
              </div>
            </div>
            <div className="text-right text-[0.72rem] leading-relaxed text-[#444]">
              <p>{STUDIO.address}</p>
              <p>{STUDIO.phone} (Call &amp; WhatsApp)</p>
              <p>{STUDIO.email}</p>
              <p className="font-medium text-[#1a1a1a]">{STUDIO.site}</p>
            </div>
          </header>

          {/* Invoice meta */}
          <div className="inv-no-break mt-5 flex items-end justify-between">
            <div>
              <p
                className="text-lg font-bold uppercase tracking-wide text-[#1a1a1a]"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Tax Invoice
              </p>
              {/* Void badge (docs/JOBCARD_LIFECYCLE_SPEC.md) — "clearly badged everywhere it
                  appears"; provenance travels with the number, never silently upgraded. */}
              {jc.status === 'void' && (
                <p className="mt-1 inline-block rounded border border-[#999] px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-[#666]">
                  Void — not a valid invoice
                </p>
              )}
            </div>
            <div className="text-right text-sm">
              <p className="text-[#1a1a1a]">
                <span className="text-[#777]">Invoice No: </span>
                <span className="font-semibold">{jc.invoiceNumber || '—'}</span>
              </p>
              <p className="text-[#1a1a1a]">
                <span className="text-[#777]">Date: </span>
                {formatDate(jc.date)}
              </p>
            </div>
          </div>

          {/* Customer + vehicle */}
          <div className="inv-no-break mt-4 grid grid-cols-2 gap-4">
            <BlockCard title="Bill To">
              <Line label="Name" value={jc.customer.name || '—'} />
              <Line label="Phone" value={jc.customer.phone || '—'} />
            </BlockCard>
            <BlockCard title="Vehicle">
              <Line label="Reg No" value={jc.vehicle.regNumber || '—'} />
              <Line label="Make / Model" value={jc.vehicle.makeModel || '—'} />
              <Line
                label="Odometer"
                value={jc.vehicle.odometer != null ? `${jc.vehicle.odometer} km` : '—'}
              />
              {/* docs/WAVE5_SPEC.md section B — vehicle depth, shown only when present. */}
              {jc.vehicle.year != null && <Line label="Year" value={String(jc.vehicle.year)} />}
              {jc.vehicle.color && <Line label="Colour" value={jc.vehicle.color} />}
              {jc.vehicle.vin && <Line label="VIN" value={jc.vehicle.vin} />}
            </BlockCard>
          </div>

          {/* Line items */}
          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className="inv-tint text-left text-[0.7rem] uppercase tracking-wider text-[#555]">
                <th className="border-b inv-hairline px-3 py-2 font-semibold">Description</th>
                <th className="border-b inv-hairline px-3 py-2 text-center font-semibold">Qty</th>
                <th className="border-b inv-hairline px-3 py-2 text-right font-semibold">Unit</th>
                <th className="border-b inv-hairline px-3 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {jc.services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-[#999]">
                    No line items.
                  </td>
                </tr>
              ) : (
                jc.services.map((s, i) => (
                  <tr key={i} className="text-[#1a1a1a]">
                    <td className="border-b inv-hairline px-3 py-2">
                      {s.serviceId === 'custom'
                        ? s.label || 'Custom item'
                        : LABEL_BY_ID.get(s.serviceId) ?? s.label}
                    </td>
                    <td className="border-b inv-hairline px-3 py-2 text-center">{s.qty}</td>
                    <td className="border-b inv-hairline px-3 py-2 text-right">{inr(s.unitPrice)}</td>
                    <td className="border-b inv-hairline px-3 py-2 text-right">
                      {inr(s.qty * s.unitPrice)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Materials + totals */}
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:justify-between">
            <div className="flex-1">
              {materials.length > 0 && (
                <BlockCard title="Materials Used">
                  {materials.map(([k, v]) => (
                    <Line key={k} label={k} value={v} />
                  ))}
                </BlockCard>
              )}
            </div>

            <div className="inv-no-break w-full max-w-[280px]">
              <dl className="text-sm text-[#1a1a1a]">
                <TotalLine label="Services" value={inr(servicesTotal)} />
                {pricing.labourCharges > 0 && (
                  <TotalLine label="Labour" value={inr(pricing.labourCharges)} />
                )}
                {pricing.materialCharges > 0 && (
                  <TotalLine label="Material Charges" value={inr(pricing.materialCharges)} />
                )}
                {pricing.discount > 0 && (
                  <TotalLine label="Discount" value={`− ${inr(pricing.discount)}`} />
                )}
                <TotalLine label="Subtotal" value={inr(pricing.subtotal)} divider />
                {pricing.gstEnabled && (
                  <TotalLine label={`GST (${pricing.gstRate}%)`} value={inr(pricing.gstAmount)} />
                )}
                <div className="inv-accent-rule mt-1 flex items-center justify-between pt-2">
                  <dt
                    className="text-sm font-bold uppercase tracking-wide text-[#1a1a1a]"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Total
                  </dt>
                  <dd className="text-base font-bold text-[#1a1a1a]">{inr(pricing.totalAmount)}</dd>
                </div>
                {pricing.advancePaid > 0 && (
                  <>
                    <TotalLine label="Advance Paid" value={inr(pricing.advancePaid)} />
                    <TotalLine label="Balance Due" value={inr(pricing.balanceDue)} strong />
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Amount in words */}
          <p className="inv-no-break mt-3 border-t inv-hairline pt-2 text-xs text-[#444]">
            <span className="text-[#888]">Amount in words: </span>
            <span className="font-medium text-[#1a1a1a]">{amountInWords(pricing.totalAmount)}</span>
          </p>

          {/* Payment + warranty */}
          <div className="inv-no-break mt-4 grid grid-cols-2 gap-4">
            <BlockCard title="Payment">
              <Line label="Mode" value={PAYMENT_MODE_LABEL[jc.payment.mode] ?? '—'} />
              {jc.payment.transactionId && <Line label="Txn ID" value={jc.payment.transactionId} />}
              <Line label="Status" value={PAYMENT_STATUS_LABEL[jc.payment.status]} />
            </BlockCard>
            {(jc.warranty.period || jc.warranty.terms) && (
              <BlockCard title="Warranty">
                {jc.warranty.period && <Line label="Period" value={jc.warranty.period} />}
                {jc.warranty.terms && <Line label="Terms" value={jc.warranty.terms} />}
              </BlockCard>
            )}
          </div>

          {/* Remarks + delivery */}
          {(jc.remarks.beforeAfterCondition ||
            jc.remarks.customerRequests ||
            jc.remarks.deliveryDateTime) && (
            <div className="inv-no-break mt-4">
              <BlockCard title="Remarks">
                {jc.remarks.beforeAfterCondition && (
                  <Line label="Condition" value={jc.remarks.beforeAfterCondition} />
                )}
                {jc.remarks.customerRequests && (
                  <Line label="Requests" value={jc.remarks.customerRequests} />
                )}
                {jc.remarks.deliveryDateTime && (
                  <Line label="Delivery" value={formatDateTime(jc.remarks.deliveryDateTime)} />
                )}
              </BlockCard>
            </div>
          )}

          {/* Signatures */}
          <div className="inv-no-break mt-10 grid grid-cols-2 gap-10">
            <SignatureLine label="Customer Signature" />
            <SignatureLine label="For Autopalette (Authorised)" />
          </div>

          {/* Footer */}
          <footer className="inv-accent-rule mt-8 pt-3 text-center text-[0.65rem] text-[#888]">
            Thank you for choosing {STUDIO.name}. · {STUDIO.address} · {STUDIO.phone} ·{' '}
            {STUDIO.email} · {STUDIO.site}
          </footer>
        </article>
      </div>
    </>
  );
}

function BlockCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="inv-tint rounded border inv-hairline px-3 py-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#777]">{title}</p>
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs text-[#1a1a1a]">
      <span className="text-[#888]">{label}: </span>
      {value}
    </p>
  );
}

function TotalLine({
  label,
  value,
  divider,
  strong,
}: {
  label: string;
  value: string;
  divider?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-0.5 ${
        divider ? 'border-t inv-hairline pt-1.5 font-medium' : ''
      }`}
    >
      <dt className="text-[#666]">{label}</dt>
      <dd className={strong ? 'font-semibold text-[#1a1a1a]' : 'text-[#1a1a1a]'}>{value}</dd>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="border-t inv-hairline pt-2" />
      <p className="text-xs text-[#666]">{label}</p>
    </div>
  );
}
