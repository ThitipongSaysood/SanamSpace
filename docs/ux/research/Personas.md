---
title: Personas
type: research
status: draft
updated: 2026-06-12
---

# Personas

## Purpose
- กำหนดกลุ่มผู้ใช้หลักของ SanamSpace เพื่อใช้อ้างอิงในการออกแบบ UX/UI และจัดลำดับฟีเจอร์
- ยึดตาม PRD (Target Customers, Roles, Customer Journey) เป็นฐาน — ส่วนที่ยังไม่มีข้อมูลวิจัยจริงระบุเป็น **สมมติฐาน (assumption)** เพื่อให้ทีมนำไป validate

## Summary
- 4 personas หลัก: เจ้าของสนามรายเดี่ยว, ผู้เล่นขาประจำ/สมาชิก, ผู้จัดก๊วน/ทีม, Staff หน้าเคาน์เตอร์
- ฝั่งธุรกิจ (Owner, Staff) ต้องการลดงานแมนนวล (ตรวจสลิป, กันจองทับ) และเห็นข้อมูลลูกค้า
- ฝั่งผู้เล่นต้องการจองเร็ว จ่ายง่ายผ่าน LINE และได้สิทธิประโยชน์จากการเป็นสมาชิก (tier, points, wallet)
- ทุก persona เข้าถึงผ่าน LINE เป็นหลัก (LINE Login / LIFF) ตาม tech stack ใน PRD

## Details

### Persona 1 — เจ้าของสนามรายเดี่ยว ("พี่เอ", เจ้าของสนามแบด 1 สาขา)
- **บริบท:** สนามเปิดใหม่ถึงขนาดเล็ก 1 สาขา ~6–10 คอร์ต ตรงกับ plan Starter/Business (PRD Plan Positioning) — **สมมติฐาน:** จำนวนคอร์ตยังไม่ยืนยัน
- **Goals:** เพิ่ม utilization คอร์ต, ลดเวลายืนยันการจ่ายเงิน, มีฐานข้อมูลลูกค้าไว้ทำการตลาด, ดูรายได้รายวันได้ทันที
- **Pain points:** จองทับเวลา/จดในสมุดหรือ LINE, ตรวจสลิปทีละใบเอง, ไม่รู้ว่าใครเป็นลูกค้าประจำ, คอร์ตช่วง off-peak ว่าง
- **Tech comfort:** ปานกลาง ใช้สมาร์ตโฟน/LINE คล่อง แต่ไม่ชอบระบบหลังบ้านซับซ้อน
- **Key scenarios:** ตั้งราคาและตารางคอร์ต, ยืนยันสลิป, ดู Revenue Dashboard, ส่งโปรช่วงคอร์ตว่าง (Business: Promotions/Coupons)

### Persona 2 — ผู้เล่นขาประจำ/สมาชิก ("น้องบีม", เล่นสัปดาห์ละ 2–3 ครั้ง)
- **บริบท:** ลูกค้าประจำที่จองคอร์ตเดิม เวลาเดิม เป็นสมาชิกเพื่อรับส่วนลด/แต้ม (อ้างอิงหน้า membership tier + points ใน customer app)
- **Goals:** จองเร็วในไม่กี่แตะ, เติม wallet จ่ายล่วงหน้าไม่ต้องโอนทุกครั้ง, สะสมแต้ม/เลื่อน tier, รับแจ้งเตือนก่อนถึงเวลา
- **Pain points:** ต้องทักแชทถามคิวว่าง, โอนแล้วต้องส่งสลิปรอยืนยันนาน, ลืมเวลาจอง, ไม่เห็นสิทธิ์/แต้มคงเหลือ
- **Tech comfort:** สูง คุ้นเคยแอป/LINE/e-wallet
- **Key scenarios:** จองผ่าน LINE, จ่ายด้วย wallet/slip, check-in ด้วย QR, ดู tier/points, rebooking ช่องเดิม (Business)

### Persona 3 — ผู้จัดก๊วน/ทีม ("พี่ตั้ม", หัวหน้าก๊วนแบด/ฟุตซอล)
- **บริบท:** จองหลายคอร์ต/ช่วงเวลายาวเป็นประจำให้สมาชิกก๊วน เก็บเงินจากเพื่อนแล้วจ่ายรวม
- **Goals:** จองล็อตใหญ่/ประจำสัปดาห์ได้สะดวก, จัดการคิวว่าง (waitlist) เมื่อคนเต็ม/ยกเลิก, ใช้แพ็กเกจ/wallet ลดต้นทุนต่อหัว
- **Pain points:** ประสานเวลากับเพื่อนหลายคน, คอร์ตที่อยากได้ถูกจองตัดหน้า, จ่ายแยกหลายบิลยุ่งยาก, ไม่มีที่เก็บประวัติก๊วน
- **Tech comfort:** ปานกลาง–สูง
- **Key scenarios:** จองประจำ/recurring (**สมมติฐาน:** recurring ยังไม่ระบุชัดใน PRD), ใช้ Waitlist (Business), จ่ายผ่าน Package/Wallet, รับโปรกลุ่ม

### Persona 4 — Staff หน้าเคาน์เตอร์ ("น้องฟ้า", Reception/Cashier)
- **บริบท:** พนักงานหน้าร้านที่รับจอง walk-in, ยืนยันสลิป, เช็คอินลูกค้า ตาม roles Reception/Cashier ใน PRD
- **Goals:** จัดการจอง/เช็คอินเร็วในชั่วโมงเร่งด่วน, เห็นสถานะคอร์ตแบบ real-time, ยืนยันการจ่ายไม่ผิดพลาด
- **Pain points:** ลูกค้าต่อคิวพร้อมกัน, สลิปปลอม/ซ้ำ/ยอดไม่ตรง, จองชนเวลาเพราะหลายช่องทาง, สื่อสารกับเจ้าของเรื่องเงินสด/โอน
- **Tech comfort:** ปานกลาง ต้องการ UI เร็ว ปุ่มใหญ่ ลดขั้นตอน
- **Key scenarios:** สร้าง booking แทนลูกค้า, ยืนยัน/ปฏิเสธสลิป, check-in/check-out, ดูตารางคอร์ตวันนี้ (สิทธิ์ตาม RBAC)

## Findings
- ทุก persona พึ่งพา LINE เป็นช่องทางหลัก → onboarding และ flow ควรลื่นไหลใน LIFF
- Owner และ Staff แชร์ pain เดียวกัน 2 ข้อ: การจองทับเวลา และการตรวจสลิปแมนนวล → เป็นโจทย์ MVP (Phase 1)
- ผู้เล่นขาประจำและผู้จัดก๊วนคือกลุ่มที่ membership/wallet/package สร้างมูลค่าได้สูง → ผลักดัน upgrade เป็น plan Business
- ฟีเจอร์ระดับ persona บางส่วน (recurring booking, จำนวนคอร์ต) ยังเป็น **สมมติฐาน** ต้อง validate กับลูกค้าจริง

## References
- structure/SanamSpace_PRD_Master_v1.md — Target Customers, Roles, Customer Journey, Modules
- structure/Feature_Matrix_v1.md — Plan Positioning, Waitlist/Membership/Wallet/Package
- image/image1.1.png — Everyday Badminton customer app (login, booking, slip, QR, wallet, tier, points)
- **สมมติฐาน:** ยังไม่มี interview/field research จริง — ดู Interview_Notes.md เพื่อเก็บข้อมูล validate
