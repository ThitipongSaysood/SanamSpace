---
id: OWN-CRM-003
screen: Customer Timeline
module: CRM
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-CRM-003 · Customer Timeline

## Objective
- แสดงประวัติกิจกรรมของลูกค้ารายคนแบบไทม์ไลน์ในที่เดียว (การจอง, การชำระเงิน, สมาชิก, คูปอง, Broadcast ที่ได้รับ)
- ช่วยให้ทีมเข้าใจพฤติกรรมลูกค้าเพื่อดูแลและทำการตลาดต่อเนื่อง
- เป็นฟีเจอร์ระดับ **Pro+** (Customer Timeline = Pro/Enterprise เท่านั้น)

## User Story
> As an **Owner / Marketing / Manager**, I want **ดูประวัติกิจกรรมทั้งหมดของลูกค้าคนหนึ่งแบบไทม์ไลน์**, so that **เข้าใจพฤติกรรมและดูแลลูกค้าได้ตรงจุด**.

## Entry Point
- คลิกชื่อลูกค้าจาก Customer Segments (OWN-CRM-001) หรือ Customer list
- ลิงก์จากหน้า Booking / Payment ที่อ้างถึงลูกค้า
- ค้นหาลูกค้าจากเมนู CRM > Customers

## Exit Point
- กด "สร้าง Broadcast / ส่งคูปอง" → ไป Broadcast Composer (OWN-CRM-002)
- กด "ตั้ง Follow Up" → ไป Follow Up (OWN-CRM-004)
- ปิด/ย้อนกลับ → กลับหน้ารายการลูกค้าหรือ Segment เดิม

## Components
- Customer profile header: ชื่อ, รูป LINE, แท็ก, Membership Tier, Segment ที่สังกัด, ยอดใช้จ่ายสะสม
- Timeline feed: เหตุการณ์เรียงตามเวลา (booking.created, payment.verified, membership.upgraded, wallet.topup, คูปอง, Broadcast ที่ได้รับ)
- Filter: กรองตามประเภทเหตุการณ์และช่วงเวลา
- Notes & Tags panel: บันทึกภายในและแท็กลูกค้า
- Quick actions: ส่งคูปอง, สร้าง Broadcast, ตั้ง Follow Up

## Validation Rules
- ต้องระบุ customerId ที่มีอยู่จริงและอยู่ใน organization เดียวกัน (no cross-tenant access)
- การเพิ่ม Note ต้องมีเนื้อหา (required) และบันทึกผู้เขียน/เวลา
- กรองช่วงเวลา: วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด

## API Dependencies
- `GET /api/v1/timeline/{customerId}` — ดึงเหตุการณ์ไทม์ไลน์ของลูกค้า
- `GET /api/v1/customers/{id}` — ดึงข้อมูลโปรไฟล์ลูกค้า
- `PUT /api/v1/customers/{id}` — อัปเดตแท็ก/โน้ตลูกค้า (ref: structure/API_Specification_v1.md)

## Edge Cases
- Plan ไม่รองรับ (Starter/Business): แสดงหน้า Upsell ชวนอัปเกรดเป็น Pro
- ลูกค้าใหม่/ไม่มีกิจกรรม: แสดง empty state พร้อมคำแนะนำ
- customerId ไม่พบ หรือข้ามองค์กร: แสดง 404 / Permission Denied
- ผู้ใช้ไม่มีสิทธิ์ (Reception/Cashier/Coach/Accountant ตาม CRM = None): บล็อกการเข้าถึง
- ไทม์ไลน์ยาวมาก: โหลดแบบ pagination / infinite scroll พร้อม skeleton

## Success Criteria
- เปิด Timeline แล้วเห็นเหตุการณ์ครบตามจริง เรียงเวลาถูกต้อง
- กรองตามประเภท/ช่วงเวลาได้ผลถูกต้อง
- เพิ่ม Note/Tag แล้วบันทึกและแสดงผลทันที
- ผู้ใช้ Starter/Business เห็นหน้า Upsell และเข้าใช้งานไม่ได้
- สิทธิ์ตาม Permission Matrix: Owner Full, Marketing Full, Manager Manage
