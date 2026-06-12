---
id: CUS-HOME-002
screen: Venue List
module: Home
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-HOME-002 · Venue List

## Objective
หน้าแสดงรายการสนาม/สาขาทั้งหมดของแบรนด์ ให้ผู้ใช้เลือกสนามที่ต้องการเพื่อดูคอร์ทและจอง

## User Story
> As a **ลูกค้า (Customer)**, I want **เห็นรายชื่อสนามทั้งหมดพร้อมข้อมูลสำคัญในที่เดียว**, so that **เลือกสนามที่สะดวกที่สุดแล้วไปจองต่อได้ทันที**.

## Entry Point
- แตะ "จองสนาม" จาก Home (CUS-HOME-001)
- แตะแท็บ/เมนูรายการสนาม

## Exit Point
- แตะการ์ดสนาม → Venue Detail (CUS-VENUE-001)
- แตะไอคอนค้นหา → Search (CUS-HOME-003)
- แตะหัวใจ → เพิ่ม/ลบ Favorites (CUS-HOME-004)

## Components
- การ์ดรายการสนาม (รูป, ชื่อสนาม, ที่ตั้ง/ระยะทาง, ช่วงราคา)
- ปุ่ม/ไอคอน favorite (หัวใจ) บนแต่ละการ์ด
- ตัวกรองชนิดกีฬา (แบดมินตัน, ฟุตบอล, เทนนิส ฯลฯ)
- แถบค้นหาด้านบน
- Infinite scroll / โหลดเพิ่ม

## Validation Rules
- รายการถูก scope ด้วย organization_id ของแบรนด์
- แสดงเฉพาะสนามที่ active (ไม่ถูก soft delete)

## API Dependencies
- `GET /branches` — รายการสาขา/สนาม
- `GET /courts` — สรุปคอร์ท/ช่วงราคาในแต่ละสนาม
- `GET /organizations/{id}` — ข้อมูลแบรนด์ประกอบ

## Edge Cases
- ไม่มีสนาม → empty state "ยังไม่มีสนามในขณะนี้"
- กำลังโหลด → skeleton การ์ด
- โหลดหน้าถัดไปล้มเหลว → ปุ่ม "ลองใหม่" ท้ายรายการ
- กรองแล้วไม่พบผล → แจ้ง "ไม่พบสนามตามตัวกรอง"

## Success Criteria
- แสดงรายการสนามของแบรนด์ครบและกดเข้าไปดูรายละเอียดได้
- ตัวกรองชนิดกีฬาและการ favorite ทำงานถูกต้อง
- มี loading/empty/error state ครบ
