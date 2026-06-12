---
id: OWN-STAFF-002
screen: Staff Form
module: Staff
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-STAFF-002 · Staff Form

## Objective
- สร้างหรือแก้ไขพนักงาน (user) และกำหนด role + สาขาที่รับผิดชอบ
- เชิญพนักงานใหม่เข้าระบบด้วยอีเมล/รหัสผ่าน
- เปิด/ปิดสถานะการใช้งานบัญชี

## User Story
> As an **Owner**, I want **เพิ่ม/แก้ไขพนักงานและกำหนด role ให้**, so that **พนักงานเข้าใช้ระบบด้วยสิทธิ์ที่เหมาะสมกับหน้าที่**.

## Entry Point
- ปุ่ม "เพิ่มพนักงาน" จาก Staff List (OWN-STAFF-001)
- คลิกแถวพนักงาน (โหมดแก้ไข) จาก Staff List (OWN-STAFF-001)

## Exit Point
- บันทึกสำเร็จ → กลับ Staff List (OWN-STAFF-001) + toast
- ยกเลิก → กลับ Staff List (OWN-STAFF-001)
- ลิงก์ "จัดการสิทธิ์ role" → Roles & Permissions (OWN-STAFF-003)

## Components
- ฟอร์ม: ชื่อ, อีเมล, เบอร์โทร, รหัสผ่าน (เฉพาะตอนสร้าง/รีเซ็ต)
- เลือก role (Owner/Manager/Reception/Cashier/Marketing/Coach/Accountant)
- เลือกสาขาที่รับผิดชอบ (multi-branch)
- toggle สถานะ active/inactive
- ปุ่ม "บันทึก" / "ยกเลิก"

## Validation Rules
- ชื่อ, อีเมล, role เป็น required
- อีเมลต้องถูกฟอร์แมตและไม่ซ้ำในองค์กร
- รหัสผ่านตามนโยบายความยาว/ความซับซ้อน (ตอนสร้าง)
- ต้องเลือกอย่างน้อย 1 role
- ผูกกับ `organization_id`; เฉพาะ Owner สร้าง/แก้ไขได้

## API Dependencies
- `POST /api/v1/users` — สร้างพนักงานใหม่
- `GET /api/v1/users` — (โหมดแก้ไข) ดึงข้อมูลพนักงาน (ไม่มี GET /users/{id} ใน spec)
- `GET /api/v1/roles` — รายการ role ให้เลือก
- หมายเหตุ: ไม่มี endpoint update/delete user เฉพาะใน spec

## Edge Cases
- อีเมลซ้ำ → inline error
- รหัสผ่านไม่ผ่านนโยบาย → block
- ลด role ของตัวเอง / ปิดบัญชี Owner คนสุดท้าย → block + เตือน
- Permission denied: ทุก role ยกเว้น Owner = None
- บันทึกไม่สำเร็จ → คงค่าในฟอร์ม + retry

## Success Criteria
- สร้าง/แก้ไขพนักงานและกำหนด role/สาขาได้สำเร็จ
- พนักงานใหม่ล็อกอินด้วยอีเมล/รหัสผ่านได้
- ปิด/เปิดบัญชีมีผลกับการเข้าใช้งานจริง
- เฉพาะ Owner ใช้งานได้ และ validation บล็อกข้อมูลผิด
