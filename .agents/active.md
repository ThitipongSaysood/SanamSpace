# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/ customer web) + Laravel 13 (backend/ /api/v1) + docs/spec

## Current goal

Phase 2 เสร็จ — customer web ต่อ backend จริงได้แล้ว (สลับ mock/real ด้วย env)

## What just happened

แยก lib/api เป็น mock/http/token + client.ts dispatcher (real เมื่อมี NEXT_PUBLIC_API_URL ไม่งั้น mock).
auth login เรียก /auth/line/login เก็บ Sanctum token; payment อัปสลิปจริง (multipart). 6 โดเมนที่ backend
ยังไม่ทำ fallback mock. Verify: mock 22 vitest เขียว + REAL e2e ผ่าน (browser→/api/v1→SQLite). commit c83bd3f.

## Blockers

ไม่มี (real mode ต้องรัน backend คู่ + มี frontend/.env.local อยู่แล้ว)

## Next step
(ก) backend endpoints ที่เหลือ reviews/packages/membership/wallet/promotions/notifications + customer update
(ข) Owner Portal (ตรวจสลิป/จัดการจอง) (ค) LINE LIFF จริง + payment verify จำกัด role (ง) Super Admin

## How to run real mode
backend: `cd backend && php artisan serve` (8000; reset: migrate:fresh --seed)
frontend: `cd frontend && npm run dev` (มี .env.local แล้ว) — ลบ .env.local = กลับ mock
