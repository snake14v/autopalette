// Generic promise-timeout race — used to fix the submit-hang bug (WAVE5_SPEC section E.1):
// an unbounded await on a Firestore write leaves the customer staring at a forever-spinner
// when the network is flaky/offline. Racing against a timeout guarantees the UI always
// hears back within `ms`, even if the underlying write is still in flight.

export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Resolves/rejects with whichever settles first: `promise`, or a `TimeoutError` after `ms`.
 * NOTE: this does not cancel the underlying request — if it later resolves after the
 * timeout fired, its result is simply ignored by the caller. Acceptable for v1 (no
 * idempotency key on createBooking); a real dedupe key is a follow-up, not required here.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
