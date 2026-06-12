---
id: SHR-005
screen: Modals
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-005 · Modals

> _Shared UI component spec — กล่อง modal / dialog / bottom sheet ใช้ร่วมกันทุกแอป_

## Objective
- แสดงเนื้อหา/ฟอร์ม/การยืนยันแบบโฟกัสทับจอเดิม โดยไม่ต้องเปลี่ยนหน้า
- กันการกระทำผิดพลาดด้วย confirm dialog
- คงรูปแบบ header/body/footer ให้สม่ำเสมอ

## User Story
> As a **user**, I want **กล่องยืนยัน/กรอกข้อมูลที่เด้งทับจอเดิม**, so that **ทำงานต่อได้โดยไม่หลุดบริบทเดิม**.

## Entry Point
N/A — shared component · เปิดจากปุ่ม/action บนจอ เช่น ยืนยันการจอง, ลบ, แก้ไขด่วน

## Exit Point
N/A — shared component · ปิดด้วยยืนยัน/ยกเลิก/แตะ backdrop แล้วคืน control กลับจอเดิม

## Components
- Variants: Confirm dialog, Form modal, Info/Detail modal, Bottom sheet (มือถือ)
- โครงสร้าง: backdrop (โปร่งดำ) · header (title + ปุ่มปิด X) · body · footer (ปุ่ม action)
- ปุ่ม footer ใช้ Button (SHR-001): Primary ยืนยัน / Secondary หรือ Ghost ยกเลิก / Danger เมื่อ destructive
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · ยืนยัน `#16A34A` · ลบ `#EF4444`

## Validation Rules
- มี action เดียวที่เป็น Primary ต่อ modal
- destructive ต้องมีขั้นยืนยันและเตือนผลกระทบให้ชัด
- Do: ปิดด้วย Esc / แตะ backdrop ได้ (ยกเว้นมีงานค้าง) · Don't: ซ้อน modal หลายชั้น

## API Dependencies
N/A — presentational · ตัว action ภายใน (บันทึก/ลบ) ขึ้นกับจอที่เรียกใช้

## Edge Cases
- default (เปิด/ปิดมี transition)
- loading — ปุ่มยืนยันแสดง spinner + ล็อก modal กันปิด/กดซ้ำ
- error — แสดง error ใน body, ไม่ปิด modal
- empty — body ว่างให้แสดงข้อความ/placeholder
- เนื้อหายาว — body scroll, header/footer คงที่
- โฟกัสถูก trap ภายใน modal

## Success Criteria
- ทุกแอปใช้ modal component ชุดเดียวกัน
- Focus trap + ปิดด้วยคีย์บอร์ดได้, contrast/touch target ผ่าน AA
- backdrop กันคลิกทะลุ และคืนโฟกัสกลับจุดเดิมเมื่อปิด
