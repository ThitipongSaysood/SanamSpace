---
id: ADM-SUB-001
screen: Subscription List
module: Subscriptions
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-SUB-001 · Subscription List

## Objective
- แสดง subscription ของทุก tenant แบบตาราง พร้อมสถานะ, plan, รอบบิล, วันหมดอายุ
- ใช้ติดตามการต่ออายุ, subscription ที่ใกล้หมด/หมดอายุ และ trial
- เป็น entry สู่ Subscription Detail และการต่ออายุ

## User Story
> As a **Super Admin**, I want **ดูและกรอง subscription ของทุก organization เป็นรายการ**, so that **ติดตามสถานะการสมัครและจัดการการต่ออายุได้ครบทั้งแพลตฟอร์ม**.

## Entry Point
- เมนูหลัก Super Admin Portal → "Subscriptions"
- คลิก KPI Card "Active Subscriptions" / "MRR" จาก Platform Dashboard (ADM-ANALYTICS-001)

## Exit Point
- คลิกแถว subscription → Subscription Detail (ADM-SUB-002)
- คลิก organization → Organization Detail (ADM-ORG-002)

## Components
- Data table: คอลัมน์ organization, plan, สถานะ (active/trial/expired/cancelled), รอบบิล, เริ่มต้น, วันหมดอายุ, ยอดต่อรอบ
- Filters: plan, สถานะ, รอบบิล (รายเดือน/รายปี), ช่วงวันหมดอายุ
- Search: ชื่อ organization
- Sort: ตามวันหมดอายุ / plan / ยอด
- Pagination
- Row action: ดูรายละเอียด, ต่ออายุ (ตามสิทธิ์)
- Badge เตือน subscription ใกล้หมดอายุ

## Validation Rules
- ช่วงวันหมดอายุ filter: `date_from` ไม่หลัง `date_to`
- คำค้นหาขั้นต่ำตามที่ระบบกำหนดก่อนยิง query
- เฉพาะ Super Admin เท่านั้นที่เข้าถึงได้

## API Dependencies
- `GET /api/v1/subscriptions` — รายการ subscription พร้อม filter/sort/pagination
- `POST /api/v1/subscriptions/renew` — ต่ออายุ subscription จาก row action

## Edge Cases
- Empty data: filter ไม่พบผลลัพธ์ → empty state "ไม่พบ subscription ตามเงื่อนไข"
- Loading: table skeleton / loading row
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- subscription หมดอายุแล้ว → ไฮไลต์สถานะ expired และเสนอ "ต่ออายุ"
- ผลลัพธ์จำนวนมาก → pagination ทำงาน
- API error → แสดง error state + retry

## Success Criteria
- ตารางแสดง subscription ตาม filter/sort/หน้า ที่เลือกถูกต้อง
- subscription ใกล้หมด/หมดอายุถูกไฮไลต์ชัดเจน
- ต่ออายุจาก row action ได้และสถานะอัปเดต
- คลิกแถวเข้าสู่ Subscription Detail ได้
