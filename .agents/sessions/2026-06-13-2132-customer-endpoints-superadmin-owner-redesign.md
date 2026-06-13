---
date: 2026-06-13 21:32
agent: Claude (Claude Code)
branch: main
task: customer remaining endpoints + Super Admin portal + Owner Portal redesign (mockup)
status: done
---

# Customer endpoints (real) + Super Admin + Owner Portal redesign

## 1. Customer remaining endpoints → real (no more mock)
- backend: reviews/packages/membership/wallet/promotions/notifications + PUT /auth/me (migrations/models/seed = frontend fixtures exactly). 29 tests.
- frontend: http.ts 6 methods mock-fallback → real `req()`; `updateProfile` (PUT /auth/me) wired into auth updateUser. Customer app now fully real (mock kept for tests). commits c623252 / 5936872

## 2. Super Admin (Platform) portal
- backend: Subscription domain (plans 990/1990/3990/custom + limits, features, plan_features, subscriptions seeded from Feature Matrix; orgs→Pro/Business). `is_super_admin` + `super.admin` middleware. /api/v1/admin/* (dashboard MRR/totals, organizations, subscriptions, plans CRUD, features). 38 tests. commit c9c3cb0
- frontend: app/admin/* (separate `sanamspace.admin_token`) + lib/api/superadmin.ts. login/dashboard/organizations/subscriptions/plans/features. e2e admin.spec (E2E_OWNER-gated, verified real). commit 637ef69
- demo super admin: super@sanamspace.test / password

## 3. Owner Portal redesign (per provided mockup)
- backend: enriched /owner/dashboard (newCustomersToday, utilizationRate, walletBalance, revenueSeries[7d], statusBreakdown, sportSales, bookingChannels[placeholder], actionItems, recentBookings). commit 10de4c8
- frontend (commit 18125b6): light-theme shell — 13-menu sidebar (Dashboard/Operations/Booking/Courts/Customers/CRM/Membership/Wallet/Promotions/Payments/Reports/Staff/Settings) + Pro Plan card + topbar (search/org/notifications/user). Dashboard rebuilt with **recharts** (5 stat cards+sparkline+delta, revenue area, status+sport donuts, today calendar, channels bars, action items, recent table).
  - real pages: operations + reports (from enriched dashboard); placeholders "เร็วๆ นี้": crm/membership/wallet/promotions/staff/settings (shared `app/owner/_components/coming-soon.tsx`)
  - added dep: recharts

## Verify
- backend 38 tests; frontend tsc + build (admin + 13 owner routes) + 22 vitest; REAL e2e: customer booking + owner login→dashboard + admin login→dashboard all pass (E2E_OWNER=1 + backend)

## Notes / TODO
- Owner dashboard delta %s are static placeholders; bookingChannels is a derived placeholder (no channel field); utilization assumes 12 open hrs/day.
- Owner pages bookings/courts/customers/payments NOT restyled to the new shell (render fine, functional) — polish later.
- Owner menus crm/membership/wallet/promotions/staff/settings are placeholders (no backend yet).
- LINE login still stub; payment verify (customer-side) still unrestricted; profile edit persists via PUT /auth/me now (real) + local override.

## For the next agent
- 3 portals: customer `/` , owner `/owner` (owner@everyday.test/password), super admin `/admin` (super@sanamspace.test/password). Each isolated token key.
- real mode: backend `php artisan serve` + frontend `.env.local` + `npm run dev`. real e2e: `E2E_OWNER=1 npx playwright test`
- next: build owner section backends (CRM/membership/wallet/promotions/staff/settings) + restyle owner bookings/courts/customers/payments; LINE LIFF; payment gateway
