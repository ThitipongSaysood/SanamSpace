---
id: CUS-VENUE-002
screen: Venue Map
module: Venue
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-VENUE-002 · Venue Map

## Objective
แสดงผังสนามแบบ Interactive ให้ลูกค้าเห็นตำแหน่งคอร์ท (C1–C6) และสิ่งอำนวยความสะดวกโดยรอบ พร้อมสถานะว่าง/ไม่ว่างของแต่ละคอร์ท

## User Story
> As a **Customer**, I want **ดูผังสนามว่าคอร์ทไหนอยู่ตรงไหนและว่างหรือไม่**, so that **เลือกคอร์ทที่ถูกใจและกดจองได้จากผังเลย**.

## Entry Point
- CUS-VENUE-001 (Venue Detail) → แตะส่วน "แผนผังสนาม"

## Exit Point
- แตะคอร์ทบนผัง → CUS-COURT-002 (Court Detail) / CUS-COURT-001 (Court List)
- สลับแท็บ "แผนที่" → Google Maps (CUS-VENUE-001 ส่วนแผนที่)
- กด Back → CUS-VENUE-001

## Components
- แท็บสลับ "แผนผัง / แผนที่"
- Interactive Map: กริดคอร์ท C1–C6 แตะได้, สีบอกสถานะ (ว่าง = เขียว / ไม่ว่าง = เทา-แดง)
- จุดสิ่งอำนวยความสะดวกบนผัง: คาเฟ่, ร้านค้า, ทางเข้า/ทางออก, ห้องน้ำ (ชาย/หญิง), Locker, ที่จอดรถ
- Legend อธิบายไอคอน/สี
- Zoom / pan, ปุ่มกลับไปหน้า Venue

## Validation Rules
- ต้องมีข้อมูลผัง (venue map) ของ venue จึงแสดงโหมด Interactive
- คอร์ทที่ status ≠ active แสดงเป็นปิด แตะแล้วไม่ไปหน้าจอง

## API Dependencies
- GET /api/v1/courts?venue_id={id} — รายการคอร์ท + สถานะเพื่อ map ลงผัง
- GET /api/v1/courts/{id}/schedules — เช็คช่วงเวลาว่างของคอร์ทที่เลือก
- venue map layout (map_data): — (ยังไม่มี endpoint เฉพาะใน API_Specification_v1)

## Edge Cases
- ไม่มีข้อมูลผัง → fallback เป็นแผนผังแบบ Simple (รายการคอร์ท) หรือซ่อนแท็บแผนผัง
- แผนที่/ผังโหลดไม่สำเร็จ (map load fail) → Error State + ปุ่มลองใหม่
- ทุกคอร์ทไม่ว่าง → แสดงผังทั้งหมดเป็นสีเทาพร้อมข้อความ "เต็มทุกคอร์ทช่วงนี้"

## Success Criteria
- แสดงคอร์ท C1–C6 พร้อมสีสถานะตรงกับข้อมูลจริง
- แตะคอร์ทที่ว่างแล้วนำไปหน้าจองพร้อม court_id ถูกต้อง
- Legend และจุดสิ่งอำนวยความสะดวกแสดงครบตามผัง
