---
id: OWN-BOOK-001
screen: Booking Calendar
module: Booking
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-BOOK-001 · Booking Calendar

## Objective
- แสดง booking ทั้งหมดของสาขาในรูปแบบปฏิทิน/ตาราง court x time
- ให้ Owner/Manager/Reception เห็นช่องว่าง-ช่องเต็มและจัดการ booking ตามเวลาได้
- เป็นจุดเริ่มสร้าง booking ใหม่และเปิดดู/แก้ booking ที่มีอยู่

## User Story
> As an **Owner/Manager/Reception**, I want **ดูตารางการจองของทุกสนามแบบ time-grid และจัดการได้จากปฏิทิน**, so that **มองเห็น slot ว่าง/เต็มและรับจอง-แก้ไขได้รวดเร็วหน้างาน**.

## Entry Point
- เมนู "Booking" บน sidebar (มุมมองเริ่มต้น = Calendar)
- คลิก "ดูปฏิทิน" จาก Booking Widget (OWN-DASH-004)

## Exit Point
- คลิก booking ในปฏิทิน → Booking Detail (OWN-BOOK-003)
- คลิก slot ว่าง → ฟอร์มสร้าง booking ใหม่
- สลับเป็นมุมมอง list → Booking List (OWN-BOOK-002)

## Components
- Time-grid calendar: คอลัมน์ = court, แถว = ช่วงเวลา (slot)
- Date navigator: เลือกวัน / สัปดาห์, ปุ่มก่อนหน้า-ถัดไป-วันนี้
- Booking block: สีตามสถานะ (confirmed / pending payment / checked-in / cancelled)
- Filters: court, ประเภทกีฬา, สถานะ booking
- View toggle: Day / Week, สลับไป List view
- Legend สีสถานะ + tooltip booking ย่อ

## Validation Rules
- ผูกกับ `branch_id`; ต้องเลือกวันที่/ช่วงเสมอ (ค่าเริ่มต้น = วันนี้)
- สร้าง booking: slot ต้องว่าง ไม่ทับ booking อื่นของ court เดียวกัน (no overlap)
- เวลาเริ่มต้องอยู่ในช่วงเปิดทำการ (court schedule) ของ court นั้น
- เวลาเริ่ม < เวลาสิ้นสุด

## API Dependencies
- `GET /api/v1/bookings` — โหลด booking ตาม branch/วันที่/court
- `GET /api/v1/courts` — รายชื่อ court เป็นคอลัมน์ปฏิทิน
- `GET /api/v1/courts/{id}/schedules` — ช่วงเปิดทำการของแต่ละ court
- `POST /api/v1/bookings` — สร้าง booking ใหม่จาก slot ว่าง
- `PUT /api/v1/bookings/{id}` — ย้าย/แก้เวลา booking
- `POST /api/v1/bookings/{id}/cancel` — ยกเลิก booking

## Edge Cases
- Empty data: วันที่เลือกไม่มี booking → ปฏิทินว่างพร้อมข้อความบอก slot ว่างทั้งหมด
- Loading: skeleton grid ระหว่างโหลด
- Permission denied: Cashier ได้ Booking = View → ดูปฏิทินได้แต่สร้าง/ย้าย/ยกเลิกถูก disable; Reception/Manager จัดการได้ (Manage)
- Concurrent edit: slot ที่เพิ่งถูกจองโดยคนอื่นระหว่างเปิดฟอร์ม → บันทึกแล้วเจอ conflict 409 → แจ้ง "slot ถูกจองแล้ว" และรีเฟรช
- จองทับช่วงเวลา/นอกเวลาเปิด → บล็อกพร้อม error
- API error → toast + retry, คงสถานะปฏิทินเดิม

## Success Criteria
- ปฏิทินแสดง booking ของทุก court ตามวัน/สถานะถูกต้องด้วยสีที่สอดคล้อง
- สร้าง booking จาก slot ว่างสำเร็จและบล็อกการจองทับเวลาได้
- สลับ Day/Week/List และเปลี่ยน filter แล้วข้อมูลอัปเดตถูกต้อง
- Cashier เห็นแบบ read-only; conflict การจองพร้อมกันถูกจัดการอย่างชัดเจน
