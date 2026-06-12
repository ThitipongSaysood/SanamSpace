---
id: OWN-CUST-002
screen: Customer Detail
module: Customer
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-CUST-002 · Customer Detail

## Objective
- แสดงโปรไฟล์ลูกค้ารายคน: ข้อมูลติดต่อ, ยอดใช้จ่ายรวม, จำนวนครั้งที่มา, กีฬาที่ชอบ
- รวมข้อมูล CRM: สมาชิก/tier, points, ประวัติการจอง, tags, notes, timeline
- ใช้แก้ไขข้อมูลลูกค้าและดูภาพรวมความสัมพันธ์

## User Story
> As an **Owner/Manager/Reception**, I want **ดูและแก้ไขโปรไฟล์ลูกค้ารายคน**, so that **เข้าใจพฤติกรรมลูกค้าและดูแลลูกค้าได้ตรงจุด**.

## Entry Point
- คลิกแถวลูกค้าจาก Customer List (OWN-CUST-001)
- ลิงก์ชื่อลูกค้าจาก Booking Detail / Payment / CRM

## Exit Point
- กลับ Customer List (OWN-CUST-001)
- ลิงก์ไป Booking Detail ของลูกค้า / Membership (OWN-MEMBER-001)

## Components
- Header: ชื่อ, เบอร์, ช่องทาง LINE, tier สมาชิก, ปุ่มแก้ไข
- Stat cards: ยอดใช้จ่ายรวม, จำนวนครั้ง, กีฬาที่ชอบ, points/tier
- Tab "ประวัติการจอง" — รายการ booking ของลูกค้า
- Tab "Tags & Notes" (Business+) — เพิ่ม/ลบ tag, บันทึก note
- Tab "Timeline" (Pro+) — ไทม์ไลน์กิจกรรม/การติดตาม CRM
- Form แก้ไขข้อมูลพื้นฐาน (ตามสิทธิ์)

## Validation Rules
- ผูกกับ `customer_id` ภายใน `organization_id` เดียวกันเท่านั้น
- แก้ไขเบอร์/ชื่อ: required, รูปแบบเบอร์ถูกต้อง
- Tags/Notes แสดงเฉพาะ Business+; Timeline เฉพาะ Pro+
- การแก้ไขถูกบันทึกลง audit log

## API Dependencies
- `GET /api/v1/customers/{id}` — โหลดโปรไฟล์ลูกค้า
- `PUT /api/v1/customers/{id}` — แก้ไขข้อมูลลูกค้า
- `GET /api/v1/timeline/{customerId}` — (Pro+) timeline กิจกรรม CRM
- `GET /api/v1/memberships` — สถานะสมาชิก/tier ของลูกค้า

## Edge Cases
- Not found: ลูกค้าไม่อยู่/ถูกลบ → empty/error state
- Loading: skeleton ของ header และแต่ละ tab
- Permission denied: Cashier/Viewer = View → form อ่านอย่างเดียว; Reception/Manager = Manage แก้ไขได้
- Plan gating: tab Tags/Notes (Business+) และ Timeline (Pro+) ถูกซ่อนหรือล็อก พร้อมแนะนำอัปเกรด
- Concurrent edit: ข้อมูลถูกแก้โดยคนอื่น → เตือน conflict ก่อนบันทึกทับ
- API error → error banner + retry

## Success Criteria
- โปรไฟล์แสดงข้อมูลติดต่อ สถิติ และประวัติการจองถูกต้อง
- แก้ไขข้อมูลลูกค้าได้ตามสิทธิ์และบันทึก audit log
- Tags/Notes และ Timeline แสดงตาม plan ที่รองรับ
- Cashier/Viewer เห็นแบบ read-only
