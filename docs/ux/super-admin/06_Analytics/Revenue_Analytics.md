---
id: ADM-ANALYTICS-002
screen: Revenue Analytics
module: Analytics
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-ANALYTICS-002 · Revenue Analytics

## Objective
- แสดงการวิเคราะห์รายได้ของแพลตฟอร์มเชิงลึก: MRR, รายได้ตาม plan, churn, การเติบโต
- ใช้ติดตามผลประกอบการ subscription และตัดสินใจเชิงกลยุทธ์
- รองรับการ export รายงานรายได้

## User Story
> As a **Super Admin**, I want **วิเคราะห์รายได้ของแพลตฟอร์มแยกตามมิติต่างๆ**, so that **เข้าใจแนวโน้ม MRR, churn และสัดส่วนรายได้ตาม plan เพื่อวางแผนธุรกิจได้**.

## Entry Point
- เมนูหลัก Super Admin Portal → "Analytics" → "Revenue"
- คลิก KPI "MRR / Revenue" จาก Platform Dashboard (ADM-ANALYTICS-001)

## Exit Point
- ย้อนกลับ → Platform Dashboard (ADM-ANALYTICS-001)
- คลิก plan ใน breakdown → Plan List (ADM-PLAN-001)
- คลิกลิงก์ invoice ที่เกี่ยว → Invoice List (ADM-BILL-001)

## Components
- KPI Cards: MRR, ARR, รายได้สะสม, ARPA (รายได้เฉลี่ยต่อ tenant), churn rate
- Chart: MRR trend รายเดือน
- Chart: รายได้แยกตาม plan (stacked)
- Chart: new vs churned MRR
- ตาราง: รายได้ตาม plan / ตาม tenant สูงสุด
- ตัวเลือกช่วงเวลา และ filter ตาม plan
- ปุ่ม Export รายงาน

## Validation Rules
- ช่วงเวลาที่เลือกต้องถูกต้อง (เริ่มไม่หลังสิ้นสุด)
- filter ตาม plan ต้องเป็น plan ที่มีอยู่จริง
- เฉพาะ Super Admin เท่านั้นที่เข้าถึงได้

## API Dependencies
- Revenue/MRR analytics aggregate — — (ยังไม่มี endpoint; อ้างอิงตาราง `monthly_metrics`, `subscription_invoices`, `subscription_payments`)
- `GET /api/v1/subscriptions` — ฐานข้อมูล subscription ประกอบการคำนวณ

## Edge Cases
- ยังไม่มีข้อมูลรายได้ในช่วงที่เลือก → empty/zero state
- Loading: chart/card skeleton
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- ช่วงเวลายาวมาก → aggregate เป็นรายเดือนแทนรายวันเพื่อ performance
- Enterprise (Custom price) → ระบุวิธีนับรายได้ให้ชัด ไม่ทำให้ตัวเลขเพี้ยน
- API error → error state ระดับ widget + retry

## Success Criteria
- MRR, ARR, churn และ ARPA แสดงค่าถูกต้องตามช่วงเวลา
- รายได้แยกตาม plan สอดคล้องผลรวมทั้งหมด
- Export รายงานรายได้ได้
- เฉพาะ Super Admin เข้าถึงได้
