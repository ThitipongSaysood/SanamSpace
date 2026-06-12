---
id: OWN-BOOK-002
screen: Booking List
module: Booking
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-BOOK-002 · Booking List

## Objective
- แสดง booking ทั้งหมดของสาขาแบบตาราง ค้นหา-กรอง-เรียงได้
- ใช้จัดการ booking เชิงปริมาณ (อนุมัติ/ยกเลิก/ค้นหาตามลูกค้า/วันที่/สถานะ)
- เป็น entry สู่ Booking Detail และรองรับ export

## User Story
> As an **Owner/Manager/Reception**, I want **ค้นหาและกรอง booking เป็นรายการตาราง**, so that **หา booking ที่ต้องการและจัดการสถานะได้รวดเร็วเมื่อมีรายการจำนวนมาก**.

## Entry Point
- สลับมุมมอง "List" จาก Booking Calendar (OWN-BOOK-001)
- คลิก "ดูทั้งหมด" จาก Booking Widget (OWN-DASH-004)
- คลิกจาก KPI Card Booking (OWN-DASH-002)

## Exit Point
- คลิกแถว booking → Booking Detail (OWN-BOOK-003)
- สลับเป็นปฏิทิน → Booking Calendar (OWN-BOOK-001)

## Components
- Data table: คอลัมน์ booking code, วันที่/เวลา, court, ลูกค้า, สถานะ, ยอดเงิน, สถานะชำระเงิน
- Filters: ช่วงวันที่, court, สถานะ booking, สถานะชำระเงิน, ค้นหาชื่อ/เบอร์ลูกค้า
- Sort: ตามวันที่/เวลา/ยอดเงิน
- Pagination หรือ infinite scroll
- Row action: ดูรายละเอียด, cancel (ตามสิทธิ์)
- ปุ่ม Export (เฉพาะ role ที่มีสิทธิ์ export)

## Validation Rules
- ผูกกับ `branch_id`; ค่าเริ่มต้นแสดง booking ช่วงล่าสุด
- ช่วงวันที่ filter: `date_from` ไม่หลัง `date_to`
- คำค้นหาขั้นต่ำตามที่ระบบกำหนด (เช่น 2 ตัวอักษร) ก่อนยิง query

## API Dependencies
- `GET /api/v1/bookings` — รายการ booking พร้อม filter/sort/pagination
- `GET /api/v1/bookings/{id}` — preview รายละเอียดเมื่อเปิด detail
- `POST /api/v1/bookings/{id}/cancel` — ยกเลิก booking จาก row action
- `GET /api/v1/reports/bookings` — (optional) สรุปจำนวนตาม filter

## Edge Cases
- Empty data: filter ไม่พบผลลัพธ์ → empty state "ไม่พบการจองตามเงื่อนไข"
- Loading: table skeleton / loading row
- Permission denied: Cashier ได้ Booking = View → ปุ่ม cancel/export ถูกซ่อน; Reception/Manager จัดการได้
- Concurrent edit: booking ที่ถูกเปลี่ยนสถานะโดยคนอื่น → รีเฟรชแล้วสถานะอัปเดต, action ที่ไม่ valid ถูก disable
- ผลลัพธ์จำนวนมาก → pagination ทำงาน, ไม่โหลดทั้งหมดทีเดียว
- API error → แสดง error state + retry

## Success Criteria
- ตารางแสดง booking ตาม filter/sort/หน้า ที่เลือกถูกต้อง
- ค้นหาด้วยชื่อ/เบอร์/code แล้วได้ผลลัพธ์ตรง
- คลิกแถวเข้าสู่ Booking Detail และ cancel ได้ตามสิทธิ์
- Cashier เห็น read-only; export ทำได้เฉพาะ role ที่มีสิทธิ์
