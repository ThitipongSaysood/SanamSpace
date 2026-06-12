---
id: OWN-DASH-004
screen: Booking Widget
module: Dashboard
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-DASH-004 · Booking Widget

## Objective
- สรุปสถานะการจองของสาขาในวันนี้และรายการล่าสุดบน Dashboard
- ให้ Owner/Manager/Reception เห็นภาพรวม booking (รอ check-in / มาแล้ว / ยกเลิก) อย่างรวดเร็ว
- เป็นทางลัดไปยัง Booking Calendar / Booking List เพื่อจัดการต่อ

## User Story
> As an **Owner/Manager/Reception**, I want **เห็นสรุปการจองวันนี้และรายการล่าสุดในจอเดียว**, so that **รู้ว่ามีคิวอะไรต้องจัดการและเข้าไปจัดการ booking ได้ทันที**.

## Entry Point
- แสดงเป็น widget บน Dashboard (OWN-DASH-001)
- คลิกจาก KPI Card Booking (OWN-DASH-002)

## Exit Point
- คลิก booking รายการ → Booking Detail (OWN-BOOK-003)
- คลิก "ดูปฏิทิน" → Booking Calendar (OWN-BOOK-001)
- คลิก "ดูทั้งหมด" → Booking List (OWN-BOOK-002)

## Components
- Status summary chips: ทั้งหมด / Confirmed / รอ check-in / Checked-in / Cancelled (นับวันนี้)
- รายการ booking ล่าสุด (list): เวลา, สนาม/court, ลูกค้า, สถานะ
- Badge สถานะการชำระเงิน (paid / pending verify)
- Quick action ต่อรายการ: เปิด detail, check-in (ตามสิทธิ์)
- ปุ่ม "ดูปฏิทิน" / "ดูทั้งหมด"

## Validation Rules
- ผูกกับ `branch_id`; ค่าเริ่มต้น = booking ของวันนี้
- รายการเรียงตามเวลาเริ่ม (start time) ใกล้สุดก่อน
- แสดงเฉพาะ booking ที่ไม่ถูก soft-delete

## API Dependencies
- `GET /api/v1/bookings` — รายการ booking วันนี้ของสาขา (filter วันที่/สถานะ)
- `GET /api/v1/reports/bookings` — ตัวเลขสรุปสถานะสำหรับ chips
- `POST /api/v1/bookings/{id}/checkin` — quick check-in จาก widget (ตามสิทธิ์)

## Edge Cases
- Empty data: วันนี้ไม่มี booking → แสดง empty state "ยังไม่มีการจองวันนี้"
- Loading: skeleton ของ list + chips
- Permission denied: Cashier ได้ Booking = View → ปุ่ม check-in/แก้ไขถูกซ่อน; Reception ทำ check-in ได้ (Check-in = Full)
- Concurrent edit: รายการที่ถูก check-in/cancel โดยคนอื่น → รีเฟรชสถานะ, ปุ่มเดิม disable พร้อมข้อความ
- API error → widget แสดง error + retry

## Success Criteria
- chips สรุปจำนวนตรงกับข้อมูลจริงของวันนี้
- รายการล่าสุดแสดงถูกต้องและคลิกเข้า detail ได้
- ปุ่ม check-in ทำงานได้สำหรับ role ที่มีสิทธิ์ และอัปเดตสถานะทันที
- Cashier เห็นแบบ read-only โดยไม่มี action เกินสิทธิ์
