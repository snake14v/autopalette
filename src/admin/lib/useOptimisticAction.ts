// Wave 3 — optimistic action + undo. A single hook reused by bookings (status advance),
// jobcards (mark-paid) and work items (start/finish). The concrete driver write happens
// immediately (list UIs re-render from their live subscription the moment the store changes),
// then a toast offers Undo, which fires the inverse driver call. If the driver write throws,
// the store was never mutated (subscriptions still show the prior value = automatic rollback)
// and an error toast is shown. ConfirmDialog stays for destructive/hard-to-reverse actions.

import { useCallback, useRef, useState } from 'react';
import { useToast } from '../ui';

export interface OptimisticAction {
  /** The forward driver call (e.g. advance booking status). */
  do: () => Promise<void>;
  /** The inverse driver call, wired to the Undo button (e.g. status back to previous). */
  undo: () => Promise<void>;
  /** Success toast message shown with the Undo action button. */
  message: string;
  /** Undo button label (default "Undo"). */
  undoLabel?: string;
  /** Optional toast shown after a successful undo. */
  undoneMessage?: string;
  /** Toast shown if do() or undo() throws (default = the error's message). */
  errorMessage?: string;
}

export function useOptimisticAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(
    async (action: OptimisticAction) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await action.do();
        toast(action.message, {
          action: {
            label: action.undoLabel ?? 'Undo',
            onClick: async () => {
              try {
                await action.undo();
                if (action.undoneMessage) toast(action.undoneMessage);
              } catch (err) {
                toast(
                  action.errorMessage ?? (err instanceof Error ? err.message : 'Undo failed'),
                  'error'
                );
              }
            },
          },
        });
      } catch (err) {
        toast(
          action.errorMessage ?? (err instanceof Error ? err.message : 'Action failed'),
          'error'
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [toast]
  );

  return { run, busy };
}
