---
id: OWN-REPORT-001
screen: Revenue Report
module: Report
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-REPORT-001 · Revenue Report

## Objective
- แสดงรายได้ของสาขาตามช่วงเวลา พร้อม KPI Revenue และ MRR
- แยกรายได้ตามช่องทางชำระ / court / ประเภทรายการ
- รองรับการเปรียบเทียบช่วงเวลาและ export

## User Story
> As an **Owner/Accountant/Manager**, I want **ดูรายงานรายได้ตามช่วงเวลาแบบกราฟและตาราง**, so that **เข้าใจแนวโน้มรายได้และตัดสินใจเชิงธุรกิจได้**.

## Entry Point
- เมนู Reports → Revenue จาก sidebar
- คลิก KPI Card Revenue จาก Dashboard (OWN-DASH-002)

## Exit Point
- คลิก "Export" → Export (OWN-REPORT-004)
- สลับไปรายงานอื่น → Booking Report (OWN-REPORT-002) / Utilization Report (OWN-REPORT-003)

## Components
- KPI summary: รายได้รวม, MRR, ค่าเฉลี่ยต่อ booking, อัตราเติบโต
- กราฟแนวโน้มรายได้ (รายวัน/เดือน) + เปรียบเทียบช่วงก่อนหน้า
- Breakdown: ตามช่องทางชำระ, court, ประเภทรายการ (booking/membership/package)
- Filters: ช่วงวันที่, court, ช่องทางชำระ
- ตารางสรุปรายได้
- ปุ่ม Export (เฉพาะ role ที่มีสิทธิ์ export)

## Validation Rules
- ผูกกับ `branch_id` / `organization_id`
- ช่วงวันที่: `date_from` ไม่หลัง `date_to`; จำกัดช่วงสูงสุดตามที่ระบบกำหนด
- ค่าเริ่มต้น: เดือนปัจจุบัน

## API Dependencies
- `GET /api/v1/reports/revenue` — ข้อมูลรายได้ตามช่วงเวลา/filter

## Edge Cases
- ไม่มีรายได้ในช่วงที่เลือก → empty state + กราฟว่าง
- Loading: skeleton กราฟ/ตาราง
- Permission denied: Reception/Cashier/Coach = None; Manager/Marketing/Accountant/Viewer = View (export ตามสิทธิ์)
- ช่วงข้อมูลใหญ่ → aggregate ฝั่ง server, ไม่ดึง raw ทั้งหมด
- API error → error state + retry

## Success Criteria
- KPI และกราฟแสดงรายได้ตรงกับช่วง/filter ที่เลือก
- Breakdown ตามช่องทาง/court ถูกต้องและผลรวมตรงกับยอดรวม
- Owner/Accountant เข้าดูได้; role ที่ไม่มีสิทธิ์เข้าไม่ได้
- Export ทำได้เฉพาะ role ที่มีสิทธิ์
