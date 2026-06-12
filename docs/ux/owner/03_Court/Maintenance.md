---
id: OWN-COURT-004
screen: Court Maintenance
module: Court
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-COURT-004 · Court Maintenance

## Objective
- แจ้งปิดสนามเพื่อซ่อมบำรุง/ปรับปรุง ในช่วงเวลาที่กำหนด
- บล็อกการจองในช่วง maintenance เพื่อกันการจองทับ
- บันทึกประวัติการปิดปรับปรุงของแต่ละสนาม

## User Story
> As an **Owner/Manager**, I want **ตั้งช่วงปิดซ่อมบำรุงของสนาม**, so that **สนามที่ไม่พร้อมใช้งานถูกบล็อกการจองในช่วงนั้นโดยอัตโนมัติ**.

## Entry Point
- คลิก "แจ้งซ่อม/ปิดปรับปรุง" จาก Court List (OWN-COURT-001)
- ลิงก์จาก Court Availability (OWN-COURT-003)

## Exit Point
- บันทึกช่วง maintenance สำเร็จ → กลับ Court List (OWN-COURT-001) พร้อม toast
- ยกเลิก → กลับหน้าก่อนหน้าโดยไม่บันทึก

## Components
- ตัวเลือกสนาม + แสดงสถานะปัจจุบัน
- ตั้งช่วง maintenance: วันที่/เวลาเริ่ม–สิ้นสุด, เหตุผล/หมายเหตุ
- รายการช่วง maintenance ที่ตั้งไว้ (active/upcoming/past) พร้อมปุ่มยกเลิก
- Toggle สถานะสนามเป็น maintenance ทันที (กรณีปิดด่วน)
- ปุ่ม "บันทึก" / "ยกเลิก"

## Validation Rules
- วันที่/เวลาเริ่มต้องก่อนสิ้นสุด; ช่วง maintenance ห้ามทับซ้อนกันเอง
- เหตุผล/หมายเหตุ: required เมื่อปิดปรับปรุง
- ผูก `court_id` ในสาขา/tenant เดียวกัน
- เตือนหากช่วง maintenance ทับกับ booking ที่ยืนยันแล้ว

## API Dependencies
- `GET /api/v1/courts/{id}` — สถานะและข้อมูลสนาม
- `PUT /api/v1/courts/{id}` — อัปเดตสถานะสนามเป็น maintenance/กำหนดช่วงปิด
- `GET /api/v1/courts/{id}/schedules` — ตรวจช่วงเวลาที่กระทบกับตาราง/การจอง

## Edge Cases
- Conflict กับ booking: มี booking ในช่วงที่จะปิด → เตือนและให้เลือก cancel/แจ้งลูกค้าก่อน
- Overlap: ช่วง maintenance ซ้อนกัน → inline error
- Permission denied: Reception/Viewer = View → ตั้ง maintenance ไม่ได้; Owner/Manager จัดการได้
- Loading/Save: skeleton + ปุ่มบันทึก disable ระหว่างเซฟ
- ช่วง maintenance หมดอายุ → สนามกลับเป็น active อัตโนมัติ
- API error → error banner + retry

## Success Criteria
- ตั้งช่วง maintenance แล้วสนามถูกบล็อกการจองในช่วงนั้น
- ระบบเตือนเมื่อช่วง maintenance ทับกับ booking ที่มีอยู่
- เมื่อพ้นช่วง สนามกลับมาจองได้ตามปกติ
- เฉพาะ Owner/Manager ที่ตั้ง maintenance ได้
