// THE DATA LAYER — a single DataDriver interface with two interchangeable implementations:
//   - localDriver:     localStorage persistence, no backend. mode = 'demo'.
//   - firestoreDriver:  Firebase Firestore + Auth. mode = 'live'. Lives in ./firestoreDriver.ts
//                       and is loaded ONLY via a dynamic import, so its firebase imports never
//                       end up in a demo-mode bundle.
// getDriver() picks firestoreDriver iff Firebase config is present (src/shared/firebaseConfig.ts),
// otherwise falls back to localDriver. Both apps (src/app, src/admin) code ONLY against
// the DataDriver interface — never import a concrete driver directly.
//
// IMPORTANT: this file must never statically import anything from the `firebase` package (nor
// from src/shared/firebase.ts, which does). That keeps demo-mode loads free of the ~600kB SDK
// chunk — see getDriver() below.

import type {
  Booking,
  BookingCustomerNote,
  BookingStatus,
  Jobcard,
  JobcardStatus,
  JobcardStatusHistoryEntry,
  JobcardCheckIn,
  JobcardQualityCheck,
  JobcardDelivery,
  Employee,
  WorkItem,
  WorkItemStatus,
  WorkItemNote,
  Customer,
} from './types';
import { hasFirebaseConfig } from './firebaseConfig';
import { SERVICE_CATALOG } from './catalog';

const CATALOG_BY_ID = new Map(SERVICE_CATALOG.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------------------
// Shared input / pricing types
// ---------------------------------------------------------------------------------------

export interface BookingInput {
  customer: Booking['customer'];
  vehicle: Booking['vehicle'];
  serviceIds: string[];
  otherRequest?: string;
  preferredDate?: string;
}

type PricingInputs = Pick<
  Jobcard['pricing'],
  'labourCharges' | 'materialCharges' | 'discount' | 'gstEnabled' | 'gstRate' | 'advancePaid'
>;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * THE ONE shared totals formula (per docs/APP_SPEC.md):
 *   subtotal   = Σ(qty × unitPrice) + labour + materials − discount
 *   gstAmount  = gstEnabled ? subtotal × rate/100 : 0
 *   total      = subtotal + gst
 *   balanceDue = total − advancePaid
 * Both drivers call this from saveJobcard so the math can never drift between them.
 * Exported directly so it is unit-testable in isolation.
 */
export function computeJobcardPricing(
  services: Jobcard['services'],
  inputs: PricingInputs
): Jobcard['pricing'] {
  const servicesTotal = services.reduce((sum, s) => sum + s.qty * s.unitPrice, 0);
  const subtotal = round2(servicesTotal + inputs.labourCharges + inputs.materialCharges - inputs.discount);
  const gstAmount = round2(inputs.gstEnabled ? subtotal * (inputs.gstRate / 100) : 0);
  const totalAmount = round2(subtotal + gstAmount);
  const balanceDue = round2(totalAmount - inputs.advancePaid);
  return { ...inputs, subtotal, gstAmount, totalAmount, balanceDue };
}

/** Normalize any phone input to its 10-digit key (last 10 digits, non-digits stripped). */
export function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-10);
}

// ---------------------------------------------------------------------------------------
// Job-card lifecycle (docs/JOBCARD_LIFECYCLE_SPEC.md) — shared by both drivers so the state
// machine can never drift between demo and live (same reasoning as computeJobcardPricing).
// ---------------------------------------------------------------------------------------

/** The linear forward lifecycle. 'void' is a side branch, not part of the ladder. */
export const JOBCARD_FLOW: JobcardStatus[] = [
  'open',
  'in_progress',
  'quality_check',
  'completed',
  'closed',
];

/**
 * Default QC checklist template — generic enough for bike or car service (per spec: do not
 * hardcode Autopalette-only language here). Seeded as defaults only; admin can add/remove
 * rows per job card once seeded into a draft.
 */
export const DEFAULT_QC_CHECKLIST: string[] = [
  'Exterior clean & inspected',
  'Interior clean (if applicable)',
  'All work items completed per job card',
  'Test drive / test run done',
  'No new damage caused during service',
  'Customer belongings returned',
];

/**
 * Validates a Jobcard status transition per docs/JOBCARD_LIFECYCLE_SPEC.md. Throws a
 * descriptive Error on any illegal transition — called by BOTH drivers before writing, so the
 * rule is enforced server-side (Firestore) and in the demo driver identically, never only
 * UI-gated.
 *
 *   open -> in_progress -> quality_check -> completed -> closed   (strictly sequential, no skips)
 *   completed | closed -> in_progress                             (reopen, REQUIRES opts.reason)
 *   open | in_progress | quality_check -> void                    (REQUIRES opts.reason)
 *   anything else (incl. any move out of 'void') is illegal.
 */
