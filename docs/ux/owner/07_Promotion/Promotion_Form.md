---
id: OWN-PROMO-002
screen: Promotion Form
module: Promotion
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-PROMO-002 · Promotion Form

## Objective
- สร้างหรือแก้ไขโปรโมชัน (Happy Hour / Flash Promotion / ส่วนลดตามเงื่อนไข)
- กำหนดประเภทส่วนลด, ช่วงเวลา, เงื่อนไข (สนาม/ช่วงเวลา/ขั้นต่ำ), โควตาการใช้
- รองรับ Promotion Management ฝั่ง Owner Portal

## User Story
> As an **Owner/Manager/Marketing**, I want **สร้างและตั้งเงื่อนไขโปรโมชัน**, so that **เปิดแคมเปญส่งเสริมการขายที่คิดส่วนลดและช่วงเวลาได้ถูกต้อง**.

## Entry Point
- คลิก "สร้างโปรโมชัน" จาก Promotion List (OWN-PROMO-001)
- คลิกแถวโปร / ปุ่มแก้ไข จาก Promotion List

## Exit Point
- บันทึกสำเร็จ → กลับ Promotion List (OWN-PROMO-001) พร้อม toast
- ยกเลิก → กลับ Promotion List โดยไม่บันทึก

## Components
- Form fields: ชื่อโปร, ประเภท (% / จำนวนเงิน / Happy Hour), ค่าส่วนลด
- ช่วงเวลาโปร: วันที่/เวลาเริ่ม–สิ้นสุด, วัน/ช่วงเวลาที่ใช้ได้
- เงื่อนไข: สนามที่ร่วม, ยอดขั้นต่ำ, โควตาการใช้รวม/ต่อคน
- Toggle เปิด/ปิดใช้งาน
- ปุ่ม "บันทึก" / "ยกเลิก"

## Validation Rules
- ฟีเจอร์เปิดเฉพาะ plan Business ขึ้นไป
- ชื่อโปร: required, ไม่ซ้ำภายใน tenant
- ค่าส่วนลด: ตัวเลข > 0; แบบ % ต้อง ≤ 100
- วันที่/เวลาเริ่มต้องก่อนสิ้นสุด
- โควตา/ยอดขั้นต่ำ: ตัวเลข ≥ 0
- ผูก `organization_id`; ห้าม cross-tenant

## API Dependencies
- `POST /api/v1/promotions` — สร้างโปรโมชันใหม่
- `GET /api/v1/promotions` — โหลดข้อมูลเดิม/ตรวจชื่อซ้ำ
- `GET /api/v1/courts` — ตัวเลือกสนามที่ร่วมโปร

## Edge Cases
- Plan gating: Starter → บล็อก + แนะนำอัปเกรดเป็น Business
- Validation error: inline error ใต้ field ที่ผิด (เช่น % > 100)
- Duplicate name → error "ชื่อโปรนี้มีอยู่แล้ว"
- โควตาเต็มหรือโปรหมดอายุระหว่างแก้ไข → เตือนสถานะ
- Permission denied: Viewer = View อ่านอย่างเดียว; Manager = Manage; Marketing = Full; role อื่นเข้าไม่ได้
- Loading/Save: ปุ่มบันทึก disable + spinner; คงค่าที่กรอกเมื่อ error
- API error → error banner

## Success Criteria
- สร้าง/แก้ไขโปรและเงื่อนไขสำเร็จ และสะท้อนใน Promotion List
- Validation บล็อกค่าส่วนลด/ช่วงเวลา/ชื่อที่ไม่ถูกต้อง
- หน้าถูก lock อย่างถูกต้องบน plan Starter
- เฉพาะ role ที่มีสิทธิ์ (Owner/Manager/Marketing) ที่บันทึกได้
