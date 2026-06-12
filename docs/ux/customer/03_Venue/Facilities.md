---
id: CUS-VENUE-003
screen: Facilities
module: Venue
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-VENUE-003 · Facilities

## Objective
แสดงรายการสิ่งอำนวยความสะดวกของสนามทั้งหมดพร้อมไอคอนและคำอธิบายสั้น เพื่อให้ลูกค้าประเมินความพร้อมก่อนจอง

## User Story
> As a **Customer**, I want **เห็นสิ่งอำนวยความสะดวกที่สนามมีครบทุกอย่าง**, so that **มั่นใจว่าสนามตอบโจทย์ (เช่น มีที่จอดรถ, คาเฟ่, Wi-Fi) ก่อนตัดสินใจจอง**.

## Entry Point
- CUS-VENUE-001 (Venue Detail) → แตะแถบสิ่งอำนวยความสะดวก "ดูทั้งหมด"

## Exit Point
- กด Back → CUS-VENUE-001 (Venue Detail)

## Components
- หัวข้อ "สิ่งอำนวยความสะดวก"
- รายการแบบ list: ไอคอน + ชื่อ + คำอธิบายสั้น
  - ที่จอดรถ (จอดได้ 50 คัน), ห้องน้ำ/ห้องอาบน้ำ, ล็อกเกอร์, Wi-Fi ฟรี
  - คาเฟ่/เครื่องดื่ม, ร้านอุปกรณ์กีฬา, ห้องพยาบาล, เปลี่ยนชุด/ที่นั่งพัก
- ปุ่ม Back

## Validation Rules
- แสดงเฉพาะ facility ที่ผูกกับ venue (venue_facilities) เท่านั้น
- facility ที่ไม่มีคำอธิบาย → แสดงเฉพาะชื่อ+ไอคอน

## API Dependencies
- GET /api/v1/branches — ดึงข้อมูล venue ที่อ้างอิง
- venue facilities (venue_facilities): — (ยังไม่มี endpoint เฉพาะใน API_Specification_v1)

## Edge Cases
- สนามไม่ระบุสิ่งอำนวยความสะดวก → Empty State "ยังไม่มีข้อมูลสิ่งอำนวยความสะดวก"
- ไอคอน facility โหลดไม่ขึ้น → แสดงไอคอน default
- โหลดล้มเหลว → Error State + ลองใหม่

## Success Criteria
- แสดงรายการ facility ตรงกับที่สนามผูกไว้จริง พร้อมไอคอนถูกต้อง
- กด Back กลับ Venue Detail ได้ราบรื่น
- เลื่อนดูรายการได้ครบทุกรายการ
