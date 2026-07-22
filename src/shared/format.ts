// Shared formatting helpers — ₹ Indian grouping, dates, amount-in-words (lakh/crore),
// WhatsApp link. Promoted from src/admin/lib/format.ts so the customer app can use the same
// helpers without duplicating them; src/admin/lib/format.ts re-exports from here so nothing
// that already imports from it breaks.

/** ₹ with Indian digit grouping (e.g. 1,23,456). Whole rupees unless paise are present. */
export function inr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const hasPaise = Math.round(n * 100) % 100 !== 0;
  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `₹${formatted}`;
}

/** Plain number with Indian grouping, no currency symbol. */
export function inGroup(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** ISO date (YYYY-MM-DD) -> "21 Jul 2026". Falls back to the raw string if unparseable. */
export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** ms-epoch -> "21 Jul 2026, 3:04 PM". */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** datetime-local value (YYYY-MM-DDTHH:mm) -> "21 Jul 2026, 3:04 PM". */
export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Digits-only phone for a wa.me deep link (studio WhatsApp number).
    Owner directive 2026-07-22: 88844 71117 is the ONLY studio number — the old
    99000 12090 is retired everywhere; never point a wa.me link back at it. */
export const STUDIO_WHATSAPP = '918884471117';

export function whatsappLink(text: string): string {
  return `https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------------------------------------
// Amount in words — Indian numbering (lakh / crore). Required on the invoice per APP_SPEC.
// ---------------------------------------------------------------------------------------

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ` ${ONES[o]}` : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/** 1234567 -> "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven". */
function integerToWords(num: number): string {
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundreds = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundreds) parts.push(threeDigits(hundreds));
  return parts.join(' ').trim();
}

/** Full "Rupees … and Paise … Only" string for the invoice total. */
export function amountInWords(amount: number): string {
  const n = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  const rupeeWords = `Rupees ${integerToWords(rupees)}`;
  const paiseWords = paise > 0 ? ` and ${twoDigits(paise)} Paise` : '';
  return `${rupeeWords}${paiseWords} Only`;
}
