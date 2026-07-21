// Wave 3 — global command palette. Ctrl/Cmd+K (or the topbar search button) opens a fuzzy
// search across the live bookings / jobcards / customers subscriptions; Enter navigates to the
// matching detail route. Client-side only (the datasets are small). Subscriptions are held ONLY
// while the palette is open — PaletteBody (which owns the hooks) unmounts on close, tearing them
// down — so an idle admin panel keeps no extra listeners open.

import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from './router';
import { useBookings, useCustomers, useJobcards } from './useDriver';
import { normalizePhone } from '../../shared/data';

/** Global Ctrl/Cmd+K listener. Calls onOpen; ignores the combo while typing isn't intended. */
export function useCommandPaletteHotkey(onOpen: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);
}

interface Result {
  key: string;
  type: 'Booking' | 'Job Card' | 'Customer';
  title: string;
  subtitle: string;
  route: string;
}

/** Subsequence fuzzy score; -1 = no match. Direct substrings rank highest. */
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx;
  let ti = 0;
  let score = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    let found = -1;
    for (; ti < t.length; ti++) {
      if (t[ti] === c) {
        found = ti;
        break;
      }
    }
    if (found === -1) return -1;
    score += 1;
    ti = found + 1;
  }
  return score;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PaletteBody onClose={onClose} />;
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const bookings = useBookings();
  const jobcards = useJobcards();
  const customers = useCustomers();

  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce the query feeding the fuzzy match.
  useEffect(() => {
    const id = window.setTimeout(() => setQ(raw.trim()), 120);
    return () => window.clearTimeout(id);
  }, [raw]);

  const results = useMemo<Result[]>(() => {
    if (!q) return [];
    const scored: { r: Result; s: number }[] = [];

    for (const b of bookings ?? []) {
      const hay = `${b.customer.name} ${b.customer.phone} ${b.vehicle.regNumber} ${b.vehicle.makeModel}`;
      const s = fuzzyScore(q, hay);
      if (s >= 0)
        scored.push({
          s,
          r: {
            key: `b-${b.id}`,
            type: 'Booking',
            title: b.customer.name || 'Unnamed customer',
            subtitle: `${b.vehicle.regNumber || 'No reg'} · ${b.customer.phone || 'No phone'}`,
            route: `/bookings/${b.id}`,
          },
        });
    }

    for (const j of jobcards ?? []) {
      const hay = `${j.invoiceNumber} ${j.customer.name} ${j.customer.phone} ${j.vehicle.regNumber} ${j.vehicle.makeModel}`;
      const s = fuzzyScore(q, hay);
      if (s >= 0)
        scored.push({
          s,
          r: {
            key: `j-${j.id}`,
            type: 'Job Card',
            title: j.invoiceNumber || 'Unsaved job card',
            subtitle: `${j.customer.name || 'Unnamed'} · ${j.vehicle.regNumber || 'No reg'}`,
            route: `/jobcards/${j.id}`,
          },
        });
    }

    for (const c of customers ?? []) {
      const regs = c.vehicles.map((v) => v.reg).join(' ');
      const hay = `${c.name} ${c.phone} ${regs}`;
      const s = fuzzyScore(q, hay);
      if (s >= 0)
        scored.push({
          s,
          r: {
            key: `c-${c.phone}`,
            type: 'Customer',
            title: c.name || 'Unnamed customer',
            subtitle: `${c.phone} · ${c.vehicles.length} vehicle${c.vehicles.length === 1 ? '' : 's'}`,
            route: `/customers/${encodeURIComponent(c.phone)}`,
          },
        });
    }

    return scored.sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.r);
  }, [q, bookings, jobcards, customers]);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActive((i) => (results.length === 0 ? 0 : Math.min(i, results.length - 1)));
  }, [results.length]);

  function go(r: Result | undefined) {
    if (!r) return;
    onClose();
    navigate(r.route);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  }

  const loading = bookings === null || jobcards === null || customers === null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-white/12 bg-char2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4">
          <span aria-hidden="true" className="font-ui text-sm text-white/40">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Search bookings, job cards, customers…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-results"
            className="w-full bg-transparent py-3.5 font-body text-sm text-white placeholder-white/35 focus:outline-none"
          />
          <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 font-ui text-[0.6rem] text-white/40 sm:inline">
            Esc
          </kbd>
        </div>

        <ul id="cmdk-results" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {q === '' ? (
            <li className="px-4 py-6 text-center font-body text-xs text-white/35">
              Type a name, phone, reg number, or invoice number.
            </li>
          ) : loading ? (
            <li className="px-4 py-6 text-center font-body text-xs text-white/35">Loading…</li>
          ) : results.length === 0 ? (
            <li className="px-4 py-6 text-center font-body text-xs text-white/35">
              No matches for “{q}”.
            </li>
          ) : (
            results.map((r, i) => (
              <li key={r.key} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === active ? 'bg-gold/15' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-ui text-sm text-white/90">{r.title}</p>
                    <p className="truncate font-body text-xs text-white/45">{r.subtitle}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/12 px-2 py-0.5 font-ui text-[0.6rem] uppercase tracking-wide text-white/45">
                    {r.type}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
