---
id: CUS-MEMBER-001
screen: Membership Overview
module: Membership
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-MEMBER-001 · Membership Overview

## Objective
- แสดงบัตรสมาชิก (Membership Card) ของลูกค้า พร้อมระดับปัจจุบัน (Silver / Gold / Platinum) และสิทธิประโยชน์
- สรุปสถานะคะแนนสะสม (Point) และความคืบหน้าสู่ระดับถัดไป (progress bar)
- เป็นจุดเริ่มต้นไปยังหน้าเปรียบเทียบระดับ (CUS-MEMBER-002) และอัปเกรด (CUS-MEMBER-003)

## User Story
> As a **Customer**, I want **เห็นบัตรสมาชิกและระดับปัจจุบันของฉันพร้อมสิทธิประโยชน์**, so that **รู้ว่าตอนนี้ได้สิทธิอะไรบ้างและต้องสะสมเพิ่มเท่าไรเพื่อเลื่อนระดับ**.

## Entry Point
- จากจอ Home (CUS-HOME-001) การ์ด "Membership Status"
- จากจอ Profile (CUS-PROFILE-001) เมนู "สมาชิก"

## Exit Point
- กด "ดูระดับทั้งหมด" → CUS-MEMBER-002 (Membership Tiers)
- กด "อัปเกรด" → CUS-MEMBER-003 (Upgrade Membership)
- กด "ดูคะแนน/ประวัติ" → CUS-WALLET-003 (Transactions) หรือ Point History
- ย้อนกลับ → จอต้นทาง (Home / Profile)

## Components
- Membership Card: โลโก้สนาม, ชื่อลูกค้า, ระดับ (Silver/Gold/Platinum) พร้อมสีประจำระดับ, เลขสมาชิก
- Point summary: คะแนนสะสมปัจจุบัน + อัตรา 100 THB = 1 Point
- Tier progress bar: ความคืบหน้าจากระดับปัจจุบันไประดับถัดไป + คะแนนที่ขาดอีก
- รายการสิทธิประโยชน์ของระดับปัจจุบัน (ส่วนลด, คะแนนพิเศษ, สิทธิจองก่อน) แบบ bullet
- ปุ่ม "ดูระดับทั้งหมด" / "อัปเกรด"

## Validation Rules
- ต้องเป็นลูกค้าที่ล็อกอินแล้ว (มี customer_id) จึงแสดงบัตร
- ระดับและคะแนนอ้างอิงค่าจาก API เท่านั้น ห้าม cache ค้างเกิน TTL ที่กำหนด
- ถ้ายังไม่มี membership record → แสดงสถานะ "ยังไม่เป็นสมาชิก" + CTA สมัคร/อัปเกรด
- progress bar แสดงสูงสุด 100% (ระดับ Platinum = สูงสุด ไม่มีระดับถัดไป)

## API Dependencies
- `GET /api/v1/memberships` — โหลดข้อมูลสมาชิก/ระดับปัจจุบันของลูกค้า
- `GET /api/v1/customers/{id}` — ข้อมูลลูกค้า/คะแนนสะสมประกอบบัตร
- `GET /api/v1/wallets` — ยอด/คะแนนที่เชื่อมกับบัญชี (ถ้าใช้ point ผ่าน wallet)

## Edge Cases
- ยังไม่มี membership → empty state พร้อมปุ่มสมัคร
- โหลดข้อมูลล้มเหลว → skeleton บัตร + ปุ่ม "ลองใหม่"
- ระดับ Platinum → ซ่อน progress ระดับถัดไป แสดง "ระดับสูงสุดแล้ว"
- คะแนนติดลบ/ผิดปกติจาก backend → fallback แสดง 0 และ log
- ออฟไลน์ → แสดงข้อมูลล่าสุดที่ cache พร้อมป้าย "ออฟไลน์"

## Success Criteria
- แสดงบัตร ระดับ และคะแนนตรงกับข้อมูลจาก API
- progress bar คำนวณคะแนนที่ขาดสู่ระดับถัดไปถูกต้อง
- กดเข้าหน้า Tiers และ Upgrade ได้จากหน้านี้
- กรณีไม่มีสมาชิกแสดง empty state พร้อม CTA ชัดเจน
