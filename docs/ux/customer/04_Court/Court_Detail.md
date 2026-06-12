---
id: CUS-COURT-002
screen: Court Detail
module: Court
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-COURT-002 · Court Detail

## Objective
แสดงสเปกของคอร์ทที่เลือก (ประเภทสนาม, พื้นสนาม, ระบบแสง, ความสูง, มาตรฐาน) พร้อมราคา เพื่อให้ลูกค้ายืนยันรายละเอียดก่อนเลือกเวลาจอง

## User Story
> As a **Customer**, I want **ดูสเปกและราคาของคอร์ทที่เลือก**, so that **มั่นใจว่าคอร์ทตรงความต้องการก่อนเลือกเวลาและจอง**.

## Entry Point
- CUS-COURT-001 (Court List) → แตะการ์ดคอร์ท
- CUS-VENUE-002 (Venue Map) → แตะคอร์ทบนผัง

## Exit Point
- กด "จองสนาม" → CUS-COURT-003 (Schedule) เพื่อเลือกช่วงเวลา
- กด Back → CUS-COURT-001 (Court List)

## Components
- ภาพคอร์ท + ชื่อ "Court 1"
- รายการสเปก (Court Specification):
  - ประเภทสนาม: แบดมินตัน
  - พื้นสนาม: PVC
  - ระบบแสง: LED
  - ความสูง: 12 เมตร
  - มาตรฐาน: BWF
- ราคาเริ่มต้น/ชั่วโมง
- ปุ่ม CTA "จองสนาม" (sticky)

## Validation Rules
- คอร์ทต้อง status = active จึงแสดงปุ่ม "จองสนาม" เป็น enabled
- ฟิลด์สเปกที่ไม่มีค่า (เช่น court_type_id NULL) → ซ่อนแถวนั้น

## API Dependencies
- GET /api/v1/courts/{id} — สเปกคอร์ท (floor_type, ceiling_height, lighting_type, court_type, base_price)
- GET /api/v1/courts/{id}/schedules — ช่วงเวลาเปิดให้จอง (ใช้ต่อในขั้น Schedule)

## Edge Cases
- คอร์ท maintenance/closed → ปุ่ม disabled + ข้อความ "คอร์ทปิดชั่วคราว"
- ไม่มีรูปคอร์ท → แสดง placeholder
- โหลดสเปกล้มเหลว → Error State + ปุ่มลองใหม่

## Success Criteria
- แสดงสเปก (พื้น PVC, ความสูง 12 ม., แสง LED, มาตรฐาน BWF) ตรงกับ GET /courts/{id}
- กด "จองสนาม" แล้วไป CUS-COURT-003 พร้อม court_id
- แสดงราคาเริ่มต้นถูกต้องตาม base_price
