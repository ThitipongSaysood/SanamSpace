---
id: OWN-PROMO-001
screen: Promotion List
module: Promotion
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-PROMO-001 · Promotion List

## Objective
- แสดงโปรโมชันทั้งหมดของ tenant (Happy Hour / Flash Promotion / ส่วนลด) แบบตาราง
- ใช้ติดตามสถานะโปร (active/scheduled/expired) และผลการใช้งาน
- เป็น entry สู่ Promotion Form และ Coupon List

## User Story
> As an **Owner/Manager/Marketing**, I want **ดูและจัดการโปรโมชันทั้งหมด**, so that **ติดตามแคมเปญที่กำลังทำงานและสร้าง/แก้ไขโปรได้รวดเร็ว**.

## Entry Point
- เมนู "โปรโมชัน" (Promotion) จาก sidebar Owner Portal
- ลิงก์จาก CRM / Auto Promotion (สนามว่าง → ส่งโปร)

## Exit Point
- คลิก "สร้างโปรโมชัน" หรือแถวโปร → Promotion Form (OWN-PROMO-002)
- คลิก "คูปอง" → Coupon List (OWN-PROMO-003)

## Components
- Data table: คอลัมน์ ชื่อโปร, ประเภท, ส่วนลด, ช่วงเวลา, สถานะ, จำนวนการใช้
- Filters: ประเภทโปร, สถานะ (active/scheduled/expired), ค้นหาชื่อ, ช่วงวันที่
- Sort: ตามวันที่เริ่ม/สิ้นสุด/จำนวนการใช้
- Pagination
- Row action: แก้ไข, เปิด/ปิดใช้งาน, ทำสำเนา (ตามสิทธิ์)
- ปุ่ม "สร้างโปรโมชัน" และลิงก์ "คูปอง"
- Banner gating หาก plan ไม่รองรับ (Promotions = Business+)

## Validation Rules
- ผูกกับ `organization_id`; ไม่แสดงข้าม tenant
- ฟีเจอร์เปิดเฉพาะ plan Business ขึ้นไป; Starter ถูก lock
- ช่วงวันที่ filter: `date_from` ไม่หลัง `date_to`

## API Dependencies
- `GET /api/v1/promotions` — รายการโปรโมชันพร้อม filter/sort/pagination
- `POST /api/v1/promotions` — สร้าง/อัปเดต (ใช้จาก row action toggle)

## Edge Cases
- Plan gating: Starter → หน้าถูก lock + แนะนำอัปเกรดเป็น Business
- Empty data: ยังไม่มีโปร → empty state "ยังไม่มีโปรโมชัน"
- Loading: table skeleton
- Permission denied: Reception/Cashier/Coach/Accountant = None เข้าไม่ได้; Viewer = View; Manager = Manage; Marketing = Full
- โปรที่หมดอายุ/scheduled → badge แยกสถานะ
- API error → error state + retry

## Success Criteria
- ตารางแสดงโปรของ tenant ตาม filter/sort/สถานะ ถูกต้อง
- สร้าง/แก้ไข/เปิด-ปิดโปรได้ตามสิทธิ์
- หน้าถูก lock อย่างถูกต้องบน plan Starter
- Marketing มีสิทธิ์ Full; Viewer เห็นแบบ read-only
