---
id: OWN-BOOK-004
screen: Check In
module: Booking
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-BOOK-004 · Check In

## Objective
- บันทึกการเข้าใช้สนามของลูกค้า (check-in) ของ booking หนึ่งรายการ
- ให้พนักงานหน้าเคาน์เตอร์ยืนยันว่าลูกค้ามาถึงและเริ่มใช้สนาม
- ตรวจความพร้อมก่อนเข้า (ชำระเงินแล้ว / ถึงเวลา) และอัปเดตสถานะเป็น checked-in

## User Story
> As a **Reception/Manager**, I want **กดเช็คอินลูกค้าเมื่อมาถึงตาม booking**, so that **ระบบบันทึกการเข้าใช้สนามและติดตามสถานะหน้างานได้ถูกต้อง**.

## Entry Point
- กดปุ่ม "Check-in" จาก Booking Detail (OWN-BOOK-003)
- quick check-in จาก Booking Widget (OWN-DASH-004) หรือ Booking Calendar (OWN-BOOK-001)
- สแกน QR/booking code ที่เคาน์เตอร์

## Exit Point
- check-in สำเร็จ → สถานะเป็น checked-in, กลับ Booking Detail/รายการพร้อมสถานะใหม่
- ยกเลิก → ปิด dialog กลับจอเดิมโดยไม่เปลี่ยนสถานะ

## Components
- Confirm dialog: สรุป booking (ลูกค้า, court, เวลา, สถานะชำระเงิน)
- Indicator สถานะชำระเงิน (paid / pending) ก่อนยืนยัน
- ปุ่มยืนยัน check-in / ยกเลิก
- (option) ช่องสแกน QR / กรอก booking code
- ข้อความเตือนถ้า check-in ก่อน/หลังเวลาที่กำหนด

## Validation Rules
- booking ต้องอยู่ในสถานะ confirmed และยังไม่ถูก check-in หรือ cancel
- ต้องชำระเงินแล้ว (verified) หรือเป็นนโยบายจ่ายหน้างานที่อนุญาต
- check-in ได้เฉพาะ booking ของ `branch_id` ที่ user สังกัด
- เวลาปัจจุบันอยู่ในกรอบที่อนุญาต (เช่นไม่เกินช่วงเวลา booking มากเกินไป)

## API Dependencies
- `POST /api/v1/bookings/{id}/checkin` — บันทึกการเช็คอิน
- `GET /api/v1/bookings/{id}` — โหลด/รีเฟรชสถานะ booking ก่อน-หลังเช็คอิน

## Edge Cases
- Booking ยังไม่ชำระเงิน → เตือน/บล็อกตามนโยบาย ก่อนให้ check-in
- Already checked-in → ปุ่ม disable + แจ้ง "เช็คอินแล้ว"
- Cancelled booking → ห้าม check-in พร้อมข้อความ
- Permission denied: Cashier/Marketing/Coach/Accountant/Viewer มี Check-in = None → ไม่เห็นปุ่ม/ถูก 403; Owner/Manager/Reception = Full ทำได้
- Concurrent: ถูก check-in โดยคนอื่นพร้อมกัน → request ที่สองคืน 409/แจ้งว่าเช็คอินแล้ว, รีเฟรชสถานะ
- API error → toast error, คงสถานะเดิม

## Success Criteria
- กดยืนยันแล้วสถานะ booking เปลี่ยนเป็น checked-in และบันทึกเวลาเช็คอิน
- บล็อกการ check-in ที่ไม่ชำระเงิน/ซ้ำ/ถูกยกเลิก ได้ถูกต้อง
- เฉพาะ Owner/Manager/Reception เท่านั้นที่เห็นและใช้ปุ่ม check-in
- กรณี concurrent check-in จัดการอย่างปลอดภัยไม่ซ้ำซ้อน
