# Active Task

_Last updated: 2026-06-15 (payments + packages + landing)_

## Project type (auto-detected)

Next.js 16 (frontend/: customer + owner + super-admin portals + /landing marketing) + Laravel 13 (backend/ /api/v1) + docs

## Current goal

**Feature build-out — 3 portals near-complete and all DB-backed.** Latest session shipped: admin billing (plan features, invoice print/email, receipts), config moved to DB (SMTP via PlatformConfigServiceProvider, encrypted), real **PromptPay** payments (per-venue, EMVCo QR, no gateway), wallet top-up + **packages** (buy→approve→redeem hours at booking), owner court-blocking + CSV export + platform-announcement banner, admin mobile menu = owner-style drawer, and the **/landing** marketing page (Landing_Page_Spec_v1, 13 sections, SEO+FAQ schema).

Tests green every commit: **backend 87/87 · tsc clean · 22/22 vitest**. Full detail: `sessions/2026-06-15-1046-billing-payments-packages-landing.md`.

Deploy pipeline still live (push `main` → GitHub Actions → server). Server = readyidc 157.85.97.241, app at `/var/www/html/sanamspace`, vhost `sanam.semitennis.com`. **Still NOT public** — needs Cloudflare A `sanam` → 157.85.97.241 + `certbot` (see `sessions/2026-06-13-2330-deploy-pipeline-live-readyidc.md`).

## What just happened

Closed out a long feature session (12 commits, `7d50f10`..`8e134be`). Audited all 3 portals → backend ~98% DB-backed; fixed remaining mocks (court schedule from real bookings, booking channel, real dashboard deltas, env→DB config).

## Blockers
none

## Next step (user's choice)
1. **LINE LIFF real** — login still mocked (`frontend/lib/auth/auth-context.tsx` hardcodes user; `AuthController::lineLogin` has a verify TODO). Biggest blocker to real customer use.
2. **Refund** (owner + admin) + **support ticket replies** (admin support read-only).
3. Owner: staff edit/delete, customer detail page, peak/time-based pricing.
4. Make site public: Cloudflare A `sanam` + certbot.
5. Landing polish: move to `/`, lead-form backend, real mockups, public `GET /plans`.

## Run (real)
backend: cd backend && php artisan serve  (:8000)
frontend: cd frontend && npm run dev  →  / (ลูกค้า) · /owner (owner@everyday.test/password) · /admin (super@sanamspace.test/password) · /landing
verify: cd backend && php artisan test  ·  cd frontend && npx tsc --noEmit && npx vitest run
