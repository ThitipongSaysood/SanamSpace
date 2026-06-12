---
id: ADM-SUB-002
screen: Subscription Detail
module: Subscriptions
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-SUB-002 · Subscription Detail

## Objective
- แสดงรายละเอียด subscription ของ tenant หนึ่งราย: plan, สถานะ, รอบบิล, ประวัติ invoice/payment
- ใช้จัดการ subscription รายราย: ต่ออายุ, เปลี่ยน plan, ยกเลิก
- เชื่อมโยงไปยัง billing/invoice ของ tenant

## User Story
> As a **Super Admin**, I want **ดูและจัดการ subscription ของ organization หนึ่งรายอย่างละเอียด**, so that **ต่ออายุ เปลี่ยนแผน และตรวจสอบประวัติการชำระเงินได้**.

## Entry Point
- คลิกแถว subscription จาก Subscription List (ADM-SUB-001)
- คลิก tab "Subscription" จาก Organization Detail (ADM-ORG-002)

## Exit Point
- ย้อนกลับ → Subscription List (ADM-SUB-001)
- คลิก organization → Organization Detail (ADM-ORG-002)
- คลิก invoice → Billing Detail (ADM-BILL-002)

## Components
- Header: organization, plan ปัจจุบัน, สถานะ, รอบบิล, วันเริ่ม-วันหมดอายุ
- Section "รายละเอียดแผน": limit/feature ตาม plan, ยอดต่อรอบ
- Section "ประวัติ Invoice": รายการ invoice ของ subscription พร้อมสถานะชำระเงิน
- Section "ประวัติการต่ออายุ": timeline การ renew/เปลี่ยน plan
- Action: ต่ออายุ, เปลี่ยน plan, ยกเลิก subscription

## Validation Rules
- ผูกกับ subscription/organization id จาก route
- การยกเลิก/เปลี่ยน plan ต้องยืนยันก่อนดำเนินการ
- เฉพาะ Super Admin เท่านั้นที่จัดการได้

## API Dependencies
- `GET /api/v1/subscriptions` — รายละเอียด subscription (กรองด้วย id/org)
- `POST /api/v1/subscriptions/renew` — ต่ออายุ subscription
- `GET /api/v1/organizations/{id}` — ข้อมูล organization ที่ผูกกับ subscription
- เปลี่ยน plan / ยกเลิก subscription — — (ยังไม่มี endpoint)

## Edge Cases
- ไม่พบ subscription → not-found state
- Loading: section skeleton
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- ต่ออายุขณะยังไม่หมดอายุ → ขยายวันหมดอายุต่อเนื่อง ไม่ทับซ้อน
- เปลี่ยนไป plan ที่ limit ต่ำกว่าการใช้งานจริง → เตือนผลกระทบก่อนยืนยัน
- API error → แสดง error state + retry

## Success Criteria
- แสดงรายละเอียด subscription, invoice และประวัติครบถ้วน
- ต่ออายุ/เปลี่ยน plan/ยกเลิก ทำงานและสะท้อนสถานะใหม่
- นำทางไป Billing Detail และ Organization Detail ได้
- การยืนยันก่อนดำเนินการที่มีผลกระทบทำงานถูกต้อง
