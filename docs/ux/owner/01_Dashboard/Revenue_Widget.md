---
id: OWN-DASH-003
screen: Revenue Widget
module: Dashboard
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-DASH-003 · Revenue Widget

## Objective
- แสดงแนวโน้มรายได้ของสาขาเป็นกราฟตามช่วงเวลาที่เลือก
- ช่วยให้ Owner/Manager เห็น pattern รายได้ (รายวัน/สัปดาห์/เดือน) และจุดสูง-ต่ำ
- เป็นทางเข้าสู่ Revenue Report แบบเต็มเพื่อเจาะรายละเอียด

## User Story
> As an **Owner/Manager**, I want **ดูกราฟแนวโน้มรายได้ของสาขาในช่วงที่เลือก**, so that **เข้าใจ pattern รายได้และวางแผนโปรโมชัน/ราคาได้**.

## Entry Point
- แสดงเป็น widget บน Dashboard (OWN-DASH-001)
- คลิกจาก KPI Card รายได้ (OWN-DASH-002) เพื่อ focus widget นี้

## Exit Point
- คลิก "ดูทั้งหมด" → Revenue Report เต็ม (Report module)
- เปลี่ยน segment/ช่วงเวลา → อยู่ใน widget เดิม รีเฟรชกราฟ

## Components
- Line/Bar chart: แกน X = เวลา, แกน Y = รายได้ (THB)
- ตัวเลือกช่วง: วันนี้ / 7 วัน / 30 วัน / custom range
- Toggle มุมมอง: รายวัน / รายสัปดาห์ / รายเดือน
- Summary: ยอดรวมช่วง + ค่าเฉลี่ยต่อวัน
- Breakdown (optional): แยกตามวิธีชำระเงิน / ประเภทสนาม
- Legend และ tooltip แสดงค่าจุดที่ hover

## Validation Rules
- ผูกกับ `branch_id` + ช่วง `date_from`/`date_to`; `date_from` ไม่หลัง `date_to`
- ช่วง custom สูงสุดตามที่ระบบกำหนด (เช่น 12 เดือน) เพื่อกันโหลดหนัก
- เฉพาะ payment ที่ verified แล้วนับเป็นรายได้ (ไม่นับ pending/rejected)

## API Dependencies
- `GET /api/v1/reports/revenue` — ข้อมูล time series รายได้ตามช่วง/granularity
- `GET /api/v1/payments` — (optional) รายการชำระเงินเมื่อ drill-down

## Edge Cases
- Empty data: ช่วงที่เลือกไม่มีรายได้ → กราฟแสดงเส้น 0 + ข้อความ "ไม่มีรายได้ในช่วงนี้"
- Loading: แสดง chart skeleton
- Permission denied: role ที่ Analytics/Report = None (เช่น Reception/Cashier) → ซ่อนปุ่ม "ดูทั้งหมด" หรือนำไป 403
- API error → แสดง error + retry ในกรอบ widget
- ข้อมูลจุดเดียว (1 วัน) → แสดงเป็น bar/จุดเดียวแทนเส้น

## Success Criteria
- กราฟแสดงรายได้จริงตามช่วงเวลาและ granularity ที่เลือกถูกต้อง
- ยอดรวมใน widget ตรงกับ KPI Card รายได้ของช่วงเดียวกัน
- เปลี่ยนช่วง/มุมมองแล้วกราฟอัปเดตภายใน 2 วินาที
- คลิก "ดูทั้งหมด" ไป Revenue Report ได้ (เฉพาะ role ที่มีสิทธิ์)
