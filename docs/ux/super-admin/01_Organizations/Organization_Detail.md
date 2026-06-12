---
id: ADM-ORG-002
screen: Organization Detail
module: Organizations
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-ORG-002 · Organization Detail

## Objective
- แสดงรายละเอียดเชิงลึกของ tenant: ข้อมูลทั่วไป, plan/subscription, สาขา, staff, การใช้งานเทียบ limit
- ใช้บริหารจัดการ tenant รายราย (suspend/activate, เปลี่ยน plan, ดู feature override)
- เป็นจุดศูนย์กลางในการตรวจสอบสุขภาพของ tenant

## User Story
> As a **Super Admin**, I want **ดูและจัดการรายละเอียดของ organization หนึ่งรายอย่างครบถ้วน**, so that **ตรวจสอบสถานะ, plan และการใช้งานของ tenant แล้วดำเนินการที่จำเป็นได้**.

## Entry Point
- คลิกแถว organization จาก Organization List (ADM-ORG-001)
- ลิงก์จาก Subscription Detail (ADM-SUB-002) → organization ที่เกี่ยวข้อง

## Exit Point
- ย้อนกลับ → Organization List (ADM-ORG-001)
- คลิก subscription → Subscription Detail (ADM-SUB-002)
- คลิก "แก้ไขข้อมูล" → Create/Edit Organization (ADM-ORG-003)

## Components
- Header: ชื่อ organization, slug/domain, สถานะ (active/suspended/trial), badge plan
- Tab "ข้อมูลทั่วไป": เจ้าของ, อีเมล, เบอร์, ที่อยู่, วันที่สร้าง
- Tab "Subscription": plan ปัจจุบัน, สถานะ, รอบบิล, วันหมดอายุ
- Tab "Branches": รายการสาขาของ tenant
- Tab "Usage vs Limit": จำนวนสาขา/court/staff/booking เทียบ limit ของ plan
- Tab "Feature Overrides": feature ที่ override จากค่า default ของ plan
- Action: suspend/activate, เปลี่ยน plan, แก้ไขข้อมูล

## Validation Rules
- ผูกกับ `organization_id` จาก URL/route
- การ suspend/activate ต้องยืนยันก่อนดำเนินการ
- เฉพาะ Super Admin เท่านั้นที่จัดการได้

## API Dependencies
- `GET /api/v1/organizations/{id}` — รายละเอียด organization
- `PUT /api/v1/organizations/{id}` — แก้ไขข้อมูล/สถานะ organization
- `GET /api/v1/branches` — รายการสาขาของ organization (กรองด้วย org)
- `GET /api/v1/subscriptions` — subscription ของ organization
- Feature override management — — (ยังไม่มี endpoint)

## Edge Cases
- ไม่พบ organization (id ผิด/ถูกลบ) → not-found state
- Loading: section skeleton ในแต่ละ tab
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- Usage เกิน limit ของ plan → highlight เตือน (over-quota)
- Suspend ขณะ subscription ยัง active → เตือนผลกระทบก่อนยืนยัน
- API error → แสดง error state + retry

## Success Criteria
- แสดงข้อมูล tenant ครบทุก tab ตรงกับฐานข้อมูล
- suspend/activate และเปลี่ยน plan ทำงานและสะท้อนสถานะใหม่ทันที
- Usage vs limit แสดงค่าถูกต้องและเตือนเมื่อเกิน
- นำทางไป Subscription Detail และแก้ไขข้อมูลได้
