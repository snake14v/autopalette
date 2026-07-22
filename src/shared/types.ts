// Shared data model — see docs/APP_SPEC.md "Data model" section (source of truth).
// Do not diverge from the spec without updating docs/APP_SPEC.md in the same change.

export type BookingStatus =
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export interface Booking {
  id: string;
  createdAt: number; // ms epoch (Firestore Timestamp -> millis at the driver boundary)
  status: BookingStatus;
  statusHistory: { status: BookingStatus; at: number; note?: string }[];
  customer: { name: string; phone: string };
  vehicle: { regNumber: string; makeModel: string; odometer?: number };
  serviceIds: string[]; // from catalog
  otherRequest?: string; // free text
  preferredDate?: string; // ISO date
  jobcardId?: string; // set when admin opens a job card
  // docs/WAVE5_SPEC.md section D — customer-safe stage mirror. Denormalized from the linked
  // Jobcard's lifecycle status by the ADMIN-SIDE driver only (setJobcardStatus), so the
  // customer app can show coarse workshop progress without ever reading jobcards directly
  // (firestore.rules for jobcards stay admin/staff-only, unchanged). Absent/undefined = no
  // stage to show (jobcard open, closed, void, or never linked).
  jobcardStage?: 'working' | 'quality_check' | 'ready';
}

// docs/JOBCARD_LIFECYCLE_SPEC.md — the professional service-centre lifecycle. Additive to the
// wave-1/2/3 billing model above; every field below is new, nothing existing changes shape.
export type JobcardStatus =
  | 'open'
  | 'in_progress'
  | 'quality_check'
  | 'completed'
  | 'closed'
  | 'void';

export interface JobcardStatusHistoryEntry {
  status: JobcardStatus;
  at: number; // ms epoch
  by?: string; // 'admin' or an Employee.id — who made the transition
  /** Required by the driver for reopen (completed/closed -> in_progress) and void. */
  reason?: string;
}

export interface JobcardCheckIn {
  odometerReading?: number;
  fuelLevel?: 'E' | '1/4' | '1/2' | '3/4' | 'F';
  existingDamageNotes?: string;
  keyTagNumber?: string;
  checkedInAt?: number; // ms epoch
}

export interface JobcardQcChecklistItem {
  item: string;
  passed: boolean;
}

export interface JobcardQualityCheck {
  checklist: JobcardQcChecklistItem[];
  notes?: string;
  checkedAt?: number; // ms epoch
}

export interface JobcardDelivery {
  odometerOut?: number;
  deliveredAt?: number; // ms epoch
  /** A checkbox admin ticks at handover, not a real e-signature (out of scope). */
  customerSignedOff?: boolean;
}

export interface Jobcard {
  // = the owner's full field list
  id: string;
  invoiceNumber: string; // AP-YYYY-#### via transactional counter
  date: string;
  bookingId?: string; // walk-ins allowed: jobcard without booking
  customer: { name: string; phone: string };
  // docs/WAVE5_SPEC.md section B — vehicle depth: year/color/vin are optional, shown in the
  // editor + invoice vehicle block only when present.
  vehicle: {
    regNumber: string;
    makeModel: string;
    odometer?: number;
    year?: number;
    color?: string;
    vin?: string;
  };
  services: { serviceId: string; label: string; qty: number; unitPrice: number }[];
  // Wave 2: an employee can be assigned the whole project (job card), in addition to /
  // instead of individual WorkItems. employeeId[] — project-level assignment.
  assignedTo?: string[];
  materials: { ppfBrand?: string; ceramicBrand?: string; paintCode?: string; other?: string };
  pricing: {
    labourCharges: number;
    materialCharges: number;
    discount: number; // flat ₹
    gstEnabled: boolean;
    gstRate: number; // default 18
    // computed + denormalized on save:
    subtotal: number;
    gstAmount: number;
    totalAmount: number;
    advancePaid: number;
    balanceDue: number;
  };
  payment: {
    mode: 'cash' | 'upi' | 'card' | 'bank_transfer' | '';
    transactionId?: string;
    status: 'unpaid' | 'advance_paid' | 'paid';
  };
  // docs/WAVE5_SPEC.md section B — payment-status changes, appended by setJobcardPaymentStatus.
  // Additive: absent on job cards saved before this wave landed (treated as empty history).
  paymentHistory?: { at: number; from: Jobcard['payment']['status']; to: Jobcard['payment']['status'] }[];
  warranty: { period?: string; terms?: string };
  remarks: {
    beforeAfterCondition?: string;
    customerRequests?: string;
    deliveryDateTime?: string;
  };
  // --- Job-card lifecycle (docs/JOBCARD_LIFECYCLE_SPEC.md) -------------------------------
  status: JobcardStatus; // defaults 'open' on create
  statusHistory: JobcardStatusHistoryEntry[];
  checkIn?: JobcardCheckIn;
  qualityCheck?: JobcardQualityCheck;
  delivery?: JobcardDelivery;
  // docs/WAVE5_SPEC.md section C — stamped on every saveJobcard call; powers the "recently
  // updated" sort on JobcardsList. Additive: absent on job cards saved before this wave.
  updatedAt?: number; // ms epoch
}

// ---------------------------------------------------------------------------------------
// Wave 2 — Employees & daily work tracking (see docs/APP_SPEC.md "Wave 2" sections)
// ---------------------------------------------------------------------------------------

export interface Employee {
  id: string;
  /** Stable login id, e.g. 'AP-EMP1' … 'AP-EMP5'. Display name is freely renameable. */
  loginId: string;
  name: string;
  phone?: string;
  active: boolean;
  /** DEMO MODE ONLY — live mode uses a Firebase account instead. Never present in live data. */
  pin?: string;
  // docs/WAVE5_SPEC.md section A — hex colour, editable via a swatch picker in the roster
  // editor. Absent = auto-assigned by roster order at render time (see employeeColor() in
  // src/shared/colors.ts) — nothing is written until the admin explicitly picks one.
  color?: string;
}

export interface WorkItemNote {
  at: number; // ms epoch
  by: string; // 'admin' or an Employee.id
  text: string;
  /** Default false. Only customerVisible notes surface on the public booking timeline. */
  customerVisible: boolean;
}

export type WorkItemStatus = 'assigned' | 'in_progress' | 'finished' | 'confirmed';

export interface WorkItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  jobcardId?: string;
  bookingId?: string;
  assignedTo: string; // Employee.id
  status: WorkItemStatus;
  notes: WorkItemNote[];
  startedAt?: number; // ms epoch — stamped on transition to in_progress
  finishedAt?: number; // ms epoch — stamped on transition to finished
  estHours?: number;
  hoursLogged: number; // auto-computed from startedAt→finishedAt; admin can override
  // docs/WAVE5_SPEC.md section B — stamped by createWorkItem/confirmWorkItem respectively, so
  // the jobcard activity timeline can place "assigned" and "confirmed" events chronologically
  // alongside started/finished. Additive: absent on work items created before this wave.
  createdAt?: number; // ms epoch
  confirmedAt?: number; // ms epoch
}

export interface CustomerVehicle {
  reg: string;
  makeModel: string;
}

export interface Customer {
  /** Normalized 10-digit phone — the document/record key. */
  phone: string;
  name: string;
  altPhone?: string;
  vehicles: CustomerVehicle[];
  notes?: string;
  createdAt: number; // ms epoch
}