export function assertValidJobcardTransition(
  from: JobcardStatus,
  to: JobcardStatus,
  opts?: { reason?: string }
): void {
  if (from === to) return; // idempotent no-op — always harmless, never needs a reason

  if (to === 'void') {
    if (from !== 'open' && from !== 'in_progress' && from !== 'quality_check') {
      throw new Error(`Cannot void a job card from status "${from}".`);
    }
    if (!opts?.reason?.trim()) {
      throw new Error('Voiding a job card requires a reason.');
    }
    return;
  }

  if (from === 'void') {
    throw new Error('A voided job card cannot change status.');
  }

  const isReopen = (from === 'completed' || from === 'closed') && to === 'in_progress';
  if (isReopen) {
    if (!opts?.reason?.trim()) {
      throw new Error('Reopening a job card requires a reason.');
    }
    return;
  }

  // completed -> closed is the legitimate forward step (Deliver) and must fall
  // through to the sequential-flow check below. Only block the OTHER exits from
  // the two late states: closed is terminal (except reopen, handled above), and
  // completed can't jump anywhere but closed.
  if (from === 'closed' || (from === 'completed' && to !== 'closed')) {
    throw new Error(`Cannot move a job card from "${from}" to "${to}" — use reopen instead.`);
  }

  const fi = JOBCARD_FLOW.indexOf(from);
  const ti = JOBCARD_FLOW.indexOf(to);
  if (fi === -1 || ti === -1 || ti !== fi + 1) {
    throw new Error(`Illegal job card status transition: "${from}" -> "${to}".`);
  }
}

/**
 * The quality_check -> completed gate: every checklist item must be passed, OR the admin
 * supplies an explicit override reason. Not just UI-gated — this is what makes it a real
 * quality gate rather than theatre (per spec). Called from setJobcardStatus in both drivers.
 */
export function assertQualityCheckPassed(jc: Jobcard, overrideReason?: string): void {
  const checklist = jc.qualityCheck?.checklist ?? [];
  const allPassed = checklist.length > 0 && checklist.every((c) => c.passed);
  if (allPassed) return;
  if (overrideReason?.trim()) return;
  throw new Error(
    'Quality check has unchecked items — check every item, or override with a note to proceed anyway.'
  );
}

/** The completed -> closed gate: customer sign-off must be recorded before delivery closes the job. */
export function assertDeliverySignedOff(jc: Jobcard): void {
  if (!jc.delivery?.customerSignedOff) {
    throw new Error('Delivery requires the customer sign-off checkbox to be ticked.');
  }
}

/**
 * Back-fills lifecycle fields on Jobcards written before this spec landed (additive
 * migration, read-time only — never rewrites storage). Missing status defaults to 'open'
 * with a single synthesized statusHistory entry, mirroring how the field would have looked
 * had it existed at creation time.
 */
export function normalizeJobcardStatus(jc: Jobcard): Jobcard {
  if (jc.status && jc.statusHistory) return jc;
  const status: JobcardStatus = jc.status ?? 'open';
  const statusHistory: JobcardStatusHistoryEntry[] = jc.statusHistory ?? [{ status, at: Date.now() }];
  return { ...jc, status, statusHistory };
}

// ---------------------------------------------------------------------------------------
// Customer-safe stage mirror (docs/WAVE5_SPEC.md section D — fixes CX-audit finding #5).
// Denormalizes a coarse, customer-facing stage onto the linked Booking whenever the admin
// moves a Jobcard's lifecycle status — instead of loosening firestore.rules to let the
// customer app read jobcards directly. Shared here (not duplicated per driver) for the same
// reason JOBCARD_FLOW/assertValidJobcardTransition are shared: the mapping can never drift
// between demo and live.
// ---------------------------------------------------------------------------------------

/** The three coarse stages the customer app is ever shown (see Booking.jobcardStage). */
export type BookingJobcardStage = 'working' | 'quality_check' | 'ready';

/**
 * Maps an admin-only JobcardStatus onto the Booking.jobcardStage the customer app may read,
 * or null when no stage should be shown (open/closed/void — field removed in that case).
 * Called by BOTH drivers' setJobcardStatus, right after the status transition itself commits.
 */
export function jobcardStageForBookingMirror(status: JobcardStatus): BookingJobcardStage | null {
  if (status === 'in_progress') return 'working';
  if (status === 'quality_check') return 'quality_check';
  if (status === 'completed') return 'ready';
  return null; // open / closed / void -> no stage to show
}

/**
 * Projects a customerVisible WorkItemNote into the shape mirrored onto Booking.customerNotes
 * (see types.ts). Called by BOTH drivers' addWorkNote — shared here so the mirrored shape can
 * never drift between demo and live, same reasoning as jobcardStageForBookingMirror above.
 */
export function toBookingCustomerNote(note: WorkItemNote): BookingCustomerNote {
  return { at: note.at, by: note.by, text: note.text };
}

