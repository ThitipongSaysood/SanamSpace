---
id: OWN-COURT-001
screen: Court List
module: Court
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-COURT-001 · Court List

## Objective
- แสดงสนาม (court) ทั้งหมดของสาขาแบบตาราง/การ์ด พร้อมสถานะใช้งาน
- ใช้จัดการสนามเชิงปริมาณ (เปิด/ปิดใช้งาน, ค้นหาตามชนิดกีฬา/สถานะ)
- เป็น entry สู่ Court Form, Court Availability และ Maintenance

## User Story
> As an **Owner/Manager**, I want **ดูและจัดการรายการสนามทั้งหมดของสาขา**, so that **ตรวจสอบสถานะสนามและเข้าไปแก้ไข ตั้งเวลาว่าง หรือแจ้งซ่อมได้รวดเร็ว**.

## Entry Point
- เมนู "สนาม" (Court Management) จาก sidebar Owner Portal
- คลิกจาก Utilization Widget / KPI Card บน Dashboard (OWN-DASH)

## Exit Point
- คลิก "เพิ่มสนาม" หรือแถวสนาม → Court Form (OWN-COURT-002)
- คลิก "ตั้งเวลาว่าง" → Court Availability (OWN-COURT-003)
- คลิก "แจ้งซ่อม/ปิดปรับปรุง" → Maintenance (OWN-COURT-004)

## Components
- Data table/grid: คอลัมน์ ชื่อสนาม, ชนิดกีฬา, ราคา/ชม., สถานะ (active/inactive/maintenance)
- Filters: ชนิดกีฬา, สถานะ, ค้นหาชื่อสนาม
- Sort: ตามชื่อ/ชนิดกีฬา/ราคา
- Row action: แก้ไข, ตั้งเวลาว่าง, แจ้งซ่อม, เปิด/ปิดใช้งาน (ตามสิทธิ์)
- ปุ่ม "เพิ่มสนาม" (เฉพาะ role ที่ create ได้)
- Badge แสดง limit จำนวนสนามตาม plan (Starter 10 / Business 30 / Pro+ Unlimited)

## Validation Rules
- ผูกกับ `branch_id` ของสาขาปัจจุบัน; ไม่แสดงสนามข้ามสาขา/ข้าม tenant
- ปุ่ม "เพิ่มสนาม" ถูก disable เมื่อจำนวนสนามถึง limit ของ plan
- คำค้นหาขั้นต่ำตามที่ระบบกำหนดก่อนยิง query

## API Dependencies
- `GET /api/v1/courts` — รายการสนามพร้อม filter/sort
- `GET /api/v1/courts/{id}` — preview รายละเอียดเมื่อเปิด
- `PUT /api/v1/courts/{id}` — toggle เปิด/ปิดใช้งานจาก row action

## Edge Cases
- Empty data: ยังไม่มีสนาม → empty state "ยังไม่มีสนาม เพิ่มสนามแรกของคุณ"
- Loading: table/grid skeleton
- Permission denied: Reception/Viewer ได้ Court = View → ปุ่มเพิ่ม/แก้ไข/ลบถูกซ่อน; Manager = Manage แก้ไขได้แต่จัดการ subscription ไม่ได้
- Plan limit reached: ปุ่มเพิ่มสนาม disable + tooltip แนะนำอัปเกรด plan
- สนามที่อยู่สถานะ maintenance → badge ชัดเจน, จองไม่ได้
- API error → error state + retry

## Success Criteria
- ตารางแสดงสนามของสาขาตาม filter/sort ถูกต้อง
- เพิ่ม/แก้ไข/เปิด-ปิดสนามได้ตามสิทธิ์
- จำนวนสนามเกิน limit ของ plan แล้วระบบบล็อกการเพิ่ม
- Reception/Viewer เห็นแบบ read-only
