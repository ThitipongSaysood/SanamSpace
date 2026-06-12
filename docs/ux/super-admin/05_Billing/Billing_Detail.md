---
id: ADM-BILL-002
screen: Billing Detail
module: Billing
app: Super Admin
status: draft
updated: 2026-06-12
---

# ADM-BILL-002 · Billing Detail

## Objective
- แสดงรายละเอียด invoice หนึ่งใบ: รายการเรียกเก็บ, ยอด, ภาษี, สถานะชำระเงิน, การชำระเงินที่ผูก
- ใช้จัดการ invoice รายใบ: mark as paid, ออกใหม่/แก้ไข, ดาวน์โหลด PDF/ใบกำกับภาษี
- เชื่อมโยงกับ subscription และ organization ที่เกี่ยวข้อง

## User Story
> As a **Super Admin**, I want **ดูและจัดการรายละเอียด invoice หนึ่งใบ**, so that **ตรวจสอบยอด, สถานะชำระเงิน และดำเนินการทางบัญชีได้ถูกต้อง**.

## Entry Point
- คลิกแถว invoice จาก Invoice List (ADM-BILL-001)
- ลิงก์ invoice จาก Subscription Detail (ADM-SUB-002)

## Exit Point
- ย้อนกลับ → Invoice List (ADM-BILL-001)
- คลิก subscription → Subscription Detail (ADM-SUB-002)
- คลิก organization → Organization Detail (ADM-ORG-002)

## Components
- Header: invoice number, organization, สถานะชำระเงิน, วันออก, วันครบกำหนด
- Section "รายการเรียกเก็บ": plan/add-on, จำนวน, ราคาต่อหน่วย, ยอดรวม, ภาษี, ยอดสุทธิ
- Section "การชำระเงิน": วิธีชำระ, วันที่ชำระ, อ้างอิง/สลิป (subscription_payments)
- Action: mark as paid, ออกใบกำกับภาษี, ดาวน์โหลด PDF, ส่ง invoice ซ้ำ

## Validation Rules
- ผูกกับ invoice id จาก route
- การ mark as paid ต้องระบุวิธี/วันที่ชำระและยืนยัน
- เฉพาะ Super Admin เท่านั้นที่จัดการได้

## API Dependencies
- Invoice detail (subscription_invoices) — — (ยังไม่มี endpoint; อ้างอิงตาราง `subscription_invoices`, `subscription_payments`)
- `GET /api/v1/subscriptions` — subscription ที่ผูกกับ invoice
- `GET /api/v1/organizations/{id}` — ข้อมูล tenant ผู้รับ invoice

## Edge Cases
- ไม่พบ invoice → not-found state
- Loading: section skeleton
- Permission denied: ผู้ใช้ที่ไม่ใช่ Super Admin → ปฏิเสธการเข้าถึง
- mark as paid ซ้ำกับ invoice ที่ชำระแล้ว → ป้องกัน/แจ้งเตือน
- invoice overdue → ไฮไลต์และเสนอ action ติดตาม
- API error → แสดง error state + retry

## Success Criteria
- แสดงรายการเรียกเก็บ, ยอด, ภาษี และการชำระเงินครบถ้วน
- mark as paid และออกใบกำกับภาษีทำงานและสะท้อนสถานะใหม่
- ดาวน์โหลด PDF/ส่ง invoice ซ้ำได้
- นำทางไป Subscription Detail และ Organization Detail ได้
