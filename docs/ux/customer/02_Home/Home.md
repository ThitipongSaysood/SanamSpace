---
id: CUS-HOME-001
screen: Home
module: Home
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-HOME-001 · Home

## Objective
หน้าแรกหลังล็อกอิน รวมคำทักทาย โปรโมชัน ทางลัดจองสนาม และสนามแนะนำ เพื่อนำผู้ใช้ไปสู่การจองได้เร็วที่สุด

## User Story
> As a **ลูกค้า (Customer)**, I want **เห็นโปรโมชันและสนามแนะนำพร้อมปุ่มจองตั้งแต่หน้าแรก**, so that **เริ่มจองสนามที่ต้องการได้ภายในไม่กี่แตะ**.

## Entry Point
- หลังล็อกอินสำเร็จจาก Login (CUS-AUTH-001) / LINE Login (CUS-AUTH-002)
- แตะแท็บ "หน้าแรก" ใน bottom navigation

## Exit Point
- แตะ "จองสนาม" → Venue/Court List (CUS-HOME-002)
- แตะ "ค้นหาสนาม" → Search (CUS-HOME-003)
- แตะแบนเนอร์โปรโมชัน → หน้ารายละเอียดโปรโมชัน
- แตะการ์ดสนามแนะนำ → Venue Detail (CUS-VENUE-001)

## Components
- Header คำทักทาย "สวัสดี, คุณ{ชื่อ} 👋 วันนี้มาเล่นที่ไหนดี"
- Promotion banner (เช่น "โปรโมชันลด 10% จอง 10%")
- Quick action: ปุ่ม "จองสนาม" และ "ค้นหาสนาม"
- Section "สนามแนะนำ" — การ์ดสนาม (รูป, ชื่อ Court, ราคา)
- สถานะสมาชิก/แต้ม (membership status)
- Bottom navigation (หน้าแรก, ค้นหา, การจอง, โปรไฟล์)

## Validation Rules
- ต้องมี session ที่ล็อกอินแล้วจึงแสดง Home (ไม่งั้นเด้งไป Login)
- ข้อมูลทุกชิ้นถูก scope ด้วย organization_id ของแบรนด์

## API Dependencies
- `GET /auth/me` — คำทักทาย + สถานะสมาชิก
- `GET /promotions` — แบนเนอร์โปรโมชัน
- `GET /courts` — สนาม/คอร์ทแนะนำ
- `GET /memberships` — สถานะ/แต้มสมาชิก

## Edge Cases
- ไม่มีโปรโมชัน → ซ่อนแบนเนอร์
- ไม่มีสนามแนะนำ → แสดง empty state พร้อมปุ่มไปค้นหา
- กำลังโหลด → แสดง skeleton ของแบนเนอร์และการ์ด
- session หมดอายุ → เด้งกลับ Login (CUS-AUTH-001)

## Success Criteria
- แสดงคำทักทายเฉพาะบุคคล + อย่างน้อย 1 ทางลัดไปจอง
- โปรโมชันและสนามแนะนำโหลดและแตะเข้าไปต่อได้ถูกจอ
- มี loading/empty state ครบทุกส่วนที่ดึงข้อมูล
