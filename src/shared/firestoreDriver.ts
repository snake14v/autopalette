// firestoreDriver — Firebase Firestore + Auth. Collections: bookings, jobcards, counters,
// users, employees, work_items, customers.
//
// This module statically imports `firebase/firestore` + `firebase/auth` + ./firebase (which
// itself imports `firebase/app`). It must ONLY ever be reached via the dynamic
// `import('./firestoreDriver')` in src/shared/data.ts::getDriver() — never imported eagerly —
// so demo-mode loads never pay for the firebase SDK chunk.

import type {
  Booking,
  BookingStatus,
  Jobcard,
  JobcardStatus,
  JobcardStatusHistoryEntry,
  Employee,
  WorkItem,
  WorkItemStatus,
  WorkItemNote,
  Customer,
} from './types';
import { firestoreDb, firebaseAuth } from './firebase';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  runTransaction,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  computeJobcardPricing,
  blankJobcard,
  normalizePhone,
  round2,
  assertValidJobcardTransition,
  assertQualityCheckPassed,
  assertDeliverySignedOff,
  normalizeJobcardStatus,
  jobcardStageForBookingMirror,
  type DataDriver,
  type AuthState,
  type WorkItemInput,
} from './data';
import { SERVICE_CATALOG } from './catalog';

export function makeFirestoreDriver(): DataDriver {
  // Only ever called from getDriver() when hasFirebaseConfig is true, so firestoreDb /
  // firebaseAuth (initialized in src/shared/firebase.ts) are guaranteed non-null here.
  const db = firestoreDb!;
  const auth = firebaseAuth!;

  const bookingsCol = collection(db, 'bookings');
  const jobcardsCol = collection(db, 'jobcards');
  const employeesCol = collection(db, 'employees');
  const workItemsCol = collection(db, 'work_items');
  const customersCol = collection(db, 'customers');

  function mapBooking(id: string, data: Record<string, unknown>): Booking {
    const createdAtRaw = data.createdAt;
    const createdAt =
      createdAtRaw instanceof Timestamp ? createdAtRaw.toMillis() : Number(createdAtRaw) || Date.now();
    return {
      id,
      createdAt,
      status: data.status as BookingStatus,
      statusHistory: (data.statusHistory as Booking['statusHistory']) ?? [],
      customer: data.customer as Booking['customer'],
      vehicle: data.vehicle as Booking['vehicle'],
      serviceIds: (data.serviceIds as string[]) ?? [],
      otherRequest: data.otherRequest as string | undefined,
      preferredDate: data.preferredDate as string | undefined,
      jobcardId: data.jobcardId as string | undefined,
    };
  }

  function mapJobcard(id: string, data: Record<string, unknown>): Jobcard {
    return normalizeJobcardStatus({ ...(data as Omit<Jobcard, 'id'>), id });
  }

  function mapEmployee(id: string, data: Record<string, unknown>): Employee {
    return { ...(data as Omit<Employee, 'id'>), id };
  }

  function mapWorkItem(id: string, data: Record<string, unknown>): WorkItem {
    return { ...(data as Omit<WorkItem, 'id'>), id };
  }

  function mapCustomer(data: Record<string, unknown>): Customer {
    return data as unknown as Customer;
  }

  async function nextInvoiceNumberTx(): Promise<string> {
    const year = new Date().getFullYear();
    const counterRef = doc(db, 'counters', 'invoices');
    const invoiceNumber = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const data = (snap.exists() ? snap.data() : {}) as Record<string, number>;
      const current = data[String(year)] ?? 0;
      const next = current + 1;
      tx.set(counterRef, { ...data, [String(year)]: next }, { merge: true });
      return `AP-${year}-${String(next).padStart(4, '0')}`;
    });
    return invoiceNumber;
  }

  /** Auto-upsert helper shared by createBooking + saveJobcard (Wave 2 customer registry). */
  async function upsertCustomer(input: {
    name: string;
    phone: string;
    vehicle?: { regNumber: string; makeModel: string };
  }): Promise<void> {
    const key = normalizePhone(input.phone);
    if (!key) return;
    const ref = doc(db, 'customers', key);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) {
          const data = snap.data() as Customer;
          const vehicles = data.vehicles ?? [];
          let nextVehicles = vehicles;
          if (input.vehicle?.regNumber) {
            const regUpper = input.vehicle.regNumber.toUpperCase();
            const has = vehicles.some((v) => v.reg.toUpperCase() === regUpper);
            if (!has) {
              nextVehicles = [
                ...vehicles,
                { reg: input.vehicle.regNumber, makeModel: input.vehicle.makeModel },
              ];
            }
          }
          tx.set(ref, { ...data, name: data.name || input.name || '', vehicles: nextVehicles }, { merge: true });
        } else {
          const customer: Customer = {
            phone: key,
            name: input.name || '',
            vehicles: input.vehicle?.regNumber
              ? [{ reg: input.vehicle.regNumber, makeModel: input.vehicle.makeModel }]
              : [],
            createdAt: Date.now(),
          };
          tx.set(ref, customer);
        }
      });
    } catch (err) {
      // Customer-registry upkeep is auxiliary — never let it break a booking/jobcard save.
      console.error('Customer upsert failed:', err);
    }
  }

  /** 'admin' or the signed-in employee's id — used to stamp WorkItemNote.by. */
  async function currentActorId(): Promise<string> {
    const user = auth.currentUser;
    if (!user) return 'unknown';
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return 'unknown';
    const data = snap.data();
    return data.role === 'admin' ? 'admin' : ((data.employeeId as string) ?? 'unknown');
  }

  const driver: DataDriver = {
    mode: 'live',

    async createBooking(input) {
      const now = Date.now();
      const docRef = await addDoc(bookingsCol, {
        createdAt: serverTimestamp(),
        status: 'requested' as BookingStatus,
        statusHistory: [{ status: 'requested', at: now }],
        customer: input.customer,
        vehicle: input.vehicle,
        serviceIds: input.serviceIds,
        otherRequest: input.otherRequest ?? null,
        preferredDate: input.preferredDate ?? null,
      });
      await upsertCustomer({ name: input.customer.name, phone: input.customer.phone, vehicle: input.vehicle });
      return {
        id: docRef.id,
        createdAt: now,
        status: 'requested',
        statusHistory: [{ status: 'requested', at: now }],
        customer: input.customer,
        vehicle: input.vehicle,
        serviceIds: input.serviceIds,
        otherRequest: input.otherRequest,
        preferredDate: input.preferredDate,
      };
    },

    async getBooking(id) {
      const snap = await getDoc(doc(db, 'bookings', id));
      return snap.exists() ? mapBooking(snap.id, snap.data()) : null;
    },

    subscribeBooking(id, cb) {
      return onSnapshot(doc(db, 'bookings', id), (snap) => {
        cb(snap.exists() ? mapBooking(snap.id, snap.data()) : null);
      });
    },

    async adminSignIn(email, password) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const roleSnap = await getDoc(doc(db, 'users', cred.user.uid));
      const role = roleSnap.exists() ? (roleSnap.data().role as string | undefined) : undefined;
      if (role !== 'admin') {
        await signOut(auth);
        throw new Error('This account is not authorized as an admin.');
      }
    },

    async adminSignOut() {
      await signOut(auth);
    },

    onAdminAuth(cb) {
      return onAuthStateChanged(auth, async (user) => {
        if (!user) {
          cb(false);
          return;
        }
        try {
          const roleSnap = await getDoc(doc(db, 'users', user.uid));
          cb(roleSnap.exists() && roleSnap.data().role === 'admin');
        } catch {
          cb(false);
        }
      });
    },

    async signInWithLoginId(loginId, password) {
      const email = `${loginId.toLowerCase()}@app.autopalette.in`;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const roleSnap = await getDoc(doc(db, 'users', cred.user.uid));
      const role = roleSnap.exists() ? (roleSnap.data().role as string | undefined) : undefined;
      if (role !== 'admin' && role !== 'staff') {
        await signOut(auth);
        throw new Error('This account is not authorized.');
      }
    },

    onAuth(cb) {
      return onAuthStateChanged(auth, async (user) => {
        if (!user) {
          cb({ signedIn: false, role: null });
          return;
        }
        try {
          const roleSnap = await getDoc(doc(db, 'users', user.uid));
          if (!roleSnap.exists()) {
            cb({ signedIn: false, role: null });
            return;
          }
          const data = roleSnap.data();
          const role = data.role as 'admin' | 'staff' | undefined;
          if (role !== 'admin' && role !== 'staff') {
            cb({ signedIn: false, role: null });
            return;
          }
          cb({ signedIn: true, role, employeeId: data.employeeId as string | undefined });
        } catch {
          cb({ signedIn: false, role: null });
        }
      });
    },

    subscribeBookings(cb) {
      const q = query(bookingsCol, orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => mapBooking(d.id, d.data())));
      });
    },

    async updateBookingStatus(id, status, note) {
      await updateDoc(doc(db, 'bookings', id), {
        status,
        statusHistory: arrayUnion({ status, at: Date.now(), ...(note ? { note } : {}) }),
      });
    },

    async createJobcardFromBooking(bookingId) {
      const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingSnap.exists()) throw new Error(`Booking ${bookingId} not found`);
      const booking = mapBooking(bookingSnap.id, bookingSnap.data());

      const jc = blankJobcard('');
      jc.bookingId = bookingId;
      jc.customer = booking.customer;
      jc.vehicle = booking.vehicle;
      // Carry the booking's requested services onto the job card as billable rows —
      // label from catalog, qty 1, unitPrice startingPrice ?? 0 (admin edits per job).
      jc.services = booking.serviceIds.map((sid) => {
        const entry = SERVICE_CATALOG.find((s) => s.id === sid);
        return { serviceId: sid, label: entry?.label ?? sid, qty: 1, unitPrice: entry?.startingPrice ?? 0 };
      });

      const { id: _drop, ...jcData } = jc;
      const docRef = await addDoc(jobcardsCol, jcData);
      await updateDoc(doc(db, 'bookings', bookingId), { jobcardId: docRef.id });
      return { ...jc, id: docRef.id };
    },

    async createBlankJobcard() {
      const jc = blankJobcard('');
      const { id: _drop, ...jcData } = jc;
      const docRef = await addDoc(jobcardsCol, jcData);
      return { ...jc, id: docRef.id };
    },

    async createBlankJobcardFor(customer, vehicle) {
      const jc = blankJobcard('');
      jc.customer = customer;
      jc.vehicle = vehicle;
      const { id: _drop, ...jcData } = jc;
      const docRef = await addDoc(jobcardsCol, jcData);
      return { ...jc, id: docRef.id };
    },

    async saveJobcard(jc) {
      const pricing = computeJobcardPricing(jc.services, jc.pricing);
      const invoiceNumber = jc.invoiceNumber || (await nextInvoiceNumberTx());
      const saved: Jobcard = { ...jc, pricing, invoiceNumber, updatedAt: Date.now() };
      const { id, ...data } = saved;
      await setDoc(doc(db, 'jobcards', id), data, { merge: true });
      await upsertCustomer({ name: saved.customer.name, phone: saved.customer.phone, vehicle: saved.vehicle });
      return saved;
    },

    async getJobcard(id) {
      const snap = await getDoc(doc(db, 'jobcards', id));
      return snap.exists() ? mapJobcard(snap.id, snap.data()) : null;
    },

    async setJobcardPaymentStatus(id, status) {
      // Nested-field write — touches only payment.status, leaving pricing/invoice untouched.
      // A read-before-write is needed only to know the `from` value for paymentHistory
      // (docs/WAVE5_SPEC.md section B); still no pricing recompute, no invoice allocation.
      const ref = doc(db, 'jobcards', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Job card ${id} not found`);
      const from = (mapJobcard(snap.id, snap.data()).payment?.status ?? 'unpaid') as Jobcard['payment']['status'];
      const patch: Record<string, unknown> = { 'payment.status': status };
      if (from !== status) {
        patch.paymentHistory = arrayUnion({ at: Date.now(), from, to: status });
      }
      await updateDoc(ref, patch);
    },

    subscribeJobcards(cb) {
      const q = query(jobcardsCol, orderBy('date', 'desc'));
      return onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => mapJobcard(d.id, d.data())));
      });
    },

    // --- Job-card lifecycle (docs/JOBCARD_LIFECYCLE_SPEC.md) -------------------------------

    async setJobcardStatus(id, status, opts) {
      // currentActorId() reads users/{uid} — a separate read outside the transaction below,
      // same pattern addWorkNote already uses; only the jobcard doc itself needs transactional
      // read-validate-write so concurrent admins can never race past an illegal transition.
      const by = await currentActorId();
      const ref = doc(db, 'jobcards', id);
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error(`Job card ${id} not found`);
        const current = mapJobcard(snap.id, snap.data());
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
          by,
          ...(opts?.reason ? { reason: opts.reason } : {}),
        };
        const next: Jobcard = {
          ...current,
          status,
          statusHistory: [...current.statusHistory, entry],
        };
        const { id: _drop, ...data } = next;
        tx.set(ref, data, { merge: true });

        // docs/WAVE5_SPEC.md section D — admin-side customer-safe stage mirror onto the
        // linked booking. No prior read of the booking doc is needed (unconditional merge),
        // so this stays within the transaction's read-then-write ordering rule (the only read
        // above is the jobcard's own snap.get()). deleteField() removes the field entirely for
        // closed/void/open, rather than leaving a stale stage behind.
        if (next.bookingId) {
          const stage = jobcardStageForBookingMirror(status);
          const bookingRef = doc(db, 'bookings', next.bookingId);
          tx.set(bookingRef, { jobcardStage: stage ?? deleteField() }, { merge: true });
        }

        return next;
      });
    },

    async saveJobcardCheckIn(id, checkIn) {
      const ref = doc(db, 'jobcards', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Job card ${id} not found`);
      const current = mapJobcard(snap.id, snap.data());
      const next: Jobcard = { ...current, checkIn };
      await updateDoc(ref, { checkIn });
      return next;
    },

    async saveJobcardQualityCheck(id, qc) {
      const ref = doc(db, 'jobcards', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Job card ${id} not found`);
      const current = mapJobcard(snap.id, snap.data());
      const stamped = { ...qc, checkedAt: qc.checkedAt ?? Date.now() };
      const next: Jobcard = { ...current, qualityCheck: stamped };
      await updateDoc(ref, { qualityCheck: stamped });
      return next;
    },

    async saveJobcardDelivery(id, delivery) {
      const ref = doc(db, 'jobcards', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Job card ${id} not found`);
      const current = mapJobcard(snap.id, snap.data());
      const stamped = { ...delivery, deliveredAt: delivery.deliveredAt ?? Date.now() };
      const next: Jobcard = { ...current, delivery: stamped };
      await updateDoc(ref, { delivery: stamped });
      return next;
    },

    // --- Wave 2: roster -------------------------------------------------------------------

    subscribeEmployees(cb) {
      return onSnapshot(employeesCol, (snap) => {
        const list = snap.docs.map((d) => mapEmployee(d.id, d.data()));
        list.sort((a, b) => a.loginId.localeCompare(b.loginId));
        cb(list);
      });
    },

    async saveEmployee(e) {
      if (e.id) {
        const { id, ...data } = e;
        await setDoc(doc(db, 'employees', id), data, { merge: true });
        return e;
      }
      const { id: _drop, ...data } = e;
      const docRef = await addDoc(employeesCol, data);
      return { ...e, id: docRef.id };
    },

    // --- Wave 2: work items -----------------------------------------------------------------

    subscribeWorkItems(cb, filter) {
      const clauses = [];
      if (filter?.date) clauses.push(where('date', '==', filter.date));
      if (filter?.employeeId) clauses.push(where('assignedTo', '==', filter.employeeId));
      const q = clauses.length ? query(workItemsCol, ...clauses) : query(workItemsCol);
      return onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => mapWorkItem(d.id, d.data())));
      });
    },

    async createWorkItem(input) {
      const wi: Omit<WorkItem, 'id'> = {
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
      const docRef = await addDoc(workItemsCol, wi);
      return { ...wi, id: docRef.id };
    },

    async updateWorkItemStatus(id, status) {
      if (status === 'confirmed') {
        throw new Error('Use confirmWorkItem to confirm a finished work item.');
      }
      const ref = doc(db, 'work_items', id);
      const patch: Record<string, unknown> = { status };
      if (status === 'in_progress' || status === 'finished') {
        const snap = await getDoc(ref);
        const existing = snap.exists() ? (snap.data() as WorkItem) : undefined;
        const now = Date.now();
        if (status === 'in_progress' && !existing?.startedAt) {
          patch.startedAt = now;
        }
        if (status === 'finished') {
          patch.finishedAt = now;
          const startedAt = (patch.startedAt as number | undefined) ?? existing?.startedAt;
          if (startedAt) patch.hoursLogged = round2((now - startedAt) / 3_600_000);
        }
      }
      await updateDoc(ref, patch);
    },

    async confirmWorkItem(id) {
      await updateDoc(doc(db, 'work_items', id), {
        status: 'confirmed' as WorkItemStatus,
        confirmedAt: Date.now(),
      });
    },

    async adjustWorkItemHours(id, hours) {
      await updateDoc(doc(db, 'work_items', id), { hoursLogged: hours });
    },

    async addWorkNote(id, text, customerVisible) {
      const by = await currentActorId();
      const note: WorkItemNote = { at: Date.now(), by, text, customerVisible };
      await updateDoc(doc(db, 'work_items', id), { notes: arrayUnion(note) });
    },

    // --- Wave 2: customers ------------------------------------------------------------------

    subscribeCustomers(cb) {
      return onSnapshot(customersCol, (snap) => {
        const list = snap.docs.map((d) => mapCustomer(d.data()));
        list.sort((a, b) => b.createdAt - a.createdAt);
        cb(list);
      });
    },

    async saveCustomer(c) {
      const key = normalizePhone(c.phone) || c.phone;
      const saved: Customer = { ...c, phone: key };
      await setDoc(doc(db, 'customers', key), saved, { merge: true });
      return saved;
    },

    subscribeCustomerNotes(bookingId, cb) {
      let byBooking: WorkItem[] = [];
      let byJobcard: WorkItem[] = [];

      function emit() {
        const merged = new Map<string, WorkItem>();
        for (const w of [...byBooking, ...byJobcard]) merged.set(w.id, w);
        const notes = Array.from(merged.values())
          .flatMap((w) => w.notes.filter((n) => n.customerVisible))
          .sort((a, b) => a.at - b.at);
        cb(notes);
      }

      const unsubByBooking = onSnapshot(query(workItemsCol, where('bookingId', '==', bookingId)), (snap) => {
        byBooking = snap.docs.map((d) => mapWorkItem(d.id, d.data()));
        emit();
      });

      let unsubByJobcard: (() => void) | null = null;
      getDoc(doc(db, 'bookings', bookingId)).then((snap) => {
        const jobcardId = snap.exists() ? (snap.data().jobcardId as string | undefined) : undefined;
        if (jobcardId) {
          unsubByJobcard = onSnapshot(query(workItemsCol, where('jobcardId', '==', jobcardId)), (snap2) => {
            byJobcard = snap2.docs.map((d) => mapWorkItem(d.id, d.data()));
            emit();
          });
        }
      });

      return () => {
        unsubByBooking();
        unsubByJobcard?.();
      };
    },
  };

  return driver;
}
