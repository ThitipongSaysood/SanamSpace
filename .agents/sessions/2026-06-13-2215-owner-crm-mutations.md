---
date: 2026-06-13
agent: Claude (Claude Code)
branch: main
task: Owner CRM (last menu) + owner mutations
status: done
---

# Owner CRM + mutations — Owner Portal 13/13 menus real

## What was done
- backend (commit 3caeee3, 65 tests): CRM domain — customer_segments/segment_members/customer_timeline/broadcasts
  (+seed) + endpoints GET /owner/crm/overview, /owner/segments CRUD, GET /owner/timeline/{customer},
  /owner/broadcasts +send. Mutations: POST /owner/staff (invite user+org_user), /owner/memberships/{id}/points
  (adjust), /owner/wallets/{id}/topup (+wallet_transaction). All org-scoped.
- frontend (commit e7c4aca): CRM page (tabs ภาพรวม/กลุ่มลูกค้า/บรอดแคสต์/ไทม์ไลน์) replaces last placeholder;
  Staff "เชิญพนักงาน", Membership "ปรับแต้ม", Wallet "เติมเงิน" inline forms. New ownerApi methods/types.
- Verify: backend 65 tests; frontend tsc/build/22 vitest; owner e2e real; CRM endpoints 200, staff invite 201.

## Status — Owner Portal COMPLETE (13/13 menus real)
Dashboard, Operations, Booking, Courts, Customers, CRM, Membership, Wallet, Promotions, Payments, Reports, Staff, Settings — all real on backend.

## System status
- 3 portals fully real: customer `/`, owner `/owner` (owner@everyday.test/password), super-admin `/admin` (super@sanamspace.test/password)
- backend ~65 feature tests; database/schema.sql 123 tables (full design); Laravel migrations cover the live MVP+ domains

## Next step (remaining)
- LINE LIFF real (currently stub) ; payment gateway (PromptPay/Omise) ; payment verify role restriction
- deeper owner mutations (court CRUD, refunds), notifications real-time, analytics (BigQuery)
- prod: switch DB to MySQL via .env, deploy (Nginx/PHP-FPM)

## For the next agent
- 3 portals, isolated token keys (sanamspace.token / owner_token / admin_token)
- real mode: backend `php artisan serve` + frontend `.env.local`; real e2e: `E2E_OWNER=1 npx playwright test`
- owner endpoints under /api/v1/owner/* (owner.org middleware); CRM models: CustomerSegment/CustomerTimelineEntry/Broadcast
- membership `note` not persisted (no points ledger table yet); wallet txn_date is a pre-formatted Thai string
