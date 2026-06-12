---
id: SHR-009
screen: Empty State
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-009 · Empty State

> _Shared UI component spec — สถานะ "ยังไม่มีข้อมูล" ใช้ร่วมกันทุกแอป_

## Objective
- สื่อสารเมื่อหน้า/รายการยังไม่มีข้อมูล อย่างเป็นมิตร ไม่ทำให้ผู้ใช้สับสน
- ชี้นำ action ถัดไป (สร้าง/จอง/ลองค้นใหม่)
- แทนที่พื้นที่ว่างเปล่าด้วยข้อความที่มีประโยชน์

## User Story
> As a **user**, I want **รู้ว่าทำไมหน้านี้ว่างและควรทำอะไรต่อ**, so that **เริ่มต้นใช้งานต่อได้โดยไม่คิดว่าระบบพัง**.

## Entry Point
N/A — shared component · แสดงในรายการที่ไม่มีข้อมูล เช่น ไม่มีการจอง, ผลค้นหาว่าง, ตะกร้าว่าง

## Exit Point
N/A — shared component · กด CTA เพื่อไป action ที่จอกำหนด (เช่น "จองสนาม", "ล้างตัวกรอง")

## Components
- Variants: No data (ครั้งแรก), No search result, Cleared/done (เช่น งานหมดแล้ว)
- โครงสร้าง: illustration/icon · หัวข้อสั้น · คำอธิบาย 1 บรรทัด · ปุ่ม CTA (ออปชัน)
- CTA ใช้ Button (SHR-001) Primary `#16A34A`
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · โทนภาพกลาง ไม่ใช่สีเตือน

## Validation Rules
- ข้อความบอกสาเหตุ + ทางออก ไม่ใช่แค่ "ไม่มีข้อมูล"
- กรณีค้นหาว่าง เสนอให้ปรับคำค้น/ล้างตัวกรอง
- Do: ใส่ CTA เมื่อมี action ที่ทำได้ · Don't: ใช้สี/ไอคอน error สื่อความว่าง

## API Dependencies
N/A — presentational · ตัดสินใจแสดงจากผลลัพธ์ list ที่ว่างของจอที่ใช้

## Edge Cases
- first-use empty (ยังไม่เคยมีข้อมูล) vs filtered empty (กรองแล้วไม่เจอ) ใช้ข้อความต่างกัน
- loading — ต้องแสดง Loading State (SHR-010) ก่อน อย่าโชว์ empty ระหว่างโหลด
- error — ใช้ Error State (SHR-011) แทน ไม่ใช่ empty
- ไม่มีสิทธิ์ดูข้อมูล — แสดงข้อความ/CTA ที่เหมาะกับ role

## Success Criteria
- ทุกแอปใช้ empty-state component ชุดเดียวกัน ใช้ซ้ำได้ทุก list
- ข้อความ + CTA เข้าใจง่าย, contrast ผ่าน AA, ปุ่ม touch target ≥ 44px
- แยกชัดจาก loading และ error ไม่ทำให้ผู้ใช้เข้าใจผิดว่าระบบมีปัญหา
