# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/: customer + owner + super-admin portals) + Laravel 13 (backend/ /api/v1) + database/schema.sql (123 ตาราง) + docs

## Current goal

3 portals ทำงานจริงบน backend แล้ว — เหลือ owner section backends + integrations จริง

## What just happened

Owner Portal sections เสร็จ: Settings/Promotions(CRUD)/Staff/Membership/Wallet เป็นจอจริง + restyle 4 จอเดิม เข้า shell (commit fb17260). เหลือ CRM เป็น placeholder (ต้องสร้าง model segments/timeline/broadcast). 3 portals ใช้งานจริงครบ.

## (prev)

(1) Customer endpoints ที่เหลือ → real ทั้งหมด (reviews/packages/membership/wallet/promotions/notifications + PUT profile), เลิก mock fallback.
(2) Super Admin portal (backend Subscription domain + /admin/* 38 tests; frontend app/admin/*).
(3) Owner Portal redesign ตาม mockup: shell 13 เมนู + dashboard เต็ม (recharts) + operations/reports จริง + 6 placeholder.
Verify: backend 38 tests, frontend 22 vitest + build, REAL e2e (customer/owner/admin) ผ่าน. commits ...18125b6

## Blockers
ไม่มี (real mode = รัน backend คู่ frontend + .env.local)

## Next step
(ก) owner section backends: CRM/membership/wallet/promotions/staff/settings + restyle owner bookings/courts/customers/payments ให้เข้า shell
(ข) LINE LIFF จริง + payment verify จำกัด role + payment gateway (ค) court CRUD/reports เชิงลึก

## Run (real)
backend: cd backend && php artisan serve  (:8000)
frontend: cd frontend && npm run dev  (.env.local) →  / (ลูกค้า) · /owner (owner@everyday.test/password) · /admin (super@sanamspace.test/password)
real e2e: E2E_OWNER=1 npx playwright test
