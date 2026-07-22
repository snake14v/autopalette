# Job Card Lifecycle & Deep CRUD — spec

Models the job card on the professional automotive/two-wheeler SERVICE CENTER
process (vehicle check-in → work → quality check → delivery), not just a
billing form. Owner ask: deeper functionality/CRUD, and the ability to REOPEN a
completed job card. Read `docs/APP_SPEC.md` and `docs/OWNER_FACTS.md` first —
this extends, doesn't replace, the existing billing model (services, materials,
pricing, payment, warranty, remarks all stay exactly as they are).

Scope: additive-only to `src/shared/types.ts` and `DataDriver` (both drivers —
never break the existing signatures wave-1/2/3 already ship on). UI in
`src/admin/**`. A small, optional tie-in in `src/app/**` (customer status
mapping). OFF-LIMITS: `index.html`, `style.css`, `main.js` (a separate in-flight
landing rebuild owns these right now — do not touch, do not even peek-and-decide
to leave alone, just skip).

## The professional job-card lifecycle (the actual model)

```
open -> in_progress -> quality_check -> completed -> closed
                                            ^  |
                                            |  v
                                         (reopen, logged with a reason)
                                  in_progress <-------------------
                       any of open/in_progress/quality_check -> void
```

- **open** — job card created (from a booking, or a walk-in via `createBlankJobcard`).
  Services/materials/pricing still being finalized. This is today's implicit
  starting state, now named explicitly.
- **in_progress** — work has started. Ties into the existing Wave-2 work-item
  system (Day Board / My Day) — moving to `in_progress` is the natural trigger
  point for "Assign project" if not already assigned.
- **quality_check** — all linked work items are `finished`; awaiting admin
  sign-off before the vehicle goes back to the customer. A lightweight
  checklist (see below), not a heavy inspection module.
- **completed** — QC passed, invoice finalized, vehicle ready for pickup.
- **closed** — vehicle delivered, customer signed off. Terminal state, but NOT
  immutable — see reopen.
- **void** — cancelled job card (mis-created, customer walked away before work
  started, duplicate). This IS the "delete" in this domain: **never hard-delete
  a job card that has an allocated invoice number** (GST/audit integrity — the
  `AP-YYYY-####` sequence must stay traceable). Void keeps the record, excludes
  it from Data Panel revenue, and is clearly badged everywhere it appears.
  Allowed from `open`/`in_progress`/`quality_check` only — not from
  `completed`/`closed` (those get reopened instead, never voided).
