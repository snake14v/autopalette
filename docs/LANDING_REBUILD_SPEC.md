# Landing Page Professionalism Rebuild — spec

Source: 3 independent audits (`_audit/` screenshots + raw data) of the live site,
synthesized here. Read `docs/OWNER_FACTS.md` first — every claim on the rebuilt
page must trace to it. Goal (owner's own words): the site currently reads like a
video game, not a premium studio; keep black/gold identity, gain restraint.
Reference point: the just-shipped `/app/#/book` is ALREADY the right tone —
plain, dark-and-gold, "priced on inspection" stated honestly. Bring the landing
up to match it, don't invent a new direction.

Scope: `index.html`, `style.css`, `main.js` only. Do not touch `/app/`, `/admin/`,
`src/**`, `dashboard/*`, `robots.txt`. This IS the marketing shell those systems
sit behind — changing its CTAs to route correctly is in scope; changing the app
itself is not.

## A — DELETE (measured overload, zero equivalent in the premium field)
1. **Entrance gate** (`#entrance-gate`, tachometer/RPM sweep, engine-start,
   brand-vector logos of cars not represented, flash-bang) — entire markup +
   `.tacho-*`/`.gate-*`/`.engine-start-btn`/`.brand-vector` CSS + its JS init.
   Measured: blocks first-time desktop visitors ~2.8s past real content-ready.
2. **Custom cursor** (`.custom-cursor`/`.custom-cursor-dot`, `initCustomCursor`,
   `body{cursor:none}`) — delete both CSS rules and the JS init/rAF loop.
3. **Always-on cinematic overlays**: `.film-grain`, `.scanlines`,
   `.cinematic-vignette`/`.noise-overlay`, floating particle field, floating
   brand/vector SVGs that parallax on mousemove (`initVectorParallax`).
4. **RGB pinstripe system**: `--cyan`/`--magenta`/`--emerald` and every
   `rgbPinstripe`/`rgbPinstripeV` usage (13+ selectors: `.navbar::after`,
   `.service-card::before`, `.about::before`, `.process-step::after`,
   `.offer-section::before/after`, `.location-card::before`,
   `.estimator-display::before`, `.faq::after`, `.reviews::after`,
   `.gallery-item:hover::after`, `.scroll-indicator .arrow::after`,
   `.brands-ticker` border-image, `.section-divider::after`). Gold is the ONLY
   accent going forward — `--red` may stay ONLY if reused for a genuine
   error/alert state, not decoration.
5. **"Grand Opening 50% OFF" ticker + offer banner** — `.top-ticker`/
   `.ticker-track`, `.offer-section`/`.offer-title .big-num`/`.offer-badge`
   (`pulseBorder` keyframe) — per OWNER_FACTS, remove entirely, no replacement.
6. **Clip-path notched HUD buttons** — remove `clip-path: polygon(...)` from
   `.btn-primary`, `.btn-secondary`, `.offer-cta`, `.btn-submit`,
   `.estimator-display`, `.cyberpunk-card`. Plain rectangles or one consistent
   small `border-radius`, matching the booking-app button style.
7. **Hero "mission brief" HUD card** (`.cyberpunk-card`, `.brief-glitch-layer`,
   `.brief-scanner`, `.terminal-cursor`) — delete the glitch/scanline/cursor
   treatment. Content survives as a plain trust-strip card (see D.3).
8. **6× per-service-card "ENQUIRE NOW" WhatsApp links** and the **3-step in-page
   WhatsApp service-builder modal** (FAQ "ASK ANOTHER QUESTION") — redundant
   with the booking app; delete.
9. **Contact-form fake-submit pattern** — the form currently builds a WhatsApp
   deep-link and shows a fake "✓ SENT" state. Relabel honestly: either wire it
   to an actual mailto-free submission path if one exists (there isn't one —
   no email per contact policy), so instead relabel the section/button
   plainly as "Message us on WhatsApp" and keep the deep-link behavior, but
   remove the fake-success theatre — the WhatsApp app opening IS the outcome.
10. **Star-icon ratings on the 4 testimonials** — per OWNER_FACTS, drop the
    5-star graphic from each card; keep the quotes as plain testimonial text.

## B — FIX (real bugs, cheap, no visual-direction judgment call)
11. Focus-visible outline on ALL interactive elements (`.btn-primary`,
    `.btn-secondary`, `.nav-cta`, `.nav-link`, `.faq-btn`, `.option-btn`) —
    a visible gold/white outline, not the browser default black-on-black.
12. Tap targets ≥44×44 on mobile: hamburger menu (currently 28×16) and any
    surviving service-card links.
13. Contrast fixes: ticker text-on-red (dead anyway per A.5) and the review
    attribution line `--gold-dim` on dark card bg → lighten to pass AA, or
    simplify since star icons are also being removed (re-verify contrast on
    whatever the testimonial attribution becomes).
14. Heading hierarchy: insert H3 between the Process/Locations H2s and their
    H4 children (or drop to H3, no skip). Fix hero H1 markup so assistive tech
    reads "WE DON'T DETAIL. WE PERFECT." as two sentences, not run together.
15. `logo.png` (281KB, larger than any photo) — re-export/compress; it's reused
    everywhere (favicon, gate—now deleted, navbar, footer) so this alone cuts
    real weight.
16. Offer banner's background-image bypassing lazy-load — moot once A.5 is
    deleted; if any other CSS `background-image` section survives, convert to
    an `<img loading="lazy">` or accept it's above-the-fold and fine.
17. Dead `initParallax`/`[data-parallax]` code (zero elements use it) and the
    duplicate unthrottled scroll listener in `initScrollReveal`'s belt-and-
    suspenders path — delete both; keep ONE IntersectionObserver-based reveal.
18. Fix "3+ Years Perfecting" → "4+ Years Perfecting" (About stat) per
    OWNER_FACTS tenure correction.

## C — TYPOGRAPHY (per design audit, matches booking-app restraint)
19. Collapse 4 display faces to 1: keep Bebas Neue ONLY for `.hero-title` and
    `.section-heading` (the 1-2 largest headline moments). Move `.nav-link`,
    `.hero-badge`, `.section-label`, `.btn-primary`/`.btn-secondary`,
    `.faq-btn`, `.contact-info-label`, `.footer-col h4`, and all
    price-estimator classes to `--font-body` (Inter). Drop Orbitron and
    Playfair Display (`--font-serif`) entirely — remove their `<link>` imports
    too, don't just stop using them.

## D — CONTENT REBUILD (honesty-gated — every claim traces to OWNER_FACTS.md)
1. **Services**: rebuild the 6 vibe-cards into the 5 real catalog categories
   (Protection / Detailing / Body Shop / Wraps & Styling / Accessories),
   matching `src/shared/catalog.ts`. Each card names 3-5 actual services from
   that category (pull the exact labels from catalog.ts — do not paraphrase),
   explicitly surfacing Window Tint, Vinyl/Roof Wrap, Chrome Delete, Headlight
   Restoration, Alloy Wheel Refurbishment (currently invisible on the page).
   Duration lines: reuse the FAQ's existing stated durations (PPF 3-5 days,
   ceramic 1-2 days curing) — do not invent new ones for categories the FAQ
   doesn't cover.
