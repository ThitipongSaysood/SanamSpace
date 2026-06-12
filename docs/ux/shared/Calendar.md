---
id: SHR-007
screen: Calendar
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-007 · Calendar

> _Shared UI component spec — ปฏิทินตารางคอร์ท/ตารางเวลา ใช้ร่วมกันทุกแอป_

## Objective
- แสดงตารางการจองคอร์ทตามวัน/สัปดาห์/ช่องเวลา
- ให้เห็นช่องว่าง vs ช่องถูกจองในมุมเดียว
- ใช้เลือก slot เพื่อจองหรือดูรายละเอียดการจอง

## User Story
> As a **user**, I want **เห็นตารางคอร์ทว่าช่องไหนว่าง/เต็ม**, so that **เลือกเวลาที่ต้องการจองได้ทันที**.

## Entry Point
N/A — shared component · ใช้บนจอ Court Booking (Customer), Schedule/ตารางคอร์ท (Owner)

## Exit Point
N/A — shared component · แตะ slot เพื่อไปยืนยันการจอง/ดูรายละเอียดตามจอที่ใช้

## Components
- Views: Day, Week, Month; แกนเวลา (slot ราย 30/60 นาที) × แกนคอร์ท
- Slot states: ว่าง / จองแล้ว / ของฉัน / ปิด/ไม่ขาย
- ปุ่มเลื่อนวัน-สัปดาห์, ตัวเลือกคอร์ท/สาขา, แถบเวลาปัจจุบัน
- สีสถานะ: ว่าง `#16A34A` · รอชำระ `#F59E0B` · เต็ม/ปิด เทา · ของฉันเน้นกรอบ
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · มือถือ scroll แนวนอน/ย่อเป็นรายคอร์ท

## Validation Rules
- slot ที่ปิด/ผ่านเวลาแล้ว เลือกไม่ได้
- มี legend อธิบายสีสถานะทุกครั้ง
- Do: เน้น slot ว่างให้เด่น · Don't: ใช้สีเดียวแทนหลายสถานะจนแยกไม่ออก

## API Dependencies
- Data-driven — ดึงตารางคอร์ท + สถานะ slot ตามวัน/สาขา (ref: structure/API_Specification_v1.md)

## Edge Cases
- default / hover slot / focus / selected slot
- loading — skeleton grid ระหว่างดึงตาราง
- empty — ไม่มีคอร์ท/ไม่เปิดขายวันนั้น → Empty State (SHR-009)
- error — โหลดตารางล้มเหลว แสดง Error State (SHR-011) + ลองใหม่
- conflict — slot ถูกจองระหว่างเลือก แจ้งเตือนและรีเฟรช

## Success Criteria
- ทุกแอปใช้ calendar component เดียวกัน สถานะ slot ตรงกัน
- อ่านง่ายบนมือถือ, สีสถานะ contrast ผ่าน AA, slot touch target ≥ 44px
- สะท้อนสถานะ real-time แม่นยำ ลดการจองชนกัน
