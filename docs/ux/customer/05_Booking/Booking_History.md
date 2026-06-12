---
id: CUS-BOOK-003
screen: Booking History
module: Booking
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-BOOK-003 · Booking History

## Objective
- ให้ลูกค้าดูประวัติการจองทั้งหมดแบ่งตามสถานะ: กำลังจะถึง (Upcoming) / เสร็จสิ้น (Completed) / ยกเลิก (Cancelled)
- เป็นจุดเข้าถึงการกระทำต่อ booking: เปิด QR Check-in, ยกเลิกการจอง, จองซ้ำ (Rebooking)

## User Story
> As a **Customer**, I want **ดูรายการจองที่ผ่านมาและที่กำลังจะถึงในที่เดียว**, so that **ติดตามนัดหมาย แสดง QR เข้าสนาม หรือยกเลิก/จองซ้ำได้สะดวก**.

## Entry Point
- จาก Bottom Nav / เมนู "การจองของฉัน" บนหน้าหลัก (CUS-HOME-001)
- จาก CUS-BOOK-002 (Confirmation) กด "ดูรายละเอียดการจอง"
- จาก LINE reminder notification

## Exit Point
- กดการ์ดที่ยังไม่ถึงเวลา → CUS-BOOK-005 (QR Check-in)
- กด "ยกเลิกการจอง" → CUS-BOOK-004 (Booking Cancel)
- กด "จองซ้ำ" (Rebooking, Business+) → CUS-BOOK-001 (Create Booking) แบบ pre-filled
- ย้อนกลับ → CUS-HOME-001

## Components
- Tab/Segmented control 3 แท็บ: Upcoming / Completed / Cancelled
- การ์ด booking (list): รูปคอร์ท, ชื่อคอร์ท (เช่น Court 1), วันที่+ช่วงเวลา, ยอด (เช่น ฿225), แบดจ์สถานะ
- ปุ่มต่อการ์ด: "QR Check-in" (เขียว) สำหรับ Upcoming, "ยกเลิกการจอง" (Upcoming ที่อยู่ในหน้าต่างยกเลิก)
- (Business+) ปุ่ม "จองซ้ำ" บนการ์ด Completed
- Empty state ต่อแท็บ + pull-to-refresh + infinite scroll/pagination

## Validation Rules
- จัดกลุ่มอัตโนมัติ: Upcoming = confirmed และเวลายังไม่ถึง/กำลังใช้, Completed = checked_out หรือเลยเวลาแล้ว, Cancelled = cancelled
- ปุ่ม "QR Check-in" แสดงเฉพาะ booking confirmed ที่ยังไม่ถึงเวลาเช็คเอาท์
- ปุ่ม "ยกเลิกการจอง" แสดงเฉพาะเมื่ออยู่ในหน้าต่างยกเลิกตามนโยบายสนาม
- เรียงลำดับ: Upcoming = ใกล้สุดก่อน, Completed/Cancelled = ใหม่สุดก่อน

## API Dependencies
- `GET /api/v1/bookings` — ดึงรายการ booking ของลูกค้า (รองรับ filter ตามสถานะ + pagination)
- `GET /api/v1/bookings/{id}` — เปิดรายละเอียดเมื่อกดการ์ด

## Edge Cases
- ยังไม่เคยจอง → empty state พร้อม CTA "เริ่มจองสนาม" ไป CUS-BOOK-001
- โหลดล้มเหลว/timeout → skeleton list + ปุ่ม "ลองใหม่"
- booking ที่สถานะเปลี่ยนระหว่างเปิดหน้า (เช่น แอดมินยกเลิก) → refresh สะท้อนแบดจ์ใหม่
- รายการจำนวนมาก → โหลดทีละหน้า, ไม่ค้าง
- Rebooking ในแพ็กเกจ Starter (ไม่รองรับ) → ซ่อนปุ่ม "จองซ้ำ"

## Success Criteria
- booking ถูกจัดเข้าแท็บ Upcoming/Completed/Cancelled ถูกต้องตามสถานะและเวลา
- กดการ์ด/ปุ่มแล้วนำทางไป QR Check-in หรือ Cancel ได้ถูกต้อง
- empty state, loading, error แสดงครบทุกแท็บ
- ปุ่ม Rebooking ปรากฏเฉพาะแพ็กเกจ Business ขึ้นไป
