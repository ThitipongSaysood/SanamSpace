---
id: OWN-DASH-002
screen: KPI Cards
module: Dashboard
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-DASH-002 · KPI Cards

## Objective
- แสดงตัวเลขสรุป (KPI) หลักของสาขาแบบการ์ดบนสุดของ Dashboard
- ครอบคลุม 4 KPI: รายได้, จำนวน Booking, Utilization %, สมาชิก
- เปรียบเทียบกับช่วงก่อนหน้า (delta %) เพื่อบอกแนวโน้มขึ้น/ลง

## User Story
> As an **Owner/Manager**, I want **เห็นตัวเลข KPI หลักของสาขาพร้อมเทรนด์เทียบช่วงก่อน**, so that **รู้สถานะธุรกิจได้ภายในไม่กี่วินาทีและเจาะดูรายงานต่อได้**.

## Entry Point
- แสดงเป็น component บนสุดของ Dashboard (OWN-DASH-001)
- รับ context สาขา + ช่วงวันที่จาก filter ของ Dashboard

## Exit Point
- คลิกการ์ดรายได้ → Revenue Report / Revenue Widget (OWN-DASH-003)
- คลิกการ์ด Booking → Booking List (OWN-BOOK-002)
- คลิกการ์ด Utilization → Utilization Report
- คลิกการ์ดสมาชิก → Membership module

## Components
- KPI Card: รายได้ (ยอดรวม + delta %), แสดงสกุลเงิน THB
- KPI Card: จำนวน Booking (รวม + แยก confirmed/cancelled)
- KPI Card: Utilization % (สัดส่วนชั่วโมงที่ถูกจอง/ชั่วโมงทั้งหมด)
- KPI Card: สมาชิก (จำนวนรวม + สมาชิกใหม่ในช่วง)
- Trend indicator: ลูกศรขึ้น/ลง + สี (เขียว/แดง)
- Sparkline ขนาดเล็กในแต่ละการ์ด (optional)

## Validation Rules
- ทุกการ์ดผูกกับ `branch_id` + ช่วง `date_from`/`date_to` เดียวกับ Dashboard
- Delta % คำนวณเทียบช่วงก่อนหน้าความยาวเท่ากัน; ถ้าฐาน = 0 → แสดง "—" แทน %
- ค่าตัวเลขเป็น 0 ถือว่าถูกต้อง (ไม่ใช่ error); ค่า null = ยังโหลดไม่เสร็จ

## API Dependencies
- `GET /api/v1/reports/revenue` — ตัวเลขรายได้ + เทียบช่วงก่อน
- `GET /api/v1/reports/bookings` — จำนวน booking และสถานะ
- `GET /api/v1/reports/utilization` — อัตราการใช้สนาม
- `GET /api/v1/memberships` — จำนวนสมาชิก/สมาชิกใหม่

## Edge Cases
- Empty data: ช่วงที่เลือกไม่มีข้อมูล → การ์ดแสดง 0 และ delta = "—"
- Loading: แสดง skeleton ต่อการ์ด, การ์ดที่โหลดเสร็จก่อนแสดงค่าได้เลย
- Permission denied: Reception/Cashier = View → คลิกการ์ดที่ลิงก์ไปโมดูลเกินสิทธิ์จะถูก disable/นำไปหน้า 403
- API error เฉพาะการ์ด → การ์ดนั้นแสดงไอคอน error + retry, การ์ดอื่นทำงานปกติ
- delta สูงผิดปกติ (เช่นฐานต่ำมาก) → cap การแสดงผลและทำ tooltip อธิบาย

## Success Criteria
- การ์ดทั้ง 4 แสดงค่าจริงและ delta ถูกต้องตามช่วงเวลาที่เลือก
- คลิกการ์ดแล้ว navigate ไปรายงานปลายทางถูกต้อง
- เปลี่ยนช่วงวันที่/สาขา การ์ดทุกใบอัปเดตพร้อมกัน
- ค่า 0 และกรณีไม่มีข้อมูลแสดงผลถูกต้องไม่ใช่ error
