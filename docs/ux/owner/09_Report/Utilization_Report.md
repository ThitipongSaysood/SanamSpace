---
id: OWN-REPORT-003
screen: Utilization Report
module: Report
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-REPORT-003 · Utilization Report

## Objective
- แสดงอัตราการใช้งาน court (Utilization Rate) ตามช่วงเวลา
- ระบุช่วงเวลา/court ที่ว่าง เพื่อวางแผน dynamic pricing และโปรโมชัน
- รองรับ heatmap ช่วงเวลา และ export

## User Story
> As an **Owner/Manager**, I want **ดูอัตราการใช้งาน court แยกตามช่วงเวลาและ court**, so that **รู้ว่าช่วงไหน/court ไหนว่าง และวางแผนเพิ่มการใช้งานได้**.

## Entry Point
- เมนู Reports → Utilization จาก sidebar
- คลิก KPI Card Utilization จาก Dashboard (OWN-DASH-002)

## Exit Point
- คลิก "Export" → Export (OWN-REPORT-004)
- สลับไปรายงานอื่น → Revenue Report (OWN-REPORT-001) / Booking Report (OWN-REPORT-002)

## Components
- KPI summary: utilization rate รวม, peak/off-peak rate
- Heatmap: ชั่วโมง × วัน แสดงอัตราการใช้งาน
- Breakdown: ตาม court, ช่วงเวลา
- Filters: ช่วงวันที่, court
- ตารางสรุปชั่วโมงใช้งาน/ชั่วโมงว่าง
- ปุ่ม Export (เฉพาะ role ที่มีสิทธิ์ export)

## Validation Rules
- ผูกกับ `branch_id` / `organization_id`
- ช่วงวันที่: `date_from` ไม่หลัง `date_to`
- ค่าเริ่มต้น: เดือนปัจจุบัน
- คำนวณจากชั่วโมงเปิดทำการของ court (court schedule)

## API Dependencies
- `GET /api/v1/reports/utilization` — อัตราการใช้งาน court ตามช่วงเวลา/filter
- `GET /api/v1/courts/{id}/schedules` — (optional) อ้างอิงชั่วโมงเปิดทำการ

## Edge Cases
- ไม่มีข้อมูลในช่วงที่เลือก → empty state + heatmap ว่าง
- Court ที่ไม่มีตารางเปิด → ไม่นำมาคำนวณ utilization
- Loading: skeleton heatmap/ตาราง
- Permission denied: Cashier/Coach = None; Manager/Marketing/Accountant/Viewer = View
- API error → error state + retry

## Success Criteria
- Heatmap และ KPI แสดงอัตราการใช้งานตรงกับ filter
- Breakdown ตาม court/ช่วงเวลา ถูกต้อง
- คำนวณ utilization อิงชั่วโมงเปิดทำการที่ถูกต้อง
- Export ทำได้เฉพาะ role ที่มีสิทธิ์
