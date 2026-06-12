---
id: OWN-COURT-003
screen: Court Availability
module: Court
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-COURT-003 · Court Availability

## Objective
- กำหนดตารางเวลาเปิด-ปิดและช่วงเวลาที่จองได้ของแต่ละสนาม (schedule)
- ตั้งราคาตามช่วงเวลา (peak/off-peak) และวันในสัปดาห์
- ควบคุม availability ที่เป็นฐานของการจอง

## User Story
> As an **Owner/Manager**, I want **ตั้งช่วงเวลาว่างและราคาของสนาม**, so that **ลูกค้าจองได้เฉพาะช่วงที่เปิดและคิดราคาตามช่วงเวลาได้ถูกต้อง**.

## Entry Point
- คลิก "ตั้งเวลาว่าง" จาก Court List (OWN-COURT-001)
- ลิงก์จาก Court Form (OWN-COURT-002) หลังบันทึกสนาม

## Exit Point
- บันทึกตารางสำเร็จ → กลับ Court List (OWN-COURT-001) พร้อม toast
- ยกเลิก → กลับหน้าก่อนหน้าโดยไม่บันทึก

## Components
- ตัวเลือกสนาม (court selector) + แสดงชื่อสนามที่กำลังตั้งค่า
- Weekly schedule grid: กำหนดเวลาเปิด-ปิดต่อวัน (จ.–อา.)
- การตั้ง time slot + ราคา peak/off-peak ต่อช่วงเวลา
- ปุ่มคัดลอกตารางไปวันอื่น / ทั้งสัปดาห์
- ปุ่ม "บันทึก" / "ยกเลิก"

## Validation Rules
- เวลาเปิดต้องก่อนเวลาปิด; ช่วงเวลาห้ามทับซ้อนกันเอง
- ราคาในแต่ละช่วง: ตัวเลข ≥ 0
- ผูก `court_id` ที่อยู่ในสาขา/tenant เดียวกันเท่านั้น
- ห้ามแก้ตารางในช่วงที่มี booking ยืนยันแล้วจนเกิด conflict

## API Dependencies
- `GET /api/v1/courts/{id}/schedules` — โหลดตารางเวลาปัจจุบันของสนาม
- `POST /api/v1/courts/{id}/schedules` — บันทึก/อัปเดตตารางเวลา
- `GET /api/v1/courts/{id}` — ข้อมูลสนามที่กำลังตั้งค่า

## Edge Cases
- Empty: สนามยังไม่มีตาราง → แสดง template ว่างให้เริ่มตั้งค่า
- Overlap slot: ช่วงเวลาทับกัน → inline error และบล็อกบันทึก
- Conflict กับ booking: มีจองในช่วงที่จะปิด → เตือนและไม่ให้ลบช่วงนั้น
- Permission denied: Reception = View → อ่านได้แต่แก้ไม่ได้
- Loading/Save: skeleton ตอนโหลด, ปุ่มบันทึก disable ระหว่างเซฟ
- API error → error banner + retry

## Success Criteria
- ตารางเวลาเปิด-ปิดและราคาบันทึกถูกต้องและสะท้อนใน slot การจอง
- ระบบบล็อกช่วงเวลาทับซ้อนและ conflict กับ booking ที่มีอยู่
- เฉพาะ Owner/Manager ที่แก้ไขได้; Reception อ่านอย่างเดียว
