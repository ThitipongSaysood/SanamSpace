---
id: ADM-ORG-001
screen: Organization List
module: Organizations
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-ORG-001 · Organization List

## Objective
- แสดง tenant (organization) ทั้งหมดบนแพลตฟอร์มแบบตาราง ค้นหา-กรอง-เรียงได้
- ใช้บริหารจัดการ tenant เชิงปริมาณ (ดูสถานะ, plan, สาขา, สถานะ subscription)
- เป็น entry สู่ Organization Detail และการสร้าง tenant ใหม่

## User Story
> As a **Super Admin**, I want **ค้นหาและกรอง organization ทั้งหมดเป็นรายการตาราง**, so that **ดูภาพรวม tenant ทุกสนามและเข้าถึงรายละเอียดได้รวดเร็วเมื่อมี tenant จำนวนมาก**.

## Entry Point
- เมนูหลัก Super Admin Portal → "Organizations"
- คลิก KPI Card "Total Tenants" จาก Platform Dashboard (ADM-ANALYTICS-001)

## Exit Point
- คลิกแถว organization → Organization Detail (ADM-ORG-002)
- คลิกปุ่ม "สร้าง Organization" → Create Organization (ADM-ORG-003)

## Components
- Data table: คอลัมน์ org name, slug/domain, plan, จำนวนสาขา, จำนวน staff, สถานะ subscription, วันที่สร้าง
- Filters: plan (Starter/Business/Pro/Enterprise), สถานะ (active/suspended/trial), ช่วงวันที่สร้าง
- Search: ชื่อ organization / slug / อีเมลเจ้าของ
- Sort: ตามชื่อ / วันที่สร้าง / plan
- Pagination
- Row action: ดูรายละเอียด, suspend/activate (ตามสิทธิ์)
- ปุ่ม "สร้าง Organization"

## Validation Rules
- คำค้นหาขั้นต่ำตามที่ระบบกำหนด (เช่น 2 ตัวอักษร) ก่อนยิง query
- ช่วงวันที่ filter: `date_from` ไม่หลัง `date_to`
- เฉพาะ Super Admin เท่านั้นที่เข้าถึงรายการได้ (cross-tenant)

## API Dependencies
- `GET /api/v1/organizations` — รายการ organization พร้อม filter/sort/pagination

## Edge Cases
- Empty data: filter ไม่พบผลลัพธ์ → empty state "ไม่พบ organization ตามเงื่อนไข"
- Loading: table skeleton / loading row
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึงทั้งหน้า
- ผลลัพธ์จำนวนมาก → pagination ทำงาน, ไม่โหลดทั้งหมดทีเดียว
- API error → แสดง error state + retry

## Success Criteria
- ตารางแสดง organization ตาม filter/sort/หน้า ที่เลือกถูกต้อง
- ค้นหาด้วยชื่อ/slug/อีเมล แล้วได้ผลลัพธ์ตรง
- คลิกแถวเข้าสู่ Organization Detail และสร้าง tenant ใหม่ได้
- เฉพาะ Super Admin เข้าถึงได้
