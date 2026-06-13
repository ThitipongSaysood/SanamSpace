# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/: customer + owner + super-admin portals) + Laravel 13 (backend/ /api/v1) + database/schema.sql (123 ตาราง) + docs

## Current goal

Production deploy setup เสร็จ (Docker Compose + VPS guide; MySQL-verified; Next standalone). พร้อม deploy บนเซิร์ฟเวอร์จริง (ดู DEPLOYMENT.md). ก่อน launch จริง: APP_KEY/DB_PASSWORD จริง, ลบ demo users, R2 storage, LINE LIFF, payment gateway, TLS.

## (prev goal)

Owner Portal ครบ 13/13 เมนูเป็นของจริงแล้ว (CRM + mutations เสร็จ). เหลือ integrations: LINE LIFF จริง, payment gateway, deploy MySQL.

## (prev goal)

Owner backend feature-complete. CRM domain (segments/timeline/broadcasts) + owner mutations (staff invite, membership points adjust, wallet topup) DONE and verified. No owner placeholders left on backend.

## What just happened

Built CRM: migration 2026_06_13_160000_create_crm_tables, models (CustomerSegment, CustomerSegmentMember pivot, CustomerTimelineEntry, Broadcast), resources (OwnerSegment/Timeline/Broadcast), controllers (Crm/Segment/Timeline/Broadcast), routes, seeder (3 segments + VIP membership + 4 timeline + 2 broadcasts). Added mutations to Staff/Membership/Wallet controllers. Tests: 65 pass (+17). Live curl on :8011 all green (incl. customer→403). See sessions/2026-06-13-2210-owner-crm-and-mutations.md.

## Assumptions (CRM overview, commented in CrmController)
- vipCount = members of segment named "VIP".
- inactive30d = customers with no booking dated in last 30 days (real bookings.date check).

## Blockers
none

## Next step
Optional: frontend CRM page consuming the new endpoints; LINE LIFF real; payment gateway; payment-verify role restriction.

## Run (real)
backend: cd backend && php artisan serve  (:8000)
frontend: cd frontend && npm run dev  (.env.local) →  / (ลูกค้า) · /owner (owner@everyday.test/password) · /admin (super@sanamspace.test/password)
real e2e: E2E_OWNER=1 npx playwright test
