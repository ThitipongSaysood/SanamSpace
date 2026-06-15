---
date: 2026-06-15
agent: Claude (Claude Code, Opus 4.8)
branch: main
task: Admin billing/receipts, DB-backed config, real payments (PromptPay), wallet top-up, packages, owner gaps, landing page
status: DONE — all verified (backend 87/87, tsc clean, 22/22 vitest), pushed
---

# Billing → real payments → packages → owner gaps → landing

A long feature session. Every change committed + pushed to `main` (auto-deploys). Verification cadence each commit: `php artisan test`, `npx tsc --noEmit`, `npx vitest run`.

## What shipped (in order, each its own commit)

1. **Plan features management** (`7d50f10`) — `PUT /admin/plans/{id}/features` syncs the `plan_features` pivot; Plans modal has a feature checklist.
2. **Invoice print + email** (`23acdb7`) — billing modal: พิมพ์ (new-window print) + ส่งอีเมล (`POST /admin/invoices/{id}/send`, resolves org email from settings).
3. **Receipts + prod SMTP** (`8010ed8`) — `invoices.paid_date`; `POST /admin/invoices/{id}/pay` → paid invoice becomes a receipt (RCP-*, PAID stamp); SMTP block in `.env.production.example` + DEPLOYMENT.md.
4. **Config → DB** (`de4bc8e`) — `platform_settings` now holds Mail/SMTP + payment; **`PlatformConfigServiceProvider`** applies DB over `.env` at boot (SMTP password `encrypted` cast, masked in API). Also: court schedules now read REAL bookings (was hardcoded 12:00/19:00); `bookings.channel` added; owner dashboard `bookingChannels` real.
5. **Tabbed admin settings** (`f656ba3`) + **security/notifications/backup tabs** (`efe5f0b`) — session timeout wired to `sanctum.expiration`; notification toggles; **`BackupService`** exports all key tables to timestamped JSON (`storage/app/backups`), `POST/GET /admin/backups` + token download, retention prune.
6. **Real PromptPay payments** (`f37f7ec`) — **per-venue** payment accounts in `organization_settings` (promptpay_id/name + bank). **`PromptPayService`** builds a real EMVCo PromptPay payload (TLV + CRC16-CCITT) for the exact amount — no gateway. `GET /payments/{id}/instructions`. Customer pays via real QR (qrcode lib) / bank slip; slip → owner verifies (removed demo auto-approve). Owner sets account in ตั้งค่า → การชำระเงิน.
7. **Manage announcements** (`fd7f249`) — admin CRUD + publish toggle.
8. **Review + wallet top-up** (`5c65221`) — `POST /reviews` (recomputes branch rating); wallet top-up flow: `POST /wallet/topup` (real QR, pending) → slip → owner approves at `/owner/wallet-topups` → balance credited.
9. **Packages full system** (`2f44fa1`) — `customer_packages` (remaining hours + expiry). Buy → pay (QR/slip) → owner approves on ตรวจสลิป → active. `GET /my-packages`. At checkout an eligible package shows as "ใช้แพ็กเกจ" → `POST /bookings/{id}/pay-with-package` deducts hours, confirms ฿0.
10. **Owner gaps** (`574577e`) — **court blocking** (`court_blocks`, maintenance/closure; blocks reject bookings + mark schedule unavailable; modal on Courts page); **CSV export** (`GET /owner/reports/bookings.csv`, UTF-8 BOM); **owner sees platform announcements** (banner on dashboard + live bell badge); removed mock UI (real day-over-day deltas, deleted topbar search, real badge, removed Settings channels placeholder tab).
11. **Admin mobile menu** (`520a8d0`) — now owner-style hamburger + slide-in drawer (was horizontal pills).
12. **Landing page** (`8e134be`) — `/landing` from `structure/Landing_Page_Spec_v1.md`: all 13 sections, SEO meta + FAQ JSON-LD, pricing month/year toggle, sports tabs, FAQ accordion, sticky mobile CTA. Brand green + Prompt font.

## Audit done (all 3 portals)
Backend is ~98% DB-backed; the few mocks found were fixed (court schedule, booking channel, dashboard deltas, env→DB config). Remaining gaps documented for the user — see "Next step".

## Key new backend pieces
- Services: `PromptPayService`, `BackupService`, `CourtScheduleService` (rewritten to use real bookings + blocks).
- Provider: `PlatformConfigServiceProvider` (registered in `bootstrap/providers.php`).
- Models: `CustomerPackage`, `CourtBlock` (+ casts on `PlatformSetting`).
- Migrations (2026_06_14_*): paid_date, config-on-platform_settings, channel-on-bookings, security/notify/backup, payment-on-organization_settings, status-on-wallet_transactions, customer_packages, court_blocks.

## Gotchas / decisions
- Resources wrap responses in `{data}`; plain `response()->json([...])` (instructions, backups, topups, deltas) do NOT — frontend `req()` only unwraps when a top-level `data` key exists.
- SMTP password stored encrypted; never returned (only `mailPasswordSet`). Local reset to `MAIL_MAILER=log` after testing.
- Package redemption sets booking `amount=0` to avoid double-counting revenue (the package purchase is the revenue).
- Landing lives at `/landing` because `/` is the customer booking app; in prod the marketing site is the apex domain.
- Tests: forget guards between role switches (`$this->app['auth']->forgetGuards()`); `Storage::fake('local')` for backup/slip tests.

## Next step (user's choice — not started)
- #1 **LINE LIFF real** (login still mocked — biggest blocker to real customer use).
- #2 **Refund** (owner+admin) + **support ticket replies** (admin support is read-only).
- Owner: staff edit/delete, customer detail page, peak pricing.
- Make site public: Cloudflare A `sanam` → 157.85.97.241 + `certbot` (still pending from 2026-06-13).
- Landing: move to `/`, add lead-form backend, real mockups, public `GET /plans` for pricing.

## Run (real)
backend: `cd backend && php artisan serve` (:8000) · frontend: `cd frontend && npm run dev`
/ (ลูกค้า) · /owner (owner@everyday.test/password) · /admin (super@sanamspace.test/password) · /landing
