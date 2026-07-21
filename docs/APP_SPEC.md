# Autopalette Service App — Build Spec (v1)

Transform autopalette.in from a display site into a book-a-service + track-service app
with an admin panel, installable as a PWA. Marketing landing page is PRESERVED as the
front door; the app lives alongside it.

## Non-negotiables (from owner + house rules)
- Marketing `index.html`/`style.css`/`main.js` stay — only CTA wiring changes there.
- `dashboard/*.html` and `robots.txt` have UNCOMMITTED owner changes — do not modify,
  stage, or commit them. The static dashboard mockups remain as design reference; the
  real admin panel is NEW code at `/admin/`.
- Brand: near-black (#0a0a0a family) + gold (#c5a44e / #e8c96e / #ffd700) + RGB
  pinstripe accents (#00e5ff / #ff00d4 / #00ff88 / #ff1a1a). Fonts: Orbitron (display),
  Space Grotesk (UI), Inter (body) — same as the dashboard mockups.
- No invented prices, ratings, or claims. Prices come from the admin or say
  "priced on inspection".
- India context: GST optional (default rate 18%, editable), ₹, phone-first customers.
- CONTACT POLICY (owner directive): the ONLY contact channels anywhere in the app,
  admin, and invoice are these two numbers and WhatsApp — +91 88844 71117 and
  +91 99000 12090 (WhatsApp deep links use 919900012090). NO email addresses
  anywhere: no mailto links, no email form fields, no email in the invoice header.

## Architecture
- Vite multi-page app in the existing repo:
  - `/index.html` — marketing (vanilla, untouched except CTAs)
  - `/app/index.html` — customer app (React 18 + TS mount)
  - `/admin/index.html` — admin app (React 18 + TS mount)
  - `src/shared/` — types, service catalog, data layer, firebase init, format utils
  - `src/app/`, `src/admin/` — the two React apps
- Styling: Tailwind (build-time, not CDN) themed with the brand tokens above.
- Data layer = adapter interface with two drivers:
  - `firestore` driver — used when Firebase config is present (env/`firebaseConfig.ts`)
  - `local` driver — localStorage persistence, used when config absent; UI shows a
    small "DEMO MODE — data stays on this device" badge. Same interface, so the app
    is fully functional and testable without a backend.
- Offline-first: Firestore driver enables persistent local cache; local driver is
  inherently offline.
- PWA: `manifest.webmanifest` (name "Auto Palette", standalone, theme #0a0a0a, icons
  from `business-card/logo.png`), service worker (cache-first app shell,
  network-first data), custom "Add to Home Screen" prompt in the customer app.

## Roles & auth
- Customer: NO account. Books as guest; booking ID (unguessable Firestore auto-ID) is
  the tracking capability. IDs also saved to localStorage ("My bookings" on that
  device — pairs with PWA install).
- Admin: Firebase email/password auth + `users/{uid}.role == 'admin'` check
  (Cha Angadi pattern). In local/demo driver, admin login is a simple passphrase
  gate labeled DEMO.
- Firestore rules: bookings `create: true (validated fields only)`, `get: true`,
  `list/update/delete: admin only`. Jobcards/settings/counters: admin only.

## Data model
```ts
type BookingStatus = 'requested'|'confirmed'|'in_progress'|'ready'|'delivered'|'cancelled';

interface Booking {
  id: string;
  createdAt: ts;
  status: BookingStatus;
  statusHistory: { status: BookingStatus; at: ts; note?: string }[];
  customer: { name: string; phone: string };
  vehicle: { regNumber: string; makeModel: string; odometer?: number };
  serviceIds: string[];          // from catalog
  otherRequest?: string;         // free text
  preferredDate?: string;        // ISO date
  jobcardId?: string;            // set when admin opens a job card
}

interface Jobcard {                     // = the owner's full field list
  id: string;
  invoiceNumber: string;                // AP-YYYY-#### via transactional counter
  date: string;
  bookingId?: string;                   // walk-ins allowed: jobcard without booking
  customer: { name: string; phone: string };
  vehicle: { regNumber: string; makeModel: string; odometer?: number };
  // serviceId 'custom' = ad-hoc extra: label + price typed freely by admin.
  // Catalog rows are NOT fixed-price either — unitPrice is set per job, per row.
  services: { serviceId: string | 'custom'; label: string; qty: number; unitPrice: number }[];
  materials: { ppfBrand?: string; ceramicBrand?: string; paintCode?: string; other?: string };
  pricing: {
    labourCharges: number; materialCharges: number; discount: number;   // flat ₹
    gstEnabled: boolean; gstRate: number;                               // default 18
    // computed + denormalized on save:
    subtotal: number; gstAmount: number; totalAmount: number;
    advancePaid: number; balanceDue: number;
  };
  payment: { mode: 'cash'|'upi'|'card'|'bank_transfer'|''; transactionId?: string;
             status: 'unpaid'|'advance_paid'|'paid' };
  warranty: { period?: string; terms?: string };
  remarks: { beforeAfterCondition?: string; customerRequests?: string;
             deliveryDateTime?: string };
}
```
Totals: subtotal = Σ(qty×unitPrice) + labour + materials − discount;
gstAmount = gstEnabled ? subtotal × rate/100 : 0; total = subtotal + gst;
balanceDue = total − advancePaid. Computed live in the editor, stored denormalized.

## Service catalog (encode VERBATIM, grouped; ids kebab-case)
- **Protection**: PPF — Full Body | PPF — Front Package | PPF — Individual Panels |
  Ceramic Coating | Graphene Coating | Underbody Coating | Anti-Rust Treatment |
  Windshield Treatment
- **Detailing**: Interior Detailing | Exterior Detailing | Engine Bay Detailing |
  Paint Correction — 1-Step | Paint Correction — 2-Step | Paint Correction — 3-Step |
  Headlight Restoration
- **Body Shop**: Full Body Painting | Panel Painting | Dent & Paint | Scratch Repair |
  Bumper Repair | Alloy Wheel Refurbishment
- **Wraps & Styling**: Vinyl Wrapping | Roof Wrap | Chrome Delete | Window Tint
- **Accessories**: Accessories Installation | Seat Covers | Ambient Lighting |
  Audio System | Dash Camera | Reverse Camera | Spoiler | Bull Bar |
  Other Custom Modifications
Catalog is a typed constant in `src/shared/catalog.ts`; each entry: id, label,
category, optional `startingPrice?: number` (LEFT UNDEFINED — admin can fill later;
UI shows "on inspection" when absent).

## Customer app (`/app/`)
1. **Book**: pick services (grouped, multi-select, search), vehicle details
   (reg, make/model via free text + datalist of common Indian makes, odometer
   optional), name + phone, preferred date, free-text requests → submit → success
   screen with booking ID + "Save to this phone" (localStorage) + WhatsApp deep link
   prefilled with the booking summary to the studio number (+91 9900012090).
2. **Track**: enter booking ID (or tap one saved on device) → status timeline
   (requested → confirmed → in progress → ready → delivered) with timestamps/notes.
3. **My bookings**: list from localStorage.
4. PWA install prompt; works offline for viewing saved bookings.

## Admin app (`/admin/`)
1. Login (see auth).
2. **Bookings inbox**: list by status, search by phone/reg; detail view; status
   updates with optional note (drives customer timeline); convert → job card.
3. **Job card editor**: every field from the data model, sectioned exactly like the
   owner's list (Customer Details / Services Performed / Materials Used / Pricing /
   Payment Details / Warranty / Remarks). Live totals. Save = upsert + denormalized
   totals + invoice number allocation on first save.
   CUSTOM BILLING (owner directive, first-class): an "Add custom item" action sits
   beside the catalog picker — free-text label + qty + unit price, unlimited rows,
   totalling identically to catalog rows and printing identically on the invoice.
   Catalog rows' prices are also fully editable per job (no fixed pricing exists).
   Use for extras: one-off parts, ad-hoc work, pickup/drop charges, anything.
4. **Invoice view**: printable A4 (print CSS) designed for DESKTOP + INKJET,
   "designer ink-saver" standard (owner directive):
   - White background. Hairline rules (≤0.5pt) and typography carry the hierarchy —
     no solid dark blocks, no heavy fills. Brand colour appears as LIGHT tints only
     (gold at ≤8–10% opacity panel fills, one thin gold accent rule) so an inkjet
     sips ink. `print-color-adjust: exact` so the light tints survive printing.
   - Header: Autopalette logo (from business-card/logo.png; must read cleanly on
     white), studio name, JP Nagar 9th Phase, Bengaluru 560108,
     +91 88844 71117 · +91 99000 12090 · WhatsApp · autopalette.in. NO email.
   - Body: invoice number + date; customer/vehicle block (all fields incl. odometer);
     line-items table (service, qty, unit price, line total); Materials Used block;
     totals block right-aligned (subtotal, discount, GST only when enabled, TOTAL,
     advance paid, balance due) with **Amount in Words** (Indian numbering —
     lakh/crore) under the total; payment mode/txn/status; warranty; remarks +
     delivery date/time; customer + authorised signature lines; small footer strip.
   - @page A4 with sane margins; Print button = window.print(); on screen the sheet
     previews as white A4 centered on the dark app background.
5. **Job cards list**: search/filter, payment status chips.
6. Brand-consistent with the dashboard mockups' look (Orbitron/gold/dark).

## Verification bar (Fable rules)
- `npx tsc --noEmit` clean; `npm run build` green.
- Rendered screenshots at 375×812 and 1280×800: landing, booking flow (filled),
  success screen, track timeline, admin login, bookings inbox, job card editor,
  invoice print view. Walk the full flow in demo mode: book → appears in admin →
  convert → fill jobcard → totals correct (spot-check math) → status update →
  customer timeline reflects it.
- PWA: manifest valid, SW registers, install prompt code path exists.
- Zero console errors on all screens.
- No stale claims: grep built output for "5.0", "rating" regressions.

## Wave 2 — Logins, PWA installs & deployment (owner directive)
- **6 accounts**: 1 admin + 5 employees. Login screen takes a LOGIN ID + password —
  IDs: `AP-ADMIN`, `AP-EMP1` … `AP-EMP5` (stable; employee display names are set in
  the roster and freely renameable without changing the login). Internally the app
  maps loginId → `<loginid>@app.autopalette.in` for Firebase email/password auth —
  synthetic identifiers only, never shown as contact info (contact policy stands).
- **Passwords**: minted at provisioning — 8-char alphanumeric, cryptographically
  random, ambiguous glyphs excluded (no 0/O/1/l/I). Delivered to the owner in
  `docs/CREDENTIALS.md` (git-ignored) + chat, for him to WhatsApp onward. Firebase
  accounts + `users/{uid}` role docs (admin | staff) created by a seed script;
  final locked rules deployed AFTER seeding.
- **PWA installs for staff**: `/admin/` gets its OWN manifest
  (`manifest-admin.webmanifest`, name "Autopalette Studio", start_url `/admin/`,
  theme #0a0a0a) + SW registration, so admin AND all 5 employees install the panel
  on their Android home screens exactly like customers install `/app/`.
- **Assignment granularity**: an employee can be assigned individual work items
  AND/OR a full project — `Jobcard.assignedTo?: employeeId[]` (project level).
  A job card's detail view shows its own work-item list; assigning the whole job
  card seeds a single "full project" work item for that employee by default.
- **Deployment**: Vercel (site already serves from Vercel; CLI authed as
  vaishakrn-3305). Firebase project `autopalette-app` created via CLI. The ONE step
  the CLI cannot do: enabling the Email/Password sign-in provider is a console
  toggle — provisioning halts with exact instructions if it isn't enabled yet.

## Wave 2 — Employees & daily work tracking (owner directive)
A timetable-style work system for the ~5-person crew, plus richer customer tracking.

- **Roster**: admin CRUD — name, phone, active toggle, PIN (demo mode) / email
  (live mode, Firebase account with users/{uid}.role='staff'). No hard cap; built
  for ~5.
- **WorkItem**:
  `{ id, date: 'YYYY-MM-DD', title, jobcardId?, bookingId?, assignedTo: employeeId,
     status: 'assigned'|'in_progress'|'finished'|'confirmed',
     notes: { at, by, text, customerVisible: boolean }[],
     startedAt?, finishedAt?, estHours?, hoursLogged }`
  hoursLogged auto-computed from startedAt→finishedAt on Finish; admin can adjust
  manually. Status flow: assigned → in_progress → finished → confirmed(admin).
- **Admin — Day Board**: date picker → timetable grouped per employee: each work
  item as a card with status colour, est vs logged hours, linked job card chip.
  Create + assign items (link a job card/booking or free-text task, est hours).
  Reassign/edit. Confirm finished work. Day + week hours summary per employee.
- **Staff view — "My Day"**: same admin app, role-gated. Staff sees only their own
  items for today (+ backlog): Start → stamps startedAt and sets in_progress;
  add progress notes along the way; Finish → stamps finishedAt, computes hours;
  read-only once admin confirms. Demo mode: employee picker + per-employee PIN.
- **Advanced customer tracking tie-in**: work-item notes flagged customerVisible
  surface on the linked booking's public timeline — the customer sees granular,
  admin-curated progress ("Paint correction stage 2 done, PPF tomorrow"), never
  internal notes. Default = NOT customer-visible; flagging is an explicit toggle.
- **Rules (live)**: staff may update only their own items' status/notes/timestamps;
  roster + confirm + reassign + hours adjustments are admin-only.

### Wave 2 — Customers panel + data panel (owner directive)
- **Customer registry**: `customers` keyed by normalized 10-digit phone —
  `{ phone, name, altPhone?, vehicles: {reg, makeModel}[], notes?, createdAt }`.
  Auto-upserted whenever a booking or job card is saved (new phone → new customer;
  known phone → merge vehicle if reg unseen). Admin can edit name/notes and add
  customers manually (walk-ins who never booked online).
- **Customers panel (admin)**: searchable list (name/phone/reg) with per-customer
  chips: visit count, last visit, outstanding balance. Detail view = FULL history:
  every booking + job card chronologically with status/payment chips, every vehicle,
  lifetime spend (Σ jobcard totals), total outstanding (Σ balanceDue where not paid),
  admin notes. One tap from any booking/jobcard to its customer and back.
- **Data panel (admin dashboard home)**: computed ONLY from real recorded data,
  labelled with its date range — this month vs last month jobs count, revenue
  (Σ jobcard totals by date), outstanding balance total, top 5 services by frequency,
  repeat-customer rate (customers with >1 job card), work hours logged per week
  (from Wave-2 work items). No projections, no invented benchmarks. Empty states
  say "No data yet" — never placeholder numbers.

## Out of scope (v1)
Payment processing (record-keeping only), SMS/WhatsApp automation, photo uploads
(before/after are text fields v1), customer accounts, multi-branch, payroll/salary
(hours are logged; money stays out of wave 2).
