---
id: OWN-COURT-002
screen: Court Form
module: Court
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-COURT-002 · Court Form

## Objective
- สร้างสนามใหม่ หรือแก้ไขข้อมูลสนามที่มีอยู่
- กำหนดข้อมูลพื้นฐาน: ชื่อ, ชนิดกีฬา, ราคา/ชม., สถานะ, รูปภาพ, รายละเอียด
- รองรับ workflow Create Court และ maintenance ของข้อมูลสนาม

## User Story
> As an **Owner/Manager**, I want **เพิ่มหรือแก้ไขข้อมูลสนาม**, so that **สนามถูกตั้งค่าถูกต้องและพร้อมเปิดให้ลูกค้าจอง**.

## Entry Point
- คลิก "เพิ่มสนาม" จาก Court List (OWN-COURT-001)
- คลิกแถวสนาม / ปุ่มแก้ไข จาก Court List

## Exit Point
- บันทึกสำเร็จ → กลับ Court List (OWN-COURT-001) พร้อม toast สำเร็จ
- ยกเลิก → กลับ Court List โดยไม่บันทึก

## Components
- Form fields: ชื่อสนาม, ชนิดกีฬา (badminton/futsal/tennis/pickleball ฯลฯ), ราคา/ชม., สถานะ active/inactive
- Upload รูปภาพสนาม + รายละเอียด/หมายเหตุ
- ตัวเลือกผูกสาขา (branch) — ล็อกเป็นสาขาปัจจุบันสำหรับ single-branch plan
- ปุ่ม "บันทึก" / "ยกเลิก"
- ลิงก์ไป Court Availability (OWN-COURT-003) หลังบันทึก (เฉพาะโหมดแก้ไข)

## Validation Rules
- ชื่อสนาม: required, ไม่ซ้ำภายในสาขาเดียวกัน
- ชนิดกีฬา: required
- ราคา/ชม.: required, เป็นตัวเลข ≥ 0
- โหมด create: บล็อกหากจำนวนสนามถึง limit ของ plan
- ผูก `branch_id`/`organization_id` อัตโนมัติ; ห้าม cross-tenant

## API Dependencies
- `POST /api/v1/courts` — สร้างสนามใหม่
- `PUT /api/v1/courts/{id}` — แก้ไขสนามที่มีอยู่
- `GET /api/v1/courts/{id}` — โหลดข้อมูลเดิมในโหมดแก้ไข

## Edge Cases
- Validation error: แสดง inline error ใต้ field ที่ผิด
- Loading: ปุ่มบันทึก disable + spinner ระหว่างเซฟ
- Permission denied: Reception/Viewer ไม่มีสิทธิ์ create/update → เข้าหน้านี้ไม่ได้ หรือ form อ่านอย่างเดียว
- Duplicate name: ชื่อสนามซ้ำในสาขา → error "ชื่อสนามนี้มีอยู่แล้ว"
- Plan limit (create): บล็อก + แจ้งอัปเกรด plan
- Concurrent edit: สนามถูกแก้โดยคนอื่น → เตือน conflict ก่อนบันทึกทับ
- API error → error banner + คงค่าที่กรอกไว้

## Success Criteria
- บันทึกสนามใหม่/แก้ไขสำเร็จและสะท้อนใน Court List ทันที
- Validation บล็อกข้อมูลไม่ครบ/ไม่ถูกต้อง
- การเพิ่มเกิน limit ของ plan ถูกบล็อก
- เฉพาะ role ที่มีสิทธิ์ create/update เท่านั้นที่บันทึกได้
