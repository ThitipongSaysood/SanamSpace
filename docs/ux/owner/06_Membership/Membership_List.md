---
id: OWN-MEMBER-001
screen: Membership List
module: Membership
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-MEMBER-001 · Membership List

## Objective
- แสดงรายชื่อสมาชิกทั้งหมดของ tenant พร้อม tier (Silver/Gold/Platinum) และสถานะ
- ใช้ติดตามสมาชิก วันหมดอายุ และ points
- เป็น entry สู่ Membership Plans และโปรไฟล์ลูกค้า

## User Story
> As an **Owner/Manager**, I want **ดูรายชื่อสมาชิกและสถานะ tier ทั้งหมด**, so that **ติดตามสมาชิกที่ active/ใกล้หมดอายุและบริหารฐานสมาชิกได้**.

## Entry Point
- เมนู "สมาชิก" (Membership) จาก sidebar Owner Portal
- คลิกจาก Members KPI Card บน Dashboard
- ลิงก์จาก Customer Detail (OWN-CUST-002)

## Exit Point
- คลิก "จัดการแพ็กเกจสมาชิก" → Membership Plans (OWN-MEMBER-002)
- คลิกแถวสมาชิก → Customer Detail (OWN-CUST-002)

## Components
- Data table: คอลัมน์ ชื่อลูกค้า, tier, วันเริ่ม, วันหมดอายุ, points, สถานะ (active/expired)
- Filters: tier, สถานะ, ค้นหาชื่อ/เบอร์, ใกล้หมดอายุ
- Sort: ตาม tier/วันหมดอายุ/points
- Pagination
- ปุ่ม "จัดการแพ็กเกจสมาชิก" และ Export (ตามสิทธิ์)
- Banner เตือนหาก plan ไม่รองรับ (Membership = Business+)

## Validation Rules
- ผูกกับ `organization_id`; ไม่แสดงข้าม tenant
- ฟีเจอร์ทั้งหน้าเปิดเฉพาะ plan Business ขึ้นไป; Starter จะถูก lock
- คำค้นหาขั้นต่ำตามที่ระบบกำหนดก่อนยิง query

## API Dependencies
- `GET /api/v1/memberships` — รายการสมาชิกพร้อม filter/sort/pagination
- `GET /api/v1/customers/{id}` — preview ข้อมูลลูกค้าเมื่อเปิด

## Edge Cases
- Plan gating: Starter ไม่มี Membership → หน้าถูก lock + แนะนำอัปเกรดเป็น Business
- Empty data: ยังไม่มีสมาชิก → empty state "ยังไม่มีสมาชิก"
- Loading: table skeleton
- Permission denied: Reception/Cashier/Marketing/Viewer = View → ปุ่มจัดการ/export ถูกซ่อน; Manager = Manage; Owner = Full
- สมาชิกหมดอายุ → badge "หมดอายุ" และกรองแยกได้
- API error → error state + retry

## Success Criteria
- ตารางแสดงสมาชิกของ tenant ตาม filter/sort ถูกต้อง
- กรองสมาชิกใกล้หมดอายุ/ตาม tier ได้
- หน้าถูก lock อย่างถูกต้องบน plan Starter
- export ทำได้เฉพาะ role/plan ที่มีสิทธิ์
