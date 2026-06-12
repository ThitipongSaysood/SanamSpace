---
id: ADM-ORG-003
screen: Create Organization
module: Organizations
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-ORG-003 · Create Organization

## Objective
- สร้าง tenant (organization) ใหม่บนแพลตฟอร์ม พร้อมกำหนด plan เริ่มต้นและบัญชีเจ้าของ
- ใช้สำหรับ onboarding สนามใหม่เข้าสู่ระบบ White Label Multi-Tenant
- รองรับการแก้ไขข้อมูล organization เดิม (reuse form)

## User Story
> As a **Super Admin**, I want **สร้าง organization ใหม่พร้อมข้อมูลพื้นฐานและ plan**, so that **เปิดใช้งาน tenant ใหม่ให้สนามเริ่มใช้แพลตฟอร์มได้**.

## Entry Point
- ปุ่ม "สร้าง Organization" จาก Organization List (ADM-ORG-001)
- ปุ่ม "แก้ไขข้อมูล" จาก Organization Detail (ADM-ORG-002) — โหมดแก้ไข

## Exit Point
- บันทึกสำเร็จ → Organization Detail (ADM-ORG-002) ของ tenant ที่สร้าง
- ยกเลิก → Organization List (ADM-ORG-001)

## Components
- Form section "ข้อมูล Organization": ชื่อ, slug, custom domain (optional), โลโก้
- Form section "เจ้าของ": ชื่อ-นามสกุล, อีเมล, เบอร์โทร
- Form section "Plan": เลือก plan เริ่มต้น (Starter/Business/Pro/Enterprise), รอบบิล
- Form section "ที่อยู่/ข้อมูลภาษี" (optional)
- ปุ่ม "บันทึก" / "ยกเลิก"

## Validation Rules
- ชื่อ organization: required
- slug: required, unique, รูปแบบ a-z0-9 และ "-" เท่านั้น
- อีเมลเจ้าของ: required, รูปแบบอีเมลถูกต้อง, ไม่ซ้ำกับเจ้าของรายอื่น
- เบอร์โทร: รูปแบบเบอร์ที่ถูกต้อง
- plan: required ต้องเลือก
- custom domain: รูปแบบ domain ถูกต้อง (ถ้ากรอก)

## API Dependencies
- `POST /api/v1/organizations` — สร้าง organization ใหม่
- `PUT /api/v1/organizations/{id}` — แก้ไข organization (โหมดแก้ไข)
- `GET /api/v1/subscriptions` — อ้างอิงรายการ plan ที่เลือกได้

## Edge Cases
- slug หรืออีเมลซ้ำ → แสดง error ที่ field พร้อมข้อความ
- Validation ไม่ผ่าน → ไฮไลต์ field ที่ผิดและไม่ส่งฟอร์ม
- Network error ระหว่างบันทึก → คงข้อมูลในฟอร์ม + ให้ retry
- เลือก plan Enterprise → แสดงหมายเหตุว่าเป็นราคา Custom
- ออกจากหน้าโดยยังไม่บันทึก → เตือน unsaved changes

## Success Criteria
- สร้าง organization ใหม่สำเร็จและ redirect ไป Organization Detail
- Validation ทำงานครบทุก field ก่อนส่ง
- โหมดแก้ไขโหลดข้อมูลเดิมและบันทึกการเปลี่ยนแปลงได้
- slug/อีเมลซ้ำถูกบล็อกพร้อมข้อความชัดเจน
