# Admin UX Upgrade — Wave 3 spec

Research-backed upgrade of the admin panel (sources: Tekmetric/Shopmonkey/GaragePlug
teardowns + NN/g / Pencil&Paper / dashboard-UX guidance — citations in the research
run; patterns below are only ones with observed evidence). Constraints: keep every
wave-1/2 verified flow passing (booking→jobcard→invoice math→timeline, day board,
My Day, customers, data panel); brand unchanged; contact policy unchanged (phones +
WhatsApp only, WhatsApp actions are ALWAYS review-and-send deep links, never
automated sends); no invented data; tsc + build green; additive schema only.

## The build list (all in src/admin unless noted)

1. **Kanban job board — BookingsInbox.tsx**: replace the status pill-tabs with
   side-by-side status columns (requested / confirmed / in progress / ready /
   delivered; cancelled collapsed behind a toggle). Reuses BookingStatus — no
   schema change. Cards keep current content. Mobile (<md): columns become the
   existing tab view (kanban is a desktop win; don't wreck phone use).
2. **Stage-aware quick actions on cards/rows**: on each kanban card and each
   JobcardsList row, a compact action menu whose items depend on stage — advance
   to next status, cancel (confirm dialog stays), open job card / open booking,
   mark-paid cycle (unpaid → advance_paid → paid) on jobcard rows. No full-form
   round-trip for one-click operations.
3. **WhatsApp status notify — BookingDetail.tsx**: beside the status stepper, a
   "Notify on WhatsApp" button building a wa.me/91<customer phone> deep link
   prefilled with a short status message (vehicle reg, new status, Autopalette
   sign-off). Admin reviews and sends in WhatsApp — no automation.
4. **WhatsApp payment nudge — JobcardEditor.tsx (post-save) + CustomerDetail.tsx
   (outstanding chip)**: same review-and-send pattern, prefilled "Invoice
   AP-XXXX-#### ready — total ₹X, balance due ₹Y".
5. **Bulk actions — BookingsInbox + JobcardsList**: row checkboxes + a sticky
   contextual bar (shared component): bookings → bulk advance / bulk cancel;
   jobcards → bulk payment-status set. Single toast summarizing the batch.
6. **Optimistic updates + undo toast**: routine reversible transitions (booking
   status advance, work item start/finish, mark-paid) update the UI immediately;
   toast with Undo (reverts via the inverse driver call); rollback + error toast
   if the driver call fails. ConfirmDialog stays ONLY for destructive/hard-to-
   reverse (cancel booking, confirm work item).
7. **Data panel drill-downs — DataPanel.tsx**: every stat tile navigates to the
   records behind it — jobs this month → JobcardsList (month filter), outstanding
   → JobcardsList (unpaid+advance filter), top service row → JobcardsList
   filtered by that service, hours → DayBoard. JobcardsList accepts these
   filters via hash query params.
8. **Technician workload — JobcardsList assignee filter chips (from
   Jobcard.assignedTo) + open-items count badge per employee row in
   Employees.tsx** (open = assigned/in_progress work items, any date).
9. **Global command palette — new src/admin/lib/commandPalette.tsx, mounted in
   App.tsx shell**: Ctrl/Cmd+K (+ a topbar search button for touch) → fuzzy
   search across bookings (name/phone/reg), jobcards (invoice #/reg/phone),
   customers (name/phone/reg) from the live subscriptions; Enter navigates to
   the detail route. Client-side only — datasets are small.
10. **Completion gating (warn, don't block) — BookingDetail.tsx**: advancing a
    booking to "ready" while linked work items are still assigned/in_progress
    shows an inline warning listing them (one tap to Day Board). Warning only —
    the admin stays in charge.
11. **Persist last-used tab/filter** per list route (localStorage) so reopening
    a queue resumes where the admin was working.

## Explicitly deferred (owner decision needed, not silently skipped)
- Canned service bundles (needs catalog schema addition)
- Customer estimate-approval public route
- Digital vehicle inspection with photos (conflicts with v1 no-photos scope)

## Verify bar
Full demo e2e regression (the exact 12-step wave-2 scenario must still pass) +
new-feature walk: kanban advance via quick action + undo, bulk advance 2 bookings,
mark-paid inline, palette jump by reg, drill-down filters land correctly, WhatsApp
links contain the right phone + prefill (DOM-check the href — do not send),
completion-gate warning appears when a work item is open. Zero console errors.
375×812 + 1280×800 screenshots of: kanban board, bulk bar, palette, data panel.
