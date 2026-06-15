# Active Task

_Last updated: 2026-06-15 (Refund flow — 3-agent build, all green)_

## Project type (auto-detected)

Next.js 16 (frontend/: customer + owner + super-admin portals + /landing marketing) + Laravel 13 (backend/ /api/v1) + docs

## Current goal

**Feature build-out — 3 portals near-complete and all DB-backed.** Latest session shipped: admin billing (plan features, invoice print/email, receipts), config moved to DB (SMTP via PlatformConfigServiceProvider, encrypted), real **PromptPay** payments (per-venue, EMVCo QR, no gateway), wallet top-up + **packages** (buy→approve→redeem hours at booking), owner court-blocking + CSV export + platform-announcement banner, admin mobile menu = owner-style drawer, and the **/landing** marketing page (Landing_Page_Spec_v1, 13 sections, SEO+FAQ schema).

Tests green every commit: **backend 119/119 · tsc clean · 23/23 vitest** (this day). Full detail: `sessions/2026-06-15-1046-billing-payments-packages-landing.md`.

Deploy pipeline still live (push `main` → GitHub Actions → server). Server = readyidc 157.85.97.241, app at `/var/www/html/sanamspace`, vhost `sanam.semitennis.com`. **Still NOT public** — needs Cloudflare A `sanam` → 157.85.97.241 + `certbot` (see `sessions/2026-06-13-2330-deploy-pipeline-live-readyidc.md`).

## What just happened

**Big day — 3 features shipped, two via parallel 3-agent (App/Owner/Admin) builds. Final: backend
119/119 · tsc clean · vitest 23/23.** Also created the 3 custom agents (`.claude/agents/App|Owner|Admin.md`)
+ an orchestration pattern: orchestrator lays a shared foundation (DB/model/routes/types/services), then
fans out 3 agents that each touch only their own zone → both multi-agent builds integrated on the FIRST try.
1. **LINE LIFF real login (env-gated)** — `LineTokenVerifier` + `auth-context` LIFF + session rehydrate
   (fixed refresh→/login bug). See `sessions/2026-06-15-1122-app-line-liff-real.md`.
2. **Per-venue LINE config** — Owner sets / Admin overrides each org's LINE channel/LIFF/messaging in DB
   (secrets encrypted, write-only). Verified live in the browser. See `sessions/2026-06-15-1155-per-venue-line-3agent.md`.
3. **Refund flow** — customer requests → Owner/Admin approve → wallet credit (or manual), via shared
   `RefundService`. Verified live end-to-end (customer ฿0→฿250). See `sessions/2026-06-15-1338-refund-3agent.md`.
Day close-out: `sessions/2026-06-15-day-closeout.md`. Setup notes: fresh checkout needed `composer install`,
`backend/.env` + `key:generate`, `npm i @line/liff`.

Prior: long feature session (12 commits, `7d50f10`..`8e134be`) — 3 portals ~98% DB-backed.

## Shared changes (read if you touch auth / api layer)
- **API contract**: `POST /auth/line/login` now accepts `idToken`; when `LINE_CHANNEL_ID` is configured
  it REQUIRES a verified `idToken` and ignores raw `lineUserId` (was: trusted lineUserId always).
- **config/services.php**: new `line` block (channel_id/secret/messaging_token/verify_url).
- **frontend api layer (co-owned)**: `api.me()` added to mock + http; `idToken` added to `LinePayload`
  (in `lib/api/mock.ts`). `lib/types.ts` was NOT changed.
- **Refund — ✅ DONE & wired** (was parked scaffold): `refunds` table + `Refund` model now live; see the
  Refund section below.
