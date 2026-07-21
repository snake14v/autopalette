// Reusable admin UI primitives — brand-consistent with the dashboard mockups
// (Orbitron display headers, dark glass panels, gold accents). Tailwind-only.

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react';

// --- Panel ------------------------------------------------------------------------------

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div';
}) {
  return (
    <Tag
      className={`rounded-xl border border-white/10 bg-char2/70 backdrop-blur-sm shadow-lg ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="font-ui text-[0.65rem] uppercase tracking-[0.25em] text-pinstripe-cyan/80">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 font-display text-lg font-bold uppercase tracking-wide text-goldBright">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

// --- Button -----------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gold text-char hover:bg-goldBright focus-visible:ring-goldBright disabled:bg-gold/40 disabled:text-char/60',
  secondary:
    'border border-gold/40 text-goldBright hover:border-gold hover:bg-gold/10 focus-visible:ring-gold disabled:opacity-40',
  ghost:
    'border border-white/15 text-white/80 hover:border-white/30 hover:bg-white/5 focus-visible:ring-white/40 disabled:opacity-40',
  danger:
    'border border-pinstripe-red/50 text-pinstripe-red hover:bg-pinstripe-red/10 focus-visible:ring-pinstripe-red disabled:opacity-40',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ variant = 'primary', className = '', children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-ui text-sm font-medium tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-char disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

// --- Form fields ------------------------------------------------------------------------

export function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-ui text-xs font-medium uppercase tracking-wider text-white/60">
        {label}
      </label>
      {children(id)}
      {hint && <p className="font-body text-[0.7rem] text-white/40">{hint}</p>}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-lg border border-white/12 bg-char3/80 px-3 py-2 font-body text-sm text-white placeholder-white/30 transition-colors focus:border-gold/60 focus:outline-none focus:ring-1 focus:ring-gold/40 disabled:opacity-50 read-only:opacity-70';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`${INPUT_BASE} ${className}`} {...rest} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea ref={ref} className={`${INPUT_BASE} min-h-[70px] resize-y ${className}`} {...rest} />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select ref={ref} className={`${INPUT_BASE} appearance-none pr-8 ${className}`} {...rest}>
        {children}
      </select>
    );
  }
);

// --- Badge ------------------------------------------------------------------------------

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-ui text-[0.7rem] font-medium uppercase tracking-wide ${tone}`}
    >
      {children}
    </span>
  );
}

// --- Empty / loading state --------------------------------------------------------------

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 px-6 py-14 text-center">
      <p className="font-display text-sm uppercase tracking-wide text-white/50">{title}</p>
      {hint && <p className="max-w-sm font-body text-xs text-white/35">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-white/50" role="status">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-gold/30 border-t-gold"
        aria-hidden="true"
      />
      <span className="font-ui text-sm">{label}</span>
    </div>
  );
}

// --- Toast --------------------------------------------------------------------------------

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

const ToastContext = createContext<(message: string, tone?: 'success' | 'error') => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const api = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 print:hidden"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-4 py-2 font-ui text-sm shadow-xl backdrop-blur ${
              t.tone === 'success'
                ? 'border-pinstripe-emerald/40 bg-char2/95 text-pinstripe-emerald'
                : 'border-pinstripe-red/40 bg-char2/95 text-pinstripe-red'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// --- Toggle (labeled checkbox switch) ---------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
          checked ? 'border-gold bg-gold/30' : 'border-white/20 bg-white/5'
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
      <span>
        <span className="font-ui text-sm text-white/85">{label}</span>
        {hint && <span className="mt-0.5 block font-body text-xs text-white/45">{hint}</span>}
      </span>
    </label>
  );
}

// --- Modal (accessible form dialog) -----------------------------------------------------

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the first focusable element inside the modal.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      // Simple focus trap.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const list = Array.from(focusables);
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-xl border border-white/12 bg-char2 p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="font-display text-base font-bold uppercase tracking-wide text-goldBright">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-white/40 transition-colors hover:text-white/80 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/50"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- Confirm dialog (accessible modal) --------------------------------------------------

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/12 bg-char2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-goldBright">
          {title}
        </h3>
        {body && <div className="mt-2 font-body text-sm text-white/70">{body}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