// ---------------------------------------------------------------------------------------
// Wave 2 auth shape
// ---------------------------------------------------------------------------------------

export interface AuthState {
  signedIn: boolean;
  role: 'admin' | 'staff' | null;
  employeeId?: string;
}

export interface WorkItemInput {
  date: string; // YYYY-MM-DD
  title: string;
  jobcardId?: string;
  bookingId?: string;
  assignedTo: string; // Employee.id
  estHours?: number;
}

export interface WorkItemFilter {
  date?: string;
  employeeId?: string;
}

// ---------------------------------------------------------------------------------------
// DataDriver — the contract both apps code against
// ---------------------------------------------------------------------------------------

export interface DataDriver {
  mode: 'live' | 'demo';

  createBooking(input: BookingInput): Promise<Booking>;
  getBooking(id: string): Promise<Booking | null>;
  subscribeBooking(id: string, cb: (booking: Booking | null) => void): () => void;

  adminSignIn(email: string, password: string): Promise<void>;
  adminSignOut(): Promise<void>;
  /** @deprecated compatibility alias — prefer onAuth. Admin-only signed-in boolean. */
  onAdminAuth(cb: (signedIn: boolean) => void): () => void;

  /** Wave 2 — login screen takes a LOGIN ID (AP-ADMIN / AP-EMP1…5) + password. */
  signInWithLoginId(loginId: string, password: string): Promise<void>;
  /** Wave 2 — richer auth state: who's signed in, and as admin or a specific staff member. */
  onAuth(cb: (state: AuthState) => void): () => void;

  subscribeBookings(cb: (bookings: Booking[]) => void): () => void;
  updateBookingStatus(id: string, status: BookingStatus, note?: string): Promise<void>;

  createJobcardFromBooking(bookingId: string): Promise<Jobcard>;
  createBlankJobcard(): Promise<Jobcard>;
  /**
   * Wave 5 — same as createBlankJobcard, but prefilled with a customer + vehicle (e.g. the
   * CustomerDetail "New job card" quick action). No invoice number is allocated here either —
   * that still happens lazily on the editor's first saveJobcard, exactly like a walk-in.
   */
  createBlankJobcardFor(customer: Jobcard['customer'], vehicle: Jobcard['vehicle']): Promise<Jobcard>;
  saveJobcard(jc: Jobcard): Promise<Jobcard>;
  getJobcard(id: string): Promise<Jobcard | null>;
  subscribeJobcards(cb: (jobcards: Jobcard[]) => void): () => void;
  /**
   * Wave 3 — light-touch payment-status write for inline mark-paid / bulk set / undo, without
   * a full saveJobcard round-trip (no pricing recompute, no invoice allocation, no customer
   * upsert). Only touches payment.status. Inverse of itself: call again with the prior status.
   */
  setJobcardPaymentStatus(id: string, status: Jobcard['payment']['status']): Promise<void>;

  // --- Job-card lifecycle (docs/JOBCARD_LIFECYCLE_SPEC.md) -------------------------------
  /**
   * Validates + applies a JobcardStatus transition (see assertValidJobcardTransition),
   * appends a statusHistory entry, and returns the updated job card. Rejects illegal jumps,
   * void from completed/closed, and reopen (completed/closed -> in_progress) without
   * `opts.reason`. `opts.reason` also doubles as the required override note for the
   * quality_check -> completed gate when an item is left unchecked (assertQualityCheckPassed).
   */
  setJobcardStatus(id: string, status: JobcardStatus, opts?: { reason?: string }): Promise<Jobcard>;
  /** Vehicle check-in fields — optional, doesn't block moving to in_progress if skipped. */
  saveJobcardCheckIn(id: string, checkIn: JobcardCheckIn): Promise<Jobcard>;
  /** QC checklist + notes. Stamps checkedAt if not supplied. */
  saveJobcardQualityCheck(id: string, qc: JobcardQualityCheck): Promise<Jobcard>;
  /** Delivery odometer-out + sign-off. Stamps deliveredAt if not supplied. */
  saveJobcardDelivery(id: string, delivery: JobcardDelivery): Promise<Jobcard>;

  // --- Wave 2: roster ---------------------------------------------------------------------
  subscribeEmployees(cb: (employees: Employee[]) => void): () => void;
  saveEmployee(e: Employee): Promise<Employee>;

  // --- Wave 2: daily work tracking --------------------------------------------------------
  subscribeWorkItems(cb: (items: WorkItem[]) => void, filter?: WorkItemFilter): () => void;
  createWorkItem(input: WorkItemInput): Promise<WorkItem>;
  /** Stamps startedAt on in_progress, finishedAt + auto hoursLogged on finished. Never 'confirmed' — use confirmWorkItem. */
  updateWorkItemStatus(id: string, status: WorkItemStatus): Promise<void>;
  /** Admin only (enforced by firestore.rules in live mode). */
  confirmWorkItem(id: string): Promise<void>;
  /** Admin only (enforced by firestore.rules in live mode). */
  adjustWorkItemHours(id: string, hours: number): Promise<void>;
  addWorkNote(id: string, text: string, customerVisible: boolean): Promise<void>;

