---
id: OWN-PROMO-003
screen: Coupon List
module: Promotion
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-PROMO-003 · Coupon List

## Objective
- แสดงและจัดการคูปองส่วนลดของ tenant แบบตาราง
- สร้างคูปอง (โค้ด, ส่วนลด, โควตา, วันหมดอายุ) และติดตามการใช้งาน
- เป็นส่วนเสริมของ Promotion Management (Coupon = Business+)

## User Story
> As an **Owner/Manager/Marketing**, I want **สร้างและจัดการคูปองส่วนลด**, so that **แจกโค้ดส่วนลดให้ลูกค้าและติดตามการใช้/โควตาคงเหลือได้**.

## Entry Point
- คลิก "คูปอง" จาก Promotion List (OWN-PROMO-001)
- เมนูย่อย Promotion จาก sidebar Owner Portal

## Exit Point
- สร้าง/แก้ไขคูปองสำเร็จ → คงอยู่ที่ Coupon List พร้อม toast
- กลับ → Promotion List (OWN-PROMO-001)

## Components
- Data table: คอลัมน์ โค้ด, ประเภทส่วนลด, ค่าส่วนลด, โควตา/ใช้ไปแล้ว, วันหมดอายุ, สถานะ
- Filters: สถานะ (active/expired/used-up), ค้นหาโค้ด
- Sort: ตามวันหมดอายุ/จำนวนการใช้
- ปุ่ม/Modal "สร้างคูปอง": โค้ด, ประเภท, ค่าส่วนลด, โควตารวม/ต่อคน, วันหมดอายุ
- Row action: แก้ไข, ปิดใช้งาน, ทำสำเนาโค้ด (ตามสิทธิ์)
- Banner gating หาก plan ไม่รองรับ

## Validation Rules
- ฟีเจอร์เปิดเฉพาะ plan Business ขึ้นไป (Coupons = Business+)
- โค้ดคูปอง: required, ไม่ซ้ำภายใน tenant, รูปแบบตามที่กำหนด
- ค่าส่วนลด: > 0; แบบ % ต้อง ≤ 100
- โควตา: ตัวเลข ≥ 1; วันหมดอายุต้องเป็นอนาคต
- ผูก `organization_id`; ห้าม cross-tenant

## API Dependencies
- `GET /api/v1/coupons` — รายการคูปองพร้อม filter/sort
- `POST /api/v1/coupons` — สร้าง/อัปเดตคูปอง

## Edge Cases
- Plan gating: Starter → หน้าถูก lock + แนะนำอัปเกรดเป็น Business
- Empty data: ยังไม่มีคูปอง → empty state "ยังไม่มีคูปอง"
- Duplicate code → error "โค้ดนี้ถูกใช้แล้ว"
- โควตาเต็ม (used-up) → badge และบล็อกการใช้เพิ่ม
- Validation error: inline error (เช่น % > 100, วันหมดอายุในอดีต)
- Permission denied: Viewer = View; Manager = Manage; Marketing = Full; role อื่นเข้าไม่ได้
- Loading/Save: skeleton + ปุ่มบันทึก disable ระหว่างเซฟ
- API error → error state + retry

## Success Criteria
- ตารางแสดงคูปองและสถานะ/โควตาคงเหลือถูกต้อง
- สร้าง/แก้ไขคูปองได้ และ validation บล็อกโค้ดซ้ำ/ค่าส่วนลดผิด
- หน้าถูก lock อย่างถูกต้องบน plan Starter
- เฉพาะ role ที่มีสิทธิ์ (Owner/Manager/Marketing) ที่จัดการได้
