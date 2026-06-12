---
id: ADM-FEAT-001
screen: Feature List
module: Features
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-FEAT-001 · Feature List

## Objective
- แสดงรายการ feature ทั้งหมดของแพลตฟอร์ม (catalog) ที่ใช้ขับเคลื่อน Feature Flag
- ใช้บริหารจัดการ feature: สร้าง, แก้ไขชื่อ/คีย์/หมวด, ดูว่าผูกกับ plan ใดบ้าง
- เป็นต้นทางของการกำหนด plan_features และ override

## User Story
> As a **Super Admin**, I want **ดูและจัดการ feature catalog ของแพลตฟอร์ม**, so that **ควบคุมว่ามี feature ใดบ้างและผูกกับ plan ใดได้ตามสถาปัตยกรรม Feature Flag**.

## Entry Point
- เมนูหลัก Super Admin Portal → "Features"
- ลิงก์ "จัดการ Feature" จาก Plan Form (ADM-PLAN-002)

## Exit Point
- คลิกแถว feature → แก้ไข feature (inline/form)
- คลิก "Feature Flags" → Feature Flags (ADM-FEAT-002)

## Components
- Data table: feature key, ชื่อ, หมวด (Booking, Payment, Membership, CRM, Marketing, Analytics, White Label, API, ฯลฯ), สถานะ (active/deprecated), plan ที่รองรับ
- Filters: หมวด, สถานะ
- Search: feature key / ชื่อ
- Row action: แก้ไข, mark deprecated
- ปุ่ม "สร้าง Feature"

## Validation Rules
- feature key: required, unique, รูปแบบ snake_case
- ชื่อ: required
- ห้าม hardcode feature ใน source — ต้องผ่าน catalog นี้เท่านั้น
- เฉพาะ Super Admin เท่านั้นที่จัดการได้

## API Dependencies
- Feature catalog (list/create/update) — — (ยังไม่มี endpoint; อ้างอิงตาราง `features`, `plan_features`)

## Edge Cases
- Empty data: ไม่มี feature → empty state พร้อมปุ่มสร้าง
- Loading: table skeleton
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- mark deprecated feature ที่ยังผูกกับ plan → เตือนผลกระทบ
- feature key ซ้ำ → error ที่ field
- API error → แสดง error state + retry

## Success Criteria
- แสดง feature ทั้งหมดพร้อมหมวดและ plan ที่รองรับถูกต้อง
- สร้าง/แก้ไข/deprecate feature ได้
- ค้นหาและกรองตามหมวด/สถานะได้
- นำทางไป Feature Flags ได้