  // --- Wave 2: customer registry -----------------------------------------------------------
  subscribeCustomers(cb: (customers: Customer[]) => void): () => void;
  saveCustomer(c: Customer): Promise<Customer>;
  /** Chronological customer-visible notes for a booking, read ONLY from the booking doc's
      customerNotes mirror (see Booking.customerNotes) — never from work_items, which the
      unauthenticated customer app has no read access to under the live firestore.rules. */
  subscribeCustomerNotes(bookingId: string, cb: (notes: BookingCustomerNote[]) => void): () => void;
}

export function blankPricing(): Jobcard['pricing'] {
  return {
    labourCharges: 0,
    materialCharges: 0,
    discount: 0,
    gstEnabled: true,
    gstRate: 18,
    subtotal: 0,
    gstAmount: 0,
    totalAmount: 0,
    advancePaid: 0,
    balanceDue: 0,
  };
}

export function blankJobcard(id: string): Jobcard {
  const now = Date.now();
  return {
    id,
    invoiceNumber: '',
    date: new Date().toISOString().slice(0, 10),
    customer: { name: '', phone: '' },
    vehicle: { regNumber: '', makeModel: '' },
    services: [],
    materials: {},
    pricing: blankPricing(),
    payment: { mode: '', status: 'unpaid' },
    warranty: {},
    remarks: {},
    status: 'open',
    statusHistory: [{ status: 'open', at: now }],
  };
}

/** Shared by BOTH drivers so live and demo booking IDs have the identical `bk_...`
    shape the Track form promises ("Looks like bk_xxxxxxxx") — the live driver used
    to let Firestore auto-generate 20-char doc IDs, which made that hint a lie. */
export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// ===========================================================================================
// localDriver — localStorage persistence. DEMO ONLY. Admin auth = passphrase 'autopalette-admin'.
// Seeds NOTHING: employees/customers/work items all start empty; the roster is built by the
// admin in the UI (per docs/APP_SPEC.md Wave 2 "Demo driver" directive).
// ===========================================================================================

const LOCAL_KEYS = {
  bookings: 'ap:bookings',
  jobcards: 'ap:jobcards',
  counters: 'ap:counters',
  adminSession: 'ap:admin-session',
  authSession: 'ap:auth-session',
  employees: 'ap:employees',
  workItems: 'ap:work-items',
  customers: 'ap:customers',
} as const;

export const LOCAL_ADMIN_PASSPHRASE = 'autopalette-admin'; // DEMO ONLY — not a real secret.
/** Fallback PIN for an employee with no phone on file and no PIN explicitly set (demo only). */
const DEFAULT_DEMO_PIN = '2468';

type Store<T> = Record<string, T>;

function readStore<T>(key: string): Store<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Store<T>) : {};
  } catch {
    return {};
  }
}

function writeStore<T>(key: string, store: Store<T>) {
  localStorage.setItem(key, JSON.stringify(store));
  // Same-tab subscribers don't receive the native `storage` event (that only fires in
  // OTHER tabs), so broadcast an in-tab custom event alongside it.
  window.dispatchEvent(new CustomEvent('ap:local-store-changed', { detail: { key } }));
}

function onStoreChanged(key: string, cb: () => void): () => void {
  const handler = (e: Event) => {
    if (e instanceof StorageEvent) {
      if (e.key === key) cb();
      return;
    }
    const detail = (e as CustomEvent).detail as { key: string } | undefined;
    if (detail?.key === key) cb();
  };
  window.addEventListener('storage', handler);
  window.addEventListener('ap:local-store-changed', handler as EventListener);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('ap:local-store-changed', handler as EventListener);
  };
}

interface InvoiceCounters {
  invoiceSeq?: Record<string, number>; // keyed by year, e.g. { "2026": 12 }
}

function nextInvoiceNumber(): string {
  const raw = localStorage.getItem(LOCAL_KEYS.counters);
  const counters: InvoiceCounters = raw ? JSON.parse(raw) : {};
  const year = new Date().getFullYear();
  const seqByYear = counters.invoiceSeq ?? {};
  const next = (seqByYear[String(year)] ?? 0) + 1;
  seqByYear[String(year)] = next;
  counters.invoiceSeq = seqByYear;
  localStorage.setItem(LOCAL_KEYS.counters, JSON.stringify(counters));
  window.dispatchEvent(new CustomEvent('ap:local-store-changed', { detail: { key: LOCAL_KEYS.counters } }));
  return `AP-${year}-${String(next).padStart(4, '0')}`;
}

