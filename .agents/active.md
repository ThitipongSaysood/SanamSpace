# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/ customer web + owner portal) + Laravel 13 (backend/ /api/v1) + database/schema.sql (123 ตาราง) + docs

## Current goal

Owner Portal MVP เสร็จ (backend + frontend) — ถัดไปเติม endpoint ลูกค้าที่เหลือ / Super Admin / integrations จริง

## What just happened

(1) database/README.md อธิบาย ER. (2) Owner Portal: backend /api/v1/owner/* (org-scoped, dashboard/bookings/
verify-slip/courts/customers, 19 tests) + frontend app/owner/* (login/dashboard/bookings/ตรวจสลิป/courts/customers,
owner token แยก). Verify: backend 19 + frontend 22 + owner e2e (E2E_OWNER=1) ผ่าน. commits 45eee0e/415ec0e/c52d498.

## Blockers
ไม่มี (owner = real-backend-only; รัน backend คู่ frontend + .env.local)

## Next step
(ก) backend customer endpoints ที่เหลือ: reviews/packages/membership/wallet/promotions/notifications + PUT /customers
(ข) Owner: court CRUD, reports, CRM/promotion/membership mgmt (ค) Super Admin portal (ง) LINE LIFF + payment gateway

## How to run (real)
backend: cd backend && php artisan serve  (:8000; reset: migrate:fresh --seed; owner: owner@everyday.test/password)
frontend: cd frontend && npm run dev  (มี .env.local) → /owner/login สำหรับฝั่งเจ้าของสนาม
