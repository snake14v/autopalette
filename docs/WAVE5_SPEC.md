# Wave 5 — Employee colours · deep indexes · richer records · progress tracking · CX criticals

Builds directly on the job-card lifecycle (docs/JOBCARD_LIFECYCLE_SPEC.md, wave 4,
verified before this wave starts). Read APP_SPEC.md + OWNER_FACTS.md first as
always. Additive-only to shared types/driver; existing signatures stay working.

## A — Employee colour coding (owner ask)
- `Employee.color?: string` (hex). Curated palette of 8 colours chosen for
  distinguishability ON DARK backgrounds and from each other and from the
  status colours already in use (gold=brand, green/red=status): e.g. sky,
  violet, amber, rose, teal, lime, orange, fuchsia (exact hexes builder's call,
  contrast-checked ≥3:1 against #141414). Auto-assigned by roster order on
  first render if unset; editable via a swatch picker in the roster editor.
- Applied consistently EVERYWHERE an employee appears: Day Board section
  headers + work-item card left-border, My Day header strip, jobcard
  assignedTo chips, kanban card assignee dots, DataPanel hours rows.
  One shared helper (e.g. `employeeColor(emp)`) — not per-screen logic.

## B — Better job-card + customer management (owner ask)
- **Jobcard activity timeline**: merged chronological view on the editor —
  statusHistory entries + linked work-item events (created/started/finished/
  confirmed, with employee colour dot) + payment-status changes. Payment
  changes must start being recorded: extend setJobcardPaymentStatus to append
  `{ at, from, to }` into a new `paymentHistory` array (additive field).
- **Vehicle depth**: Jobcard.vehicle gains optional `year?`, `color?`, `vin?`
  — shown in editor + invoice vehicle block when present.
- **Customer quick actions** on CustomerDetail: "New job card" (creates a
  blank jobcard prefilled with this customer + their most recent vehicle) and
  the existing WhatsApp nudge. Editable customer notes stay.
- **Per-vehicle history**: CustomerDetail groups history by vehicle reg when
  the customer has >1 vehicle (flat list stays for single-vehicle customers).

## C — Better indexing (owner ask, two layers)
- **UI layer**: sort controls on JobcardsList (newest / oldest / highest
  balance due / recently updated) and Customers (name A-Z / last visit /
  outstanding). Month grouping headers in JobcardsList when sorted by date.
  All persisted per-route (reuse wave-3 persist.ts).
- **Firestore layer**: populate firestore.indexes.json with the composite
  indexes the live queries actually need as data grows: jobcards(status,
  date desc), work_items(assignedTo, date), work_items(date, status),
  bookings(status, createdAt desc), jobcards(customerPhone?, date) if a
  customer-scoped query exists. Deploy happens at ship time via
  `firebase deploy --only firestore:indexes` (orchestrator does it, builder
  just writes the file). Verify the file parses (firebase CLI validates on
  deploy; builder at minimum validates JSON shape against existing entries).

## D — Progress tracking system (owner ask)
- **Per-jobcard progress**: derived, never stored — `confirmed+finished work
  items / total work items` for that jobcard. Shown as a slim progress bar +
  "N of M tasks done" on: kanban cards, jobcard editor lifecycle strip, and
  the jobcard's row in lists. Zero work items → no bar (not a fake 0%).
- **Customer-safe stage mirror (fixes CX-audit finding #5 — the milestone
  lines currently NEVER render live because firestore.rules blocks customer
  jobcard reads, and the failure is silently swallowed)**: denormalize a
  customer-safe field onto the BOOKING instead of loosening rules —
  `Booking.jobcardStage?: 'working'|'quality_check'|'ready'` written by the
  admin-side driver whenever jobcard status changes (in_progress→'working',
  quality_check→'quality_check', completed→'ready'; closed/void→field
  removed/null). Customer app reads the booking it already has access to —
  no rules change, no jobcard read, no leak surface. Replace the current
  silently-failing getJobcard() path in WorkshopUpdates.tsx with this.
  Customer copy stays exactly: 'Final quality check in progress' /
  'Ready for pickup' (+ optionally a coarse progress bar on the track page
  derived from booking status + jobcardStage — no task counts, no internals).
- **Day Board load view**: per-employee day header shows est-hours total vs
  logged, as a small load bar in the employee's colour.

## E — CX criticals from the audit (fold in, same files)
1. **Submit-hang (CRITICAL)**: wrap createBooking's Firestore write in a
   timeout race (~12s). On timeout/offline: keep the form state, show a
   specific error ("Couldn't reach the server — check your connection and
   try again"), re-enable Back + retry. Never a forever-spinner.
2. **Back-button trap**: the 4-step book flow loses everything on hardware
   back. Push a history entry per step (hash-based sub-steps or
   history.pushState) so back navigates steps, and keep draft form state in
   sessionStorage so even a full exit restores on return (offer "Resume where
   you left off").
3. **SW registration**: investigate why the auto-registration in
   src/app/main.tsx doesn't activate (audit found manual register works);
   fix registration timing (e.g. register on window load event) and register
   for /admin/ too if not already.
4. **Repeat-customer prefill**: persist name/phone/vehicle(s) locally
   (localStorage profile written on successful booking) and prefill the form
   next visit with an editable banner ("Booking as <name> · <reg> — change").
   Local-only; no account, no server read needed.

## Verify bar
- Colour: every employee surface shows the same colour per employee; swatch
  edit persists; contrast ≥3:1 on dark (spot-check computed styles).
- Timeline: perform status change + work-item flow + payment change on one
  jobcard → timeline shows all three interleaved chronologically.
- Sorts persist across reload; month grouping correct.
- Progress: create 3 work items, finish 1, confirm 1 → card shows 2/3 with
  bar; jobcard with zero items shows no bar.
- Stage mirror: drive jobcard to quality_check then completed in admin →
  customer track page (booking access only) shows the two milestone lines —
  THE KEY REGRESSION THE OLD PATH FAILED: verify with the demo driver
  simulating the live rules constraint (i.e. verify the data path reads ONLY
  the booking, grep WorkshopUpdates for any remaining getJobcard call).
- CX: block network mid-submit → error within ~12s, form intact, retry works.
  Hardware back from review → goes to previous step, not out of the flow;
  full exit + return → draft restore offered. Repeat booking → prefilled.
- tsc clean, build green, zero console errors, screenshots both viewports.
- firestore.indexes.json valid JSON with the listed composites.
