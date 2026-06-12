---
id: SHR-001
screen: Buttons
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-001 · Buttons

> _Shared UI component spec — ปุ่ม (Button) ใช้ร่วมกันทุกแอป (Customer / Owner / Admin)_

## Objective
- ให้ปุ่มมาตรฐานสำหรับ trigger action หลัก (จอง / ยืนยัน / บันทึก / ยกเลิก)
- ลำดับความสำคัญของ action ชัดเจนผ่าน variant
- คงความสม่ำเสมอของสไตล์ทั้งระบบ

## User Story
> As a **user**, I want **ปุ่มที่บอกได้ทันทีว่าอันไหนคือ action หลัก**, so that **กดถูกปุ่มและทำงานเสร็จเร็วขึ้น**.

## Entry Point
N/A — shared component · ใช้บนทุกจอ เช่น Booking, Payment, Form, Modal

## Exit Point
N/A — shared component · trigger action แล้วคืน control กลับให้จอที่เรียกใช้

## Components
- Variants
  - Primary — พื้น `#16A34A`, ตัวอักษรขาว (action หลัก: จอง/ยืนยัน/บันทึก)
  - Secondary — เส้นขอบ `#16A34A` พื้นขาว ตัวอักษรเขียว (action รอง)
  - Ghost — ไม่มีพื้น/ขอบ ตัวอักษรเทา-เขียว (action เบา เช่น "ดูเพิ่ม")
  - Danger — พื้น `#EF4444` ตัวอักษรขาว (ลบ/ยกเลิกถาวร)
- Sizes: sm (32px) · md (40px) · lg (48px) · full-width บนมือถือ
- รองรับ icon ซ้าย/ขวา, มุมโค้ง (rounded), เงาเบา
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · Primary `#16A34A` · Danger `#EF4444`

## Validation Rules
- 1 จอมี Primary button เด่นได้ที่เดียวต่อ 1 บริบท
- ข้อความปุ่มเป็นคำกริยา สั้น กระชับ (เช่น "ยืนยันการจอง")
- Do: ใช้ Danger เฉพาะ destructive action เท่านั้น
- Don't: ใช้สีอื่นนอก token / ปุ่มยาวเกินจนตัด 2 บรรทัด

## API Dependencies
N/A — presentational · ตัว action ที่ปุ่มเรียกขึ้นกับจอที่นำไปใช้

## Edge Cases
- default / hover (เข้มขึ้น ~10%) / focus (ring เขียว) / active (กด)
- disabled — ทึบ จาง กดไม่ได้
- loading — แสดง spinner + ล็อกปุ่มกันกดซ้ำ
- error — คืนสถานะปกติ ให้ผู้ใช้กดใหม่ได้

## Success Criteria
- ทุกแอปเรียกใช้ component เดียวกัน สไตล์ตรงกัน
- Touch target ≥ 44px, contrast ตัวอักษร/พื้นผ่าน WCAG AA
- โฟกัสด้วยคีย์บอร์ดได้ และมี state ครบทุกแบบ
