---
id: OWN-SET-003
screen: Branch Settings
module: Settings
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-SET-003 · Branch Settings

## Objective
- จัดการสาขา (branch) ขององค์กร: สร้าง/แก้ไข/ปิดสาขา
- ตั้งค่าข้อมูลสาขา (ชื่อ, ที่อยู่, เวลาเปิด-ปิด, ผู้ติดต่อ)
- รองรับ multi-branch ตาม plan (Pro/Enterprise)

## User Story
> As an **Owner/Manager**, I want **จัดการรายการสาขาและตั้งค่าแต่ละสาขา**, so that **ข้อมูลสาขาถูกต้องและรองรับการดำเนินงานแบบหลายสาขา**.

## Entry Point
- เมนู Settings → Branches จาก sidebar
- ลิงก์จาก General Settings (OWN-SET-001)

## Exit Point
- บันทึก/สร้างสาขาสำเร็จ → กลับรายการสาขา + toast
- ไปแท็บ General (OWN-SET-001) / Branding (OWN-SET-002)

## Components
- รายการสาขา: ชื่อ, ที่อยู่, สถานะ (เปิด/ปิด)
- ปุ่ม "เพิ่มสาขา"
- ฟอร์มสาขา: ชื่อ, ที่อยู่, เบอร์ติดต่อ, เวลาเปิด-ปิด
- Row action: แก้ไข, ลบ/ปิดสาขา
- Badge จำกัดจำนวนสาขาตาม plan

## Validation Rules
- ชื่อสาขาเป็น required และไม่ซ้ำในองค์กร
- เวลาเปิดต้องก่อนเวลาปิด
- จำนวนสาขาไม่เกินสิทธิ์ตาม plan (Starter = 1 Branch)
- ผูกกับ `organization_id`; Owner = Full, Manager = Manage
- ลบ/ปิดสาขาที่มี booking ค้าง ต้องยืนยัน

## API Dependencies
- `GET /api/v1/branches` — รายการสาขา
- `POST /api/v1/branches` — สร้างสาขา
- `PUT /api/v1/branches/{id}` — แก้ไขสาขา
- `DELETE /api/v1/branches/{id}` — ลบ/ปิดสาขา

## Edge Cases
- เกินจำนวนสาขาตาม plan → block + แจ้งให้อัปเกรด plan
- ลบสาขาที่มี booking/court ผูกอยู่ → เตือนก่อนยืนยัน
- Permission denied: Branch = Full เฉพาะ Owner, Manage โดย Manager; role อื่น = None
- ชื่อสาขาซ้ำ → inline error
- API error → คงค่าในฟอร์ม + retry

## Success Criteria
- สร้าง/แก้ไข/ลบสาขาได้ตามสิทธิ์ และค่าคงอยู่หลังรีโหลด
- จำกัดจำนวนสาขาตาม plan ถูกบังคับใช้
- Owner/Manager จัดการได้; role อื่นเข้าไม่ได้
- เวลาเปิด-ปิดและ validation ถูกบังคับใช้
