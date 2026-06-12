---
id: OWN-BOOK-005
screen: Check Out
module: Booking
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-BOOK-005 · Check Out

## Objective
- บันทึกการสิ้นสุดการใช้สนาม (check-out) ของ booking ที่ check-in แล้ว
- ปิดรอบการใช้สนามและคำนวณค่าใช้จ่ายส่วนเกิน (เกินเวลา/ค่าบริการเพิ่ม) ถ้ามี
- ทำให้ court ว่างพร้อมรับ booking ถัดไปและปิดสถานะเป็น completed

## User Story
> As a **Reception/Manager**, I want **กดเช็คเอาท์เมื่อลูกค้าใช้สนามเสร็จ**, so that **ปิดรอบการใช้งาน เก็บค่าส่วนเกิน และปล่อยสนามให้คิวถัดไปได้**.

## Entry Point
- กดปุ่ม "Check-out" จาก Booking Detail (OWN-BOOK-003) ของ booking ที่ checked-in
- จาก Booking Calendar (OWN-BOOK-001) บน booking ที่กำลังใช้สนาม

## Exit Point
- check-out สำเร็จ → สถานะเป็น completed/checked-out, court ว่าง, กลับ Booking Detail
- หากมีค่าส่วนเกิน → ไปขั้นตอนชำระเงิน/บันทึกยอดเพิ่ม แล้วปิดรายการ
- ยกเลิก → ปิด dialog โดยไม่เปลี่ยนสถานะ

## Components
- Confirm dialog: สรุปเวลาใช้งานจริง (check-in → ปัจจุบัน)
- Overtime/extra charge section: ค่าใช้จ่ายส่วนเกินถ้าเลยเวลา + ยอดรวม
- สถานะการชำระเงินคงค้าง (ถ้ามี)
- ปุ่มยืนยัน check-out / ยกเลิก
- หมายเหตุ (note) ปิดรายการ

## Validation Rules
- booking ต้องอยู่สถานะ checked-in ก่อนจึง check-out ได้
- check-out ได้เฉพาะ booking ของ `branch_id` ที่ user สังกัด
- หากมีค่าส่วนเกินค้างชำระ ต้องบันทึก/เก็บก่อนปิดรายการตามนโยบาย
- เวลา check-out ต้องไม่ก่อนเวลา check-in

## API Dependencies
- `POST /api/v1/bookings/{id}/checkout` — บันทึกการเช็คเอาท์/ปิดรอบ
- `GET /api/v1/bookings/{id}` — โหลด/รีเฟรชสถานะและคำนวณเวลาใช้งาน
- `POST /api/v1/payments` — (option) บันทึกการชำระค่าส่วนเกิน

## Edge Cases
- Booking ยังไม่ check-in → ปุ่ม check-out disable + แจ้งต้อง check-in ก่อน
- Already checked-out / completed → แจ้ง "ปิดรายการแล้ว", ปุ่ม disable
- มียอดค้างชำระ → เตือนก่อนปิด ตามนโยบายสาขา
- Permission denied: role ที่ Check-in = None (Cashier/Marketing/Coach/Accountant/Viewer) → ไม่เห็นปุ่ม/ถูก 403; Owner/Manager/Reception = Full ทำได้
- Concurrent: ถูก check-out โดยคนอื่นพร้อมกัน → request ที่สองคืน 409/แจ้งปิดแล้ว, รีเฟรชสถานะ
- API error → toast error, คงสถานะเดิม

## Success Criteria
- กดยืนยันแล้วสถานะเปลี่ยนเป็น checked-out/completed และบันทึกเวลา
- คำนวณ/แสดงค่าส่วนเกินถูกต้องเมื่อใช้เกินเวลา
- court ว่างพร้อมรับ booking ถัดไปหลัง check-out
- เฉพาะ Owner/Manager/Reception ใช้งานได้; กรณี concurrent/ค้างชำระจัดการถูกต้อง
