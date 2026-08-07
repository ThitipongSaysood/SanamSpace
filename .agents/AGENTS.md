# AGENTS.md — sanamspace

> Read this first. It explains how the `.agents/` directory works and how
> AI assistants should record progress so the next session can resume.

## Project

- **Name**: sanamspace
- **Type**: Monorepo — Laravel 13 API (`backend/`) + Next.js 16 App Router (`frontend/`), SQLite in dev
- **Git remote**: https://github.com/ThitipongSaysood/SanamSpace.git
- **Branch**: main
- **Bootstrapped**: 2026-06-12
- **Last agent**: Claude (Opus 4.8, 1M ctx) — 2026-08-07

## Rules for AI assistants

1. **Before starting work** — read `.agents/active.md` for the current goal,
   blockers, and next step. If empty, ask the user what they want to do.
2. **While working** — keep `.agents/active.md` up to date when the situation
   changes (new blocker, decision made, scope shift). One short sentence per
   update is enough.
3. **When ending a work session** — append a checkpoint at
   `.agents/sessions/YYYY-MM-DD-HHMM-<slug>.md` with:
   - Goal of the session
   - What was actually done (files touched, decisions)
   - State at end (passing? blocked? half-done?)
   - Next step for whoever picks this up
   (The `agents-checkpoint` skill automates this — read/write `.agents/` on
   resume and at the end of each round.)
4. **Cross-task knowledge** (architecture notes, API quirks, gotchas) goes in
   `.agents/topics/<slug>.md` — not in session checkpoints.
5. **Private / scratch / sensitive notes** go in `.agents/private/` — this
   subfolder is `.gitignore`d and never pushed.
6. **Re-generate** `.agents/index/repo-tree.md` if the directory structure
   changes significantly.

## Project rules

### Multi-tenancy — the rule everything else depends on
Every venue is an `Organization` and rents the platform. A customer belongs to exactly ONE venue.
- The tenant is resolved by `ResolvesOrganization` from `X-Venue-Slug` (the customer app sends it on
  every request) / `?venueId` / the signed-in customer. **There is no fallback** — an unresolvable
  tenant is a 404, never "just use the first organization". That default previously served one venue's
  catalogue to another venue's customers.
- Customer screens live under `/v/{slug}/*` and link **venue-relative** via `VenueLink` /
  `useVenueRouter`, so no screen can hard-code a path that escapes its tenant.
- `/v/{slug}` is also the LINE **LIFF Endpoint URL**. Changing that path means editing every venue's
  LINE console — don't.

### Money
Anything that moves money or a subscription goes through a shared service — `RefundService`,
`SubscriptionRenewalService` — never re-implemented per portal. State transitions are guarded so the
same transfer can't be counted twice. If you add a money path, add the double-processing test with it.

### Verify before claiming
Run the thing, don't infer it. This project has had bugs that only a real run surfaces: a slip upload
that posted `{}`, a PDF that silently fell back to a font with no Thai glyphs. When something looks
suspicious (a 2 KB PDF, a 26 KB font), check the bytes.

Baseline to hold: backend tests green · `tsc --noEmit` clean · vitest green · **lint errors must not
exceed the existing 13** (all pre-existing `react-hooks/set-state-in-effect` + one hoisting warning).

### Testing gotchas that will waste your afternoon
- **Laravel caches the resolved guard user between HTTP calls inside one test.** A second
  `withToken()` stays authenticated as the FIRST user, so admin calls silently become owner calls
  (403). Use an `as()` helper that calls `$this->app['auth']->forgetGuards()` first.
- **Run e2e with `--workers=1`.** Parallel runs lose to the Next dev server's cold compile.
- **e2e write to the real dev DB.** A spec that books a slot or raises an invoice must clean up after
  itself, or the next run fails for no code reason (see `e2e/billing-helpers.ts`).
- **`rm -rf frontend/.next`** when you hit `Could not find the module ... in the React Client Manifest`.

### Local dev setup (do these once, or waste an afternoon)
- **`frontend/.env.local` must set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`** (gitignored). Without
  it the value is empty, so the **owner/admin** portals post to the Next origin (:3000) → **404 on every API
  call including login**. The customer app silently falls back to its in-memory mock. Restart `npm run dev`
  after adding it (NEXT_PUBLIC_* is inlined at start). Prod builds use `/api/v1` (same-origin behind nginx).
- **`php artisan storage:link`** must exist, or every uploaded image (welcome banners, broadcast banners,
  slips) 404s while the upload itself succeeds — a broken-image icon, not an error. Standard deploy step.
- If owner routes 402 `subscription_expired`, the seeded subscription lapsed — renew it in the DB; it does
  NOT mean the code is broken (`EnsureSubscriptionActive` reads `ends_at`).

### Frontend
`frontend/AGENTS.md` applies: this is Next.js 16 and the APIs differ from older training data — read
`node_modules/next/dist/docs/` before writing routing/rendering code.

### PDFs
dompdf ships no Thai font and falls back to Helvetica **silently**. Sarabun lives in
`backend/resources/fonts` (committed) and is installed to `storage/fonts` (gitignored) on boot by
`AppServiceProvider`. Google Fonts' CSS API serves a Latin-only subset — take the full TTF from the
`google/fonts` GitHub repo.

### Lists
Anything that grows with time is paginated (`PaginatesLists`, default 50 / max 200) and the screen
gets a `LoadMore`. Never ship a list that returns every row a venue has ever created.
