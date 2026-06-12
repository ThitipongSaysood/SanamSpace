---
id: ADM-ANALYTICS-001
screen: Platform Dashboard
module: Analytics
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-ANALYTICS-001 · Platform Dashboard

## Objective
- แสดงภาพรวมสุขภาพแพลตฟอร์มทั้งหมดในหน้าจอเดียว: tenant, subscription, รายได้, การใช้งาน
- เป็นหน้าแรกของ Super Admin Portal สำหรับติดตาม KPI ระดับแพลตฟอร์ม
- เป็น entry สู่โมดูลต่างๆ ผ่าน KPI card

## User Story
> As a **Super Admin**, I want **ดูภาพรวม KPI ของทั้งแพลตฟอร์มในหน้าเดียว**, so that **ติดตามการเติบโต, รายได้ และสุขภาพของ tenant ทั้งหมดได้อย่างรวดเร็ว**.

## Entry Point
- หน้าแรกหลัง login เข้าสู่ Super Admin Portal
- เมนูหลัก → "Dashboard"

## Exit Point
- คลิก KPI "Total Tenants" → Organization List (ADM-ORG-001)
- คลิก KPI "Active Subscriptions" → Subscription List (ADM-SUB-001)
- คลิก KPI "MRR / Revenue" → Revenue Analytics (ADM-ANALYTICS-002)
- คลิก KPI "Outstanding Invoices" → Invoice List (ADM-BILL-001)

## Components
- KPI Cards: Total Tenants, Active Subscriptions, Trial Tenants, MRR, รายได้เดือนนี้, Outstanding Invoices
- Chart: การเติบโตของ tenant (รายเดือน)
- Chart: MRR trend
- Breakdown: tenant ตาม plan (Starter/Business/Pro/Enterprise)
- Widget: tenant ใหม่ล่าสุด
- Widget: subscription ใกล้หมดอายุ
- ตัวเลือกช่วงเวลา (เดือนนี้ / ไตรมาส / ปี)

## Validation Rules
- ช่วงเวลาที่เลือกต้องถูกต้อง (เริ่มไม่หลังสิ้นสุด)
- เฉพาะ Super Admin เท่านั้นที่เข้าถึงได้ (ข้อมูล cross-tenant)

## API Dependencies
- Platform metrics aggregate — — (ยังไม่มี endpoint; อ้างอิงตาราง `daily_metrics`, `monthly_metrics`)
- `GET /api/v1/organizations` — นับ/รายชื่อ tenant ล่าสุด
- `GET /api/v1/subscriptions` — subscription active/ใกล้หมดอายุ

## Edge Cases
- ยังไม่มีข้อมูลในช่วงที่เลือก → empty/zero state ใน card และ chart
- Loading: card/chart skeleton แยกส่วน
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- ข้อมูลบางส่วนโหลดล้มเหลว → แสดงเฉพาะ widget ที่ผิดพลาดพร้อม retry
- API error → error state ระดับ widget ไม่ทำทั้งหน้าพัง

## Success Criteria
- KPI card แสดงค่าถูกต้องตามช่วงเวลาที่เลือก
- Chart การเติบโตและ MRR แสดงแนวโน้มสอดคล้องข้อมูลจริง
- คลิก KPI card นำทางไปโมดูลที่เกี่ยวข้องได้
- เฉพาะ Super Admin เข้าถึงได้
