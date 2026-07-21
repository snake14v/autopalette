import React from 'react';
import { href, navigate } from '../lib/router';
import { isDemo } from '../lib/driver';
import { ArrowLeftIcon } from './icons';

interface ShellProps {
  children: React.ReactNode;
  /** When set, a back affordance appears in the header pointing at this hash path. */
  back?: string;
  /** Optional short label next to the back arrow / under the wordmark. */
  title?: string;
}

/** App frame: fixed pinstripe accent, sticky header with the wordmark, and the DEMO badge. */
export function Shell({ children, back, title }: ShellProps) {
  return (
    <div className="ap-safe-top min-h-screen bg-char text-white">
      <div className="ap-pinstripe fixed inset-x-0 top-0 z-40" />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-char/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
          {back !== undefined ? (
            <button
              type="button"
              onClick={() => navigate(back)}
              aria-label="Go back"
              className="-ml-1 rounded-lg p-1.5 text-white/70 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
            >
              <ArrowLeftIcon />
            </button>
          ) : null}
          <a
            href={href('/')}
            className="flex items-baseline gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-goldBright"
            aria-label="Auto Palette home"
          >
            <span className="font-display text-lg font-bold tracking-wide text-goldBright">
              AUTO<span className="text-white">PALETTE</span>
            </span>
          </a>
          {title ? (
            <span className="ml-auto font-ui text-sm text-white/50">{title}</span>
          ) : null}
        </div>
      </header>

      <main className="ap-safe-bottom mx-auto w-full max-w-md px-4 pb-24 pt-5">{children}</main>

      {isDemo ? (
        // Own badge (not the shared .demo-mode-badge class) so it is pointer-events-none and
        // sits BELOW the sticky booking action bar — the shared class is fixed bottom-3 right-3
        // at z-50, which would overlap and swallow taps on the pinned "Continue" CTA.
        <div
          className="pointer-events-none fixed bottom-3 right-3 z-20 rounded-full border border-gold/40 bg-char2/90 px-3 py-1 font-ui text-xs tracking-wide text-goldBright shadow-lg backdrop-blur"
          role="status"
          aria-label="Demo mode — data stays on this device"
        >
          DEMO · data stays on this device
        </div>
      ) : null}
    </div>
  );
}
