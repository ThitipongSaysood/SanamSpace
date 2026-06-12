---
id: SHR-011
screen: Error State
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-011 · Error State

> _Shared UI component spec — สถานะข้อผิดพลาด ใช้ร่วมกันทุกแอป_

## Objective
- สื่อสารเมื่อเกิดข้อผิดพลาด อย่างชัดเจนและไม่ทำให้ตกใจ
- บอกสาเหตุพอเข้าใจ + เสนอทางแก้ (ลองใหม่/กลับ/ติดต่อ)
- รักษาความเชื่อมั่นในระบบแม้เกิดปัญหา

## User Story
> As a **user**, I want **รู้ว่าผิดพลาดอะไรและทำอะไรต่อได้**, so that **แก้ไขหรือลองใหม่ได้โดยไม่หงุดหงิด**.

## Entry Point
N/A — shared component · แสดงเมื่อโหลด/บันทึก/ชำระเงินล้มเหลว, หน้าไม่พบ, หมดสิทธิ์

## Exit Point
N/A — shared component · กด "ลองใหม่" รีโหลด หรือ "กลับ" ไปจอก่อนหน้าที่จอกำหนด

## Components
- Variants: Inline error (ใต้ field/การ์ด), Section error (ทั้งบล็อก), Full-page error (404/500/offline), Toast/Banner
- โครงสร้าง: icon เตือน · หัวข้อ · ข้อความสาเหตุ · ปุ่มแก้ไข (ลองใหม่/กลับ)
- ปุ่มใช้ Button (SHR-001); ระดับวิกฤตใช้สี Danger `#EF4444`, เตือนทั่วไป `#F59E0B`
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter

## Validation Rules
- ข้อความเป็นภาษาคน บอกทางแก้ ไม่โชว์ stack/รหัสดิบให้ผู้ใช้ทั่วไป
- จับคู่ระดับความรุนแรงกับสี (Danger vs Warning) ให้เหมาะ
- Do: ให้ปุ่ม "ลองใหม่" เสมอเมื่อทำได้ · Don't: โทษผู้ใช้/ใช้ศัพท์เทคนิคล้วน

## API Dependencies
N/A — presentational · ทริกเกอร์จาก response error (4xx/5xx/timeout) ของจอที่ใช้

## Edge Cases
- network/offline — แจ้งสัญญาณหลุด + ลองใหม่อัตโนมัติเมื่อกลับมาออนไลน์
- 404/หน้าไม่พบ — full-page + ปุ่มกลับหน้าหลัก
- 403/หมดสิทธิ์ — ข้อความตาม role ไม่ใช่ error ทั่วไป
- validation error — ใช้ inline ใต้ field (อ้างอิง Forms SHR-002)
- error ชั่วคราว — toast หายเองได้; error บล็อกเนื้อหา — คงไว้จนแก้

## Success Criteria
- ทุกแอปใช้ error-state component ชุดเดียวกัน รูปแบบตรงกัน
- ข้อความชัด + มีทางออกเสมอ, แยกจาก loading/empty อย่างชัดเจน
- contrast ผ่าน AA, ปุ่ม touch target ≥ 44px, a11y ประกาศ error (role=alert)
