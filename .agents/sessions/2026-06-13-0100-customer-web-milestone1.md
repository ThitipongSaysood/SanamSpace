---
date: 2026-06-13 01:00
agent: Claude Opus 4.8 (1M context) in Claude Code
branch: main (merged from feat/customer-booking-web)
task: สร้าง Customer Booking Web — Milestone 1
status: done
---

# Customer Booking Web — Milestone 1 (foundation + booking happy-path)

## Goal
"เริ่มสร้าง Website" → ผ่าน brainstorming → spec → plan → subagent-driven execution
สร้างเว็บลูกค้าจองสนาม (Next.js PWA, mock data) ครอบ booking happy-path

## What was done
- **Process:** brainstorming skill (เลือก: customer web / mock data / foundation+booking flow) →
  spec `docs/superpowers/specs/2026-06-13-customer-booking-web-design.md` →
  plan `docs/superpowers/plans/2026-06-13-customer-booking-web.md` (16 TDD tasks) →
  subagent-driven-development (implementer ต่อ batch + final review + fix loop)
- **App:** `frontend/` — Next.js 16.2.9 + React 19 + Tailwind v4 + shadcn(base-ui) + TanStack Query
- **จอครบ happy-path:** Login(mock LINE) → Home → Venue Detail → Create Booking (court/วัน/เวลา/ราคา)
  → Payment (method→อัปสลิป→status) → Confirmation+QR → Booking History
- **Data layer:** `lib/api/client.ts` = mock service ตาม /api/v1 (swap point เดียว, signatures นิ่ง)
- **Logic (TDD):** `lib/booking/slots.ts` (เลือก slot/ราคา), `lib/booking/slip.ts` (validate สลิป), `lib/theme.ts`
- **Tests:** 22 unit (Vitest+RTL) + 1 Playwright e2e ครอบ happy-path ถึง check-in
- **Final review เจอ + แก้ 5 bug:** ราคาหลายชม.ผิด(C1), cache เก่าทำ check-in ไม่โผล่(C2),
  สลิปไม่บังคับแนบ(C3), venue tsr-arena ตัน(I1), header ไม่ตามสถานะ(I2)
- Merge → main (`498e354`) + push GitHub แล้ว

## Current state
เสร็จ + verify อิสระ: 22 เทสต์เขียว, `npm run build` ผ่าน (8 routes), local==remote main.
node_modules ไม่ track (65 ไฟล์ frontend)

## Next step
ต่อจอ customer ที่เหลือ / Owner portal / PHP backend จริง (สลับ mock) / ขัด UI ตรง mockup

## For the next agent
- ⚠️ **create-next-app ตอนนี้ลง Next.js 16 (ไม่ใช่ 15)** + React 19 — มี breaking changes,
  อ่าน `frontend/AGENTS.md` + `node_modules/next/dist/docs/` ก่อนเขียน app code
- ⚠️ Node 20.12 ในเครื่องนี้เก่าไปสำหรับ vitest 4 — **pin ไว้: vitest@3, @vitejs/plugin-react@4, jsdom@26** (อย่าอัป)
- shadcn v4 ใช้ `@base-ui/react` (ไม่ใช่ Radix); primitives อยู่ใน `frontend/components/ui/`
- `useSearchParams` ต้องอยู่ใน `<Suspense>` ไม่งั้น production build พัง (ดู booking/new)
- **swap mock→backend จริง:** แก้แค่ `frontend/lib/api/client.ts` (เปลี่ยน body เป็น fetch('/api/v1/...'))
- mock เก็บ booking/payment ใน module-level memory → หาย refresh (ปกติของ mock)
- บทเรียน subagent: build/test เขียว ≠ flow ถูก — final review จับ bug happy-path ได้ 5 ตัวที่ unit test ไม่ครอบ
