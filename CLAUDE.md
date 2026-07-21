# Autopalette (autopalette.in)

Premium car detailing & protection studio, JP Nagar 9th Phase, Bengaluru — PPF, ceramic/graphene coating, body shop/painting, detailing, vehicle mods. Founded 2022. Tagline: "We don't detail. We perfect." Part of the Ooru Logix client portfolio (site built by Ooru Logix).

## Stack
Vanilla HTML/CSS/JS + Vite (no framework, by design — "maximize control over visual effects and animations" per CODE_WIKI.md). `index.html` + `style.css` + `main.js` at repo root; `dashboard/` = 5 separate admin pages (booking, catalog, garage, progress, index); `business-card/` = print collateral (card.html + render.cjs + pre-rendered PNGs + qr-autopalette.png).

## Commands
- `npm install` (first time)
- `npm run dev` — Vite dev server, default port 5173
- `npm run build` — outputs to `dist/`
- `npm run preview` — serve the built `dist/`
- **Deploy**: no vercel.json/netlify.toml in repo — push to `origin master` (github.com/snake14v/autopalette). Confirm current hosting/deploy trigger with Vaishak before assuming auto-deploy.
- **Verify rendered**: `npm run dev` then open http://localhost:5173 — screenshot at 375×812 and 1280×800 per Fable rule before calling any visual change done.

## Brand (verified, don't reinvent)
Near-black bg (`#000000`/`#0a0a0a`/`#0f0f0f`/`#141414`) + gold (`--gold:#c5a44e`, `--gold-bright:#e8c96e`, `--neon-gold:#ffd700`) + RGB pinstripe accents (`--cyan:#00e5ff`, `--magenta:#ff00d4`, `--emerald:#00ff88`, `--red:#ff1a1a`). Glassmorphism, custom cursor, mouse-parallax backgrounds, "Engine Start" 3s loading sequence.

## Gotchas
- **Uncommitted work exists right now**: all 5 `dashboard/*.html` files are modified, `business-card/` and `robots.txt` are untracked (last commit 2026-07-11). Don't discard — check with Vaishak or `git diff` before any git operation that could lose this.
- Recent commits (`481c60c`, `6b09719`) were an **honesty audit** — fabricated 5.0 Google-rating claims removed, price defaults aligned. Don't reintroduce unverified numeric claims.
- Domain was previously typo'd as `autopalatte.in` (fixed in `4993ab8`) — grep for the typo if touching SEO/canonical/sitemap tags.
- No test suite, no linter config — verify by rendering, not by a green check.
- Owning subagent: none dedicated yet (not orbean-web/hostel-booth/olog-cv) — treat as general frontend-design work.
