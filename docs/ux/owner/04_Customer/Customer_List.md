---
id: OWN-CUST-001
screen: Customer List
module: Customer
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-CUST-001 · Customer List

## Objective
- แสดงรายชื่อลูกค้าทั้งหมดของ tenant แบบตาราง ค้นหา-กรอง-เรียงได้
- ใช้หาลูกค้า ดูข้อมูลสรุป (ยอดใช้จ่าย/จำนวนครั้งที่มา) และเข้าสู่โปรไฟล์
- เป็น entry สู่ Customer Detail

## User Story
> As an **Owner/Manager/Reception**, I want **ค้นหาและดูรายชื่อลูกค้าเป็นตาราง**, so that **หาลูกค้าและเข้าถึงประวัติ/ข้อมูลติดต่อได้รวดเร็ว**.

## Entry Point
- เมนู "ลูกค้า" (Customer) จาก sidebar Owner Portal
- คลิกจากชื่อลูกค้าใน Booking List / Payment / CRM

## Exit Point
- คลิกแถวลูกค้า → Customer Detail (OWN-CUST-002)

## Components
- Data table: คอลัมน์ ชื่อ, เบอร์โทร, ช่องทาง (LINE), ยอดใช้จ่ายรวม, จำนวนครั้ง, สมาชิก/tier
- Filters: ค้นหาชื่อ/เบอร์, tier สมาชิก, customer tag (Business+), segment (Pro+)
- Sort: ตามชื่อ/ยอดใช้จ่าย/ครั้งล่าสุด
- Pagination หรือ infinite scroll
- Row action: ดูรายละเอียด (ตามสิทธิ์)
- ปุ่ม Export (เฉพาะ role ที่มีสิทธิ์ export)

## Validation Rules
- ผูกกับ `organization_id`; ไม่แสดงลูกค้าข้าม tenant
- คำค้นหาขั้นต่ำตามที่ระบบกำหนดก่อนยิง query
- ตัวกรอง tag/segment แสดงเฉพาะ plan ที่รองรับ (Tags = Business+, Segments = Pro+)

## API Dependencies
- `GET /api/v1/customers` — รายการลูกค้าพร้อม filter/sort/pagination
- `GET /api/v1/customers/{id}` — preview เมื่อเปิด detail
- `GET /api/v1/segments` — (Pro+) ตัวเลือก segment สำหรับ filter

## Edge Cases
- Empty data: ค้นหาไม่พบ → empty state "ไม่พบลูกค้าตามเงื่อนไข"
- Loading: table skeleton
- Permission denied: Cashier/Marketing/Viewer = View → ปุ่ม edit/export ถูกซ่อน; Reception/Manager = Manage; Accountant = None เข้าไม่ได้
- Plan gating: filter Tags/Segments ถูกซ่อนหรือ disable ตาม plan
- ผลลัพธ์จำนวนมาก → pagination ทำงาน ไม่โหลดทั้งหมดทีเดียว
- API error → error state + retry

## Success Criteria
- ตารางแสดงลูกค้าของ tenant ตาม filter/sort/หน้า ถูกต้อง
- ค้นหาด้วยชื่อ/เบอร์ได้ผลลัพธ์ตรง
- คลิกแถวเข้าสู่ Customer Detail ได้
- สิทธิ์การ export และ filter ขั้นสูงถูกควบคุมตาม role และ plan
