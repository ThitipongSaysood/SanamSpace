---
id: SHR-006
screen: Date Picker
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-006 · Date Picker

> _Shared UI component spec — ตัวเลือกวันที่/ช่วงวันที่ ใช้ร่วมกันทุกแอป_

## Objective
- ให้เลือกวันที่ (หรือช่วงวันที่) ได้ง่ายและถูกต้อง
- ใช้เลือกวันจอง, ตัวกรองรายงาน, วันหมดอายุแพ็กเกจ
- คุมขอบเขตวันที่ที่เลือกได้ (min/max, วันที่ปิด)

## User Story
> As a **user**, I want **เลือกวันจากปฏิทินที่อ่านง่าย**, so that **เลือกวันได้ถูกโดยไม่ต้องพิมพ์เอง**.

## Entry Point
N/A — shared component · เปิดจาก input/ปุ่มบนจอ Booking, Reports filter, Package

## Exit Point
N/A — shared component · เลือกวันแล้วส่งค่ากลับให้ field/จอที่เรียกใช้

## Components
- Variants: Single date, Date range, Month/Year quick jump
- Trigger input (แสดงวันที่ + ไอคอนปฏิทิน) + popover ปฏิทิน
- Grid วันในเดือน, ปุ่มเลื่อนเดือน, ปุ่มลัด "วันนี้"
- วันที่เลือก/ช่วง highlight เขียว `#16A34A`; วันนี้มี marker
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · รองรับ พ.ศ./ค.ศ. ตามตั้งค่าระบบ

## Validation Rules
- บังคับช่วงด้วย min/max (เช่น จองได้ไม่ย้อนหลัง)
- range: วันสิ้นสุดต้อง ≥ วันเริ่ม
- Do: แสดงรูปแบบวันที่เดียวกันทั้งระบบ · Don't: ให้เลือกวันที่ disabled

## API Dependencies
- ส่วนใหญ่ presentational; อาจดึงรายการวันที่ปิด/วันเต็มจาก endpoint ของจอที่ใช้ (ref: structure/API_Specification_v1.md)

## Edge Cases
- default / hover วัน / focus (คีย์บอร์ดเลื่อนวันได้)
- disabled dates — วันก่อน min / หลัง max / วันปิด แสดงจาง เลือกไม่ได้
- loading — ระหว่างโหลดวันปิด แสดง skeleton/ปิดชั่วคราว
- error — เลือกวันไม่ถูกต้องแสดงข้อความใต้ field `#EF4444`
- empty — ยังไม่เลือก แสดง placeholder

## Success Criteria
- ทุกแอปใช้ date picker ชุดเดียวกัน รูปแบบวันที่ตรงกัน
- ใช้งานด้วยคีย์บอร์ด/สกรีนรีดเดอร์ได้, touch target ≥ 44px
- คุม min/max/disabled ได้แม่นยำ ป้องกันเลือกผิด
