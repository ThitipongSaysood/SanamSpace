---
id: OWN-PAY-003
screen: Refund Management
module: Payment
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-PAY-003 · Refund Management

## Objective
- สร้างคำขอคืนเงินจาก payment ที่ verified แล้ว และอนุมัติคำขอคืนเงิน
- ระบุยอดคืน (เต็ม/บางส่วน) และเหตุผล
- ติดตามสถานะการคืนเงิน

## User Story
> As an **Owner/Cashier/Manager**, I want **สร้างและอนุมัติคำขอคืนเงิน**, so that **คืนเงินให้ลูกค้าที่ยกเลิก booking ได้อย่างถูกต้องและตรวจสอบย้อนหลังได้**.

## Entry Point
- ปุ่ม "ทำคืนเงิน" จาก Payment List (OWN-PAY-001)
- ลิงก์จาก Booking Detail (OWN-BOOK-003) เมื่อยกเลิก booking ที่ชำระแล้ว

## Exit Point
- สร้าง/อนุมัติสำเร็จ → กลับ Payment List (OWN-PAY-001)
- ยกเลิกการทำรายการ → กลับหน้าก่อนหน้า

## Components
- Refund form: payment ต้นทาง, ยอดที่ชำระ, ยอดคืน (เต็ม/บางส่วน), เหตุผล, ช่องทางคืน
- ปุ่ม "สร้างคำขอคืนเงิน"
- ปุ่ม "อนุมัติ" (เฉพาะ role ที่มีสิทธิ์ approve)
- สถานะคำขอ: รออนุมัติ / อนุมัติแล้ว
- ประวัติการคืนเงินของ payment นั้น

## Validation Rules
- คืนได้เฉพาะ payment ที่ verified แล้วเท่านั้น
- ยอดคืน > 0 และ ≤ ยอดที่ชำระจริง
- เหตุผลคืนเงินเป็น required
- ผูกกับ `organization_id`; ห้ามทำข้ามสาขา/ข้าม tenant

## API Dependencies
- `POST /api/v1/refunds` — สร้างคำขอคืนเงิน
- `POST /api/v1/refunds/{id}/approve` — อนุมัติคำขอคืนเงิน
- `GET /api/v1/payments` — อ้างอิง payment ต้นทาง

## Edge Cases
- ยอดคืนเกินยอดชำระ → block + แจ้ง error
- คืนซ้ำเกินยอดคงเหลือ (รวมคืนบางส่วนก่อนหน้า) → block
- Permission denied: Reception/Marketing/Coach = None; Cashier/Manager = Approve; Accountant/Viewer = View
- Concurrent approve: คำขอถูกอนุมัติแล้ว → disable ปุ่ม, แสดงสถานะ
- API error → คงสถานะเดิม + retry

## Success Criteria
- สร้างคำขอคืนเงิน (เต็ม/บางส่วน) สำเร็จและบันทึกเหตุผล
- อนุมัติแล้วสถานะเป็น approved และยอดคงเหลือคืนได้ลดลงถูกต้อง
- คืนได้เฉพาะ payment ที่ verified
- เฉพาะ role ที่มีสิทธิ์ approve เท่านั้นที่อนุมัติได้
