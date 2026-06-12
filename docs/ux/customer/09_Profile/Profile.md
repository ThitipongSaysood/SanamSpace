---
id: CUS-PROFILE-001
screen: Profile
module: Profile
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-PROFILE-001 · Profile

## Objective
- แสดงข้อมูลส่วนตัวของลูกค้า: ชื่อ, รูป, เบอร์/อีเมล, ระดับสมาชิก, ยอด Wallet, คะแนน
- เป็นศูนย์กลางเข้าถึงเมนู Membership, Wallet, Package, Notification, Settings
- ให้แก้ไขข้อมูลส่วนตัวผ่านปุ่มแก้ไข

## User Story
> As a **Customer**, I want **ดูข้อมูลโปรไฟล์และสรุปสมาชิก/Wallet/คะแนนของฉัน**, so that **เข้าถึงเมนูส่วนตัวและจัดการบัญชีได้จากที่เดียว**.

## Entry Point
- จาก Bottom Navigation แท็บ "โปรไฟล์"
- จาก Home (CUS-HOME-001) กดรูป/ชื่อมุมบน

## Exit Point
- "แก้ไขโปรไฟล์" → CUS-PROFILE-002 (Edit Profile)
- "สมาชิก" → CUS-MEMBER-001 ; "Wallet" → CUS-WALLET-001 ; "แพ็กเกจ" → CUS-PKG-003 (My Packages)
- "การแจ้งเตือน" → CUS-NOTI-001 ; "ตั้งค่า" → CUS-SET-001
- "ออกจากระบบ" → CUS-AUTH (Login)

## Components
- Profile header: รูปโปรไฟล์, ชื่อ, ป้ายระดับสมาชิก (Silver/Gold/Platinum)
- สรุป Wallet (ยอดคงเหลือ) + คะแนนสะสม (Point)
- รายการเมนู: ข้อมูลส่วนตัว, สมาชิก, Wallet, แพ็กเกจของฉัน, ประวัติการจอง, การแจ้งเตือน, ตั้งค่า
- ปุ่ม "แก้ไขโปรไฟล์"
- ปุ่ม "ออกจากระบบ"

## Validation Rules
- ต้องล็อกอินจึงเข้าหน้านี้ (มี customer_id)
- ข้อมูลสมาชิก/Wallet/คะแนน อ้างอิงจาก API ไม่ hardcode
- รูปโปรไฟล์ที่ไม่มี → แสดง avatar placeholder จากชื่อย่อ
- ออกจากระบบต้องยืนยัน (confirm dialog) ก่อน

## API Dependencies
- `GET /api/v1/customers/{id}` — ข้อมูลส่วนตัวและคะแนนของลูกค้า
- `GET /api/v1/memberships` — ระดับสมาชิกปัจจุบัน
- `GET /api/v1/wallets` — ยอด Wallet สำหรับสรุป

## Edge Cases
- โหลดข้อมูลล้มเหลว → skeleton + ปุ่ม "ลองใหม่"
- ไม่มีรูปโปรไฟล์ → placeholder
- ยังไม่เป็นสมาชิก/ไม่มี wallet → แสดงสถานะว่างพร้อม CTA ที่เกี่ยวข้อง
- token หมดอายุ → เด้งกลับหน้า Login
- ออฟไลน์ → แสดงข้อมูล cache พร้อมป้าย "ออฟไลน์"

## Success Criteria
- แสดงข้อมูลโปรไฟล์ ระดับสมาชิก ยอด Wallet และคะแนนตรงกับ API
- เมนูทุกรายการนำไปจอปลายทางถูกต้อง
- ปุ่มแก้ไขนำไป CUS-PROFILE-002 ได้
- ออกจากระบบมี confirm และเคลียร์ session ถูกต้อง
