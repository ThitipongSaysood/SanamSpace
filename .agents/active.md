# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/) + docs/spec repo. Backend (PHP/MySQL) ยังไม่เริ่ม

## Current goal

สร้าง Customer Booking Web (Next.js PWA, mock data) — **Milestone 1 เสร็จและ merge เข้า main แล้ว**

## What just happened

ทำ Milestone 1 ครบตามแผน: scaffold Next.js 16 + Tailwind v4 + shadcn(base-ui) + TanStack Query,
mock data layer (swap point เดียว), mock auth+guard, จอ booking happy-path
(Login→Home→Venue→Booking→Payment+slip→Confirmation+QR→History) + slot/slip logic (TDD).
Final review เจอ bug 5 ตัว (ราคาหลายชม.ผิด, cache เก่า, สลิปไม่บังคับ, venue ตัน, header ไม่ตามสถานะ) → แก้ครบ.
22 เทสต์เขียว, build ผ่าน, e2e ผ่าน. Merge feat/customer-booking-web → main (498e354) + push แล้ว

## Blockers

ไม่มี

## Next step
เลือกได้: (ก) ต่อจอ customer ที่เหลือ (membership/wallet/profile/...), (ข) เริ่ม Owner Admin Portal,
(ค) เริ่ม PHP backend จริงแล้วสลับ mock→/api/v1, (ง) เติม wireframe/รูปจริง + ขัด UI ให้ตรง mockup
