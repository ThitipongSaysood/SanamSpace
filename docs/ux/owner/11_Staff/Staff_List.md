---
id: OWN-STAFF-001
screen: Staff List
module: Staff
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-STAFF-001 · Staff List

## Objective
- แสดงรายชื่อพนักงาน (users) ขององค์กรพร้อม role ที่ได้รับ
- ค้นหา-กรองตาม role/สถานะ และเป็น entry สู่การเพิ่ม/แก้ไขพนักงาน
- เฉพาะ Owner เท่านั้นที่จัดการได้

## User Story
> As an **Owner**, I want **ดูรายชื่อพนักงานและ role ของแต่ละคน**, so that **บริหารทีมงานและสิทธิ์การเข้าถึงในองค์กรได้**.

## Entry Point
- เมนู Staff จาก sidebar

## Exit Point
- ปุ่ม "เพิ่มพนักงาน" → Staff Form (OWN-STAFF-002)
- คลิกแถวพนักงาน → Staff Form (OWN-STAFF-002) โหมดแก้ไข
- ลิงก์ "จัดการสิทธิ์" → Roles & Permissions (OWN-STAFF-003)

## Components
- Data table: ชื่อ, อีเมล, role, สาขา, สถานะ (active/inactive), เข้าใช้ล่าสุด
- Filters: role, สาขา, สถานะ, ค้นหาชื่อ/อีเมล
- ปุ่ม "เพิ่มพนักงาน"
- Row action: แก้ไข, ปิด/เปิดใช้งาน
- Pagination

## Validation Rules
- ผูกกับ `organization_id`; ไม่แสดงพนักงานข้าม tenant
- คำค้นหาขั้นต่ำตามที่ระบบกำหนด
- เฉพาะ Owner เท่านั้น (Staff = Full เฉพาะ Owner)

## API Dependencies
- `GET /api/v1/users` — รายชื่อพนักงานพร้อม role/สถานะ
- `GET /api/v1/roles` — อ้างอิงรายชื่อ role สำหรับ filter

## Edge Cases
- Empty/filter ไม่พบ → empty state "ไม่พบพนักงานตามเงื่อนไข"
- Loading: table skeleton
- Permission denied: ทุก role ยกเว้น Owner = None → เข้าหน้านี้ไม่ได้
- พนักงาน inactive → แสดง badge และซ่อน action บางอย่าง
- API error → error state + retry

## Success Criteria
- ตารางแสดงพนักงานและ role ตาม filter ถูกต้อง
- ค้นหา/กรองตาม role/สาขา/สถานะ ได้ผลตรง
- คลิกเข้าแก้ไขและเพิ่มพนักงานได้
- เฉพาะ Owner เข้าถึงได้
