---
id: ADM-BILL-001
screen: Invoice List
module: Billing
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-BILL-001 · Invoice List

## Objective
- แสดงรายการ subscription invoice ของทุก tenant แบบตาราง พร้อมสถานะชำระเงิน
- ใช้ติดตามการเรียกเก็บเงิน: invoice ค้างชำระ, ชำระแล้ว, overdue
- เป็น entry สู่ Billing Detail และการ export ทางบัญชี

## User Story
> As a **Super Admin**, I want **ดูและกรอง invoice ของทุก organization เป็นรายการ**, so that **ติดตามการเรียกเก็บเงินและจัดการ invoice ค้างชำระทั้งแพลตฟอร์มได้**.

## Entry Point
- เมนูหลัก Super Admin Portal → "Billing"
- คลิก KPI Card "Outstanding / Revenue" จาก Platform Dashboard (ADM-ANALYTICS-001)

## Exit Point
- คลิกแถว invoice → Billing Detail (ADM-BILL-002)
- คลิก organization → Organization Detail (ADM-ORG-002)

## Components
- Data table: invoice number, organization, plan, รอบบิล, ยอดเงิน, สถานะ (paid/unpaid/overdue), วันออก, วันครบกำหนด
- Filters: สถานะชำระเงิน, plan, ช่วงวันออก/วันครบกำหนด
- Search: invoice number / ชื่อ organization
- Sort: ตามวันออก / ยอด / วันครบกำหนด
- Pagination
- Row action: ดูรายละเอียด
- ปุ่ม Export (CSV/รายงานบัญชี)

## Validation Rules
- ช่วงวันที่ filter: `date_from` ไม่หลัง `date_to`
- คำค้นหาขั้นต่ำตามที่ระบบกำหนดก่อนยิง query
- เฉพาะ Super Admin เท่านั้นที่เข้าถึงได้

## API Dependencies
- Invoice list (subscription_invoices) — — (ยังไม่มี endpoint; อ้างอิงตาราง `subscription_invoices`)
- `GET /api/v1/subscriptions` — เชื่อม invoice กับ subscription

## Edge Cases
- Empty data: filter ไม่พบผลลัพธ์ → empty state "ไม่พบ invoice ตามเงื่อนไข"
- Loading: table skeleton
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- invoice เลย due date และยังไม่ชำระ → ไฮไลต์สถานะ overdue
- ผลลัพธ์จำนวนมาก → pagination ทำงาน
- API error → แสดง error state + retry

## Success Criteria
- ตารางแสดง invoice ตาม filter/sort/หน้า ที่เลือกถูกต้อง
- invoice overdue/unpaid ถูกไฮไลต์ชัดเจน
- คลิกแถวเข้าสู่ Billing Detail ได้
- Export ทำงานสำหรับ role ที่มีสิทธิ์