- **Refund — Owner zone DONE (2026-06-15)**: `Owner/RefundController` (index/approve/reject) wired to the
  pre-registered `/owner/refunds*` routes; all money logic via shared `App\Services\RefundService` (never
  re-implements wallet credit). `index` returns `{data:[OwnerRefund]}` (requested-first, then newest);
  `approve` validates `method∈{wallet,manual}` (default wallet) + nullable `note`; `reject` nullable `note`.
  Approve(wallet) credits the customer wallet + logs a WalletTransaction + sets booking `status='cancelled'`;
  approve(manual) records only (no wallet). Org-scoped (cross-org=404), re-process guarded (422). Frontend:
  `ownerApi.getRefunds/approveRefund(id,method,note?)/rejectRefund(id,note?)`, new `app/owner/refunds/page.tsx`,
  nav entry "คืนเงิน". Tests: `OwnerRefundTest` 6/6. Did NOT touch any shared file. App may surface
  `bookingCode`/refund status on booking detail; Admin's cross-org refund controller still to be built.

### Per-venue LINE config (✅ DONE — 3-agent build, 2026-06-15)
**Integrated green: backend 101/101 · tsc clean · vitest 23/23.** Built by 3 parallel agents
(App/Owner/Admin) on an orchestrator-laid foundation (DB+model+routes+types). No agent touched
shared files; integrated on first try. Owner sets per-venue LINE; Admin can override per-org.
- **DB**: `organization_settings` + `line_channel_id`, `line_channel_secret`(enc), `line_liff_id`,
  `line_messaging_token`(enc). `OrganizationSetting` casts the two secrets `encrypted`.
- **Routes (pre-registered)**: `GET /line-config` → `AuthController@lineConfig` (App);
  `PUT /admin/organizations/{id}/settings` → `AdminOrganizationController@updateSettings` (Admin).
- **types.ts (done)**: `OwnerSettings` + `AdminOrganizationDetail.settings` got `lineChannelId`,
  `lineLiffId`, `lineChannelSecretSet`, `lineMessagingTokenSet`; new `LineConfig = { liffId }`.
- **Masking rule**: secrets are WRITE-ONLY — never return `line_channel_secret`/`line_messaging_token`;
  expose only `*Set: boolean`. channelId + liffId may be returned.
- **Resolution**: `LineTokenVerifier` reads the org's settings first, falls back to `services.line.*` (.env).
  `lineLogin` resolves the org BEFORE verifying.
- **Zone split**: App = verifier+lineLogin+lineConfig+frontend auth. Owner = /owner/settings CRUD + UI.
  Admin = updateSettings override + org-detail UI.
- ✅ **Admin zone DONE (2026-06-15)**: `AdminOrganizationController@updateSettings` (write-only secrets, blank≠wipe);
  `AdminOrganizationDetailResource` exposes `lineChannelId`/`lineLiffId` + `*Set` flags only; new
  `superAdminApi.updateOrganizationSettings(id,patch)`; org drawer got a "LINE" tab (password fields,
  "ตั้งค่าแล้ว" hints). New `tests/Feature/AdminLineSettingsTest.php` 3/3 green (Admin tests 15/15).
- ✅ **App zone DONE (2026-06-15)**: `LineTokenVerifier` now per-org (`isConfigured`/`verify` take
  `?OrganizationSetting`, org channel first → .env fallback); `AuthController@lineLogin` resolves org
  BEFORE verify + loads `settings` (relation || `firstOrCreate`); added `AuthController@lineConfig`
  (`GET /line-config?organizationSlug=` → `{liffId}`, public, secrets never returned). Frontend:
  `api.getLineConfig()` (mock `{liffId:null}` + http `GET /line-config`), `getLineIdToken(liffId?)`,
  `auth-context.login()` resolves per-venue LIFF id in real mode (`NEXT_PUBLIC_LIFF_ID || config.liffId`),
  demo stub in mock mode. `tests/Feature/AuthLineLoginTest.php` 7/7 (added per-org-channel + line-config).
