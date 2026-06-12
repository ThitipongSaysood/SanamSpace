---
id: CUS-COURT-001
screen: Court List
module: Court
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-COURT-001 · Court List

## Objective
แสดงรายการคอร์ททั้งหมดของสนามพร้อมสถานะการใช้งานแบบเรียลไทม์ (ว่าง/กำลังใช้งาน) เพื่อให้ลูกค้าเลือกคอร์ทที่ต้องการจอง

## User Story
> As a **Customer**, I want **เห็นคอร์ททั้งหมดและสถานะว่างของแต่ละคอร์ท**, so that **เลือกคอร์ทที่ว่างและกดจองได้ทันที**.

## Entry Point
- CUS-VENUE-001 (Venue Detail) → กด "จองสนาม"
- CUS-VENUE-002 (Venue Map) → แตะคอร์ทบนผัง

## Exit Point
- แตะคอร์ท → CUS-COURT-002 (Court Detail)
- กด "จอง" บนคอร์ทที่ว่าง → CUS-COURT-003 (Schedule) / Create Booking
- กด Back → CUS-VENUE-001

## Components
- ตัวเลือกวันที่ (date selector) ด้านบน
- การ์ดคอร์ท Court 1–6: ภาพคอร์ท, ชื่อ, สถานะ (● กำลังใช้งาน / ● ว่าง), ช่วงเวลา (เช่น 18:00–20:00), ปุ่ม "จอง"
- แถบช่วงเวลา (time bar) สีบอกสถานะ: ว่าง / บางส่วน / เต็ม พร้อม Legend
- ป้ายราคาเริ่มต้นต่อคอร์ท
- ปุ่ม Back, Bottom Nav

## Validation Rules
- แสดงเฉพาะคอร์ทที่ status = active ของ venue ที่เลือก
- เลือกวันได้ตั้งแต่วันนี้เป็นต้นไป (ห้ามเลือกย้อนหลัง)
- คอร์ท maintenance/closed แสดงแต่ปุ่ม "จอง" disabled

## API Dependencies
- GET /api/v1/courts?venue_id={id} — รายการคอร์ท + ราคาเริ่มต้น + สถานะ
- GET /api/v1/courts/{id}/schedules — ช่วงเวลาว่าง/ไม่ว่างต่อคอร์ทตามวันที่เลือก

## Edge Cases
- ไม่มีคอร์ทในสนาม (no courts available) → Empty State "ยังไม่มีคอร์ทเปิดให้จอง"
- ทุกคอร์ทเต็มในวันที่เลือก → แสดงรายการเป็นสถานะเต็ม + แนะนำเปลี่ยนวัน
- โหลดสถานะล้มเหลว → Error State + ปุ่มลองใหม่ (คงตัวเลือกวันที่ไว้)

## Success Criteria
- แสดงคอร์ท 1–6 พร้อมสถานะและแถบเวลาสีตรงกับข้อมูลจริงตามวันที่เลือก
- เปลี่ยนวันที่แล้วสถานะคอร์ทอัปเดตถูกต้อง
- กด "จอง" บนคอร์ทว่างแล้วไปขั้นตอนจองพร้อม court_id + วันที่
