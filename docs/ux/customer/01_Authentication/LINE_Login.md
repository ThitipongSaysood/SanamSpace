---
id: CUS-AUTH-002
screen: LINE Login
module: Authentication
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-AUTH-002 · LINE Login

## Objective
ขั้นตอนล็อกอินด้วย LINE (LIFF) เป็นช่องทางหลักของลูกค้า ขอความยินยอมและรับโปรไฟล์ LINE เพื่อสร้าง/เข้าสู่บัญชี

## User Story
> As a **ลูกค้า (Customer)**, I want **กดเข้าสู่ระบบด้วย LINE แล้วยืนยันสิทธิ์ครั้งเดียว**, so that **เข้าใช้งานได้ทันทีโดยใช้บัญชี LINE ที่มีอยู่แล้ว**.

## Entry Point
- กดปุ่ม "เข้าสู่ระบบด้วย LINE" จาก Login (CUS-AUTH-001)

## Exit Point
- ผู้ใช้เดิม → Home (CUS-HOME-001)
- ผู้ใช้ใหม่/ข้อมูลไม่ครบ → Register (CUS-AUTH-003)
- มีบัญชีเบอร์/อีเมลอยู่แล้ว → Account Link (CUS-AUTH-004)
- ยกเลิก/ปฏิเสธ → กลับ Login (CUS-AUTH-001)

## Components
- หน้า LINE LIFF consent (ชื่อแอป + ขอบเขตสิทธิ์ profile/openid)
- ปุ่ม "อนุญาต" / "ยกเลิก" (จาก LINE)
- Loading overlay ระหว่าง redirect กลับแอป
- โลโก้แบรนด์ระหว่างรอ callback

## Validation Rules
- ต้องได้รับ LINE access token / authorization code ที่ถูกต้อง
- ต้องมี userId (sub) จากโปรไฟล์ LINE
- token หมดอายุ/ไม่ผ่าน verify → ถือว่าไม่สำเร็จ

## API Dependencies
- `POST /auth/line/login` — แลก token/รหัสจาก LINE เป็น session ของระบบ
- `GET /auth/me` — ตรวจสถานะบัญชีและความครบของโปรไฟล์

## Edge Cases
- ผู้ใช้กด "ยกเลิก" ใน consent → กลับ Login พร้อม toast
- LINE/เครือข่ายล่มระหว่าง redirect → error + ปุ่มลองใหม่
- เปิดนอก LINE/LIFF ไม่รองรับ → แจ้งให้เปิดผ่านช่องทางที่รองรับ
- token verify ไม่ผ่านที่ฝั่ง server → แจ้ง error และให้ลองใหม่

## Success Criteria
- แลก LINE login เป็น session ระบบสำเร็จและคงอยู่
- ผู้ใช้ใหม่ถูกส่งไปสมัคร, ผู้ใช้เดิมเข้า Home อัตโนมัติ
- กรณีบัญชีซ้ำถูกพาเข้าสู่ flow ผูกบัญชีอย่างถูกต้อง