- ✅ **Owner zone DONE (2026-06-15)**: `Owner/SettingController@update` validates + saves
  `lineChannelId`/`lineLiffId` (columnMap) and `lineChannelSecret`/`lineMessagingToken` (separate
  `filled()`-guarded `$secretMap` — blank never wipes); `OwnerSettingResource` exposes ids + `*Set`
  flags only. Frontend: owner settings "การเชื่อมต่อ" tab got a LINE form (password secret fields,
  "ตั้งค่าแล้ว" hints, write-only); `ownerApi.updateSettings` signature widened. New
  `tests/Feature/OwnerLineSettingsTest.php` 4/4 (round-trip, encrypted-at-rest, blank-preserves, 401).
- **Open follow-ups**: (a) `lineConfig` resolves by `?organizationSlug`/default only — `venueId`
  resolution not wired (would need to extend shared `resolveOrganization`). (b) `messaging_token`
  is stored/managed but not yet USED (no push-messaging feature yet). (c) Frontend LINE UIs are
  compile-verified (tsc) but have no component tests / not visually run.

### Refund flow (✅ DONE — 3-agent build, 2026-06-15)
**Integrated green: backend 119/119 · tsc clean · vitest 23/23.** Foundation by orchestrator
(refunds table+model, `Booking`/`Payment` `refunds()`, **shared `App\Services\RefundService`** for the
money logic, 7 routes, types). Flow: customer requests → Owner/Admin approve (wallet credit) or reject.
- **RefundService** (shared, money-critical): `approve(refund, method=wallet|manual, note, processedBy)`
  — DB transaction, guards `status===requested` (no double-process/double-credit), wallet method credits
  the customer wallet (+WalletTransaction) and sets booking `cancelled`, manual records only; `reject(...)`.
- **App**: `RefundController@store` (eligibility: approved payment OR amount>0 & confirmed/completed; no
  duplicate open refund) + `@index`; `RefundResource`; booking-detail "ขอคืนเงิน" button + status badge;
  `api.requestRefund/getRefunds` (mock+http). `RefundRequestTest` 5/5.
- **Owner**: `Owner/RefundController` index/approve/reject (org-scoped, via RefundService); `app/owner/refunds`
  page + "คืนเงิน" nav; `ownerApi.getRefunds/approveRefund/rejectRefund`. `OwnerRefundTest` 6/6.
- **Admin**: `Admin/RefundController` index(all orgs)/approve/reject override (via RefundService);
  `app/admin/refunds` page + "การคืนเงิน" nav; `superAdminApi.*`. `AdminRefundTest` 7/7.
- **Open follow-ups**: full-amount refund only (schema supports partial via `amount`); approve sets booking
  `cancelled` even if completed; frontend refund UIs compile-verified (tsc) but not visually run / no
  component tests; live money E2E covered by feature tests (not curl-driven on the running server yet).

## Blockers
none (LINE LIFF is code-complete; going live needs LINE_CHANNEL_ID/SECRET + NEXT_PUBLIC_LIFF_ID)

## Next step (user's choice)
1. ✅ **LINE LIFF real** — DONE (env-gated, 2026-06-15). Verify path + frontend LIFF + session
   rehydrate shipped & tested. **To activate**: set `LINE_CHANNEL_ID`/`LINE_CHANNEL_SECRET` (backend)
   and `NEXT_PUBLIC_LIFF_ID` (frontend build) → rebuild → test on device. Until then runs in stub/mock.
2. ✅ **Refund** (owner + admin) — DONE (2026-06-15, wallet+manual, customer-requested). Remaining from
   this line: **support ticket replies** (admin support still read-only).
3. Owner: staff edit/delete, customer detail page, peak/time-based pricing.
4. Make site public: Cloudflare A `sanam` + certbot.
5. Landing polish: move to `/`, lead-form backend, real mockups, public `GET /plans`.

## Run (real)
backend: cd backend && php artisan serve  (:8000)
frontend: cd frontend && npm run dev  →  / (ลูกค้า) · /owner (owner@everyday.test/password) · /admin (super@sanamspace.test/password) · /landing
verify: cd backend && php artisan test  ·  cd frontend && npx tsc --noEmit && npx vitest run
