# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/) + docs/spec repo. Backend (PHP/MySQL) ยังไม่เริ่ม

## Current goal

สร้าง Customer Booking Web (Next.js PWA, mock data) — **Milestone 1 เสร็จและ merge เข้า main แล้ว**

## What just happened

Milestone 1 (booking happy-path) เสร็จ + **ยกระดับ UI ทุกจอให้ตรง mockup** (Everyday Badminton โทนเขียว):
UI kit (SportMedia/FacilityChip/StatusBadge/AppHeader), bottom nav 4 แท็บ + /notifications,/profile,
Login ขาว 3 ปุ่ม, Home green header+quick-actions, การ์ดสนามมีราคา/ระยะทาง, payment methods, QR countdown.
22 เทสต์เขียว, build ผ่าน. Merge → main (3e2fd5d) + push

## Blockers

⚠️ disk เครื่องเกือบเต็ม (184/228Gi, ~240Mi free) — operations หนักอาจ ENOSPC; ยังไม่ได้ screenshot ตรวจ UI ด้วยตา

## Next step
ดู UI จริง `cd frontend && npm run dev`; ต่อได้: แยก booking เป็น 3 จอ (คอร์ท/วัน/เวลา) ตาม mockup,
ทำจอ membership/wallet/package/profile จริง, เริ่ม Owner Portal, หรือเริ่ม PHP backend (สลับ mock→/api/v1)
