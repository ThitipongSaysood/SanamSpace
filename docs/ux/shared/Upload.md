---
id: SHR-008
screen: Upload
module: Shared
app: Shared
status: draft
updated: 2026-06-12
---

# SHR-008 · Upload

> _Shared UI component spec — อัปโหลดไฟล์/รูป (สลิป, รูปสนาม) ใช้ร่วมกันทุกแอป_

## Objective
- ให้ผู้ใช้แนบไฟล์/รูปได้ง่าย (สลิปโอนเงิน, รูปสนาม, โลโก้, เอกสาร)
- แสดงตัวอย่าง + ความคืบหน้าการอัปโหลด
- คุมชนิด/ขนาดไฟล์ก่อนส่ง

## User Story
> As a **user**, I want **แนบรูปสลิป/รูปสนามแล้วเห็นตัวอย่างทันที**, so that **มั่นใจว่าอัปโหลดถูกไฟล์ก่อนยืนยัน**.

## Entry Point
N/A — shared component · ใช้บนจอ Payment slip upload, Venue/Court photos, Profile, Settings

## Exit Point
N/A — shared component · อัปโหลดสำเร็จแล้วส่ง file ref/URL กลับให้ฟอร์มของจอที่ใช้

## Components
- Variants: Single file, Multi file/gallery, รูปวงกลม (avatar/logo)
- Drop zone (ลากวาง) + ปุ่มเลือกไฟล์ + ถ่ายรูปจากมือถือ
- Thumbnail preview, progress bar, ปุ่มลบ/แทนที่
- Tokens: ฟอนต์ไทย Prompt / อังกฤษ Inter · progress/สำเร็จ `#16A34A` · ผิดพลาด `#EF4444`

## Validation Rules
- จำกัดชนิด (เช่น JPG/PNG/PDF) และขนาดสูงสุดต่อไฟล์
- จำกัดจำนวนไฟล์ในโหมด multi
- Do: ระบุชนิด/ขนาดที่รับได้ใต้ drop zone · Don't: ปล่อยอัปโหลดไฟล์เกินขนาดแล้วค่อย error

## API Dependencies
- Data-driven — อัปโหลดไป object storage (Cloudflare R2) ผ่าน endpoint ของจอที่ใช้ (ref: structure/API_Specification_v1.md)

## Edge Cases
- default / hover-drag (เน้น drop zone) / focus
- uploading — progress bar + ล็อกปุ่ม submit
- success — แสดง thumbnail + เครื่องหมายสำเร็จ
- error — ไฟล์ผิดชนิด/เกินขนาด/อัปโหลดล้ม แสดงข้อความ `#EF4444` + ลองใหม่
- empty — ยังไม่มีไฟล์ แสดง placeholder drop zone
- disabled — เมื่อครบจำนวนไฟล์/ไม่มีสิทธิ์

## Success Criteria
- ทุกแอปใช้ upload component ชุดเดียวกัน
- รองรับลากวาง + ถ่ายรูปมือถือ, ปุ่ม/พื้นที่แตะ ≥ 44px, contrast ผ่าน AA
- ตรวจชนิด/ขนาดก่อนส่ง และแสดง progress/ผลลัพธ์ชัดเจน
