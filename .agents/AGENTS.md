# AGENTS.md — sanamspace

> Read this first. It explains how the `.agents/` directory works and how
> AI assistants should record progress so the next session can resume.

## Project

- **Name**: sanamspace
- **Type**: Monorepo — Laravel 13 API (`backend/`) + Next.js 16 App Router (`frontend/`), SQLite in dev
- **Git remote**: https://github.com/ThitipongSaysood/SanamSpace.git
- **Branch**: main
- **Bootstrapped**: 2026-06-12
- **Last agent**: Claude (Opus 4.8) — 2026-08-13

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
`CreditService`, `DepositService`, `DiscountService` — never re-implemented per portal. State
transitions are guarded so the same transfer can't be counted twice. If you add a money path, add the
double-processing test with it.

- **A customer holds credit (baht) and package hours (court time) — two things, never summed.**
  Credit (`CreditService`) is money: top-ups, refunds, staff adjustments, and it pays for anything.
  A package is court time bought ahead at a discount and pays for the court only. Converting between
  them needs a rate nobody has agreed on; a venue selling "10 ชม. ฿2,500" has not promised an hour is
  worth ฿250 forever. The old **"wallet" is gone** — that was a second MONEY balance that nothing
  could spend: money went in via top-ups and refunds and never came out. Cancelling a paid booking
  returns credit immediately; refunds pay out as credit, never cash (`manual` survives only for money
  genuinely returned off-system).
- **Two different things are called "แพ็กเกจ".** `/owner/packages` = the hour packages a venue SELLS
  to its customers. `/owner/billing` = what the venue PAYS SanamSpace (labelled "ค่าบริการระบบ" now,
  precisely so the two stop colliding).
- **Every credit movement records who caused it** (`wallet_transactions.created_by` + `source`).
  Credit is money staff can create by hand, so a balance alone is not enough — "who gave this
  customer ฿5,000" has to have an answer. A row with no name is one the customer caused themselves.
- **"confirmed" does not mean "paid in full."** Deposits let a booking be confirmed with a balance
  owing. Key on `paid_amount` / outstanding, never on status.
- **Anything that changed a price is snapshotted on the booking** (`discount_amount`,
  `discount_label`, `package_hours_used`, rental lines). Editing or retiring a coupon, a package or a
  rental item must not rewrite what someone was charged last month.
- **An accepted payment-method string is not a payment method.** `wallet` was in the `in:` rule for
  months with no code behind it anywhere. If you add one, add the code that moves the money.

### Dev is SQLite, prod is MySQL — and CI runs no tests
`.github/workflows/deploy.yml` builds and deploys and **runs no tests at all**. Everything "green" is
green because someone ran it locally, on SQLite, against a database that does not enforce what
production enforces.

MySQL is installed locally. Before calling a release ready, run the migrations **and** the suite
against it:

```
mysql -u root -e "CREATE DATABASE sanamspace_migtest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 DB_DATABASE=sanamspace_migtest \
  DB_USERNAME=root DB_PASSWORD= php artisan migrate --force && ... php artisan test
```

This is how `reviews.sort_order` was caught: declared `unsignedInteger`, written as `min - 1`. SQLite
stored -1 happily and all tests passed; MySQL raises `SQLSTATE[22003] 1264`, so **every customer
review would have 500'd in production**. Watch for unsigned columns receiving computed negatives,
GETs that answer 201 because the model was created during the request, and column-length truncation.

### Auth: a token that exists is not a token that works
The portal layouts only check that a token is *present*. A token that is present but dead — expired,
revoked, or left over from a `migrate:fresh` — used to sail past that guard and then fail every
request, so every screen showed "เกิดข้อผิดพลาด ลองอีกครั้ง", which can never succeed. All three API
clients now clear the session and redirect to their login on a 401 (login routes exempt, or a wrong
password loops). **Resetting the dev DB signs every open tab out** — say so before doing it.

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
**Exception — a bounded date window.** `Owner/BookingController::index` returns *all* rows when `from`+`to`
are given, because the calendar and the รายการจอง list need the whole window at once (to draw every slot, to
count status tabs before filtering). The bound is the date range, not a page. When such a screen still gets
long, page it **client-side** (see `owner/bookings/list`, `PER_PAGE`) rather than reintroducing a server
`LoadMore` — the rows are already down.

