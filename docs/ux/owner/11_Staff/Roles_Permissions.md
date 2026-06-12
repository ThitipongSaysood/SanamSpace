---
id: OWN-STAFF-003
screen: Roles & Permissions
module: Staff
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-STAFF-003 · Roles & Permissions

## Objective
- แสดงและปรับแต่งสิทธิ์ของแต่ละ role ภายในองค์กร (RBAC)
- กำหนด action (view/create/update/delete/approve/export) ต่อ module ให้ role
- เฉพาะ Owner ปรับแต่งได้ และทุกการเปลี่ยนแปลงถูกบันทึก audit log

## User Story
> As an **Owner**, I want **ดูและปรับสิทธิ์ของแต่ละ role ตาม module**, so that **ควบคุมการเข้าถึงให้เหมาะกับหน้าที่และปลอดภัยต่อ tenant**.

## Entry Point
- เมนู Staff → Roles & Permissions จาก sidebar
- ลิงก์ "จัดการสิทธิ์" จาก Staff List (OWN-STAFF-001) / Staff Form (OWN-STAFF-002)

## Exit Point
- บันทึกสำเร็จ → คงหน้าเดิม + toast
- กลับ Staff List (OWN-STAFF-001)

## Components
- รายการ role: Owner, Manager, Reception, Cashier, Marketing, Coach, Accountant, Viewer
- Permission matrix: module (dashboard/booking/payment/refund/report/analytics/staff ฯลฯ) × action (view/create/update/delete/approve/export)
- Checkbox/toggle ต่อ cell
- ปุ่ม "บันทึก"
- หมายเหตุ role ระบบที่แก้ไม่ได้ (เช่น Super Admin)

## Validation Rules
- เฉพาะ Owner เท่านั้น (Staff = Full เฉพาะ Owner)
- สิทธิ์ทุกอย่าง scoped ตาม `organization_id`; ห้าม cross-tenant
- ห้ามแก้สิทธิ์ Super Admin
- ห้ามถอดสิทธิ์ที่ทำให้ไม่มี Owner เต็มสิทธิ์เหลือในองค์กร
- ทุกการเปลี่ยนแปลงต้องบันทึกลง audit_logs

## API Dependencies
- `GET /api/v1/roles` — รายชื่อ role ขององค์กร
- `GET /api/v1/permissions` — รายการ permission/matrix ปัจจุบัน
- หมายเหตุ: ไม่มี endpoint update role_permissions เฉพาะใน spec (—)

## Edge Cases
- พยายามแก้ role ระบบ → cell ถูก disable
- ถอดสิทธิ์ Owner คนสุดท้าย → block + เตือน
- Permission denied: ทุก role ยกเว้น Owner = None
- Concurrent edit โดย Owner คนอื่น → เตือน/รีโหลด matrix
- บันทึกไม่สำเร็จ → คงค่าที่แก้ + retry

## Success Criteria
- ปรับสิทธิ์ module × action ต่อ role และบันทึกได้ ค่าคงอยู่หลังรีโหลด
- สิทธิ์ที่ปรับมีผลกับการเข้าถึงของพนักงานจริง
- การเปลี่ยนแปลงถูกบันทึก audit log
- เฉพาะ Owner ปรับได้; role ระบบและ cross-tenant ถูกป้องกัน
