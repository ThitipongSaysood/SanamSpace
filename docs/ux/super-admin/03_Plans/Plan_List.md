---
id: ADM-PLAN-001
screen: Plan List
module: Plans
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-PLAN-001 · Plan List

## Objective
- แสดงรายการ subscription plan ทั้งหมด (Starter/Business/Pro/Enterprise) พร้อมราคาและ limit หลัก
- ใช้บริหารจัดการ plan: สร้าง, แก้ไข, เปิด/ปิดการขาย
- เป็น entry สู่ Plan Form

## User Story
> As a **Super Admin**, I want **ดูรายการ plan ทั้งหมดพร้อมราคาและ limit**, so that **บริหารโครงสร้างแพ็กเกจของแพลตฟอร์มและเข้าไปแก้ไขแต่ละ plan ได้**.

## Entry Point
- เมนูหลัก Super Admin Portal → "Plans"
- ลิงก์ "จัดการ Plan" จาก Subscription List (ADM-SUB-001)

## Exit Point
- คลิกแถว plan → Plan Form (ADM-PLAN-002) โหมดแก้ไข
- คลิก "สร้าง Plan" → Plan Form (ADM-PLAN-002) โหมดสร้าง

## Components
- Data table / card list: ชื่อ plan, ราคา/เดือน, limit หลัก (branches, courts, staff, monthly bookings, storage), สถานะ (เปิด/ปิดขาย), จำนวน tenant ที่ใช้
- Reference ราคา: Starter 990, Business 1,990, Pro 3,990, Enterprise Custom (THB/เดือน)
- Row action: แก้ไข, เปิด/ปิดการขาย
- ปุ่ม "สร้าง Plan"
- Sort: ตามราคา / ชื่อ

## Validation Rules
- เฉพาะ Super Admin เท่านั้นที่เข้าถึงและจัดการได้
- การปิดการขาย plan ที่ยังมี tenant ใช้งานต้องยืนยันก่อน

## API Dependencies
- Plan management (list) — — (ยังไม่มี endpoint; อ้างอิงตาราง `plans`)

## Edge Cases
- Empty data: ไม่มี plan → empty state พร้อมปุ่มสร้าง
- Loading: skeleton
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- ปิดการขาย plan ที่มี tenant ใช้งาน → เตือนว่ามี subscription ผูกอยู่
- API error → แสดง error state + retry

## Success Criteria
- แสดง plan ทั้ง 4 พร้อมราคาและ limit ตรงกับ Feature Matrix
- สร้าง/แก้ไข/เปิด-ปิดขาย plan ได้
- จำนวน tenant ต่อ plan แสดงถูกต้อง
- เฉพาะ Super Admin เข้าถึงได้
