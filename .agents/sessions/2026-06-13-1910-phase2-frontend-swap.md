---
date: 2026-06-13 19:10
agent: Claude (Claude Code)
branch: main
task: Phase 2 — สลับ frontend mock → real /api/v1
status: done
---

# Phase 2 — Frontend → real backend (/api/v1)

## Goal
ต่อ customer web เข้ากับ Laravel backend จริง โดยไม่พัง test/mock

## What was done (frontend/lib/api refactor)
- แยก client เป็น: `mock.ts` (in-memory เดิม + lineLogin), `http.ts` (fetch จริง), `token.ts` (Bearer ใน localStorage)
- `client.ts` = **dispatcher**: `api = NEXT_PUBLIC_API_URL ? httpApi : mockApi`
  → app ใช้จริงเมื่อมี env, **เทสต์ (vitest) ไม่อ่าน .env.local → mock เสมอ**
- `http.ts`: ส่ง `Authorization: Bearer`, unwrap Laravel `{data}`, `getOrUndefined` (404→undefined), uploadSlip ส่ง FormData(slip=File)
- 6 โดเมนที่ backend ยังไม่ทำ (reviews/packages/membership/wallet/promotions/notifications) → `httpApi` fallback เรียก `mockApi`
- `auth-context.login()` async → เรียก `api.lineLogin({lineUserId:Uxxxx...})` → เก็บ token → setUser (merge local profile overrides); logout เคลียร์ token
- login page = async + busy/error; payment ส่ง `slipFile` เข้า `uploadSlip(id, file)`
- `.env.example` (commit) + `.env.local` (gitignored, ตั้ง NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1) สำหรับ real mode

## Verify
- mock: tsc clean, **22 vitest เขียว** (ยังเขียวแม้มี .env.local — vitest อ่าน process.env ไม่ใช่ .env.local)
- **REAL: e2e Playwright ผ่าน** — browser → frontend(http) → Laravel /api/v1 → SQLite ครบ flow
  (login(LINE stub token)→branches→courts→booking→payment→อัปสลิปจริง(multipart)→verify→confirmed→QR)

## วิธีรัน real mode
1. backend: `cd backend && php artisan serve` (port 8000; ถ้าต้องรีเซ็ต `php artisan migrate:fresh --seed`)
2. frontend: มี `frontend/.env.local` อยู่แล้ว → `cd frontend && npm run dev`
   (ลบ .env.local = กลับไป mock; ถ้าเปิด dev โดยไม่รัน backend จะขึ้น ErrorState)

## Next step
- backend endpoints ที่เหลือ: reviews/packages/membership/wallet/promotions/notifications (+customer update PUT) → เลิก fallback mock
- LINE LIFF จริง (ตอนนี้ stub), payment verify จำกัด role
- **Owner Portal** (ตรวจสลิปจริง), Super Admin
- (CI: ถ้าจะรัน e2e แบบ real ต้อง start backend ใน playwright webServer ด้วย)

## For the next agent
- swap point เดียวยังอยู่: `frontend/lib/api/client.ts` (เลือก mock/http ด้วย env)
- เพิ่ม endpoint backend แล้ว ย้าย method นั้นใน http.ts จาก fallback mock → req() จริง
- profile edit (updateUser) ยังเก็บ localStorage (backend ไม่มี PUT /customers) — TODO
