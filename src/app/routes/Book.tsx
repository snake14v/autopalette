import { useEffect, useMemo, useRef, useState } from 'react';
import type { Booking } from '../../shared/types';
import { CATEGORIES, SERVICE_CATALOG } from '../../shared/catalog';
import { Shell } from '../components/Shell';
import { Button } from '../components/Button';
import { InstallButton } from '../components/InstallButton';
import { Field, inputClass } from '../components/Field';
import { CheckIcon, CopyIcon, WhatsAppIcon, ChevronRightIcon, CarIcon } from '../components/icons';
import { driver } from '../lib/driver';
import { navigate, replaceRoute, BOOK_STEPS, type BookStep } from '../lib/router';
import { saveMyBookingId } from '../lib/storage';
import { getProfile, saveProfileFromBooking, type CustomerProfile } from '../lib/profile';
import { withTimeout, TimeoutError } from '../lib/withTimeout';
import { INDIAN_MAKES } from '../lib/makes';
import { formatReg, formatPhoneInput, isValidPhone, todayISO, formatDate } from '../lib/format';
import { STUDIO_WHATSAPP } from '../../shared/format';

const CATALOG_LABELS = new Map(SERVICE_CATALOG.map((s) => [s.id, s.label]));
/** Submit-hang fix (WAVE5_SPEC section E.1) — never let createBooking spin forever. */
const SUBMIT_TIMEOUT_MS = 12_000;
/** Back-button-trap fix (WAVE5_SPEC section E.2) — session-scoped draft, cleared on submit. */
const DRAFT_KEY = 'ap:book-draft';

type Step = BookStep;
const STEP_ORDER: Step[] = [...BOOK_STEPS];
const STEP_TITLES: Record<Step, string> = {
  services: 'Services',
  vehicle: 'Vehicle',
  contact: 'Your details',
  review: 'Review',
};

interface BookForm {
  serviceIds: string[];
  reg: string;
  makeModel: string;
  odometer: string;
  name: string;
  phone: string;
  preferredDate: string;
  otherRequest: string;
}

const EMPTY_FORM: BookForm = {
  serviceIds: [],
  reg: '',
  makeModel: '',
  odometer: '',
  name: '',
  phone: '',
  preferredDate: '',
  otherRequest: '',
};

// ---------------------------------------------------------------------------------------
// Session-scoped draft (WAVE5_SPEC section E.2) — survives a full exit from the flow
// (navigating to Home/Track and back) within the same tab session so it can be offered
// back to the customer, without ever leaving the device.
// ---------------------------------------------------------------------------------------

interface BookDraft {
  step: Step;
  form: BookForm;
  savedAt: number;
}

