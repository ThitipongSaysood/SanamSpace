---
id: OWN-CRM-002
screen: Broadcast
module: CRM
app: Owner
status: draft
updated: 2026-06-12
---

# OWN-CRM-002 · Broadcast

## Objective
- ส่งข้อความสื่อสารถึงลูกค้าเป็นกลุ่ม ผ่าน LINE OA / Email / SMS
- เลือก Audience จาก Segment (OWN-CRM-001) หรือกลุ่มลูกค้าทั้งหมด
- รองรับส่งทันทีหรือตั้งเวลาส่ง (Scheduled Campaign)
- เป็นฟีเจอร์ระดับ **Pro+** (Broadcast LINE / Scheduled Campaigns = Pro/Enterprise)

## User Story
> As an **Owner / Marketing**, I want **เขียนและส่งข้อความถึงกลุ่มลูกค้าที่เลือก**, so that **กระตุ้นการกลับมาจองและประชาสัมพันธ์โปรโมชันได้รวดเร็ว**.

## Entry Point
- เมนู CRM > Broadcast จาก Owner Admin Portal
- ปุ่ม "สร้าง Broadcast" จากหน้า Customer Segments (OWN-CRM-001) โดยติด Audience มาด้วย

## Exit Point
- ส่งสำเร็จ/ตั้งเวลาสำเร็จ → กลับหน้ารายการ Broadcast พร้อมสถานะ (Queued/Sent/Scheduled)
- ยกเลิก → กลับหน้ารายการ Broadcast หรือ Customer Segments

## Components
- Broadcast composer: เลือกช่องทาง (LINE/Email/SMS), หัวข้อ, เนื้อหา, แนบรูป/ปุ่มลิงก์
- Audience selector: เลือก Segment หรือลูกค้าทั้งหมด พร้อมแสดงจำนวนผู้รับโดยประมาณ
- Schedule: ส่งทันที หรือเลือกวัน-เวลา (Scheduled)
- Preview: แสดงตัวอย่างข้อความตามช่องทางที่เลือก
- Quota/throttle bar: แสดงโควตาคงเหลือของแผนและอัตราการส่ง
- ปุ่ม Action: ส่งทันที, ตั้งเวลา, บันทึกร่าง, ยกเลิก

## Validation Rules
- ต้องเลือกอย่างน้อย 1 ช่องทาง และเนื้อหาห้ามว่าง
- ต้องมี Audience และจำนวนผู้รับ > 0 จึงส่งได้
- จำกัดความยาวข้อความตามช่องทาง (SMS สั้นกว่า, LINE/Email ยาวกว่า)
- ตั้งเวลาส่งต้องเป็นเวลาในอนาคต
- จำนวนผู้รับต้องไม่เกินโควตาคงเหลือของแผน (broadcast quota)
- บังคับ throttle ตามอัตราที่ผู้ให้บริการกำหนด เพื่อกันการส่งถี่เกิน

## API Dependencies
- `POST /api/v1/broadcasts` — สร้างและส่ง/ตั้งเวลา Broadcast เข้า Job Queue
- `GET /api/v1/segments` — ดึง Segment เพื่อเลือกเป็น Audience
- `GET /api/v1/notifications` — ตรวจสอบสถานะ/ผลการส่งของ Broadcast (ref: structure/API_Specification_v1.md)

## Edge Cases
- Plan ไม่รองรับ (Starter/Business): แสดงหน้า Upsell ชวนอัปเกรดเป็น Pro
- Audience ว่าง (Segment 0 คน): ปิดปุ่มส่งและแจ้งให้แก้ Segment
- โควตาหมด: บล็อกการส่ง พร้อมแจ้งโควตาคงเหลือและวันรีเซ็ต
- ผู้ใช้ไม่มีสิทธิ์ (Manager = View, อื่นๆ = None): แสดง Permission Denied; เฉพาะ Owner/Marketing = Full ส่งได้
- ส่งล้มเหลวบางส่วน: แสดงสรุปสำเร็จ/ล้มเหลว และให้ส่งซ้ำเฉพาะที่ล้มเหลว
- การเชื่อมต่อ LINE OA ไม่พร้อม: แจ้งเตือนก่อนส่ง

## Success Criteria
- ส่ง Broadcast แล้วลูกค้าในกลุ่มได้รับข้อความตามช่องทางที่เลือก
- Broadcast ตั้งเวลาทำงานตรงเวลาและสถานะอัปเดตเป็น Sent
- ระบบบังคับโควตาและ throttle ได้จริง (ส่งเกินโควตาไม่ได้)
- ผู้ใช้ Starter/Business เห็นหน้า Upsell และส่งไม่ได้
- สิทธิ์ตาม Permission Matrix: Owner Full, Marketing Full, Manager View
