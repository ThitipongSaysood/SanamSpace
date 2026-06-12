---
id: CUS-BOOK-001
screen: Create Booking
module: Booking
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-BOOK-001 · Create Booking

## Objective
- ให้ลูกค้าเลือก วันที่ → คอร์ท → ช่วงเวลา (time slot) แล้วยืนยันสรุปการจอง ก่อนไปชำระเงิน
- ครอบคลุม Booking Flow ขั้น 4 (Date) → 5 (Time) → 6 (Summary) ของจอเดียว ต่อจากการเลือกกีฬา/สนาม/คอร์ท
- ป้องกันการจองซ้ำ (double-booking) และจองช่วงเวลาที่ไม่ว่าง

## User Story
> As a **Customer**, I want **เลือกวันที่และช่วงเวลาของคอร์ทที่ว่างแล้วยืนยันการจอง**, so that **ได้สิทธิ์ใช้สนามตามเวลาที่ต้องการและไปชำระเงินต่อได้ทันที**.

## Entry Point
- จากจอ Court Detail (CUS-COURT-003) กดปุ่ม "จอง"
- Deep link / LINE Rich Menu → เปิดจองสนามโดยตรง (pre-select branch/court ถ้ามี)

## Exit Point
- สำเร็จ (ยืนยันสรุป) → CUS-PAY-001 (Payment / Upload Slip)
- ยกเลิก/ย้อนกลับ → CUS-COURT-003 (Court Detail) โดยไม่สร้าง booking
- กรณีล็อก slot แล้วชำระไม่ทัน → ปล่อย hold กลับมาที่ CUS-BOOK-001

## Components
- Date Picker แบบปฏิทินเดือน: วันที่ที่เลือกไฮไลต์สีเขียว, วันที่ผ่านมา/เต็มถูก disable
- รายการคอร์ท (court 1–4) แบบ single-select (radio) + ปุ่ม "ตกลง"
- Time Slot Grid: ช่อง 08:00–22:00 (รายชั่วโมง) พร้อม legend สถานะ — ว่าง (เขียว) / ไม่ว่าง / เต็ม
- Booking Summary card: ชื่อคอร์ท, สนาม (เช่น EVERYDAY BADMINTON), วันที่ (เช่น เสาร์ 25 พ.ค. 2567), ช่วงเวลา (18:00–19:00), ราคา (เช่น ฿225)
- ปุ่มหลัก "ยืนยันการจอง" / ปุ่มรอง "ย้อนกลับ"

## Validation Rules
- ต้องเลือก วันที่ + คอร์ท + อย่างน้อย 1 slot ก่อนกดยืนยัน
- เลือกได้เฉพาะ slot สถานะ "ว่าง" เท่านั้น (กด slot เต็ม/ไม่ว่างไม่ได้)
- ระยะเวลาขั้นต่ำ 1 ชั่วโมง (1 slot) — สูงสุดตามนโยบายสนาม (ค่าเริ่มต้น 4 ชั่วโมงต่อการจอง)
- หลายช่วงเวลาต้องต่อเนื่องกัน (ห้ามข้าม slot) ภายในคอร์ทเดียว/วันเดียว
- จองล่วงหน้าได้ภายในหน้าต่างที่สนามตั้ง (เช่น วันนี้–30 วัน) และไม่จองย้อนหลัง/เวลาที่ผ่านไปแล้ว

## API Dependencies
- `GET /api/v1/courts/{id}/schedules` — โหลดสถานะ slot ว่าง/ไม่ว่างตามวันที่ที่เลือก
- `GET /api/v1/courts/{id}` — ข้อมูลคอร์ท/ราคา สำหรับ summary
- `POST /api/v1/bookings` — สร้างการจอง (hold) เมื่อกดยืนยัน
- `GET /api/v1/bookings/{id}` — อ่านสถานะ booking ที่เพิ่งสร้างก่อนส่งไปชำระเงิน

## Edge Cases
- Slot ถูกจองโดยคนอื่นพร้อมกัน (race): `POST /bookings` คืน 409 → แสดง toast "ช่วงเวลานี้เพิ่งถูกจอง" + รีเฟรช grid
- ไม่มี slot ว่างในวันที่เลือก → empty state พร้อมแนะนำวันถัดไป / (Business+ เท่านั้น) ปุ่ม "เข้าคิว Waitlist"
- โหลด schedule ช้า/ล้มเหลว → skeleton + ปุ่ม "ลองใหม่"
- ออฟไลน์/หลุดเน็ตระหว่างยืนยัน → คง state ที่เลือกไว้, แสดงข้อความให้ลองอีกครั้ง
- เกิน limit แพ็กเกจสนาม (Monthly Bookings) → แจ้งเตือนจากฝั่งสนาม (ไม่บล็อกลูกค้าโดยตรง)

## Success Criteria
- เลือกวัน+คอร์ท+slot ว่างได้ครบ แล้วกดยืนยันสร้าง booking สถานะ pending_payment สำเร็จ
- slot ไม่ว่างถูก disable และกดไม่ได้ 100%
- กรณี double-booking concurrent ระบบปฏิเสธ booking ที่สองและแจ้งผู้ใช้อย่างชัดเจน
- summary แสดงราคาตรงกับ schedule และนำผู้ใช้เข้าสู่ CUS-PAY-001 ได้
