---
id: OWN-REPORT-004
screen: Export
module: Report
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-REPORT-004 · Export

## Objective
- ส่งออกรายงาน (Revenue/Booking/Utilization) เป็นไฟล์ CSV/Excel/PDF
- คงเงื่อนไข filter ของรายงานต้นทาง
- รองรับ export ขนาดใหญ่ผ่าน job queue และดาวน์โหลดเมื่อพร้อม

## User Story
> As an **Owner/Accountant/Manager**, I want **ส่งออกรายงานตาม filter ที่เลือกเป็นไฟล์**, so that **นำข้อมูลไปทำบัญชี/วิเคราะห์ต่อภายนอกได้**.

## Entry Point
- ปุ่ม "Export" จาก Revenue Report (OWN-REPORT-001), Booking Report (OWN-REPORT-002), Utilization Report (OWN-REPORT-003)

## Exit Point
- ดาวน์โหลดไฟล์สำเร็จ → กลับรายงานต้นทาง
- ปิด dialog → กลับรายงานต้นทาง

## Components
- Export dialog: เลือกฟอร์แมต (CSV / Excel / PDF), ช่วงข้อมูล (สืบทอดจาก filter)
- ตัวเลือกคอลัมน์ที่ต้องการ
- สถานะงาน export (กำลังสร้าง / พร้อมดาวน์โหลด) สำหรับไฟล์ใหญ่
- ปุ่ม "ดาวน์โหลด"

## Validation Rules
- เฉพาะ role ที่มีสิทธิ์ `export` ในโมดูลรายงานนั้นเท่านั้น
- ช่วงข้อมูลต้องไม่เกินขีดจำกัดที่ระบบกำหนด
- ผูกกับ `branch_id` / `organization_id`; export เฉพาะข้อมูล tenant ตนเอง

## API Dependencies
- `GET /api/v1/reports/revenue` — แหล่งข้อมูล export รายได้ (พร้อมพารามิเตอร์ format)
- `GET /api/v1/reports/bookings` — แหล่งข้อมูล export การจอง
- `GET /api/v1/reports/utilization` — แหล่งข้อมูล export การใช้งาน
- หมายเหตุ: ไฟล์ใหญ่สร้างผ่าน job queue (job type `generate_report`) แล้วเก็บที่ Cloudflare R2; ไม่มี endpoint export เฉพาะใน spec

## Edge Cases
- ไฟล์ใหญ่ → สร้างเป็น background job, แจ้งเมื่อพร้อมดาวน์โหลด
- ไม่มีข้อมูลในช่วงที่เลือก → แจ้ง "ไม่มีข้อมูลให้ export"
- Permission denied: role ที่ไม่มีสิทธิ์ export → ปุ่มถูกซ่อน/disable
- Generate ล้มเหลว → แจ้ง error + ลองใหม่
- ลิงก์ดาวน์โหลดหมดอายุ → สร้างใหม่

## Success Criteria
- ไฟล์ที่ export มีข้อมูลตรงกับ filter ของรายงานต้นทาง
- รองรับฟอร์แมต CSV/Excel/PDF
- ไฟล์ใหญ่ทำงานผ่าน queue โดยไม่ block UI
- เฉพาะ role ที่มีสิทธิ์ export เท่านั้นที่ใช้งานได้