- **Reopen** (the owner's specific ask — "pull them back from complete"): from
  `completed` OR `closed` back to `in_progress`. REQUIRES a reason (free text —
  e.g. "customer reported a defect", "missed a panel"). Every reopen is an entry
  in a `statusHistory` array (mirrors `Booking.statusHistory` already shipped):
  `{ status, at, by, reason? }`. No cap on reopen count — a job can legitimately
  bounce back more than once.

## Data model additions (`src/shared/types.ts`, additive only)

```ts
type JobcardStatus = 'open' | 'in_progress' | 'quality_check' | 'completed' | 'closed' | 'void';

interface Jobcard {
  // ...all existing fields unchanged...
  status: JobcardStatus;                 // new, defaults 'open' on create
  statusHistory: { status: JobcardStatus; at: ts; by?: string; reason?: string }[];
  checkIn?: {                            // vehicle check-in, professional-shop standard
    odometerReading?: number;            // may duplicate/override the top-level odometer if refined at check-in
    fuelLevel?: 'E'|'1/4'|'1/2'|'3/4'|'F';
    existingDamageNotes?: string;        // pre-existing dents/scratches noted BEFORE work — protects both parties
    keyTagNumber?: string;
    checkedInAt?: ts;
  };
  qualityCheck?: {
    checklist: { item: string; passed: boolean }[]; // simple items, see below
    notes?: string;
    checkedAt?: ts;
  };
  delivery?: {
    odometerOut?: number;
    deliveredAt?: ts;
    customerSignedOff?: boolean;         // a checkbox admin ticks at handover, not a real e-signature (out of scope)
  };
}
```

Default QC checklist items (generic enough for bike or car service — do not
hardcode Autopalette-only language here, this is the reusable template):
"Exterior clean & inspected", "Interior clean (if applicable)", "All work items
completed per job card", "Test drive / test run done", "No new damage caused
during service", "Customer belongings returned". Admin can add/remove checklist
items per job card — don't hardcode a fixed list, seed these as defaults only.

## DataDriver additions (both drivers, additive only — existing methods untouched)

- `setJobcardStatus(id, status, opts?: { reason?: string })` — validates the
  transition (reject illegal jumps, e.g. `open` -> `closed` directly; reject
  `void` from `completed`/`closed`; require `opts.reason` when status is
  `in_progress` AND the current status is `completed` or `closed` — i.e. reopen
  requires a reason, forward transitions don't). Appends to `statusHistory`.
- `saveJobcardCheckIn(id, checkIn)`, `saveJobcardQualityCheck(id, qc)`,
  `saveJobcardDelivery(id, delivery)` — small, focused setters rather than
  folding these into the general `saveJobcard` (keeps the lifecycle actions
  distinct from the billing-edit action in the UI and the audit trail).

## Admin UI (`src/admin/`)

1. **JobcardsList — kanban by lifecycle status** (reuse the exact pattern
   `BookingsInbox` just shipped in wave 3): columns Open / In Progress /
   Quality Check / Completed / Closed, Void collapsed behind a toggle. Falls
   back to the existing tab/filter list on mobile. Each card shows a
   stage-aware quick action (Start Work / Send to QC / Pass QC / Deliver) —
   same `ActionMenu` component wave 3 built, reused not reinvented.
2. **JobcardEditor — lifecycle strip** at the top (above the existing 7
   billing sections, which stay exactly as they are): current status badge +
   the next-step action button. Reopen is a distinct, clearly-different action
   (not just another item in the same forward-progress button) — a small
   "Reopen this job card" link/button visible only when status is
   `completed`/`closed`, opening a reason prompt (reuse `ConfirmDialog` with a
   required text field, or a small modal — admin's call on exact component,
   but a reason must be required, not optional, before the transition fires).
3. **Check-in panel**: shown when status is `open`, a small form (odometer,
   fuel level dropdown, damage notes, key tag) — optional fields, save via
   `saveJobcardCheckIn`, doesn't block moving to `in_progress` if skipped.
4. **Quality check panel**: shown when status is `quality_check` — the
   checklist (default items + admin can add custom rows), notes field, and the
   "Pass QC -> Completed" action only enables once every checklist item is
   checked true (or admin can override-and-note why, but do NOT silently allow
   skipping — require an explicit "note reason and proceed anyway" path if any
   item is left unchecked, this is what makes it a REAL quality gate not
   theatre).
5. **Delivery panel**: shown when status is `completed` — odometer-out,
   customer-signed-off checkbox, "Deliver -> Closed" action requires the
   checkbox ticked.
6. **Void action**: available from open/in_progress/quality_check card menus
   and detail view, requires a reason, clearly distinct styling (not the same
   red as Cancel elsewhere — use a muted/grey "voided" treatment since this
   isn't a customer-facing failure, it's an internal record correction).
7. **Data Panel**: exclude `void` job cards from revenue/job-count tiles;
   optionally add a small status-breakdown stat (count per lifecycle stage) —
   real recorded data only, per the existing honesty-gate discipline.

## Customer-app tie-in (`src/app/**` — independent of the admin work above)

When a linked booking's job card moves to `quality_check` or `completed`, add
a customer-visible note to the existing "Workshop updates" timeline (the
Wave-2 mechanism already shipped) — e.g. "Final quality check in progress" /
"Ready for pickup" — auto-generated, not requiring the admin to type it
manually each time (though the existing manual note path stays available too).
Do not surface internal QC checklist details or void reasons to the customer —
only the plain milestone language above.

## Verify bar
- Every legal transition works via UI action; every illegal jump is rejected
  (attempt `open`->`closed` directly via a direct driver call in a test
  script — must throw/reject).
- Reopen from `completed` AND from `closed`, both requiring a reason; the
  reopened card's `statusHistory` shows the full lifecycle including the
  bounce-back with its reason, not just the current state.
- Void: allowed from open/in_progress/quality_check, rejected from
  completed/closed. Voided job cards excluded from Data Panel revenue
  (hand-check the number before/after voiding one).
- QC gate: attempting to pass QC with an unchecked item either blocks or
  requires an explicit override+reason — verify both paths, not just the
  happy path.
- Kanban board renders all 6 (5 visible + void-toggle) columns correctly at
  1280×800; tab fallback at 375×812.
- Customer track page shows the auto-generated QC/ready milestone notes, and
  does NOT leak internal QC checklist/void reasons.
- tsc clean, build green, zero console errors, screenshots at both viewports.
- Confirm `index.html`/`style.css`/`main.js` untouched (separate in-flight
  work owns them).
