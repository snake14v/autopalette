import React from 'react';

let idSeq = 0;
function useFieldId(explicit?: string): string {
  const [id] = React.useState(() => explicit ?? `ap-field-${++idSeq}`);
  return id;
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}

/** Labelled form field with error + hint wiring for a11y (aria-describedby / aria-invalid). */
export function Field({ label, htmlFor, error, hint, optional, children }: FieldProps) {
  const id = useFieldId(htmlFor);
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between font-ui text-sm text-white/80">
        <span>{label}</span>
        {optional ? <span className="text-xs text-white/35">optional</span> : null}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={errId} className="mt-1.5 font-ui text-xs text-pinstripe-red">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 font-ui text-xs text-white/40">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-xl border bg-white/[0.03] px-3.5 py-3 font-body text-[15px] text-white ' +
  'placeholder:text-white/30 transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-goldBright focus:border-gold/50';

export function inputClass(invalid?: boolean): string {
  return `${INPUT_BASE} ${invalid ? 'border-pinstripe-red/60' : 'border-white/12'}`;
}
