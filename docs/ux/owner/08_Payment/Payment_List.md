---
id: OWN-PAY-001
screen: Payment List
module: Payment
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-PAY-001 · Payment List

## Objective
- แสดงรายการชำระเงินทั้งหมดของสาขาแบบตาราง ค้นหา-กรอง-เรียงได้
- ติดตามสถานะการชำระ (รอตรวจ/ตรวจแล้ว/ปฏิเสธ) และยอดเงิน
- เป็น entry สู่ Verify Slip และ Refund Management

## User Story
> As an **Owner/Cashier/Manager**, I want **ดูและกรองรายการชำระเงินเป็นตาราง**, so that **ติดตามสถานะการชำระและเข้าตรวจสลิป/ทำคืนเงินได้รวดเร็ว**.

## Entry Point
- เมนู Payment จาก sidebar
- คลิก KPI Card Revenue จาก Dashboard (OWN-DASH-002)
- ลิงก์จาก Booking Detail (OWN-BOOK-003) → ดูการชำระของ booking นั้น

## Exit Point
- คลิกแถวที่สถานะ "รอตรวจสลิป" → Verify Slip (OWN-PAY-002)
- คลิก "ทำคืนเงิน" → Refund Management (OWN-PAY-003)
- คลิกแถวข้าม → Booking Detail (OWN-BOOK-003)

## Components
- Data table: คอลัมน์ payment code, booking code, ลูกค้า, ช่องทาง (PromptPay/Card/Wallet/โอน), ยอดเงิน, สถานะชำระ, วันที่/เวลา
- Filters: ช่วงวันที่, สถานะ (pending/verified/rejected), ช่องทางชำระ, ค้นหาชื่อ/เบอร์/code
- Sort: ตามวันที่/ยอดเงิน
- Badge สถานะ: รอตรวจ (warning) / ตรวจแล้ว (success) / ปฏิเสธ (danger)
- Pagination
- Row action: ตรวจสลิป, ทำคืนเงิน (ตามสิทธิ์)
- ปุ่ม Export (เฉพาะ role ที่มีสิทธิ์ export)

## Validation Rules
- ผูกกับ `branch_id` / `organization_id`; ค่าเริ่มต้นแสดงรายการล่าสุด
- ช่วงวันที่ filter: `date_from` ไม่หลัง `date_to`
- คำค้นหาขั้นต่ำตามที่ระบบกำหนด (เช่น 2 ตัวอักษร) ก่อนยิง query

## API Dependencies
- `GET /api/v1/payments` — รายการชำระเงินพร้อม filter/sort/pagination
- `GET /api/v1/bookings/{id}` — preview booking ที่ผูกกับการชำระ
- `GET /api/v1/refunds` — (—) ไม่มี endpoint list refund ใน spec; ใช้สถานะจาก payment

## Edge Cases
- Empty data: filter ไม่พบผลลัพธ์ → empty state "ไม่พบรายการชำระเงินตามเงื่อนไข"
- Loading: table skeleton
- Permission denied: Marketing/Coach = None เข้าหน้านี้ไม่ได้; Accountant/Viewer ได้ View อย่างเดียว (ซ่อนปุ่มตรวจ/คืนเงิน)
- Concurrent verify: สลิปถูกตรวจโดยคนอื่น → สถานะอัปเดต, ปุ่มตรวจถูก disable
- API error → error state + retry

## Success Criteria
- ตารางแสดงรายการชำระตาม filter/sort/หน้า ถูกต้อง
- กรองตามสถานะ/ช่องทาง/วันที่ ได้ผลตรง
- Cashier เข้าตรวจสลิปและทำคืนเงินได้; Accountant/Viewer เห็น read-only
- Export ทำได้เฉพาะ role ที่มีสิทธิ์
