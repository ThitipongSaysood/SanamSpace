---
id: CUS-WALLET-001
screen: Wallet Overview
module: Wallet
app: Customer
status: draft
updated: 2026-06-12
---

# CUS-WALLET-001 · Wallet Overview

## Objective
- แสดงยอดเงินคงเหลือใน Wallet ของลูกค้า และคะแนนสะสม (Point) ในที่เดียว
- เป็นจุดเริ่มต้นไปเติมเงิน (Topup) และดูประวัติธุรกรรม (Transactions)
- ให้ลูกค้าใช้ยอด Wallet เป็นช่องทางชำระเงินการจองได้

## User Story
> As a **Customer**, I want **เห็นยอดเงินและคะแนนใน Wallet ของฉัน**, so that **รู้ยอดคงเหลือก่อนใช้จ่าย และเติมเงินหรือดูประวัติได้สะดวก**.

## Entry Point
- จาก Home (CUS-HOME-001) Quick Action "Wallet"
- จาก Profile (CUS-PROFILE-001) เมนู "Wallet"

## Exit Point
- กด "เติมเงิน" → CUS-WALLET-002 (Topup)
- กด "ดูประวัติ" / "ดูทั้งหมด" → CUS-WALLET-003 (Transactions)
- ย้อนกลับ → จอต้นทาง

## Components
- Wallet Balance card: ยอดคงเหลือ (เช่น ฿580) สกุลเงิน THB เด่นชัด
- Point summary: คะแนนสะสม + อัตรา 100 THB = 1 Point
- ปุ่มหลัก "เติมเงิน" (Topup)
- รายการธุรกรรมล่าสุด (3–5 รายการ): ชนิด (เติม/จ่าย/คืน), จำนวน +/−, วันเวลา
- ลิงก์ "ดูทั้งหมด" ไปหน้า Transactions

## Validation Rules
- ต้องล็อกอิน (มี wallet ผูกกับ customer) จึงแสดงยอด
- ยอดคงเหลือดึงจาก API เท่านั้น ไม่คำนวณฝั่ง client
- ยอดต้องไม่ติดลบ (floor ที่ 0) แสดงทศนิยม 2 ตำแหน่ง
- รายการล่าสุดเรียงจากใหม่ไปเก่า

## API Dependencies
- `GET /api/v1/wallets` — ยอดคงเหลือและข้อมูล wallet ของลูกค้า
- `GET /api/v1/wallets/{id}/transactions` — รายการธุรกรรมล่าสุด (limit สั้น)
- `GET /api/v1/customers/{id}` — คะแนนสะสมประกอบหน้า

## Edge Cases
- ยังไม่มี wallet → empty state พร้อมปุ่มเปิดใช้งาน/เติมเงินครั้งแรก
- โหลดยอดล้มเหลว → skeleton + ปุ่ม "ลองใหม่"
- ยังไม่มีธุรกรรม → empty state "ยังไม่มีรายการ"
- ออฟไลน์ → แสดงยอดล่าสุดที่ cache พร้อมป้าย "ออฟไลน์"

## Success Criteria
- แสดงยอดคงเหลือและคะแนนตรงกับ API
- รายการล่าสุดเรียงถูกต้องและกด "ดูทั้งหมด" ไป CUS-WALLET-003 ได้
- ปุ่ม "เติมเงิน" นำไป CUS-WALLET-002 ได้
- กรณีไม่มี wallet/ธุรกรรม แสดง empty state ชัดเจน
