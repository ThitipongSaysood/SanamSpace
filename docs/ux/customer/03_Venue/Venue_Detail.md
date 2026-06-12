---
id: CUS-VENUE-001
screen: Venue Detail
module: Venue
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-VENUE-001 · Venue Detail

## Objective
แสดงรายละเอียดสนาม (ภาพ, เรตติ้ง, สิ่งอำนวยความสะดวก, เวลาเปิด-ปิด, ที่ตั้ง) เพื่อให้ลูกค้าตัดสินใจและกดจองได้จากหน้านี้

## User Story
> As a **Customer**, I want **ดูข้อมูลสนามครบในหน้าเดียวก่อนจอง**, so that **มั่นใจว่าสนามตรงความต้องการแล้วจึงกดจองเลย**.

## Entry Point
- CUS-HOME-002 (Venue List) → แตะการ์ดสนาม
- CUS-HOME-001 (Home) / Search / Favorites → แตะสนาม

## Exit Point
- กด "จองสนาม" → CUS-COURT-001 (Court List)
- แตะแกลเลอรี → CUS-VENUE-004 / แผนผัง → CUS-VENUE-002 / สิ่งอำนวยความสะดวก → CUS-VENUE-003
- กด Back → กลับจอก่อนหน้า

## Components
- Hero cover image + ปุ่ม Back / Favorite (หัวใจ)
- ชื่อสนาม "EVERYDAY BADMINTON", badge เรตติ้ง 4.8 ★ (236 รีวิว)
- ที่ตั้ง "บางใหญ่, นนทบุรี" + ระยะ "15 นาทีจาก MRT บางใหญ่"
- แถบไอคอนสิ่งอำนวยความสะดวก (Wi-Fi, ที่จอดรถ, คาเฟ่, ล็อกเกอร์) → ดูทั้งหมด
- เวลาเปิด-ปิด 08:00–24:00, ปุ่มโทร/นำทาง Google Maps
- ส่วน Gallery, Court Specification, รีวิว, Google Maps (embed)
- ปุ่ม CTA "จองสนาม" (sticky ด้านล่าง), Bottom Nav

## Validation Rules
- ต้องมี `venue_id` ที่ status = active จึงแสดงหน้า
- ปุ่ม Favorite ใช้ได้เฉพาะผู้ล็อกอิน — ถ้ายังไม่ล็อกอินให้ไป LINE Login
- เรตติ้ง/จำนวนรีวิวซ่อนเมื่อยังไม่มีรีวิว

## API Dependencies
- GET /api/v1/branches — ข้อมูลสนาม/ที่ตั้ง/เวลาเปิด-ปิด (venue อยู่ภายใต้ branch)
- GET /api/v1/courts?venue_id={id} — จำนวนคอร์ท/ราคาเริ่มต้น
- รีวิว / venue map / facilities: — (ยังไม่มี endpoint เฉพาะใน API_Specification_v1)

## Edge Cases
- ไม่มี cover image → แสดง placeholder
- ไม่มีคอร์ทเปิดให้จอง → ปุ่ม "จองสนาม" disabled + ข้อความ "ยังไม่เปิดให้จอง"
- สนามปิด (status closed/maintenance) → แสดง banner "สนามปิดชั่วคราว"
- โหลดข้อมูลล้มเหลว → Error State + ปุ่มลองใหม่

## Success Criteria
- แสดงชื่อ, เรตติ้ง 4.8★, เวลา 08:00–24:00, ที่ตั้ง, สิ่งอำนวยความสะดวกถูกต้องตาม API
- กด "จองสนาม" แล้วไป CUS-COURT-001 พร้อม venue_id
- โหลดหน้าเสร็จภายใน 2 วินาทีบน 4G
