---
id: SHR-002
screen: Forms
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-002 · Forms

> _Shared UI component spec — ฟอร์มและ field มาตรฐาน ใช้ร่วมกันทุกแอป_

## Objective
- ให้ชุด input มาตรฐานสำหรับกรอก/แก้ไขข้อมูล (โปรไฟล์, จอง, ตั้งค่า)
- แสดง label, helper, error สม่ำเสมอ
- ลดความผิดพลาดในการกรอกด้วย validation ที่ชัดเจน

## User Story
> As a **user**, I want **ฟอร์มที่บอกชัดว่าต้องกรอกอะไรและผิดตรงไหน**, so that **กรอกได้ถูกตั้งแต่ครั้งแรกโดยไม่งง**.

## Entry Point
N/A — shared component · ใช้บนจอ Login, Profile, Booking, Settings, Modal

## Exit Point
N/A — shared component · ส่งค่ากลับให้จอ submit แล้วแสดงผลต่อ

## Components
- Field types: text, number, email/tel, password, textarea, select/dropdown, checkbox, radio, toggle, search
- โครงสร้าง field: label + input + helper text + error message
- Label มี `*` แดงเมื่อ required
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · focus ring `#16A34A` · error `#EF4444`
- Sizes: sm / md (ค่าเริ่มต้น) / lg · เต็มความกว้างบนมือถือ

## Validation Rules
- ระบุ required field ด้วยเครื่องหมาย `*`
- Validate ตอน blur และตอน submit; แสดง error ใต้ field นั้น
- ข้อความ error สั้น บอกวิธีแก้ (เช่น "กรอกเบอร์ 10 หลัก")
- Do: group field ที่เกี่ยวกัน · Don't: ใช้ placeholder แทน label

## API Dependencies
N/A — presentational · การ submit/บันทึกขึ้นกับจอที่นำไปใช้ (ref: structure/API_Specification_v1.md)

## Edge Cases
- default / hover / focus (ring เขียว) / disabled (จาง กรอกไม่ได้)
- loading — ล็อก field + ปุ่ม submit ระหว่างบันทึก
- error — ขอบ/ข้อความแดง `#EF4444`, scroll ไป field แรกที่ผิด
- empty (read-only) — แสดง "—" หรือ placeholder จาง

## Success Criteria
- ทุกแอปใช้ field component ชุดเดียวกัน
- Touch target ≥ 44px, label ผูกกับ input (a11y), contrast ผ่าน AA
- error อ่านง่ายและชี้จุดที่ต้องแก้ได้ทันที