function sortByCreatedAtDesc(a: Booking, b: Booking) {
  return b.createdAt - a.createdAt;
}

/** Read the demo auth-session (Wave 2 signInWithLoginId state). Absent = signed out. */
function readAuthState(): AuthState {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.authSession);
    if (!raw) return { signedIn: false, role: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { signedIn: false, role: null };
  }
}

function writeAuthState(state: AuthState | null): void {
  if (state) {
    localStorage.setItem(LOCAL_KEYS.authSession, JSON.stringify(state));
  } else {
    localStorage.removeItem(LOCAL_KEYS.authSession);
  }
  window.dispatchEvent(new CustomEvent('ap:local-store-changed', { detail: { key: LOCAL_KEYS.authSession } }));
}

/** 'admin' or the signed-in employee's id — used to stamp WorkItemNote.by in demo mode. */
function currentActorId(): string {
  const s = readAuthState();
  if (!s.signedIn) return 'unknown';
  return s.role === 'admin' ? 'admin' : (s.employeeId ?? 'unknown');
}

/** Auto-upsert into the customer registry — called ONLY from saveJobcard (admin
    context), mirroring the live driver where /customers is admin-only. */
function upsertCustomer(input: {
  name: string;
  phone: string;
  vehicle?: { regNumber: string; makeModel: string };
}): void {
  const key = normalizePhone(input.phone);
  if (!key) return;
  const customers = readStore<Customer>(LOCAL_KEYS.customers);
  const existing = customers[key];
  if (existing) {
    if (!existing.name && input.name) existing.name = input.name;
    if (input.vehicle?.regNumber) {
      const regUpper = input.vehicle.regNumber.toUpperCase();
      const has = existing.vehicles.some((v) => v.reg.toUpperCase() === regUpper);
      if (!has) existing.vehicles.push({ reg: input.vehicle.regNumber, makeModel: input.vehicle.makeModel });
    }
    customers[key] = existing;
  } else {
    customers[key] = {
      phone: key,
      name: input.name || '',
      vehicles: input.vehicle?.regNumber
        ? [{ reg: input.vehicle.regNumber, makeModel: input.vehicle.makeModel }]
        : [],
      createdAt: Date.now(),
    };
  }
  writeStore(LOCAL_KEYS.customers, customers);
}