function readDraft(): BookDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as BookDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(step: Step, form: BookForm): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form, savedAt: Date.now() } satisfies BookDraft));
  } catch {
    /* storage unavailable — non-fatal, just no resume offer */
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** A draft is only worth offering if the customer actually entered something. */
function isFormMeaningful(form: BookForm): boolean {
  return (
    form.serviceIds.length > 0 ||
    !!form.reg.trim() ||
    !!form.makeModel.trim() ||
    !!form.name.trim() ||
    !!form.phone.trim() ||
    !!form.otherRequest.trim()
  );
}

export function Book({ step: routeStep }: { step?: Step }) {
  const step: Step = routeStep ?? 'services';
  const [form, setForm] = useState<BookForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Booking | null>(null);
  const [resumeDraft, setResumeDraft] = useState<BookDraft | null>(null);
  const [profileBanner, setProfileBanner] = useState<CustomerProfile | null>(null);
  const initChecked = useRef(false);

  // Bare "#/book" (e.g. a fresh link from Home) normalizes to "#/book/services" via a
  // history REPLACE (not push) — so hardware back from step 1 exits straight to Home
  // instead of bouncing through an extra "/book" stop.
  useEffect(() => {
    if (!routeStep) replaceRoute('/book/services');
  }, [routeStep]);

  // On first mount: offer to resume a leftover draft from earlier this session; otherwise,
  // if this device has a remembered profile from a prior booking, prefill from it.
  useEffect(() => {
    if (initChecked.current) return;
    initChecked.current = true;
    const draft = readDraft();
    if (draft && isFormMeaningful(draft.form)) {
      setResumeDraft(draft);
      return;
    }
    const profile = getProfile();
    if (profile) applyProfilePrefill(profile);
  }, []);

  // Persist the in-progress draft on every step/form change so a full exit + return can
  // offer to resume it. Session-scoped only — never sent anywhere, cleared on submit.
  useEffect(() => {
    if (success) return;
    if (isFormMeaningful(form)) writeDraft(step, form);
  }, [step, form, success]);

  const patch = (p: Partial<BookForm>) => setForm((f) => ({ ...f, ...p }));

  function applyProfilePrefill(profile: CustomerProfile) {
    const vehicle = profile.vehicles[0];
    setForm((f) => ({
      ...f,
      name: profile.name || f.name,
      phone: profile.phone || f.phone,
      reg: vehicle ? formatReg(vehicle.regNumber) : f.reg,
      makeModel: vehicle?.makeModel ?? f.makeModel,
    }));
    setProfileBanner(profile);
  }

  function applyResumeDraft() {
    if (!resumeDraft) return;
    setForm(resumeDraft.form);
    navigate(`/book/${resumeDraft.step}`);
    setResumeDraft(null);
  }

  function startFresh() {
    clearDraft();
    setResumeDraft(null);
    const profile = getProfile();
    if (profile) applyProfilePrefill(profile);
  }

  function clearProfilePrefill() {
    setForm((f) => ({ ...f, name: '', phone: '', reg: '', makeModel: '' }));
    setProfileBanner(null);
  }

  if (success) {
    return <SuccessScreen booking={success} />;
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  function goNext() {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) navigate(`/book/${next}`);
  }
  function goBackStep(): boolean {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) {
      navigate(`/book/${prev}`);
      return true;
    }
    return false;
  }
  function goToStep(s: Step) {
    navigate(`/book/${s}`);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!navigator.onLine) {
        throw new TimeoutError('offline');
      }
      const booking = await withTimeout(
        driver.createBooking({
          customer: { name: form.name.trim(), phone: form.phone },
          vehicle: {
            regNumber: formatReg(form.reg),
            makeModel: form.makeModel.trim(),
            ...(form.odometer ? { odometer: Number(form.odometer) } : {}),
          },
          serviceIds: form.serviceIds,
          ...(form.otherRequest.trim() ? { otherRequest: form.otherRequest.trim() } : {}),
          ...(form.preferredDate ? { preferredDate: form.preferredDate } : {}),
        }),
        SUBMIT_TIMEOUT_MS
      );
      saveMyBookingId(booking.id);
      saveProfileFromBooking(booking);
      clearDraft();
      setSuccess(booking);
    } catch (err) {
      // Form state is untouched above (we never clear it on error) — Back stays enabled
      // (submitting flips back to false) and Confirm booking doubles as the retry action.
      const message =
        err instanceof TimeoutError
          ? "Couldn't reach the server — check your connection and try again."
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.';
      setSubmitError(message);
      setSubmitting(false);
    }
  }

  return (
    <Shell
      back={stepIndex === 0 ? '/' : undefined}
      title={`Step ${stepIndex + 1} of ${STEP_ORDER.length}`}
    >
      {resumeDraft && (
        <ResumeDraftBanner onResume={applyResumeDraft} onDismiss={startFresh} />
      )}
      {!resumeDraft && profileBanner && (
        <ProfileBanner profile={profileBanner} onChange={clearProfilePrefill} />
      )}

      <StepIndicator current={stepIndex} />

      {step === 'services' && (
        <ServicesStep
          selected={form.serviceIds}
          onChange={(serviceIds) => patch({ serviceIds })}
          onContinue={goNext}
        />
      )}
      {step === 'vehicle' && (
        <VehicleStep form={form} patch={patch} onContinue={goNext} onBack={() => goBackStep()} />
      )}
      {step === 'contact' && (
        <ContactStep form={form} patch={patch} onContinue={goNext} onBack={() => goBackStep()} />
      )}
      {step === 'review' && (
        <ReviewStep
          form={form}
          onEdit={goToStep}
          onBack={() => goBackStep()}
          onConfirm={submit}
          submitting={submitting}
          error={submitError}
        />
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------
// Resume-draft / repeat-customer banners
// ---------------------------------------------------------------------------------------

function ResumeDraftBanner({ onResume, onDismiss }: { onResume: () => void; onDismiss: () => void }) {
  return (
    <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-3.5">
      <p className="font-ui text-sm font-medium text-white">Resume where you left off?</p>
      <p className="mt-0.5 font-body text-xs text-white/60">
        You had a booking in progress from earlier.
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button onClick={onResume} className="!px-3 !py-1.5 text-sm">
          Resume
        </Button>
        <Button variant="ghost" onClick={onDismiss} className="!px-3 !py-1.5 text-sm">
          Start fresh
        </Button>
      </div>
    </div>
  );
}

function ProfileBanner({ profile, onChange }: { profile: CustomerProfile; onChange: () => void }) {
  const vehicle = profile.vehicles[0];
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/5 px-3.5 py-2.5">
      <p className="min-w-0 truncate font-ui text-sm text-white/70">
        Booking as <span className="font-medium text-white">{profile.name || 'you'}</span>
        {vehicle ? (
          <>
            {' '}
            · <span className="font-mono text-white/80">{formatReg(vehicle.regNumber)}</span>
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded px-1 font-ui text-xs text-goldBright hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
      >
        change
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------------------

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Booking steps">
      {STEP_ORDER.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                done
                  ? 'border-gold bg-gold text-char'
                  : active
                    ? 'border-goldBright bg-char text-goldBright'
                    : 'border-white/15 bg-char text-white/30'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <CheckIcon width={13} height={13} /> : i + 1}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <span className={`h-px flex-1 ${done ? 'bg-gold/50' : 'bg-white/10'}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------------------
// Step 1 — services (grouped multi-select + search + pinned count)
// ---------------------------------------------------------------------------------------

function ServicesStep({
  selected,
  onChange,
  onContinue,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  onContinue: () => void;
}) {
  const [queryText, setQueryText] = useState('');
  const q = queryText.trim().toLowerCase();

  const filtered = useMemo(
    () => (q ? SERVICE_CATALOG.filter((s) => s.label.toLowerCase().includes(q)) : SERVICE_CATALOG),
    [q]
  );

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-white">What do you need?</h1>
      <p className="mb-4 font-body text-sm text-white/55">
        Pick one or more services. Prices are confirmed on inspection.
      </p>

      <div className="mb-4">
        <label htmlFor="svc-search" className="sr-only">
          Search services
        </label>
        <input
          id="svc-search"
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search services…"
          className={inputClass()}
          autoCapitalize="none"
        />
      </div>

      {CATEGORIES.map((cat) => {
        const rows = filtered.filter((s) => s.category === cat);
        if (rows.length === 0) return null;
        return (
          <section key={cat} className="mb-5">
            <h2 className="mb-2 font-ui text-xs font-semibold uppercase tracking-wide text-gold/70">
              {cat}
            </h2>
            <div className="space-y-2">
              {rows.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                      on
                        ? 'border-gold/50 bg-gold/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(s.id)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        on ? 'border-gold bg-gold text-char' : 'border-white/25 bg-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      {on && <CheckIcon width={14} height={14} />}
                    </span>
                    <span className="flex-1 font-body text-[15px] text-white">{s.label}</span>
                    <span className="shrink-0 font-ui text-xs text-white/35">
                      {typeof s.startingPrice === 'number'
                        ? `from ₹${s.startingPrice.toLocaleString('en-IN')}`
                        : 'on inspection'}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <p className="py-8 text-center font-body text-sm text-white/40">
          No services match “{queryText}”.
        </p>
      )}

      {/* Pinned selected-count + continue */}
      <div className="sticky bottom-3 z-30 mt-6">
        <div className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-char2/95 p-2.5 pl-4 shadow-xl shadow-black/50 backdrop-blur">
          <span className="font-ui text-sm text-white/70" aria-live="polite">
            <span className="font-semibold text-goldBright">{selected.length}</span> selected
          </span>
          <Button
            className="ml-auto"
            onClick={onContinue}
            disabled={selected.length === 0}
          >
            Continue
            <ChevronRightIcon width={18} height={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Step 2 — vehicle
// ---------------------------------------------------------------------------------------

type StepErrors = Record<string, string>;

function useFocusFirstError(errors: StepErrors, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const el = containerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus();
  }, [errors, containerRef]);
}

function VehicleStep({
  form,
  patch,
  onContinue,
  onBack,
}: {
  form: BookForm;
  patch: (p: Partial<BookForm>) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [errors, setErrors] = useState<StepErrors>({});
  const ref = useRef<HTMLFormElement>(null);
  useFocusFirstError(errors, ref);

  function validateAndNext(e: React.FormEvent) {
    e.preventDefault();
    const next: StepErrors = {};
    if (!formatReg(form.reg).trim()) next.reg = 'Enter your vehicle registration number.';
    if (!form.makeModel.trim()) next.makeModel = 'Enter the make & model.';
    setErrors(next);
    if (Object.keys(next).length === 0) onContinue();
  }

  return (
    <form ref={ref} onSubmit={validateAndNext} noValidate>
      <h1 className="mb-1 font-display text-2xl font-bold text-white">Your vehicle</h1>
      <p className="mb-5 font-body text-sm text-white/55">So we know what&apos;s coming in.</p>

      <Field label="Registration number" error={errors.reg}>
        {(id, describedBy) => (
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={errors.reg ? true : undefined}
            value={form.reg}
            onChange={(e) => patch({ reg: formatReg(e.target.value) })}
            placeholder="KA 01 AB 1234"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputClass(!!errors.reg)} font-mono tracking-wide`}
          />
        )}
      </Field>

      <Field label="Make & model" error={errors.makeModel}>
        {(id, describedBy) => (
          <>
            <input
              id={id}
              list="ap-makes"
              aria-describedby={describedBy}
              aria-invalid={errors.makeModel ? true : undefined}
              value={form.makeModel}
              onChange={(e) => patch({ makeModel: e.target.value })}
              placeholder="e.g. Hyundai Creta"
              className={inputClass(!!errors.makeModel)}
            />
            <datalist id="ap-makes">
              {INDIAN_MAKES.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </>
        )}
      </Field>

      <Field label="Odometer (km)" optional hint="Helps us note the vehicle condition.">
        {(id, describedBy) => (
          <input
            id={id}
            aria-describedby={describedBy}
            type="number"
            inputMode="numeric"
            min={0}
            value={form.odometer}
            onChange={(e) => patch({ odometer: e.target.value.replace(/\D/g, '') })}
            placeholder="e.g. 34500"
            className={inputClass()}
          />
        )}
      </Field>

      <StepNav onBack={onBack} />
    </form>
  );
}

// ---------------------------------------------------------------------------------------
// Step 3 — contact
// ---------------------------------------------------------------------------------------

function ContactStep({
  form,
  patch,
  onContinue,
  onBack,
}: {
  form: BookForm;
  patch: (p: Partial<BookForm>) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [errors, setErrors] = useState<StepErrors>({});
  const ref = useRef<HTMLFormElement>(null);
  useFocusFirstError(errors, ref);

  function validateAndNext(e: React.FormEvent) {
    e.preventDefault();
    const next: StepErrors = {};
    if (!form.name.trim()) next.name = 'Enter your name.';
    if (!isValidPhone(form.phone)) next.phone = 'Enter a 10-digit mobile number.';
    setErrors(next);
    if (Object.keys(next).length === 0) onContinue();
  }

  return (
    <form ref={ref} onSubmit={validateAndNext} noValidate>
      <h1 className="mb-1 font-display text-2xl font-bold text-white">Your details</h1>
      <p className="mb-5 font-body text-sm text-white/55">
        We&apos;ll use this to confirm your booking.
      </p>

      <Field label="Full name" error={errors.name}>
        {(id, describedBy) => (
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={errors.name ? true : undefined}
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Your name"
            autoComplete="name"
            className={inputClass(!!errors.name)}
          />
        )}
      </Field>

      <Field label="Mobile number" error={errors.phone} hint="10-digit Indian mobile number.">
        {(id, describedBy) => (
          <div className="flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-white/12 bg-white/[0.06] px-3 font-body text-[15px] text-white/60">
              +91
            </span>
            <input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={errors.phone ? true : undefined}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={form.phone}
              onChange={(e) => patch({ phone: formatPhoneInput(e.target.value) })}
              placeholder="98xxxxxxxx"
              className={`${inputClass(!!errors.phone)} rounded-l-none`}
            />
          </div>
        )}
      </Field>

      <Field label="Preferred date" optional>
        {(id, describedBy) => (
          <input
            id={id}
            aria-describedby={describedBy}
            type="date"
            min={todayISO()}
            value={form.preferredDate}
            onChange={(e) => patch({ preferredDate: e.target.value })}
            className={inputClass()}
          />
        )}
      </Field>

      <Field label="Anything else?" optional hint="Special requests, problem areas, etc.">
        {(id, describedBy) => (
          <textarea
            id={id}
            aria-describedby={describedBy}
            value={form.otherRequest}
            onChange={(e) => patch({ otherRequest: e.target.value })}
            rows={3}
            placeholder="e.g. deep scratch on rear door, pickup requested"
            className={`${inputClass()} resize-none`}
          />
        )}
      </Field>

      <StepNav onBack={onBack} nextLabel="Review" />
    </form>
  );
}

// ---------------------------------------------------------------------------------------
// Step 4 — review
// ---------------------------------------------------------------------------------------

function ReviewStep({
  form,
  onEdit,
  onBack,
  onConfirm,
  submitting,
  error,
}: {
  form: BookForm;
  onEdit: (s: Step) => void;
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const labels = form.serviceIds.map((id) => CATALOG_LABELS.get(id) ?? id);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-white">Review your booking</h1>
      <p className="mb-5 font-body text-sm text-white/55">Check everything looks right.</p>

      <ReviewBlock title="Services" onEdit={() => onEdit('services')}>
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <span
              key={l}
              className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-ui text-xs text-goldBright"
            >
              {l}
            </span>
          ))}
        </div>
      </ReviewBlock>

      <ReviewBlock title="Vehicle" onEdit={() => onEdit('vehicle')}>
        <p className="font-body text-[15px] text-white">
          {formatReg(form.reg)}
          {form.makeModel ? <span className="text-white/60"> · {form.makeModel}</span> : null}
        </p>
        {form.odometer ? (
          <p className="mt-0.5 font-ui text-xs text-white/40">
            {Number(form.odometer).toLocaleString('en-IN')} km
          </p>
        ) : null}
      </ReviewBlock>

      <ReviewBlock title="Your details" onEdit={() => onEdit('contact')}>
        <p className="font-body text-[15px] text-white">{form.name}</p>
        <p className="mt-0.5 font-body text-sm text-white/60">+91 {form.phone}</p>
        {form.preferredDate ? (
          <p className="mt-0.5 font-ui text-xs text-white/40">
            Preferred: {formatDate(form.preferredDate)}
          </p>
        ) : null}
        {form.otherRequest.trim() ? (
          <p className="mt-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 font-body text-sm text-white/70">
            {form.otherRequest.trim()}
          </p>
        ) : null}
      </ReviewBlock>

      {error ? (
        <p className="mb-3 rounded-lg border border-pinstripe-red/30 bg-pinstripe-red/10 px-3 py-2 font-ui text-sm text-pinstripe-red">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-2.5">
        <Button full loading={submitting} onClick={onConfirm}>
          Confirm booking
        </Button>
        <Button variant="ghost" full onClick={onBack} disabled={submitting}>
          Back
        </Button>
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-ui text-xs font-semibold uppercase tracking-wide text-white/50">
          {title}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className="rounded px-1 font-ui text-xs text-goldBright hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
        >
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------------------
// Shared step nav (Back + Continue)
// ---------------------------------------------------------------------------------------

function StepNav({ onBack, nextLabel = 'Continue' }: { onBack: () => void; nextLabel?: string }) {
  return (
    <div className="mt-6 flex gap-3">
      <Button type="button" variant="ghost" onClick={onBack}>
        Back
      </Button>
      <Button type="submit" full>
        {nextLabel}
        <ChevronRightIcon width={18} height={18} />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------------------

function SuccessScreen({ booking }: { booking: Booking }) {
  const [copied, setCopied] = useState(false);
  const labels = booking.serviceIds.map((id) => CATALOG_LABELS.get(id) ?? id);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(booking.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const waText =
    `Hi Autopalette, I've booked a service.\n` +
    `Booking ID: ${booking.id}\n` +
    `Vehicle: ${booking.vehicle.regNumber}${booking.vehicle.makeModel ? ` (${booking.vehicle.makeModel})` : ''}\n` +
    `Services: ${labels.join(', ')}`;
  const waUrl = `https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(waText)}`;

  return (
    <Shell>
      <div className="pt-2 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-goldBright">
          <CheckIcon width={32} height={32} />
        </div>
        <h1 className="font-display text-2xl font-bold text-white">Booking received</h1>
        <p className="mx-auto mt-2 max-w-xs font-body text-sm text-white/60">
          We&apos;ll confirm your appointment shortly. Keep your booking ID to track progress.
        </p>
      </div>

      {/* Big booking ID + copy */}
      <div className="mt-6 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-5 text-center">
        <p className="font-ui text-[11px] uppercase tracking-[0.2em] text-gold/70">Booking ID</p>
        <p className="mt-1.5 break-all font-mono text-xl font-semibold text-goldBright">
          {booking.id}
        </p>
        <button
          type="button"
          onClick={copyId}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 font-ui text-sm text-white/80 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
        >
          {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
          {copied ? 'Copied' : 'Copy ID'}
        </button>
        <p className="mt-3 font-ui text-xs text-white/40">Saved to this phone — find it under “My bookings”.</p>
      </div>

      <div className="mt-5 space-y-2.5">
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="block">
          <Button variant="secondary" full>
            <WhatsAppIcon width={20} height={20} />
            Send summary on WhatsApp
          </Button>
        </a>
        <Button full onClick={() => navigate(`/track/${encodeURIComponent(booking.id)}`)}>
          <CarIcon width={18} height={18} />
          Track this service
        </Button>
        <InstallButton full />
        <Button variant="ghost" full onClick={() => navigate('/')}>
          Back to home
        </Button>
      </div>
    </Shell>
  );
}
