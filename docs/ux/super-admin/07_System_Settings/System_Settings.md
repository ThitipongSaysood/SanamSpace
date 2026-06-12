---
id: ADM-SYS-001
screen: System Settings
module: System Settings
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-SYS-001 · System Settings

## Objective
- จัดการการตั้งค่าระดับแพลตฟอร์ม: ค่าเริ่มต้นระบบ, การเชื่อมต่อภายนอก, สิทธิ์/บทบาท, ผู้ดูแล
- เป็นศูนย์รวมการกำหนดค่าที่มีผลข้ามทุก tenant
- ควบคุมการตั้งค่าที่ไม่ขึ้นกับ tenant รายราย

## User Story
> As a **Super Admin**, I want **กำหนดค่าระดับระบบของแพลตฟอร์มในที่เดียว**, so that **ดูแลค่าเริ่มต้น, integration และบัญชีผู้ดูแลได้อย่างเป็นระบบ**.

## Entry Point
- เมนูหลัก Super Admin Portal → "System Settings"

## Exit Point
- บันทึกการตั้งค่า → คงอยู่หน้าเดิมพร้อม toast ยืนยัน
- ออกจากเมนู → กลับ Platform Dashboard (ADM-ANALYTICS-001)

## Components
- Tab "ทั่วไป": ชื่อแพลตฟอร์ม, โลโก้, timezone, สกุลเงิน, ภาษา default
- Tab "Integrations": LINE Messaging API, Email/SMS, Payment (PromptPay/Omise/GB Prime Pay), Storage (Cloudflare R2)
- Tab "Roles & Permissions": บทบาท (Owner, Manager, Reception, Cashier, Marketing, Coach, Accountant) และ permission matrix
- Tab "Admin Users": รายการผู้ดูแลระบบ Super Admin, เพิ่ม/ถอนสิทธิ์
- Tab "Billing Defaults": รอบบิล default, ภาษี, ข้อมูลผู้ออกใบกำกับ
- ปุ่ม "บันทึก" ต่อ section

## Validation Rules
- ค่า required ในแต่ละ section ต้องกรอกครบก่อนบันทึก
- คีย์/credential ของ integration ต้องตรงรูปแบบที่กำหนด
- ภาษี/สกุลเงิน: รูปแบบและช่วงค่าถูกต้อง
- เฉพาะ Super Admin เท่านั้นที่เข้าถึงและบันทึกได้

## API Dependencies
- System settings (get/update) — — (ยังไม่มี endpoint)
- `GET /api/v1/permissions` — ดึง permission ประกอบ matrix
- `GET /api/v1/users` — รายการผู้ดูแลระบบ
- `POST /api/v1/users` — เพิ่มผู้ดูแลระบบ
- `GET /api/v1/roles` — รายการบทบาทสำหรับ Roles & Permissions

## Edge Cases
- Validation ไม่ผ่าน → ไฮไลต์ field และไม่บันทึก section นั้น
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- ทดสอบ integration แล้ว credential ผิด → แสดงผลทดสอบ fail พร้อมเหตุผล
- ถอนสิทธิ์ Super Admin คนสุดท้าย → บล็อก (ต้องเหลืออย่างน้อย 1)
- ออกจากหน้าโดยยังไม่บันทึก → เตือน unsaved changes
- API error → คงค่าในฟอร์ม + retry

## Success Criteria
- บันทึกการตั้งค่าแต่ละ section ได้และมีผลทันที
- เพิ่ม/ถอนสิทธิ์ Admin Users ได้ภายใต้ข้อจำกัด
- ทดสอบการเชื่อมต่อ integration และแสดงผลถูกต้อง
- เฉพาะ Super Admin เข้าถึงและบันทึกได้
