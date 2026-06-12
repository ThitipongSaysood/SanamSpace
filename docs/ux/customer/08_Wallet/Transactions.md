---
id: CUS-WALLET-003
screen: Transactions
module: Wallet
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-WALLET-003 · Transactions

## Objective
- แสดงประวัติธุรกรรม Wallet ทั้งหมด: เติมเงิน, จ่ายค่าจอง, คืนเงิน, คะแนน
- ให้ลูกค้าตรวจสอบยอดเข้า-ออกและกรองตามชนิด/ช่วงเวลาได้

## User Story
> As a **Customer**, I want **ดูประวัติธุรกรรม Wallet ทั้งหมดของฉัน**, so that **ตรวจสอบยอดเงินเข้า-ออกและคะแนนได้อย่างโปร่งใส**.

## Entry Point
- จาก CUS-WALLET-001 (Wallet Overview) ลิงก์ "ดูทั้งหมด"

## Exit Point
- กดรายการ → รายละเอียดธุรกรรม / booking ที่เกี่ยวข้อง (ถ้ามี)
- ย้อนกลับ → CUS-WALLET-001 (Wallet Overview)

## Components
- ตัวกรอง: ทั้งหมด / เติมเงิน / ชำระ / คืนเงิน / คะแนน
- รายการธุรกรรม: ไอคอนชนิด, คำอธิบาย, จำนวน +/− (สีเขียวเข้า/สีแดงออก), ยอดคงเหลือหลังรายการ, วันเวลา
- กลุ่มตามวัน/เดือน (section header)
- Infinite scroll / pagination + pull-to-refresh
- Empty state เมื่อไม่มีรายการตามตัวกรอง

## Validation Rules
- รายการเรียงจากใหม่ไปเก่าเสมอ
- จำนวนเงินแสดงเครื่องหมาย +/− และทศนิยม 2 ตำแหน่ง
- ตัวกรองต้องสะท้อนผลจาก API (server-side filter) ไม่กรองเฉพาะ client
- แสดงเฉพาะธุรกรรมของ wallet ที่เป็นของลูกค้าที่ล็อกอิน

## API Dependencies
- `GET /api/v1/wallets/{id}/transactions` — รายการธุรกรรม (รองรับ filter/pagination)
- `GET /api/v1/wallets` — อ้างอิง wallet id และยอดคงเหลือล่าสุด

## Edge Cases
- ไม่มีธุรกรรม → empty state "ยังไม่มีรายการ"
- โหลดล้มเหลว → error + ปุ่ม "ลองใหม่"
- โหลดหน้าถัดไปล้มเหลว → คงรายการเดิม + ปุ่ม retry ที่ท้ายลิสต์
- ตัวกรองไม่พบผล → empty state เฉพาะตัวกรองนั้น
- ออฟไลน์ → แสดงรายการที่ cache พร้อมป้าย "ออฟไลน์"

## Success Criteria
- แสดงประวัติธุรกรรมครบถ้วน เรียงจากใหม่ไปเก่า
- ตัวกรองทำงานถูกต้องและสะท้อนผลจาก server
- จำนวนเงิน/ทิศทาง +/− และยอดคงเหลือถูกต้อง
- pagination และ pull-to-refresh ทำงานได้
