# Autopalette (autopalette.in)

Premium car detailing & protection studio, JP Nagar 9th Phase, Bengaluru — PPF, ceramic/graphene coating, body shop/painting, detailing, vehicle mods. Founded 2022. Tagline: "We don't detail. We perfect." Ooru Logix client. Since Jul 2026 it is a full service PLATFORM, not a display site: marketing landing + customer booking/tracking PWA (`/app/`) + admin panel PWA (`/admin/`).

## Stack
- Marketing landing: vanilla HTML/CSS/JS (`index.html`+`style.css`+`main.js`) — deliberately frameworkless, don't reactify.
- App: Vite MPA + React 18 + TS + Tailwind. `src/app/` (customer), `src/admin/` (admin+staff), `src/shared/` (types, catalog, format, data layer).
- Data layer (`src/shared/data.ts`): adapter with TWO drivers — Firestore (live, lazily imported chunk) and localStorage (demo, auto when no Firebase config). Async `getDriver()`; both apps use top-level await accessors.
- Backend: Firebase project **autopalette-app** (asia-south1). Rules in `firestore.rules` (staff/admin roles). Collections: bookings, jobcards, counters, users, employees, work_items, customers.
- Auth: loginId + password (AP-ADMIN, AP-EMP1..5 → synthetic `<id>@app.autopalette.in`). Credentials live ONLY in git-ignored `docs/CREDENTIALS*` (md + pdf + html sheet).
- `dashboard/` = OLD static mockups (noindexed, design reference only). `docs/APP_SPEC.md` = the build contract — read it before touching app features.

## Commands
- `npm install`; `npm run dev` (5173); `npm run build` → `dist/` (3 pages); `npm run preview`
- **Deploy**: push to `origin master` → Vercel auto-deploys (project `autopalette`, vercel.json pins build/dist). Live config via Vercel env `VITE_FIREBASE_*`; local `.env` (gitignored) flips local builds to live mode — absence = demo mode.
- **Rules deploy**: `npx firebase-tools deploy --only firestore:rules --project autopalette-app`
- **Verify rendered**: build + `vite preview`, walk /app/ booking→track and /admin/ flows headless (playwright-core, resolveChromium pattern); screenshot 375×812 + 1280×800. NO .env during demo-mode verification.

## Brand (verified, don't reinvent)
Near-black (`#0a0a0a` family) + gold (`#c5a44e`/`#e8c96e`/`#ffd700`) + RGB pinstripe (`#00e5ff`/`#ff00d4`/`#00ff88`/`#ff1a1a`). Fonts: Orbitron (display) / Space Grotesk (UI) / Inter (body). Invoice + credential sheets: ink-saver white A4, hairline rules, ≤10% gold tints.

## Gotchas
- **Live DB discipline**: production Firestore is the client's real data. Never create job cards in live testing (burns the AP-YYYY-#### invoice counter); test bookings must be labeled and cancelled.
- Honesty audit heritage (`481c60c`,`6b09719`): no fabricated ratings/claims; data panel shows real recorded data only, "No data yet" over placeholder numbers.
- Contact policy: only +91 88844 71117, +91 99000 12090, WhatsApp. No email anywhere user-facing (synthetic auth emails are internal-only).
- Old domain typo `autopalatte.in` fixed in `4993a b8` — grep before touching SEO tags.
- No test suite — verify by rendering (Fable rule).
- Owning subagent: none dedicated — general frontend + this file + APP_SPEC.md.
