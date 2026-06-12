# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/) + docs/spec repo. Backend (PHP/MySQL) ยังไม่เริ่ม

## Current goal

Customer Web ครบทุกจอแล้ว (24 routes) — รอตรวจตา + รัน e2e แล้วเลือกเฟสถัดไป

## What just happened

ทำครบทุกจอตาม structure/mockups: booking 4-step wizard, payment+slip (บัญชีโอน/QR/countdown),
venue sub-pages 6 จอ (facilities/map/gallery/reviews/hours/courts), discovery (sports/search),
account 7 จอ (profile/membership/wallet/packages/promotions/notifications/contact), bookings tabs จริง.
Merge → main b51d7ca + push. build ผ่าน, 22 tests เขียว, e2e ยังไม่ได้รัน

## Blockers

ไม่มี (disk กลับมาว่าง ~3.9Gi แล้ว)

## Next step
รัน e2e (`cd frontend && npx playwright test`) + เปิด dev ดู UI จริง;
จากนั้น: Owner Portal / PHP backend (สลับ mock ที่ lib/api/client.ts) / LINE LIFF จริง