### Customer names are peekable
Any owner-facing name that belongs to a `customers` row renders through `<CustomerName id name />`
(`components/customer-peek.tsx`) — it becomes a drawer-peek button when `id` is set and stays plain text
(walk-in) when not. So **any resource/array that emits `customerName` must also emit `customerId`**
(`$this->customer_id ? (string)… : null`, or `$x->customer?->id` inline) and its frontend type gets
`customerId?: string | null`. Don't wrap a name that sits inside another `<button>`/`<a>`, a drag-interactive
calendar block, or a string prop — those stay plain.

### Toasts, not silence (or `window.alert`)
User-facing feedback goes through `toast` / `toastSave` from `@/lib/toast` — a venue-branded card (accent bar
by type, the venue's sport as the icon) rendered via sonner's `toast.custom`; the `<Toaster>` is mounted once
in `providers.tsx` (top-right). `toast.success/error/…` take a single message string. `toastSave(promise)`
shows "saving… → saved / error message" for a mutation — note it must `dismiss()` the loading toast then show the
result, because a custom toast can't be swapped in place by id. Never reach for `window.alert`.

### Customer-app feature flags live on `/orgs/{slug}/public`
The customer app learns what a venue turned on from `OrganizationPublicController::show` → `tenant.*`
(`checkinEnabled`, `pointsEnabled`, `sport`, `sports`). A server-side gate (e.g. `PointsService` refusing to
award) is not enough — if the app still shows the UI, add the flag here and gate the screens off it. When a
setting the owner just changed doesn't show up, suspect the browser HTTP cache: API GETs are `cache:"no-store"`
in `lib/api/http.ts` for exactly this reason.

### Owner-editable JSON payloads: persist the raw input
`$request->validate()` returns only the keys it has rules for and **drops every un-ruled nested key**. For a
free-form JSON column (a LINE template's `blocks`, etc.) validate the shape but write `$request->input('…')`,
not the validated copy, or all but the ruled sub-keys vanish.

### Every user-facing string is bilingual (TH/EN)
The whole frontend (landing, customer app, owner portal, admin portal) is translated through one custom,
lightweight i18n layer — no URL locale prefix, because `/v/{slug}` is the LINE LIFF path and must not change.
Locale lives in a cookie + localStorage, toggled by the switcher in each portal's chrome.
- **`frontend/lib/i18n/messages/th.ts` is the source of truth**; `en.ts` is typed `typeof th`, so a
  missing or renamed key **fails `tsc`** — the two catalogs can never drift. Never hard-code a new
  user-facing string: add `th`+`en` keys and read them with `useMessages(ns)` (typed namespace object).
  Interpolate with `fmt(template, { key })` from `@/lib/i18n/format` (usually imported as `interp`); format
  dates/numbers with `intlLocale(locale)` from the same module (Thai Buddhist vs. English Gregorian).
- **Leave data-keys untranslated.** Anything the backend stores/compares or sends to a customer stays the
  raw value and only its *display label* comes from the catalog: promotion tags, week-day keys, RFM/segment
  criteria, LINE-flex block-content seeds, broadcast template message-text, admin permission modules. Same
  for status/type/method maps — split the colour class into a module const and take the label from the
  catalog with a `?? rawValue` fallback.
- **A Thai string that also drives React state must be an English key.** Where tab/segment identifiers were
  compared with `===` or held in `useState`, the key is stable English (`"info"`, `"subscription"`, …) and
  only the display comes from `t.tabs[key]`. Module helper fns that need strings take the catalog / `locale`
  as a parameter — they can't call a hook.
- **Run vitest from `frontend/`.** A bare `npx vitest` at the repo root ignores `vitest.config.ts`, defaults
  to the `node` environment, and fails with "document is not defined" — a cwd artifact, not a regression.
