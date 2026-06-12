---
id: ADM-FEAT-002
screen: Feature Flags
module: Features
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-FEAT-002 · Feature Flags

## Objective
- จัดการ feature flag ระดับ tenant: เปิด/ปิด feature เฉพาะรายเป็น override จากค่า default ของ plan
- รองรับกรณี Enterprise ที่ override feature ได้ และ add-on ที่ซื้อแยกจาก plan
- เป็นจุดควบคุมสิทธิ์การใช้งานจริงตามสถาปัตยกรรม Feature Flag Driven

## User Story
> As a **Super Admin**, I want **เปิด/ปิด feature ของ tenant แต่ละรายแบบ override**, so that **กำหนดสิทธิ์การใช้งานเฉพาะรายให้ยืดหยุ่นเกินกว่าค่า default ของ plan ได้**.

## Entry Point
- เมนูหลัก Super Admin Portal → "Features" → tab "Feature Flags"
- ลิงก์จาก Feature List (ADM-FEAT-001)
- tab "Feature Overrides" ใน Organization Detail (ADM-ORG-002)

## Exit Point
- ย้อนกลับ → Feature List (ADM-FEAT-001)
- คลิก organization → Organization Detail (ADM-ORG-002)

## Components
- ตัวเลือก organization (เลือก tenant ที่จะ override)
- Matrix: รายการ feature × สถานะ (default จาก plan / override on / override off)
- Toggle ต่อ feature: เปิด/ปิด override
- Badge แสดงที่มา (จาก plan / override / add-on)
- ปุ่ม "บันทึกการเปลี่ยนแปลง" / "รีเซ็ตเป็นค่า default ของ plan"

## Validation Rules
- ต้องเลือก organization ก่อนแก้ไข flag
- override ต้องอ้างอิง feature ที่มีใน catalog เท่านั้น
- การ override ที่ขัดกับ limit ของ plan ต้องเตือน
- เฉพาะ Super Admin เท่านั้นที่จัดการได้

## API Dependencies
- `GET /api/v1/organizations/{id}` — context ของ tenant ที่ override
- `GET /api/v1/permissions` — อ้างอิงสิทธิ์/feature ประกอบการแสดงผล
- Feature override toggle (set/reset) — — (ยังไม่มี endpoint; อ้างอิงตาราง `organization_feature_overrides`)

## Edge Cases
- ยังไม่เลือก organization → prompt ให้เลือกก่อน
- Loading: matrix skeleton
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- override feature ที่ plan ไม่รองรับ limit → เตือนผลกระทบก่อนบันทึก
- รีเซ็ต override → กลับไปใช้ค่า default ของ plan ทั้งหมด
- API error → แสดง error state + retry

## Success Criteria
- เปิด/ปิด override ต่อ feature ของ tenant ได้และมีผลทันที
- แสดงที่มาของสถานะ feature (plan/override/add-on) ถูกต้อง
- รีเซ็ตกลับค่า default ของ plan ได้
- เฉพาะ Super Admin เข้าถึงและบันทึกได้
