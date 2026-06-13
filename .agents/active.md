# Active Task

_Last updated: 2026-06-13_

## Project type (auto-detected)

Next.js 16 (frontend/, customer web) + Laravel 13 (backend/, /api/v1) + docs/spec

## Current goal

Backend Phase 1 (Core API) เสร็จ — ถัดไป Phase 2: สลับ frontend mock → /api/v1

## What just happened

สร้าง backend Laravel 13 (PHP 8.4, SQLite dev / MySQL prod) /api/v1 ครบโดเมนหลัก:
auth(LINE+admin/Sanctum), venue/court+schedules, booking(slot guard+pricing), payment+slip(upload/verify),
multi-tenant+RBAC, seeder ตรง frontend fixtures. 14 tests เขียว, 21 endpoints. commit 3dd40f2 pushed.

## Blockers

ไม่มี (LINE login ยัง stub, payment verify ยังไม่จำกัด role — ตั้งใจ รอ Phase ต่อ)

## Next step
Phase 2: แก้ frontend/lib/api/client.ts mock → fetch /api/v1 (จุดเดียว), unwrap .data, ส่ง Bearer token,
ตั้ง NEXT_PUBLIC_API_URL, รัน backend คู่ frontend. จากนั้น Owner Portal / Super Admin / LINE LIFF จริง
