---
id: OWN-REPORT-002
screen: Booking Report
module: Report
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-REPORT-002 · Booking Report

## Objective
- แสดงสถิติการจองของสาขาตามช่วงเวลา (จำนวน booking, ยกเลิก, no-show)
- แยกตาม court / ช่วงเวลา / สถานะ booking
- รองรับเปรียบเทียบช่วงเวลาและ export

## User Story
> As an **Owner/Manager/Accountant**, I want **ดูรายงานจำนวนและสถานะการจองตามช่วงเวลา**, so that **เข้าใจพฤติกรรมการจองและวางแผนบริหาร court ได้**.

## Entry Point
- เมนู Reports → Booking จาก sidebar
- คลิก KPI Card Booking จาก Dashboard (OWN-DASH-002)

## Exit Point
- คลิก "Export" → Export (OWN-REPORT-004)
- สลับไปรายงานอื่น → Revenue Report (OWN-REPORT-001) / Utilization Report (OWN-REPORT-003)
- เจาะดูรายการ → Booking List (OWN-BOOK-002)

## Components
- KPI summary: booking รวม, ยกเลิก, no-show, อัตรายกเลิก
- กราฟแนวโน้มจำนวน booking (รายวัน/เดือน)
- Breakdown: ตาม court, ช่วงเวลา (peak/off-peak), สถานะ
- Filters: ช่วงวันที่, court, สถานะ booking
- ตารางสรุป
- ปุ่ม Export (เฉพาะ role ที่มีสิทธิ์ export)

## Validation Rules
- ผูกกับ `branch_id` / `organization_id`
- ช่วงวันที่: `date_from` ไม่หลัง `date_to`
- ค่าเริ่มต้น: เดือนปัจจุบัน

## API Dependencies
- `GET /api/v1/reports/bookings` — สถิติการจองตามช่วงเวลา/filter
- `GET /api/v1/bookings` — (optional) drill-down ไปรายการ booking

## Edge Cases
- ไม่มี booking ในช่วงที่เลือก → empty state
- Loading: skeleton กราฟ/ตาราง
- Permission denied: Cashier/Coach = None ใน analytics; Manager/Marketing/Accountant/Viewer = View
- ช่วงข้อมูลใหญ่ → aggregate ฝั่ง server
- API error → error state + retry

## Success Criteria
- KPI และกราฟแสดงจำนวน/สถานะ booking ตรงกับ filter
- Breakdown ตาม court/ช่วงเวลา ถูกต้อง ผลรวมตรงกับยอดรวม
- เข้าได้เฉพาะ role ที่มีสิทธิ์ analytics
- Export ทำได้เฉพาะ role ที่มีสิทธิ์
