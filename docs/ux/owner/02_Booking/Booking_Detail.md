---
id: OWN-BOOK-003
screen: Booking Detail
module: Booking
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-BOOK-003 · Booking Detail

## Objective
- แสดงรายละเอียด booking รายการเดียวแบบครบถ้วน (ลูกค้า, court, เวลา, การชำระเงิน, ประวัติ)
- เป็นศูนย์กลางจัดการ 1 booking: approve, cancel, refund, check-in/out, verify payment
- ให้ทุก role ที่เกี่ยวข้องทำงานตามสิทธิ์ของตนบนรายการเดียวกัน

## User Story
> As an **Owner/Manager/Reception**, I want **ดูและจัดการรายละเอียดของ booking รายการเดียวในที่เดียว**, so that **อนุมัติ/ยกเลิก/คืนเงิน/เช็คอินและตรวจสลิปได้ครบในจอเดียว**.

## Entry Point
- คลิก booking จาก Booking Calendar (OWN-BOOK-001)
- คลิกแถวจาก Booking List (OWN-BOOK-002)
- คลิกรายการจาก Booking Widget (OWN-DASH-004)

## Exit Point
- กด check-in → Check In (OWN-BOOK-004)
- กด check-out → Check Out (OWN-BOOK-005)
- ปิด drawer/กลับ → กลับจอเดิม (Calendar/List)
- หลัง cancel/refund สำเร็จ → อัปเดตสถานะและคงอยู่หน้าเดิม

## Components
- Detail drawer/panel: ข้อมูลลูกค้า, court, วัน-เวลา, ราคา, booking code, สถานะ
- Payment section: ยอด, สถานะชำระเงิน, สลิป (preview), ปุ่ม verify/reject (ตามสิทธิ์)
- Action bar: Approve/Confirm, Cancel, Refund, Check-in, Check-out (แสดงตามสถานะ+สิทธิ์)
- Timeline/audit: ประวัติการเปลี่ยนสถานะ booking
- Note field สำหรับเหตุผล cancel/refund

## Validation Rules
- ต้องมี `booking_id` ที่อยู่ใน `organization_id`/`branch_id` ของ user
- Cancel/Refund ต้องระบุเหตุผล (note) ตามนโยบาย
- ปุ่มแต่ละ action เปิดเฉพาะเมื่อสถานะ booking สอดคล้อง (เช่น check-out ต้อง checked-in ก่อน)
- Verify payment ต้องมีสลิปอัปโหลดแล้ว

## API Dependencies
- `GET /api/v1/bookings/{id}` — โหลดรายละเอียด booking
- `POST /api/v1/bookings/{id}/cancel` — ยกเลิก booking
- `POST /api/v1/payments/{id}/verify` — ยืนยันการชำระเงิน (verify สลิป)
- `POST /api/v1/payments/{id}/reject` — ปฏิเสธสลิป
- `POST /api/v1/refunds` + `POST /api/v1/refunds/{id}/approve` — สร้าง/อนุมัติคืนเงิน
- `POST /api/v1/bookings/{id}/checkin` — เช็คอิน
- `POST /api/v1/bookings/{id}/checkout` — เช็คเอาท์

## Edge Cases
- Not found / soft-deleted booking → แสดง "ไม่พบรายการจอง"
- Loading: skeleton ของ panel
- Permission denied per role:
  - Reception: Booking = Manage, Check-in = Full, แต่ Payment = Upload Slip เท่านั้น และ Refund = None → ปุ่ม verify/refund ถูกซ่อน
  - Cashier: Booking = View แต่ Payment = Full, Refund = Approve → จัดการเงิน/คืนเงินได้ แต่แก้ booking ไม่ได้
  - Manager: Payment = Verify, Refund = Approve → ตรวจสลิป/อนุมัติคืนเงินได้
- Concurrent edit: booking ถูก cancel/check-in โดยคนอื่นระหว่างเปิดอยู่ → action ขัดแย้งคืน 409 → แจ้งเตือน + รีโหลดสถานะ
- Action ไม่ตรงสถานะ (เช่น check-out ก่อน check-in) → ปุ่ม disable พร้อม tooltip
- API error ของ action → toast error, ไม่เปลี่ยนสถานะ UI

## Success Criteria
- แสดงข้อมูล booking และสถานะการชำระเงินครบถ้วนถูกต้อง
- แต่ละ action (cancel/verify/refund/check-in/out) ทำงานและอัปเดตสถานะทันที
- ปุ่ม action แสดง/ซ่อนตรงตามสิทธิ์ของแต่ละ role และสถานะ booking
- กรณี concurrent/permission-denied แสดงข้อความชัดเจนไม่ทำให้ข้อมูลเพี้ยน
