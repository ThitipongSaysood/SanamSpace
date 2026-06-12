---
id: CUS-BOOK-002
screen: Booking Confirmation
module: Booking
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-BOOK-002 · Booking Confirmation

## Objective
- ยืนยันต่อลูกค้าว่าการจองสำเร็จ (Booking Flow ขั้น 8) หลังชำระเงิน/อัปโหลดสลิปและผ่านการตรวจสอบ
- แสดงรหัสการจอง (Booking Code) และสรุปรายละเอียดเพื่อให้ลูกค้ามั่นใจและบันทึกไว้อ้างอิง
- เป็นจุดเชื่อมไปยังหน้า QR Check-in และประวัติการจอง

## User Story
> As a **Customer**, I want **เห็นหน้ายืนยันว่าการจองสำเร็จพร้อมรหัสการจอง**, so that **มั่นใจว่าได้สิทธิ์ใช้สนามและรู้ขั้นตอนถัดไปตอนไปถึงสนาม**.

## Entry Point
- จากจอ Payment (CUS-PAY-001) เมื่อชำระ/อัปโหลดสลิปสำเร็จและสถานะ booking = confirmed
- จาก LINE notification "การจองได้รับการยืนยัน" → เปิดหน้านี้

## Exit Point
- กด "ดูรายละเอียดการจอง" → CUS-BOOK-003 (Booking History) หรือ CUS-BOOK-005 (QR Check-in)
- กด "กลับหน้าหลัก" → CUS-HOME-001

## Components
- ไอคอนเครื่องหมายถูกสีเขียว + หัวข้อ "จองสำเร็จ!"
- Booking Code เด่นชัด (เช่น BK240S250012)
- สรุปการจอง: ชื่อคอร์ท, สนาม, วันที่ (เช่น เสาร์ 25 พ.ค. 2567), ช่วงเวลา (18:00–19:00), ยอดชำระ (เช่น ฿225)
- ปุ่มหลัก "ดูรายละเอียดการจอง" / ปุ่มรอง "กลับหน้าหลัก"
- (ทางเลือก) ลิงก์ "บันทึกลงปฏิทิน" / แชร์ใน LINE

## Validation Rules
- แสดงหน้านี้ได้เฉพาะเมื่อ booking มีสถานะ confirmed (หรือ pending_verification ตามนโยบายสนาม) เท่านั้น
- Booking Code ต้องตรงกับ booking ที่สร้างใน CUS-BOOK-001 และไม่ว่าง
- ข้อมูลสรุปต้อง read-only (แก้ไม่ได้จากจอนี้)

## API Dependencies
- `GET /api/v1/bookings/{id}` — ดึงรายละเอียด booking + สถานะ + booking code เพื่อแสดงผล
- `GET /api/v1/payments?booking_id={id}` — ตรวจสถานะการชำระเงินประกอบ (อ้างอิง `GET /payments`)

## Edge Cases
- เข้าหน้านี้แต่ booking ยังเป็น pending_verification (รอแอดมินตรวจสลิป) → แสดงแบดจ์ "รอตรวจสอบการชำระเงิน" แทนเครื่องหมายถูก
- โหลด booking ไม่สำเร็จ/network error → แสดงข้อความ + ปุ่ม "ลองใหม่"
- เปิดหน้านี้ซ้ำจาก deep link หลัง booking ถูกยกเลิก → redirect ไป CUS-BOOK-003 พร้อมสถานะ "ยกเลิกแล้ว"
- สลิปถูก reject ภายหลัง → push แจ้งเตือนและไม่แสดงหน้านี้เป็น "สำเร็จ"

## Success Criteria
- เมื่อ booking confirmed หน้านี้แสดง "จองสำเร็จ!" พร้อม Booking Code ที่ถูกต้องเสมอ
- ปุ่ม "ดูรายละเอียดการจอง" และ "กลับหน้าหลัก" นำทางไปจอที่ถูกต้อง
- สถานะที่ไม่ใช่ confirmed ถูกสะท้อนด้วย UI ที่แตกต่าง (ไม่หลอกว่าสำเร็จ)
