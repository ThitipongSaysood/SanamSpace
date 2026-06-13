---
date: 2026-06-13 19:51
agent: Claude (Claude Code)
branch: main
task: database/README (ER) + Owner Portal MVP (backend + frontend)
status: done
---

# database/README (ER) + Owner Admin Portal MVP

## What was done
### 1. database/README.md
อธิบาย ER: 10 core domains + future modules, conventions (UUID/organization_id/soft-delete/money),
ความสัมพันธ์ต่อโดเมน, mermaid ER, วิธี load, ความสัมพันธ์กับ Laravel migrations. (schema.sql = 123 ตาราง)

### 2. Owner Portal — Backend (/api/v1/owner/*, org-scoped)
- middleware `owner.org` (ResolveOwnerOrganization): ต้องเป็น staff User ที่อยู่ใน org (403 ถ้า customer), resolve current org
- controllers: Owner/{Dashboard,Booking,Payment,Court,Customer}
- routes: GET /owner/dashboard (plain stats), GET /owner/bookings(+customerName)/{id}, GET /owner/payments?status,
  POST /owner/payments/{id}/verify|reject, GET /owner/courts, GET /owner/customers(+bookingsCount)
- org-scope ทุก query (กันข้าม tenant), 19 feature tests เขียว

### 3. Owner Portal — Frontend (app/owner/*)
- `lib/api/owner.ts` self-contained (token key แยก `sanamspace.owner_token` → ไม่ชน customer)
- จอ: /owner/login (admin), layout (sidebar admin), /owner (dashboard stats), /owner/bookings (filter),
  /owner/payments (ตรวจสลิป: ดูรูป + อนุมัติ/ปฏิเสธ), /owner/courts, /owner/customers
- owner เป็น real-backend-only (ไม่มี mock)

## Verify
- backend: migrate:fresh --seed สะอาด, php artisan test 19/19
- frontend: tsc clean, build (เพิ่ม 6 owner routes), vitest 22 เขียว (customer ไม่กระทบ)
- **REAL e2e owner**: E2E_OWNER=1 + backend → owner login→dashboard ผ่าน; ไม่มี flag → skip (suite ไม่แดง)
- curl: admin login → token, /owner/dashboard {courtCount:6,...}, /owner/bookings {data:[]}
- commits: db readme 45eee0e, backend owner 415ec0e, frontend owner c52d498

## Next step
- เติม backend endpoints ลูกค้าที่เหลือ (reviews/packages/membership/wallet/promotions/notifications + PUT customers) → เลิก mock fallback
- Owner: court CRUD/maintenance, reports, CRM/promotion/membership management (gate ตาม plan), staff mgmt
- Super Admin portal · LINE LIFF จริง · payment gateway

## For the next agent
- รัน owner จริง: backend `php artisan serve` (:8000) + frontend `.env.local` (NEXT_PUBLIC_API_URL) + `npm run dev` → /owner/login (owner@everyday.test / password)
- owner e2e จริง: `E2E_OWNER=1 npx playwright test owner.spec` (ต้องมี backend)
- backend owner endpoints scope ด้วย middleware owner.org (user.organization_users แรก) — multi-org staff ยังไม่รองรับ
- owner token แยก key จาก customer (owner.ts ไม่ใช้ lib/api/token.ts)