2. **Warranty**: add the OWNER_FACTS approved sentence ("PPF warranties up to
   5+ years and ceramic coating warranties of 2–5 years depending on product
   tier — exact terms stated on your invoice") to the Services or Trust area.
   Do not print a single fixed number.
3. **Trust strip** (replaces the deleted HUD "mission brief"): 3 plain lines —
   materials (per OWNER_FACTS: multi-brand — XPEL/3M/Garware for PPF, Ceramic
   Pro/Gtechniq/CarPro for coatings — text only, no logo grid, no "authorized"
   language), trained/certified technicians (claimable per OWNER_FACTS), free
   quote via booking app.
4. **Copy tone pass** — direct swaps, no new claims:
   - "THE VAULT" → "OUR STUDIO" · "A HIDDEN WORLD OF PERFECTION" → "PRECISION,
     EVERY PANEL"
   - "◆ OUR SECRET MENU ◆" → "◆ SERVICES ◆"
   - Estimator: "[ INSTANT ESTIMATE ]" / "tactical estimate" → "Get a starting
     estimate for your vehicle." · "ESTIMATED VAULT QUOTE" → "ESTIMATED
     STARTING PRICE"
   - "PPF (ARMOR)" / "CERAMIC (SHIELD)" / "DETAILING (PERFECTION)" → "PPF" /
     "CERAMIC COATING" / "DETAILING"
5. **Estimator/funnel reconciliation**: the estimator currently sends a fixed
   rupee number to WhatsApp as if final. Reword its output framing to
   "Typical starting range — confirmed on inspection" (matches the app's own
   honest framing) and repoint its primary action to `/app/#/book`, carrying
   the selected vehicle/service as context if easy, else just linking through;
   WhatsApp stays available as the secondary link, not the primary one. Do NOT
   invent new numbers — reuse the existing static price-table values in
   `main.js`, only the framing/destination changes.
6. **Funnel collapse**: exactly two paths sitewide — `/app/#/book` (primary,
   everywhere: nav, hero, service cards' main action, estimator) and WhatsApp
   (ONE secondary channel — floating button + mobile sticky bar is enough;
   remove the redundant per-card/modal/offer-banner WA links per A.8/A.9).
7. **Trust addition**: embed a real Google Maps `<iframe>` per location
   (both existing addresses) alongside the existing "Get Directions" links —
   free, truthful, no fabrication.
8. **Section reorder**: Hero → Services (named, with duration+warranty) →
   Estimator → Trust strip (D.3) → Process → Reviews (testimonials, no stars)
   → Gallery → FAQ → Contact/Maps → Locations → Footer. Services and trust
   content outrank "About/Vault" mythology for a comparison-shopping buyer.

## Verify bar
- Rendered screenshots 375×812 + 1280×800: hero (no gate delay — measure
  content-visible timing before/after), services section (all 5 categories
  visible), estimator, trust strip, reviews (no stars), footer.
- Re-run the SAME measurement harness the technical auditor used where
  practical: gate-block time (should be ~0 now), concurrent animation count
  (should drop sharply from 55), focus-outline visibility on primary CTA,
  contrast on surviving text, tap-target sizes on hamburger + any surviving
  links, console errors (zero), heading hierarchy (no skips).
- Grep final `index.html`/`style.css` for tombstone tokens — zero hits for:
  `vault`, `tactical`, `armor`, `shield`, `grand opening`, `cyberpunk`,
  `glitch`, `rgb-pin`, `entrance-gate`, `custom-cursor`, `film-grain`,
  `scanline`, `pulseBorder`. (Some may legitimately survive as CSS variable
  *names* if repurposed — check usage context, not just string match.)
- Confirm every service named on the page has a matching entry in
  `src/shared/catalog.ts` (no invented service names).
- Confirm zero fixed price numbers presented as final quotes (estimator output
  must read as a range/starting estimate, not a quote).
- Confirm WhatsApp link count sitewide ≤3 (floating button, mobile sticky bar,
  one contact-section link) down from ~15+.
