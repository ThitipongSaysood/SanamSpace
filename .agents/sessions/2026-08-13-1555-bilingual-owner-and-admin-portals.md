# Session 2026-08-13 15:55 — bilingual (TH/EN) owner + admin portals

## Goal
Finish the "ทั้งระบบ 2 ภาษา (ไทย/อังกฤษ)" work the user chose earlier. Phase 1 (i18n foundation +
landing) and Phase 2 (customer app) were already committed (`4533980`). This session did **Phase 3 — the
entire owner portal** and **Phase 4 — the entire admin/super-admin portal**, group by group, committing
each round.

## What changed
**Committed on `main`, not pushed** (per the standing "don't push unless asked" rule). 22 commits
`26a4dfa`→`11d7f30`. 60 files changed (+7075 / −2493).

- **Every owner page (38 `.tsx`) is bilingual** — chrome, login, dashboard, operations, bookings
  calendar + list + dialog, payments, check-in, customers + detail, membership, refunds, reports,
  support, wallet, POS + sales, products, rentals, branches, courts, staff, signup, packages, banners,
  customer-credit, points, promotions + coupons (3 files), CRM, LINE templates, broadcast, billing,
  settings, coming-soon.
- **Every admin page (20 `.tsx`) is bilingual** — chrome (layout/login/dashboard), organizations list +
  the 869-line detail drawer, subscriptions, plans, features, sports, payments, transactions, refunds,
  billing, users, roles, support, announcements, logs, settings (6 tabs), coming-soon.
- **Catalogs grew** to ~2760 lines each: `frontend/lib/i18n/messages/th.ts` (source of truth) and
  `en.ts` (typed `typeof th`, so a missing/renamed key fails `tsc`). New top-level `admin` namespace with
  ~20 sub-blocks; the `owner` namespace gained ~25 page sub-blocks.

## Conventions used (repeated on every page)
- **TH is source of truth.** `en.ts: typeof th` — any missing/renamed key is a compile error, so the two
  catalogs can never drift.
- **`useMessages(ns)`** returns a typed namespace object; **`fmt(template, vars)`** (imported as `interp`)
  does `{key}` placeholder interpolation; **`intlLocale(locale)`** feeds `Intl` for locale-aware
  dates/numbers (Thai Buddhist calendar vs. English Gregorian).
- **Data-keys stay untranslated** — anything a backend stores/compares or sends to customers is left as
  the raw value and only its *display label* comes from the catalog: promotion tags (`ส่วนลด`/`แพ็กเกจ`),
  week-day keys, RFM/segment criteria, LINE flex block-content seeds, broadcast template message-text,
  admin permission-module keys, and a few Thai example-placeholder hints (company/bank format).
- **Status/type/method maps split** into a color-only module const (`STATUS_CLS`, `PILL_CLS`, …) + a
  catalog labels object; indexing keeps `?? rawValue` fallback. Cast `(t.status as Record<string,string>)`
  when the index type is a broad `string`.
- **Tab keys stabilized to English** wherever Thai strings had been doubling as React state / `===`
  comparisons (owner bookings-list status tabs, org drawer tabs, subscriptions tabs, admin settings tabs) —
  state stays stable, display comes from `t.tabs[key]`.
- **Hooks before early returns** (rules-of-hooks); map-var/`t` shadowing avoided with `tt`/`tp`/`tc`/`td`/
  `ts`/`tx`/`m` aliases when a `.map((t) => …)` or a local `const t` already owns the name.
- Module helper fns that need strings (`statusInfo`, `worth`/`usage`, `channelLabel`, `errorText`,
  `fmtDate`) take the typed catalog and/or `locale` as a parameter rather than calling a hook.

## Verification (baseline held throughout)
- `cd frontend && npx tsc --noEmit` — **clean**.
- `cd frontend && npm run lint` — **0 errors** (47 pre-existing warnings, unchanged — the same
  `react-hooks/set-state-in-effect` + `@next/next/no-img-element` categories).
- `cd frontend && npx vitest run` — **43/43 pass** (must run *from* `frontend/`; a bare `npx vitest` from
  the repo root picks up no `vitest.config.ts`, defaults to the `node` environment, and fails with
  "document is not defined" — that is a wrong-cwd artifact, not a regression).

## State at end
**Done.** All four phases complete — landing, customer app, owner portal, admin portal are fully
bilingual, toggled by the language switcher in each portal's chrome (cookie + localStorage locale, no URL
change so the `/v/{slug}` LIFF path is untouched). Working tree clean.

## Next step
- **Not pushed** — push `26a4dfa`→`11d7f30` when the user asks.
- Optional polish: the Thai example-placeholders in `admin/settings` (`บริษัท สนามสเปซ จำกัด`, `กสิกรไทย`,
  address) are illustrative hints left in Thai — swap to EN-neutral examples only if desired.
- If MySQL prod hasn't run these yet: this is frontend-only, no migrations, but still run
  `migrate + test` on MySQL before release per the standing rule.
