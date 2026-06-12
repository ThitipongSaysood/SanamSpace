---
title: Pain Points
type: research
status: draft
updated: 2026-06-12
---

# Pain Points

## Purpose
- รวบรวม pain points ของฝั่งเจ้าของสนาม (Owner/Staff) และฝั่งลูกค้า (ผู้เล่น) ที่ SanamSpace ตั้งใจแก้
- จับคู่แต่ละ pain กับฟีเจอร์ใน PRD/Feature Matrix ที่ตอบโจทย์ เพื่อยืนยัน problem–solution fit
- pain ที่ยังไม่มีข้อมูลวิจัยจริงระบุเป็น **สมมติฐาน (assumption)** ให้ทีม validate

## Summary
- Pain ฝั่งธุรกิจ เด่นที่สุด: จองทับเวลา, ตรวจสลิปด้วยมือ, ไม่มีข้อมูลลูกค้า, คอร์ตว่างไม่มีคนจอง
- Pain ฝั่งลูกค้า เด่นที่สุด: หาคิวว่างยาก/ต้องทักแชท, รอยืนยันสลิป, ลืมเวลาจอง, ไม่เห็นสิทธิ์/แต้ม
- ส่วนใหญ่แก้ได้ตั้งแต่ Phase 1 (Booking, Slip, Notification); ส่วนการตลาด/ข้อมูลลูกค้าอยู่ Phase 2–3 (Membership, CRM)

## Details

### A. Pain ฝั่งเจ้าของสนาม / Staff
| Pain Point | ผลกระทบ | ฟีเจอร์ที่แก้ (PRD/Feature Matrix) |
|---|---|---|
| จองทับเวลา (จดสมุด/หลาย LINE) | คอร์ตชน, ทะเลาะกับลูกค้า, เสียความน่าเชื่อถือ | Court Booking + Schedule กันชน real-time (Core Booking) |
| ตรวจสลิปด้วยมือทีละใบ | ใช้เวลานาน, สลิปซ้ำ/ปลอม, ยอดไม่ตรง | Slip Upload + Slip Verification (Payment) |
| ไม่มีฐานข้อมูลลูกค้า | ทำการตลาดซ้ำกับลูกค้าเก่าไม่ได้ | Customer Profile, Tags, Notes, Segments (Customer & CRM) |
| คอร์ต off-peak ว่างไม่มีคนจอง | รายได้รั่ว | Promotions, Coupons, Broadcast (Marketing) |
| ไม่รู้รายได้/อัตราการใช้คอร์ต | ตัดสินใจราคาผิด | Revenue/Booking Dashboard, Utilization Report (Analytics) |
| งานหน้าเคาน์เตอร์หนักช่วง peak | คิวยาว, ผิดพลาด | Check-in/Check-out (QR), RBAC แยกสิทธิ์ Staff |
| ลูกค้ายกเลิกแล้วคอร์ตค้าง | เสียโอกาสขาย | Waitlist (Business) |

### B. Pain ฝั่งลูกค้า / ผู้เล่น
| Pain Point | ผลกระทบ | ฟีเจอร์ที่แก้ |
|---|---|---|
| หาคิวว่างยาก ต้องทักแชทถาม | จองไม่ทัน, เปลี่ยนไปสนามอื่น | View Courts + ตารางว่าง, LINE Login (Booking) |
| โอนแล้วต้องรอยืนยันนาน | ค้างคา ไม่มั่นใจว่าจองสำเร็จ | Slip Verification + Booking Confirmed + Notification |
| ต้องโอน+ส่งสลิปทุกครั้ง | ขั้นตอนซ้ำซาก | Wallet, Package (จ่ายล่วงหน้า ข้ามสลิป) |
| ลืมเวลาที่จองไว้ | พลาดคิว/เสียเงิน | Booking Reminder (LINE Notification) |
| ไม่เห็นแต้ม/สิทธิ์/ส่วนลด | ไม่รู้สึกถึงคุณค่าสมาชิก | Membership Tier, Points, Wallet (แสดงในแอป) |
| จองล็อตใหญ่/ประจำให้ก๊วนยาก | ประสานงานวุ่น | Rebooking + Package (Business); recurring **สมมติฐาน** |

## Findings
- Pain คู่กัน: "จองทับเวลา" (Owner) ↔ "หาคิวว่างยาก" (ลูกค้า) แก้ได้ด้วยระบบจอง real-time เดียวกัน → คุ้มค่าทำใน MVP
- "ตรวจสลิปด้วยมือ" (Owner) ↔ "รอยืนยันสลิป" (ลูกค้า) คือ pain เดียวกันสองมุม → จุดที่ slip verification/automation สร้าง impact สูงสุด
- Wallet/Package เป็นตัวลด pain ทั้งสองฝั่งพร้อมกัน (ลดงานตรวจสลิป + ลดขั้นตอนผู้เล่น) → คุ้มผลักดัน upgrade plan
- Pain เชิงข้อมูลลูกค้า/การตลาด แก้ได้จริงเมื่อขึ้น Phase 2–3 (Membership/CRM) — ต้องสื่อสาร roadmap ให้ Owner เข้าใจ
- ความรุนแรง/ความถี่ของ pain ยังเป็น **สมมติฐาน** — ต้องจัดลำดับด้วยข้อมูล interview จริง

## References
- structure/SanamSpace_PRD_Master_v1.md — Modules (Booking, Payment, Membership, CRM, Analytics), Customer/Owner Journey, Development Phases
- structure/Feature_Matrix_v1.md — Slip Verification, Waitlist, Wallet, Package, Promotions, Utilization Report
- image/image1.1.png — Everyday Badminton app (slip upload, wallet, tier, points, QR check-in)
- **สมมติฐาน:** ยังไม่มีข้อมูลภาคสนาม — ใช้ Interview_Notes.md เพื่อจัดอันดับความรุนแรงของ pain
