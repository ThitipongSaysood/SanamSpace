---
id: OWN-SET-001
screen: General Settings
module: Settings
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-SET-001 · General Settings

## Objective
- จัดการข้อมูลทั่วไปขององค์กร (ชื่อ, ข้อมูลติดต่อ, ภาษี, เขตเวลา, สกุลเงิน)
- ตั้งค่าระดับ organization ที่ใช้ร่วมกันทุกสาขา
- เป็นจุดตั้งต้นสู่ Branding และ Branch Settings

## User Story
> As an **Owner**, I want **แก้ไขข้อมูลทั่วไปขององค์กร**, so that **ข้อมูลธุรกิจ เอกสาร และใบกำกับภาษีถูกต้องทั้งระบบ**.

## Entry Point
- เมนู Settings → General จาก sidebar

## Exit Point
- ไปแท็บ Branding (OWN-SET-002)
- ไปแท็บ Branch Settings (OWN-SET-003)
- บันทึกสำเร็จ → คงอยู่หน้าเดิมพร้อม toast ยืนยัน

## Components
- ฟอร์มข้อมูลองค์กร: ชื่อองค์กร, อีเมล, เบอร์โทร, ที่อยู่
- ข้อมูลภาษี: เลขผู้เสียภาษี, ชื่อสำหรับใบกำกับภาษี
- ค่าทั่วไป: เขตเวลา, สกุลเงิน, ภาษา
- ปุ่ม "บันทึก"
- แท็บ/ลิงก์ไป Branding, Branch Settings

## Validation Rules
- ชื่อองค์กรเป็น required
- อีเมล/เบอร์โทรต้องถูกฟอร์แมต
- เลขผู้เสียภาษีตามรูปแบบที่กำหนด (ถ้ากรอก)
- ผูกกับ `organization_id`; เฉพาะ Owner เท่านั้นที่แก้ไขได้
- ค่าทั้งหมดเก็บใน organization_settings

## API Dependencies
- `GET /api/v1/organizations/{id}` — ดึงข้อมูลองค์กร/ตั้งค่า
- `PUT /api/v1/organizations/{id}` — บันทึกการแก้ไข

## Edge Cases
- Permission denied: Organization = Full เฉพาะ Owner; Manager = View; role อื่น = None → ซ่อนหน้า/ปุ่มบันทึก
- Validation ผิด → inline error, ไม่ส่ง
- บันทึกไม่สำเร็จ (network) → คงค่าในฟอร์ม + retry
- Concurrent edit โดย Owner คนอื่น → เตือน/รีโหลดค่าใหม่

## Success Criteria
- แก้ไขและบันทึกข้อมูลองค์กรได้ ค่าคงอยู่หลังรีโหลด
- ข้อมูลภาษีถูกใช้ในใบกำกับภาษีอย่างถูกต้อง
- เฉพาะ Owner แก้ไขได้; Manager เห็น read-only
- Validation บล็อกข้อมูลผิดรูปแบบ
