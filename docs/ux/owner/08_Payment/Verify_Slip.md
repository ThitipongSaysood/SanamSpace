---
id: OWN-PAY-002
screen: Verify Slip
module: Payment
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-PAY-002 · Verify Slip

## Objective
- ตรวจสอบสลิปการโอนเงินของลูกค้าและอนุมัติ/ปฏิเสธการชำระ
- เทียบยอดในสลิปกับยอดที่ต้องชำระและตรวจสลิปซ้ำ (duplicate)
- ปรับสถานะ payment เป็น verified หรือ rejected

## User Story
> As a **Cashier/Manager/Owner**, I want **ดูภาพสลิปและยืนยันหรือปฏิเสธการชำระ**, so that **ยืนยันว่าลูกค้าจ่ายเงินจริงและปลดล็อกสถานะ booking ได้ถูกต้อง**.

## Entry Point
- คลิกแถวสถานะ "รอตรวจสลิป" จาก Payment List (OWN-PAY-001)
- Notification/queue งานตรวจสลิปใหม่

## Exit Point
- กด "อนุมัติ" → payment.verified → กลับ Payment List (OWN-PAY-001)
- กด "ปฏิเสธ" → payment.rejected → กลับ Payment List (OWN-PAY-001)

## Components
- Slip viewer: ภาพสลิป (zoom/หมุน) จาก Cloudflare R2
- Payment summary: ยอดที่ต้องชำระ, ยอดในสลิป, ช่องทาง, เวลาโอน, booking code/ลูกค้า
- ผล OCR + flag duplicate detection (ถ้ามี)
- ปุ่ม "อนุมัติ" / "ปฏิเสธ"
- ช่องระบุเหตุผลปฏิเสธ (required เมื่อ reject)

## Validation Rules
- เฉพาะ payment สถานะ pending เท่านั้นที่ตรวจได้
- เหตุผลปฏิเสธเป็น required ก่อนยืนยัน reject
- ผูกกับ `organization_id`; ห้ามตรวจข้ามสาขา/ข้าม tenant
- เตือนเมื่อยอดในสลิปไม่ตรงกับยอดที่ต้องชำระ

## API Dependencies
- `GET /api/v1/payments` — ดึงรายการ/รายละเอียด payment (ไม่มี GET /payments/{id} ใน spec)
- `POST /api/v1/payments/{id}/verify` — อนุมัติการชำระ
- `POST /api/v1/payments/{id}/reject` — ปฏิเสธการชำระ (พร้อมเหตุผล)

## Edge Cases
- สลิปโหลดไม่ขึ้น (R2 error) → placeholder + ปุ่มลองใหม่
- Duplicate slip: ระบบ flag → เตือนก่อนอนุมัติ
- ยอดไม่ตรง → เตือน, ให้ยืนยันก่อนอนุมัติ
- Concurrent: payment ถูกตรวจแล้วโดยคนอื่น → แสดงสถานะปัจจุบัน, disable ปุ่ม
- Permission denied: Reception = Upload Slip เท่านั้น (ตรวจไม่ได้); Manager = Verify; Cashier = Full
- API error → คงสถานะเดิม + แจ้ง retry

## Success Criteria
- อนุมัติแล้ว payment = verified และ booking ปลดล็อกสถานะชำระ
- ปฏิเสธแล้ว payment = rejected พร้อมบันทึกเหตุผล
- ตรวจซ้ำไม่ได้หลังตัดสินแล้ว
- เฉพาะ role ที่มีสิทธิ์ verify/reject เท่านั้นที่กดปุ่มได้
