---
title: User Journey
type: research
status: draft
updated: 2026-06-12
---

# User Journey

## Purpose
- อธิบาย customer journey ตั้งแต่ awareness → booking → payment (slip) → play/check-in → repeat/membership
- แมป touchpoints, อารมณ์ (emotions), และโอกาสปรับปรุง (opportunities) เพื่อใช้ออกแบบ flow ใน LINE/LIFF
- ยึดตาม Customer Journey ใน PRD และ customer app — ส่วนที่เป็นการตีความระบุเป็น **สมมติฐาน (assumption)**

## Summary
- Journey หลัก 6 ระยะ: Awareness → Discover/Select Venue → Booking → Payment (Slip/Wallet) → Play/Check-in → Repeat/Membership
- จุดเสียดทานสูงสุดอยู่ที่ขั้น Payment (รอยืนยันสลิป) และ Discover (หาคิวว่าง) — ตรงกับ pain ของผู้เล่น
- โอกาสใหญ่: ย่อขั้นตอนใน LINE, ยืนยันสลิปอัตโนมัติ, ผูก membership/wallet เพื่อให้กลับมาจองซ้ำ

## Details

### 1. Awareness (รู้จักสนาม)
- **Touchpoints:** LINE OA ของสนาม, โพสต์โซเชียล, เพื่อนชวน/ปากต่อปาก, ป้ายหน้าสนาม
- **Emotion:** เป็นกลาง–สนใจ
- **Opportunity:** ปุ่ม "จองเลย" ใน LINE OA, แชร์ลิงก์จองได้ง่าย — **สมมติฐาน:** ช่องทาง awareness ยังไม่ยืนยันสัดส่วน

### 2. Discover / Select Venue (เลือกสนาม–คอร์ต)
- **Touchpoints:** LINE Login (LIFF) → เลือก Venue → View Courts → ดูตารางว่าง (อ้างอิงหน้า venue/court/calendar ในแอป)
- **Emotion:** คาดหวัง แต่หงุดหงิดถ้าหาคิวว่างยาก
- **Opportunity:** ปฏิทินคอร์ตว่างแบบเห็นภาพชัด, ตัวกรองวัน/เวลา/ประเภทกีฬา, Waitlist เมื่อเต็ม (Business)

### 3. Booking (สร้างการจอง)
- **Touchpoints:** เลือกคอร์ต/ช่วงเวลา → Create Booking → สรุปราคา
- **Emotion:** มั่นใจถ้าราคาชัด, กังวลถ้ากลัวจองทับ
- **Opportunity:** กันจองทับเวลาแบบ real-time (กันชนคอร์ต), แสดงราคาชัดเจน, จองซ้ำช่องเดิม (Rebooking — Business)

### 4. Payment — Slip / Wallet (จ่ายเงิน)
- **Touchpoints:** Manual Transfer → Upload Slip → Verification → Booking Confirmed (PRD); หรือจ่ายผ่าน Wallet/Package (Business)
- **Emotion:** **จุดเสียดทานสูงสุด** — โอนแล้วต้องรอยืนยัน รู้สึกค้างคา
- **Opportunity:** ตรวจสลิปอัตโนมัติ/กึ่งอัตโนมัติเพื่อยืนยันไว, จ่ายด้วย wallet เพื่อข้ามขั้นสลิป, แจ้งเตือนเมื่อยืนยันสำเร็จ
- **สมมติฐาน:** ระดับ automation ของการตรวจสลิป (เช่น OCR) ขึ้นกับ implementation จริง

### 5. Play / Check-in (เข้าใช้สนาม)
- **Touchpoints:** Reminder Notification (LINE) → มาถึงสนาม → Check-in (QR) → เล่น → Check-out/Complete
- **Emotion:** ผ่อนคลาย ถ้าเช็คอินลื่นและไม่ต้องคุยกับเคาน์เตอร์มาก
- **Opportunity:** QR check-in เร็ว, reminder ตรงเวลา, ลดงานหน้าเคาน์เตอร์ในชั่วโมงเร่งด่วน

### 6. Repeat / Membership (กลับมาซ้ำ)
- **Touchpoints:** สะสม Points, เลื่อน Membership Tier (ส่วนลด %), เติม Wallet, รับ Promotions/Coupons, Broadcast (Pro)
- **Emotion:** ผูกพันถ้าเห็นคุณค่า (แต้ม/ส่วนลด/ความสะดวก)
- **Opportunity:** แสดงแต้ม/tier/สิทธิ์คงเหลือชัดเจน, โปรชวนจองคอร์ต off-peak, automation ติดตามลูกค้าที่หายไป (Pro CRM)

## Findings
- 2 จุดเสียดทานหลัก: หาคิวว่าง (Discover) และรอยืนยันสลิป (Payment) — ทั้งคู่อยู่ก่อนได้เล่น จึงกระทบ conversion มากที่สุด
- Wallet/Package เป็นทางลัดข้ามขั้น "อัปโหลดสลิป" → ช่วยทั้งผู้เล่นและลด workload Staff
- Repeat/Membership คือช่วงสร้างมูลค่าระยะยาว แต่ต้องทำให้ผู้เล่น "เห็น" สิทธิประโยชน์ในแอปจึงจะได้ผล
- ทั้ง journey ผูกกับ LINE → ความลื่นไหลของ LIFF คือ make-or-break

## References
- structure/SanamSpace_PRD_Master_v1.md — Customer Journey (LINE Login → ... → Complete Booking)
- structure/Feature_Matrix_v1.md — Waitlist, Rebooking, Wallet, Package, Promotions, Broadcast
- image/image1.1.png — Everyday Badminton app: venue/court selection, calendar, slip upload, QR check-in, wallet, tier, points
- **สมมติฐาน:** อารมณ์และสัดส่วน touchpoint ยังไม่ได้ทดสอบกับผู้ใช้จริง — validate ผ่าน Interview_Notes.md
