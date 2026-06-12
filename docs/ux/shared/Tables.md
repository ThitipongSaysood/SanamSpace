---
id: SHR-003
screen: Tables
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-003 · Tables

> _Shared UI component spec — ตารางแสดงข้อมูลแบบ list ใช้ร่วมกันทุกแอป_

## Objective
- แสดงข้อมูลหลายรายการแบบมีคอลัมน์ (รายการจอง, ผู้ใช้, ธุรกรรม)
- รองรับการเรียง/กรอง/แบ่งหน้า เพื่ออ่านและจัดการง่าย
- คงรูปแบบหัวตาราง/แถวให้สม่ำเสมอ

## User Story
> As a **user**, I want **ตารางที่เรียงและกรองข้อมูลได้**, so that **หารายการที่ต้องการได้เร็วและไม่ตกหล่น**.

## Entry Point
N/A — shared component · ใช้บนจอ Bookings, Customers, Payments, Reports (ฝั่ง Owner/Admin)

## Exit Point
N/A — shared component · คลิกแถวเพื่อไปจอรายละเอียดที่จอนั้นกำหนด

## Components
- Header row (มี sort indicator), data rows, divider เส้นเทาอ่อน
- Pagination หรือ infinite scroll, จำนวนแถวต่อหน้า
- Filter/Search bar, bulk-select (checkbox), row actions (ปุ่ม/เมนู)
- Status badge ในเซลล์ (สำเร็จ `#16A34A` / รอ `#F59E0B` / ยกเลิก `#EF4444`)
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · มือถือ → card list แทนตาราง

## Validation Rules
- คอลัมน์สำคัญต้องเห็นก่อน (ชื่อ, สถานะ, วันที่, จำนวนเงิน)
- ตัวเลข/เงินจัดชิดขวา, วันที่รูปแบบเดียวทั้งระบบ
- Do: sticky header เมื่อ scroll · Don't: ยัดคอลัมน์เกินจอจนต้องเลื่อนซ้ายขวามาก

## API Dependencies
- Data-driven — ดึง list + pagination/sort/filter params จาก endpoint ของจอที่ใช้ (ref: structure/API_Specification_v1.md)

## Edge Cases
- default / hover (เน้นแถว) / selected row
- loading — skeleton rows
- empty — Empty State (SHR-009) "ยังไม่มีข้อมูล"
- error — แถบ error + ปุ่มลองใหม่
- overflow — ข้อความยาวตัด ellipsis, ตัวเลขมาก format ให้อ่านง่าย

## Success Criteria
- ทุกแอปใช้ table component เดียวกัน หัว/แถวตรงกัน
- อ่านง่ายบนมือถือ (ยุบเป็น card), contrast ผ่าน AA
- sort/filter/pagination ทำงานสม่ำเสมอและ a11y เข้าถึงได้
