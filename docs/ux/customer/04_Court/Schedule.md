---
id: CUS-COURT-003
screen: Schedule
module: Court
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-COURT-003 · Schedule

## Objective
แสดงตารางเวลาว่าง-ไม่ว่างของคอร์ทตามวันที่เลือก ให้ลูกค้าเลือกช่วงเวลาที่ต้องการเพื่อสร้างการจอง

## User Story
> As a **Customer**, I want **เลือกวันและช่วงเวลาที่คอร์ทว่าง**, so that **จองคอร์ทในเวลาที่ต้องการได้สำเร็จ**.

## Entry Point
- CUS-COURT-002 (Court Detail) → กด "จองสนาม"
- CUS-COURT-001 (Court List) → กด "จอง" บนคอร์ท

## Exit Point
- เลือก slot แล้วกด "ถัดไป/จอง" → Create Booking (CUS-BOOKING-xxx)
- กด Back → CUS-COURT-002 (Court Detail)

## Components
- ปฏิทิน/แถบเลือกวันที่ (เลือกได้ตั้งแต่วันนี้)
- กริดช่วงเวลา (time slots) ตามเวลาเปิด-ปิด เช่น 08:00–24:00 ทีละ 1 ชม.
- สีบอกสถานะ slot: ว่าง (เลือกได้) / เต็ม (disabled) / ที่เลือก
- สรุปช่วงเวลาที่เลือก + ราคารวม
- ปุ่ม CTA "จอง / ถัดไป"

## Validation Rules
- ต้องเลือกอย่างน้อย 1 slot ที่ว่างจึงกด "จอง" ได้
- ห้ามเลือกเวลาที่ผ่านมาแล้วของวันนี้
- slot ที่ถูกจอง/ปิด (court_maintenance) → disabled เลือกไม่ได้
- ช่วงเวลาที่เลือกต่อเนื่องตามกฎ min/max ของสนาม

## API Dependencies
- GET /api/v1/courts/{id}/schedules — เวลาเปิด-ปิดและ slot ว่างตามวันที่
- POST /api/v1/bookings — สร้างการจองเมื่อยืนยัน slot

## Edge Cases
- ทุก slot เต็มในวันที่เลือก → ข้อความ "วันนี้เต็มแล้ว" + แนะนำเปลี่ยนวัน
- คอร์ทปิดทั้งวัน (maintenance) → แสดงเป็นปิดทั้งกริด
- slot ถูกจองโดยคนอื่นระหว่างเลือก → แจ้งเตือนและรีเฟรชสถานะ
- โหลดตารางล้มเหลว → Error State + ปุ่มลองใหม่ (คงวันที่ไว้)

## Success Criteria
- แสดง slot ว่าง/เต็มตรงกับ GET /courts/{id}/schedules ตามวันที่เลือก
- เลือก slot แล้วราคารวมคำนวณถูกต้อง
- กด "จอง" แล้วสร้าง booking ผ่าน POST /bookings และไปขั้นถัดไปได้
