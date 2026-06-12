---
id: ADM-PLAN-002
screen: Plan Form
module: Plans
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-PLAN-002 · Plan Form

## Objective
- สร้างหรือแก้ไข subscription plan: ชื่อ, ราคา, รอบบิล, limit และ feature ที่ผูกกับ plan
- ใช้กำหนดโครงสร้างแพ็กเกจและ feature flag ตาม plan (plan_features)
- รองรับทั้งโหมดสร้างและแก้ไข

## User Story
> As a **Super Admin**, I want **กำหนดราคา, limit และ feature ของ plan ในฟอร์มเดียว**, so that **สร้างหรือปรับโครงสร้างแพ็กเกจให้ตรงตามนโยบายธุรกิจได้**.

## Entry Point
- ปุ่ม "สร้าง Plan" จาก Plan List (ADM-PLAN-001)
- คลิกแถว plan จาก Plan List (ADM-PLAN-001) — โหมดแก้ไข

## Exit Point
- บันทึกสำเร็จ → Plan List (ADM-PLAN-001)
- ยกเลิก → Plan List (ADM-PLAN-001)

## Components
- Form section "ข้อมูล Plan": ชื่อ, รหัส/slug, คำอธิบาย, ราคา/เดือน, ราคา/ปี, สถานะการขาย
- Form section "Limits": branches, courts, staff users, monthly bookings, storage (รองรับค่า Unlimited)
- Form section "Features": รายการ feature toggle ผูกกับ plan (อ้างอิง Feature List)
- ปุ่ม "บันทึก" / "ยกเลิก"

## Validation Rules
- ชื่อ plan: required, ไม่ซ้ำ
- slug/รหัส: required, unique, รูปแบบ a-z0-9 และ "-"
- ราคา: required, ตัวเลข ≥ 0 (Enterprise รองรับ Custom = ไม่กำหนดราคาคงที่)
- limit: ตัวเลข ≥ 0 หรือ Unlimited
- ต้องเลือก feature อย่างน้อยตามที่ plan กำหนด

## API Dependencies
- Plan create/update + plan_features mapping — — (ยังไม่มี endpoint; อ้างอิงตาราง `plans`, `plan_features`, `features`)

## Edge Cases
- ชื่อ/slug ซ้ำ → error ที่ field
- Validation ไม่ผ่าน → ไฮไลต์ field และไม่ส่งฟอร์ม
- แก้ไข limit ให้ต่ำกว่าที่ tenant ปัจจุบันใช้งาน → เตือนผลกระทบต่อ tenant ที่ผูกอยู่
- เลือก Enterprise → ปลดล็อก Custom price และ Unlimited limit
- ออกจากหน้าโดยยังไม่บันทึก → เตือน unsaved changes
- API error → คงข้อมูลในฟอร์ม + retry

## Success Criteria
- สร้าง/แก้ไข plan พร้อม limit และ feature mapping สำเร็จ
- Validation ทำงานครบทุก field
- โหมดแก้ไขโหลดค่าเดิมและบันทึกการเปลี่ยนแปลงได้
- การเตือนผลกระทบต่อ tenant ที่ผูกอยู่ทำงานถูกต้อง
