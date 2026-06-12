---
id: OWN-MEMBER-002
screen: Membership Plans
module: Membership
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-MEMBER-002 · Membership Plans

## Objective
- สร้างและจัดการแพ็กเกจ/tier สมาชิก (Silver/Gold/Platinum) ของ tenant
- กำหนดสิทธิประโยชน์, ราคา, ระยะเวลา และเงื่อนไข points ของแต่ละ tier
- รองรับ Membership Management ฝั่ง Owner Portal

## User Story
> As an **Owner/Manager**, I want **ตั้งค่าแพ็กเกจและสิทธิประโยชน์ของสมาชิกแต่ละ tier**, so that **เสนอแพ็กเกจสมาชิกที่ชัดเจนและคิดสิทธิประโยชน์/points ได้ถูกต้อง**.

## Entry Point
- คลิก "จัดการแพ็กเกจสมาชิก" จาก Membership List (OWN-MEMBER-001)

## Exit Point
- บันทึกสำเร็จ → กลับ Membership List (OWN-MEMBER-001) พร้อม toast
- ยกเลิก → กลับหน้าก่อนหน้าโดยไม่บันทึก

## Components
- รายการ tier (การ์ด): Silver/Gold/Platinum พร้อมราคา, ระยะเวลา, สิทธิประโยชน์
- Form แต่ละ tier: ชื่อ tier, ราคา, ระยะเวลา (เดือน), อัตรา points, ส่วนลด/สิทธิพิเศษ
- ปุ่ม "เพิ่ม tier" / แก้ไข / เปิด-ปิดใช้งาน tier
- ปุ่ม "บันทึก" / "ยกเลิก"
- Banner gating หาก plan ไม่รองรับ

## Validation Rules
- ฟีเจอร์เปิดเฉพาะ plan Business ขึ้นไป (Membership + Membership Tier + Points = Business+)
- ชื่อ tier: required, ไม่ซ้ำภายใน tenant
- ราคา/ระยะเวลา/อัตรา points: ตัวเลข ≥ 0, ระยะเวลา ≥ 1 เดือน
- ผูก `organization_id`; ห้าม cross-tenant

## API Dependencies
- `GET /api/v1/memberships` — โหลดแพ็กเกจ/tier ที่มีอยู่
- `POST /api/v1/memberships` — สร้าง/อัปเดตแพ็กเกจสมาชิก

## Edge Cases
- Plan gating: Starter → หน้าถูก lock + แนะนำอัปเกรดเป็น Business
- Validation error: inline error ใต้ field ที่ผิด
- Duplicate tier name → error "ชื่อ tier นี้มีอยู่แล้ว"
- Tier ที่มีสมาชิกใช้งานอยู่ → เตือนก่อนปิด/แก้ไขเงื่อนไขสำคัญ
- Permission denied: Reception/Cashier/Marketing/Viewer = View → form อ่านอย่างเดียว; Owner/Manager แก้ไขได้
- Loading/Save: skeleton + ปุ่มบันทึก disable ระหว่างเซฟ
- API error → error banner + คงค่าที่กรอก

## Success Criteria
- สร้าง/แก้ไข tier และสิทธิประโยชน์ได้ และสะท้อนในแพ็กเกจที่ลูกค้าเห็น
- Validation บล็อกข้อมูลไม่ครบ/ซ้ำ
- หน้าถูก lock อย่างถูกต้องบน plan Starter
- เฉพาะ Owner/Manager ที่แก้ไขได้
