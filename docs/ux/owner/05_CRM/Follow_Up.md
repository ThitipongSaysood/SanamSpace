---
id: OWN-CRM-004
screen: Follow Up
module: CRM
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-CRM-004 · Follow Up

## Objective
- ตั้งค่า Automation ติดตามลูกค้าแบบอัตโนมัติ: Send Coupon, Birthday Coupon, Rebooking Reminder
- กำหนด trigger จาก Segment หรือเหตุการณ์ (เช่น Inactive 30/90 วัน, วันเกิด, ไม่กลับมาจอง)
- ลดงานทำมือ ทำให้ลูกค้าได้รับการดูแลต่อเนื่องอัตโนมัติ
- เป็นฟีเจอร์ระดับ **Pro+** (Customer Follow-up / CRM Automation = Pro/Enterprise)

## User Story
> As an **Owner / Marketing**, I want **ตั้งกฎติดตามลูกค้าแบบอัตโนมัติตามเงื่อนไข**, so that **ลูกค้าได้รับคูปองและการแจ้งเตือนกลับมาจองโดยไม่ต้องทำมือทุกครั้ง**.

## Entry Point
- เมนู CRM > Follow Up (Automation) จาก Owner Admin Portal
- ปุ่ม "ตั้ง Follow Up" จาก Customer Segments (OWN-CRM-001) หรือ Customer Timeline (OWN-CRM-003)

## Exit Point
- บันทึกกฎสำเร็จ → กลับหน้ารายการ Follow Up พร้อมสถานะ (Active/Paused)
- ยกเลิก → กลับหน้ารายการ Follow Up

## Components
- Automation list: รายการกฎติดตามทั้งหมด พร้อมประเภท, Segment เป้าหมาย, สถานะ, สถิติการส่ง
- Rule builder: เลือก trigger (Inactive 30/90 วัน, วันเกิด, ไม่กลับมาจอง), Audience (Segment), Action (ส่งคูปอง/แจ้งเตือนผ่าน LINE/Email/SMS)
- Schedule: เวลาส่งและความถี่ (ครั้งเดียว/วนซ้ำ)
- Coupon picker: เลือกคูปอง/โปรโมชันที่จะแนบ
- Preview & test: ประมาณการจำนวนผู้รับและส่งทดสอบ
- ปุ่ม Action: เปิด/หยุดกฎ, แก้ไข, ลบ

## Validation Rules
- ต้องเลือก trigger, Audience (Segment) และ Action อย่างน้อยอย่างละ 1
- Birthday Coupon ต้องมีข้อมูลวันเกิดลูกค้าจึงจะ trigger
- คูปองที่แนบต้องยัง active และไม่หมดอายุ
- ผู้รับต้องไม่เกินโควตา Broadcast/SMS ของแผน และเคารพ throttle
- Rebooking Reminder ต้องกำหนดจำนวนวันหลังการจองล่าสุด (> 0)

## API Dependencies
- `POST /api/v1/broadcasts` — สั่งส่งคูปอง/แจ้งเตือนเข้า Job Queue เมื่อ trigger ทำงาน
- `GET /api/v1/segments` — เลือก Segment เป็นเป้าหมายของกฎ
- `GET /api/v1/coupons` / `POST /api/v1/coupons` — เลือก/สร้างคูปองที่จะแนบ
- `GET /api/v1/notifications` — ติดตามสถานะการส่งของ Automation (ref: structure/API_Specification_v1.md)

## Edge Cases
- Plan ไม่รองรับ (Starter/Business): แสดงหน้า Upsell ชวนอัปเกรดเป็น Pro
- Segment เป้าหมายว่าง: เตือนว่าจะไม่มีผู้รับและไม่ให้เปิดใช้งานกฎ
- โควตาหมด: หยุดส่งและแจ้งเตือน Owner/Marketing
- ผู้ใช้ไม่มีสิทธิ์ (CRM/Broadcast: Manager จำกัด, อื่นๆ None): แสดง Permission Denied
- กฎซ้อนทับกัน (ลูกค้าเข้าหลายกฤ): กันส่งซ้ำในช่วงเวลาเดียวกัน
- คูปองหมดอายุระหว่างกฎทำงาน: ข้ามและบันทึก log

## Success Criteria
- ตั้งกฎแล้วเมื่อถึง trigger ระบบส่งคูปอง/แจ้งเตือนให้กลุ่มเป้าหมายอัตโนมัติ
- Birthday Coupon ส่งตรงวันเกิด และ Rebooking Reminder ส่งตามจำนวนวันที่กำหนด
- ระบบเคารพโควตาและ throttle ไม่ส่งซ้ำเกินกำหนด
- ผู้ใช้ Starter/Business เห็นหน้า Upsell และตั้งกฎไม่ได้
- สิทธิ์ตาม Permission Matrix: Owner Full, Marketing Full, Manager Manage
