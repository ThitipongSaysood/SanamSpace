---
id: OWN-DASH-001
screen: Dashboard
module: Dashboard
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-DASH-001 · Dashboard

## Objective
- หน้าศูนย์กลางภาพรวมธุรกิจของสาขา ให้ Owner/Manager เห็นสถานะวันนี้ในจอเดียว
- รวม KPI หลัก (รายได้ / การจอง / Utilization / สมาชิก) และวิดเจ็ตย่อยเพื่อเจาะดูต่อ
- ใช้ตัดสินใจรายวันและ navigate ไปยังโมดูล Booking / Report ได้รวดเร็ว

## User Story
> As an **Owner/Manager**, I want **เห็นภาพรวมรายได้ การจอง อัตราการใช้สนาม และสมาชิกของสาขาในจอเดียว**, so that **ตัดสินใจบริหารงานรายวันได้ทันทีโดยไม่ต้องเปิดหลายหน้า**.

## Entry Point
- เข้าจากการ Login เข้า Owner Admin Portal สำเร็จ (จอเริ่มต้น/landing)
- คลิกเมนู "Dashboard" บน sidebar
- สลับสาขา (branch switcher) แล้ว reload ข้อมูลของสาขาที่เลือก

## Exit Point
- คลิก KPI Card → ไป Report ที่เกี่ยวข้อง (OWN-DASH-002)
- คลิก Revenue Widget → Revenue Report (OWN-DASH-003)
- คลิก Booking Widget → Booking Calendar (OWN-BOOK-001) / Booking List (OWN-BOOK-002)
- ออกเมื่อเปลี่ยนไปเมนูอื่น หรือ logout

## Components
- KPI Cards row: รายได้วันนี้, จำนวน Booking, Utilization %, สมาชิกใหม่ (OWN-DASH-002)
- Revenue Widget: กราฟแนวโน้มรายได้ + ตัวเลือกช่วงเวลา (OWN-DASH-003)
- Booking Widget: สรุปสถานะ booking วันนี้ + รายการล่าสุด (OWN-DASH-004)
- Filter bar: ตัวเลือกสาขา (branch) และช่วงวันที่ (today / 7d / 30d / custom)
- Quick action: ปุ่มไป Booking Calendar, Verify Payment

## Validation Rules
- ต้องมี `organization_id` และ `branch_id` ที่ผูกกับ user เสมอ (multi-tenant scope)
- ช่วงวันที่: `date_from` ต้องไม่หลัง `date_to`; ค่าเริ่มต้น = วันนี้
- แสดงเฉพาะสาขาที่ user มีสิทธิ์เข้าถึงใน branch switcher

## API Dependencies
- `GET /api/v1/reports/revenue` — สรุปรายได้สำหรับ KPI + Revenue Widget
- `GET /api/v1/reports/bookings` — สรุปการจองสำหรับ KPI + Booking Widget
- `GET /api/v1/reports/utilization` — อัตราการใช้สนามสำหรับ KPI
- `GET /api/v1/memberships` — นับสมาชิก/สมาชิกใหม่
- `GET /api/v1/bookings` — รายการ booking ล่าสุดใน Booking Widget

## Edge Cases
- Empty data: สาขาใหม่ยังไม่มีข้อมูล → แสดง empty state ทุก widget ("ยังไม่มีข้อมูล")
- Loading: แสดง skeleton ของ KPI/กราฟระหว่างโหลด แต่ละ widget โหลดอิสระ
- Permission denied: Reception/Cashier ได้สิทธิ์ Dashboard = View → ดูได้แต่ไม่มี quick action ที่เกินสิทธิ์; role ที่ไม่มีสิทธิ์ → redirect/แสดง 403
- API error บาง widget → widget นั้นแสดง error + ปุ่ม retry โดยไม่ล้มทั้งหน้า
- เปลี่ยนสาขาระหว่างโหลด → ยกเลิก request เดิม โหลดของสาขาใหม่

## Success Criteria
- โหลดหน้าแล้วเห็น KPI ครบ 4 ตัวพร้อมค่าจริงของสาขาที่เลือกภายใน 2 วินาที
- คลิกแต่ละ widget แล้ว navigate ไปจอปลายทางถูกต้อง
- เปลี่ยนสาขา/ช่วงวันที่แล้วข้อมูลทุก widget อัปเดตสอดคล้องกัน
- Reception/Cashier เห็นหน้าแบบ read-only โดยไม่มีปุ่มเกินสิทธิ์
