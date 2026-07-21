import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-ui font-semibold ' +
  'transition-colors duration-150 select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-char ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const SIZES = 'px-5 py-3 text-[15px]';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-goldBright to-gold text-char shadow-lg shadow-gold/20 ' +
    'hover:from-neonGold hover:to-goldBright active:scale-[0.99]',
  secondary:
    'border border-gold/40 bg-white/[0.03] text-goldBright hover:bg-gold/10 active:scale-[0.99]',
  ghost: 'text-white/70 hover:text-white hover:bg-white/5',
  danger:
    'border border-pinstripe-red/40 bg-pinstripe-red/10 text-pinstripe-red hover:bg-pinstripe-red/20',
};

export function Button({
  variant = 'primary',
  loading = false,
  full = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${SIZES} ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
