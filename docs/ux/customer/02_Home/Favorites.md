---
id: CUS-HOME-004
screen: Favorites
module: Home
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-HOME-004 · Favorites

## Objective
หน้ารวมสนามที่ผู้ใช้กดถูกใจ เพื่อให้กลับมาจองสนามที่ชอบซ้ำได้รวดเร็ว

## User Story
> As a **ลูกค้า (Customer)**, I want **เก็บสนามที่ชอบไว้ในรายการโปรด**, so that **กลับมาจองสนามเดิมได้เร็วโดยไม่ต้องค้นหาใหม่**.

## Entry Point
- แตะแท็บ/เมนู "รายการโปรด"
- กดไอคอนหัวใจบนการ์ดสนามจาก Venue List (CUS-HOME-002) หรือ Search (CUS-HOME-003)

## Exit Point
- แตะการ์ดสนาม → Venue Detail (CUS-VENUE-001)
- กดเอาออกจากโปรด → อัปเดตรายการในจอ
- รายการว่าง แตะปุ่ม → ไปค้นหา (CUS-HOME-003)

## Components
- รายการการ์ดสนามที่ถูกใจ (รูป, ชื่อ, ที่ตั้ง, ช่วงราคา)
- ไอคอนหัวใจ (toggle เอาออกจากโปรด)
- Empty state พร้อมปุ่ม "ค้นหาสนาม"
- Pull-to-refresh

## Validation Rules
- ต้องล็อกอินจึงเข้าถึงรายการโปรด (ไม่งั้นเด้งไป Login)
- รายการโปรดผูกกับ customer ปัจจุบันและ scope ตาม organization_id

## API Dependencies
- `GET /customers/{id}` — ดึงรายการสนามโปรดของลูกค้า
- `PUT /customers/{id}` — เพิ่ม/ลบสนามออกจากรายการโปรด
- `GET /branches` — ข้อมูลสนามประกอบการ์ด
- _หมายเหตุ: ยังไม่มี endpoint favorites เฉพาะใน API_Specification_v1 — ใช้ผ่านโปรไฟล์ลูกค้า_

## Edge Cases
- ยังไม่มีรายการโปรด → empty state + ปุ่มไปค้นหา
- กำลังโหลด → skeleton การ์ด
- ลบออกจากโปรดแล้ว → อัปเดตทันที (optimistic) และ rollback ถ้า API ล้มเหลว
- session หมดอายุ → เด้งกลับ Login (CUS-AUTH-001)

## Success Criteria
- เพิ่ม/ลบสนามโปรดได้และสถานะคงอยู่ข้าม session
- รายการโปรดแสดงถูกต้องและกดเข้าไปจองต่อได้
- มี empty/loading/error state ครบและ sync กับการกดหัวใจในจออื่น
