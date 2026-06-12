---
id: CUS-VENUE-004
screen: Gallery
module: Venue
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-VENUE-004 · Gallery

## Objective
แสดงรูปภาพและวิดีโอของสนามทั้งหมดในรูปแบบแกลเลอรี เพื่อให้ลูกค้าเห็นบรรยากาศจริงก่อนตัดสินใจจอง

## User Story
> As a **Customer**, I want **ดูรูปและวิดีโอสนามทั้งหมด**, so that **เห็นบรรยากาศและสภาพคอร์ทจริงก่อนจอง**.

## Entry Point
- CUS-VENUE-001 (Venue Detail) → แตะรูป Hero หรือส่วน "รูปภาพ/วิดีโอ"

## Exit Point
- แตะรูป → มุมมองเต็มจอ (lightbox) แล้วปิดกลับ
- กด Back → CUS-VENUE-001 (Venue Detail)

## Components
- แท็บสลับ "รูปภาพทั้งหมด / วิดีโอ"
- กริดรูปภาพ (thumbnail) แตะเปิดเต็มจอได้
- Lightbox: เลื่อนซ้าย-ขวา (swipe), ตัวนับ 1/n, ปุ่มปิด
- ตัวเล่นวิดีโอในแท็บวิดีโอ
- ปุ่ม Back

## Validation Rules
- แสดงเฉพาะไฟล์ที่อัปโหลดและ status พร้อมใช้งาน
- แท็บ "วิดีโอ" แสดงเมื่อมีวิดีโออย่างน้อย 1 รายการ

## API Dependencies
- GET /api/v1/courts?venue_id={id} — อ้างอิงรูปคอร์ท (court_images) ของสนาม
- venue gallery (venue media/files): — (ยังไม่มี endpoint เฉพาะใน API_Specification_v1)

## Edge Cases
- ไม่มีรูป (empty gallery) → Empty State "ยังไม่มีรูปภาพสนาม"
- รูปบางรูปโหลดไม่สำเร็จ → แสดง placeholder เฉพาะรูปนั้น
- ไม่มีวิดีโอ → ซ่อนแท็บวิดีโอ
- โหลดล้มเหลวทั้งหมด → Error State + ปุ่มลองใหม่

## Success Criteria
- แสดงรูปทั้งหมดของสนามครบ, แตะเปิดเต็มจอและ swipe ได้
- สลับแท็บรูป/วิดีโอทำงานถูกต้อง
- โหลด thumbnail ครบภายใน 2 วินาทีบน 4G
