---
id: SHR-004
screen: Cards
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-004 · Cards

> _Shared UI component spec — การ์ดสำหรับห่อกลุ่มข้อมูล ใช้ร่วมกันทุกแอป_

## Objective
- ห่อข้อมูลหนึ่งชุดให้อ่านเป็นกลุ่ม (สนาม, การจอง, แพ็กเกจ, สถิติ)
- จัดลำดับสายตาด้วยรูป + หัวข้อ + เนื้อหา + action
- ใช้แทนตารางบนมือถือ

## User Story
> As a **user**, I want **การ์ดที่สรุปข้อมูลหนึ่งชุดในที่เดียว**, so that **กวาดสายตาเห็นและเลือกได้เร็ว**.

## Entry Point
N/A — shared component · ใช้บน Venue list, Booking list, Dashboard stat, Package, Membership

## Exit Point
N/A — shared component · แตะการ์ด/ปุ่มในการ์ดเพื่อไปจอรายละเอียดที่จอนั้นกำหนด

## Components
- Variants: Basic, Image card (รูปสนาม), Stat card (ตัวเลข KPI), Selectable card (เลือกคอร์ท/แพ็กเกจ)
- ส่วนประกอบ: image/icon · title · subtitle/meta · body · status badge · footer action
- มุมโค้ง, เงาเบา, เส้นขอบบาง; selected เน้นขอบ/พื้นเขียว `#16A34A`
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · badge สถานะตามสีระบบ

## Validation Rules
- 1 การ์ด = 1 ชุดข้อมูล/1 entity เท่านั้น
- title สั้น ไม่เกิน 1–2 บรรทัด, ลำดับ image → title → meta → action
- Do: ระยะ padding สม่ำเสมอทุกใบ · Don't: ยัด action เกิน 2 ปุ่มต่อใบ

## API Dependencies
- Data-driven — เนื้อหาในการ์ดมาจาก list/detail endpoint ของจอที่ใช้ (ref: structure/API_Specification_v1.md)

## Edge Cases
- default / hover (ยกเงา) / focus / selected
- loading — skeleton card
- disabled — จาง แตะไม่ได้ (เช่น คอร์ทเต็ม)
- empty — ซ่อนการ์ดแล้วแสดง Empty State (SHR-009)
- error — แสดง placeholder รูปเสีย / ข้อความผิดพลาดในการ์ด

## Success Criteria
- ทุกแอปใช้ card component ชุดเดียวกัน สไตล์ตรงกัน
- ทั้งใบแตะได้ touch target ≥ 44px, contrast ผ่าน AA
- เรียงเป็น grid/list ได้ยืดหยุ่นทุกหน้าจอ