export const localDriver: DataDriver = {
  mode: 'demo',

  async createBooking(input) {
    const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
    const id = genId('bk');
    const now = Date.now();
    const booking: Booking = {
      id,
      createdAt: now,
      status: 'requested',
      statusHistory: [{ status: 'requested', at: now }],
      customer: input.customer,
      vehicle: input.vehicle,
      serviceIds: input.serviceIds,
      otherRequest: input.otherRequest,
      preferredDate: input.preferredDate,
    };
    bookings[id] = booking;
    writeStore(LOCAL_KEYS.bookings, bookings);
    // NO customer upsert here: the customer registry grows on the admin-side
    // saveJobcard path only. The customer app has no permission to write
    // /customers on live (rules: admin-only) — it failed silently there while
    // working in demo, so both drivers now skip it for parity.
    return booking;
  },

  async getBooking(id) {
    const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
    return bookings[id] ?? null;
  },

  subscribeBooking(id, cb) {
    const emit = () => {
      const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
      cb(bookings[id] ?? null);
    };
    emit();
    return onStoreChanged(LOCAL_KEYS.bookings, emit);
  },

  async adminSignIn(_email, password) {
    if (password !== LOCAL_ADMIN_PASSPHRASE) {
      throw new Error('Incorrect passphrase (demo mode).');
    }
    localStorage.setItem(LOCAL_KEYS.adminSession, '1');
    window.dispatchEvent(new CustomEvent('ap:local-store-changed', { detail: { key: LOCAL_KEYS.adminSession } }));
    writeAuthState({ signedIn: true, role: 'admin' });
  },

  async adminSignOut() {
    localStorage.removeItem(LOCAL_KEYS.adminSession);
    window.dispatchEvent(new CustomEvent('ap:local-store-changed', { detail: { key: LOCAL_KEYS.adminSession } }));
    writeAuthState(null);
  },

  onAdminAuth(cb) {
    const emit = () => cb(localStorage.getItem(LOCAL_KEYS.adminSession) === '1');
    emit();
    return onStoreChanged(LOCAL_KEYS.adminSession, emit);
  },

  async signInWithLoginId(loginId, password) {
    const id = loginId.trim().toUpperCase();
    if (id === 'AP-ADMIN') {
      if (password !== LOCAL_ADMIN_PASSPHRASE) {
        throw new Error('Incorrect passphrase (demo mode).');
      }
      localStorage.setItem(LOCAL_KEYS.adminSession, '1');
      window.dispatchEvent(new CustomEvent('ap:local-store-changed', { detail: { key: LOCAL_KEYS.adminSession } }));
      writeAuthState({ signedIn: true, role: 'admin' });
      return;
    }
    const employees = readStore<Employee>(LOCAL_KEYS.employees);
    const employee = Object.values(employees).find((e) => e.loginId.toUpperCase() === id);
    if (!employee || !employee.active) {
      throw new Error('Invalid login ID or password (demo).');
    }
    // Demo PIN precedence: explicit roster PIN > last 4 digits of phone > '2468'.
    const expectedPin = employee.pin || (employee.phone ? employee.phone.replace(/\D/g, '').slice(-4) : DEFAULT_DEMO_PIN);
    if (password !== expectedPin) {
      throw new Error('Invalid login ID or password (demo).');
    }
    writeAuthState({ signedIn: true, role: 'staff', employeeId: employee.id });
  },

  onAuth(cb) {
    const emit = () => cb(readAuthState());
    emit();
    return onStoreChanged(LOCAL_KEYS.authSession, emit);
  },

  subscribeBookings(cb) {
    const emit = () => {
      const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
      cb(Object.values(bookings).sort(sortByCreatedAtDesc));
    };
    emit();
    return onStoreChanged(LOCAL_KEYS.bookings, emit);
  },

  async updateBookingStatus(id, status, note) {
    const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
    const booking = bookings[id];
    if (!booking) throw new Error(`Booking ${id} not found`);
    booking.status = status;
    booking.statusHistory = [...booking.statusHistory, { status, at: Date.now(), note }];
    bookings[id] = booking;
    writeStore(LOCAL_KEYS.bookings, bookings);
  },

  async createJobcardFromBooking(bookingId) {
    const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
    const booking = bookings[bookingId];
    if (!booking) throw new Error(`Booking ${bookingId} not found`);

    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const id = genId('jc');
    const jc = blankJobcard(id);
    jc.bookingId = bookingId;
    jc.customer = booking.customer;
    jc.vehicle = booking.vehicle;
    // Carry the booking's requested services onto the job card as billable rows —
    // label from catalog, qty 1, unitPrice startingPrice ?? 0 (admin edits per job below).
    jc.services = booking.serviceIds.map((sid) => {
      const entry = CATALOG_BY_ID.get(sid);
      return { serviceId: sid, label: entry?.label ?? sid, qty: 1, unitPrice: entry?.startingPrice ?? 0 };
    });
    jobcards[id] = jc;
    writeStore(LOCAL_KEYS.jobcards, jobcards);

    booking.jobcardId = id;
    bookings[bookingId] = booking;
    writeStore(LOCAL_KEYS.bookings, bookings);

    return jc;
  },

  async createBlankJobcard() {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const id = genId('jc');
    const jc = blankJobcard(id);
    jobcards[id] = jc;
    writeStore(LOCAL_KEYS.jobcards, jobcards);
    return jc;
  },

  async createBlankJobcardFor(customer, vehicle) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const id = genId('jc');
    const jc = blankJobcard(id);
    jc.customer = customer;
    jc.vehicle = vehicle;
    jobcards[id] = jc;
    writeStore(LOCAL_KEYS.jobcards, jobcards);
    return jc;
  },

  async saveJobcard(jc) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const pricing = computeJobcardPricing(jc.services, jc.pricing);
    const invoiceNumber = jc.invoiceNumber || nextInvoiceNumber();
    const saved: Jobcard = { ...jc, pricing, invoiceNumber, updatedAt: Date.now() };
    jobcards[jc.id] = saved;
    writeStore(LOCAL_KEYS.jobcards, jobcards);
    upsertCustomer({ name: saved.customer.name, phone: saved.customer.phone, vehicle: saved.vehicle });
    return saved;
  },

  async getJobcard(id) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const jc = jobcards[id];
    return jc ? normalizeJobcardStatus(jc) : null;
  },

  async setJobcardPaymentStatus(id, status) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const jc = jobcards[id];
    if (!jc) throw new Error(`Job card ${id} not found`);
    const from = jc.payment.status;
    jc.payment = { ...jc.payment, status };
    if (from !== status) {
      jc.paymentHistory = [...(jc.paymentHistory ?? []), { at: Date.now(), from, to: status }];
    }
    jobcards[id] = jc;
    writeStore(LOCAL_KEYS.jobcards, jobcards);
  },

  subscribeJobcards(cb) {
    const emit = () => {
      const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
      cb(
        Object.values(jobcards)
          .map(normalizeJobcardStatus)
          .sort((a, b) => (a.date < b.date ? 1 : -1))
      );
    };
    emit();
    return onStoreChanged(LOCAL_KEYS.jobcards, emit);
  },

  // --- Job-card lifecycle (docs/JOBCARD_LIFECYCLE_SPEC.md) --------------------------------

  async setJobcardStatus(id, status, opts) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const jc = jobcards[id];
    if (!jc) throw new Error(`Job card ${id} not found`);
    const current = normalizeJobcardStatus(jc);
    assertValidJobcardTransition(current.status, status, opts);
    if (current.status === 'quality_check' && status === 'completed') {
      assertQualityCheckPassed(current, opts?.reason);
    }
    if (current.status === 'completed' && status === 'closed') {
      assertDeliverySignedOff(current);
    }
    const entry: JobcardStatusHistoryEntry = {
      status,
      at: Date.now(),
      by: currentActorId(),
      ...(opts?.reason ? { reason: opts.reason } : {}),
    };
    const updated: Jobcard = {
      ...current,
      status,
      statusHistory: [...current.statusHistory, entry],
    };
    jobcards[id] = updated;
    writeStore(LOCAL_KEYS.jobcards, jobcards);

    // docs/WAVE5_SPEC.md section D — admin-side customer-safe stage mirror onto the linked
    // booking. `undefined` (not written) when the mapping is null, which JSON.stringify drops
    // from storage — functionally "field removed" for closed/void/open.
    if (updated.bookingId) {
      const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
      const booking = bookings[updated.bookingId];
      if (booking) {
        const stage = jobcardStageForBookingMirror(status);
        bookings[updated.bookingId] = { ...booking, jobcardStage: stage ?? undefined };
        writeStore(LOCAL_KEYS.bookings, bookings);
      }
    }

    return updated;
  },

  async saveJobcardCheckIn(id, checkIn) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const jc = jobcards[id];
    if (!jc) throw new Error(`Job card ${id} not found`);
    const updated: Jobcard = { ...normalizeJobcardStatus(jc), checkIn };
    jobcards[id] = updated;
    writeStore(LOCAL_KEYS.jobcards, jobcards);
    return updated;
  },

  async saveJobcardQualityCheck(id, qc) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const jc = jobcards[id];
    if (!jc) throw new Error(`Job card ${id} not found`);
    const stamped = { ...qc, checkedAt: qc.checkedAt ?? Date.now() };
    const updated: Jobcard = { ...normalizeJobcardStatus(jc), qualityCheck: stamped };
    jobcards[id] = updated;
    writeStore(LOCAL_KEYS.jobcards, jobcards);
    return updated;
  },

  async saveJobcardDelivery(id, delivery) {
    const jobcards = readStore<Jobcard>(LOCAL_KEYS.jobcards);
    const jc = jobcards[id];
    if (!jc) throw new Error(`Job card ${id} not found`);
    const stamped = { ...delivery, deliveredAt: delivery.deliveredAt ?? Date.now() };
    const updated: Jobcard = { ...normalizeJobcardStatus(jc), delivery: stamped };
    jobcards[id] = updated;
    writeStore(LOCAL_KEYS.jobcards, jobcards);
    return updated;
  },

  // --- Wave 2: roster ---------------------------------------------------------------------

  subscribeEmployees(cb) {
    const emit = () => {
      const employees = readStore<Employee>(LOCAL_KEYS.employees);
      cb(Object.values(employees).sort((a, b) => a.loginId.localeCompare(b.loginId)));
    };
    emit();
    return onStoreChanged(LOCAL_KEYS.employees, emit);
  },

  async saveEmployee(e) {
    const employees = readStore<Employee>(LOCAL_KEYS.employees);
    const id = e.id || genId('emp');
    const saved: Employee = { ...e, id };
    employees[id] = saved;
    writeStore(LOCAL_KEYS.employees, employees);
    return saved;
  },

  // --- Wave 2: daily work tracking ----------------------------------------------------------

  subscribeWorkItems(cb, filter) {
    const emit = () => {
      const items = readStore<WorkItem>(LOCAL_KEYS.workItems);
      let list = Object.values(items);
      if (filter?.date) list = list.filter((w) => w.date === filter.date);
      if (filter?.employeeId) list = list.filter((w) => w.assignedTo === filter.employeeId);
      cb(list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
    };
    emit();
    return onStoreChanged(LOCAL_KEYS.workItems, emit);
  },

  async createWorkItem(input) {
    const items = readStore<WorkItem>(LOCAL_KEYS.workItems);
    const id = genId('wi');
    const wi: WorkItem = {
      id,
      date: input.date,
      title: input.title,
      jobcardId: input.jobcardId,
      bookingId: input.bookingId,
      assignedTo: input.assignedTo,
      status: 'assigned',
      notes: [],
      estHours: input.estHours,
      hoursLogged: 0,
      createdAt: Date.now(),
    };
    items[id] = wi;
    writeStore(LOCAL_KEYS.workItems, items);
    return wi;
  },

  async updateWorkItemStatus(id, status) {
    if (status === 'confirmed') {
      throw new Error('Use confirmWorkItem to confirm a finished work item.');
    }
    const items = readStore<WorkItem>(LOCAL_KEYS.workItems);
    const item = items[id];
    if (!item) throw new Error(`Work item ${id} not found`);
    const now = Date.now();
    item.status = status;
    if (status === 'in_progress' && !item.startedAt) item.startedAt = now;
    if (status === 'finished') {
      item.finishedAt = now;
      if (item.startedAt) item.hoursLogged = round2((now - item.startedAt) / 3_600_000);
    }
    items[id] = item;
    writeStore(LOCAL_KEYS.workItems, items);
  },

  async confirmWorkItem(id) {
    const items = readStore<WorkItem>(LOCAL_KEYS.workItems);
    const item = items[id];
    if (!item) throw new Error(`Work item ${id} not found`);
    item.status = 'confirmed';
    item.confirmedAt = Date.now();
    items[id] = item;
    writeStore(LOCAL_KEYS.workItems, items);
  },

  async adjustWorkItemHours(id, hours) {
    const items = readStore<WorkItem>(LOCAL_KEYS.workItems);
    const item = items[id];
    if (!item) throw new Error(`Work item ${id} not found`);
    item.hoursLogged = hours;
    items[id] = item;
    writeStore(LOCAL_KEYS.workItems, items);
  },

  async addWorkNote(id, text, customerVisible) {
    const items = readStore<WorkItem>(LOCAL_KEYS.workItems);
    const item = items[id];
    if (!item) throw new Error(`Work item ${id} not found`);
    const note: WorkItemNote = { at: Date.now(), by: currentActorId(), text, customerVisible };
    item.notes = [...item.notes, note];
    items[id] = item;
    writeStore(LOCAL_KEYS.workItems, items);

    // Customer-visible notes are mirrored onto the linked booking (Booking.customerNotes,
    // section-D pattern — same as jobcardStage). Booking resolved via the work item's own
    // bookingId, or through its jobcard for items created after conversion. No linked
    // booking (walk-in jobcard / free-text task) -> nothing to mirror, no customer surface.
    if (customerVisible) {
      const bookingId =
        item.bookingId ??
        (item.jobcardId ? readStore<Jobcard>(LOCAL_KEYS.jobcards)[item.jobcardId]?.bookingId : undefined);
      if (bookingId) {
        const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
        const booking = bookings[bookingId];
        if (booking) {
          booking.customerNotes = [...(booking.customerNotes ?? []), toBookingCustomerNote(note)];
          bookings[bookingId] = booking;
          writeStore(LOCAL_KEYS.bookings, bookings);
        }
      }
    }
  },

  // --- Wave 2: customer registry -------------------------------------------------------------

  subscribeCustomers(cb) {
    const emit = () => {
      const customers = readStore<Customer>(LOCAL_KEYS.customers);
      cb(Object.values(customers).sort((a, b) => b.createdAt - a.createdAt));
    };
    emit();
    return onStoreChanged(LOCAL_KEYS.customers, emit);
  },

  async saveCustomer(c) {
    const customers = readStore<Customer>(LOCAL_KEYS.customers);
    const key = normalizePhone(c.phone) || c.phone;
    const saved: Customer = { ...c, phone: key };
    customers[key] = saved;
    writeStore(LOCAL_KEYS.customers, customers);
    return saved;
  },

  subscribeCustomerNotes(bookingId, cb) {
    // Reads ONLY the booking doc's customerNotes mirror — never work_items. The customer app
    // could read work_items in demo, but not on live (admin/staff-only rules); both drivers
    // read the same single place so demo can never mask a live permission failure again.
    const emit = () => {
      const bookings = readStore<Booking>(LOCAL_KEYS.bookings);
      const notes = [...(bookings[bookingId]?.customerNotes ?? [])].sort((a, b) => a.at - b.at);
      cb(notes);
    };
    emit();
    return onStoreChanged(LOCAL_KEYS.bookings, emit);
  },
};

// ---------------------------------------------------------------------------------------
// Driver selection
// ---------------------------------------------------------------------------------------

let cachedDriver: DataDriver | null = null;
let driverPromise: Promise<DataDriver> | null = null;

/**
 * Resolves to the firestore driver iff Firebase config is present, otherwise the local
 * (demo) driver. The firestore driver — and the entire `firebase` SDK it imports — is only
 * ever loaded via this dynamic import, so a demo-mode page load never fetches that chunk.
 */
export function getDriver(): Promise<DataDriver> {
  if (cachedDriver) return Promise.resolve(cachedDriver);
  if (!driverPromise) {
    driverPromise = (async () => {
      if (hasFirebaseConfig) {
        const { makeFirestoreDriver } = await import('./firestoreDriver');
        cachedDriver = makeFirestoreDriver();
      } else {
        cachedDriver = localDriver;
      }
      return cachedDriver;
    })();
  }
  return driverPromise;
}
