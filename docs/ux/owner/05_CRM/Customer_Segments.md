---
id: OWN-CRM-001
screen: Customer Segments
module: CRM
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-CRM-001 · Customer Segments

## Objective
- สร้างและจัดการกลุ่มลูกค้า (Segment) ตามเงื่อนไขพฤติกรรม เพื่อใช้ทำการตลาดแบบเจาะกลุ่ม
- รองรับ Segment สำเร็จรูป: VIP, Gold, Inactive 30 วัน, Inactive 90 วัน, High Value
- ใช้เป็น Audience ตั้งต้นสำหรับ Broadcast (OWN-CRM-002) และ Follow Up (OWN-CRM-004)
- เป็นฟีเจอร์ระดับ **Pro+** (Customer Segmentation = Pro/Enterprise เท่านั้น)

## User Story
> As an **Owner / Marketing**, I want **สร้าง Segment ลูกค้าจากเงื่อนไขการใช้งานจริง**, so that **ส่งโปรโมชันและสื่อสารตรงกลุ่มเป้าหมายได้แม่นยำขึ้น**.

## Entry Point
- เมนู CRM > Customer Segments จาก Owner Admin Portal
- ลิงก์จาก CRM Dashboard (การ์ดสรุปจำนวนลูกค้าแต่ละ Segment)

## Exit Point
- กด "สร้าง Broadcast" → ไป Broadcast Composer (OWN-CRM-002) พร้อม Segment ที่เลือกเป็น Audience
- กด "ตั้ง Follow Up" → ไป Follow Up (OWN-CRM-004)
- บันทึก/ยกเลิก Segment Builder → กลับหน้ารายการ Segment

## Components
- Segment list: รายการ Segment ทั้งหมด พร้อมจำนวนสมาชิก, ประเภท (สำเร็จรูป/กำหนดเอง), อัปเดตล่าสุด
- Segment builder: ฟอร์มกำหนดเงื่อนไข (criteria) แบบ AND/OR — ยอดใช้จ่ายสะสม, จำนวนการจอง, วันที่จองล่าสุด (inactive 30/90 วัน), Membership Tier, แท็กลูกค้า
- Preview panel: แสดงจำนวนลูกค้าที่เข้าเกณฑ์แบบเรียลไทม์ก่อนบันทึก
- Customer list (preview): ตัวอย่างรายชื่อสมาชิกใน Segment พร้อมลิงก์ไป Customer Timeline (OWN-CRM-003)
- ปุ่ม Action: สร้าง Broadcast, ตั้ง Follow Up, แก้ไข, ลบ

## Validation Rules
- ต้องมีชื่อ Segment (required) และห้ามซ้ำภายใน organization
- ต้องมีอย่างน้อย 1 เงื่อนไข (criteria) จึงบันทึกได้
- ค่าตัวเลข (ยอดใช้จ่าย/จำนวนจอง/จำนวนวัน) ต้องเป็นจำนวนเต็มบวก
- ช่วง inactive รับเฉพาะค่าที่กำหนด (30 / 90 วัน) หรือกำหนดเองมากกว่า 0
- Segment สำเร็จรูป (VIP/Gold/High Value/Inactive) แก้เงื่อนไขไม่ได้ ทำได้แค่ดูและ Clone

## API Dependencies
- `GET /api/v1/segments` — ดึงรายการ Segment ทั้งหมดของ organization
- `POST /api/v1/segments` — สร้าง Segment ใหม่จากเงื่อนไขที่กำหนด
- `GET /api/v1/customers` — ดึง/พรีวิวรายชื่อลูกค้าที่เข้าเกณฑ์
- `GET /api/v1/timeline/{customerId}` — เปิด Timeline ของลูกค้าในรายการ (ref: structure/API_Specification_v1.md)

## Edge Cases
- Plan ไม่รองรับ (Starter/Business): แสดงหน้า Upsell ชวนอัปเกรดเป็น Pro แทนหน้าจริง
- Segment ว่าง (0 คนเข้าเกณฑ์): แจ้งเตือนและปิดปุ่ม "สร้าง Broadcast"
- ผู้ใช้ไม่มีสิทธิ์ (เช่น Manager = Manage, Reception/Cashier = None): ซ่อนปุ่มแก้ไข/ลบ หรือแสดง Permission Denied
- โหลดรายการนาน: แสดง skeleton loading; ดึงข้อมูลผิดพลาด → แสดงปุ่มลองใหม่
- เงื่อนไขกว้างเกินไป (ครอบคลุมลูกค้าเกือบทั้งหมด): เตือนก่อนบันทึก

## Success Criteria
- สร้าง Segment จากเงื่อนไขแล้วจำนวนสมาชิกใน Preview ตรงกับผลลัพธ์จริงจาก API
- Segment ที่บันทึกปรากฏในรายการและเลือกเป็น Audience ใน Broadcast ได้
- ผู้ใช้ Starter/Business เห็นหน้า Upsell และเข้าใช้งานจริงไม่ได้
- สิทธิ์ตาม Permission Matrix: Owner Full, Marketing Full, Manager Manage
