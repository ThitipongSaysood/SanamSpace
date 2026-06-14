# PlayCourt Feature Matrix v2.0

## White Label Sports Venue Operating System

Version: 2.0

รองรับทุกกีฬา: แบดมินตัน · ฟุตบอล · ฟุตซอล · เทนนิส · บาสเกตบอล · วอลเลย์บอล · พิคเคิลบอล และอื่นๆ

---

# 0. Pricing Philosophy (สำคัญที่สุด)

ระบบนี้ขายได้ทุกกีฬา และแต่ละกีฬ "โมเดลรายได้ต่างกันมาก"

| กีฬา | จำนวนสนาม/คอร์ท | ราคา/ชม. | รายได้/เดือน | บุ๊คกิ้ง/เดือน |
|---|---|---|---|---|
| แบดมินตัน | 8–12 คอร์ท | 120–280 | ~150–220k | 1,500–3,000 |
| ฟุตบอลหญ้าเทียม | 1–3 สนาม | 600–1,700 | ~160–360k | 200–500 |
| ฟุตซอล | 1–3 สนาม | 500–1,000 | ~120–250k | 200–500 |
| เทนนิส | 2–6 คอร์ท | 150–400 | ~100–200k | 400–900 |
| พิคเคิลบอล | 3–8 คอร์ท | 150–300 | กำลังโต | ปานกลาง |

เพราะ "จำนวนคอร์ท" และ "จำนวนบุ๊คกิ้ง" ไม่สะท้อนคุณค่าเมื่อข้ามกีฬา จึงกำหนดหลักการคิดราคาดังนี้:

1. ตัวคุมขนาดหลักคือ **จำนวนสาขา (branch)** ไม่ใช่จำนวนคอร์ทหรือจำนวนบุ๊คกิ้ง
2. ภายใน 1 สาขา เปิดคอร์ท/สนามได้ **ไม่จำกัด** (จะ 2 สนามบอล หรือ 15 คอร์ทแบดก็ได้)
3. **ห้าม cap จำนวน booking** — ไม่ลงโทษสนามที่ขายดี
4. ตัวแบ่ง Tier คือ **Feature** ไม่ใช่ปริมาณ
5. สนามรายได้สูง (ฟุตบอล/ฟุตซอล) เก็บมูลค่าผ่าน "ฟีเจอร์ที่เขาจำเป็นต้องใช้" → เขาจะเลือกขึ้น Tier เอง
6. ใช้ราคาชุดเดียวทุกกีฬา ไม่ทำราคาแยกตามกีฬา

---

# 1. Plan Structure

PlayCourt มี 4 แพ็กเกจหลัก

- Starter
- Business
- Pro
- Enterprise

---

# 2. Pricing Strategy

| Plan | Monthly | Annual (จ่าย 10 ได้ 12) |
|--------|--------|--------|
| Starter | 990 THB | 9,900 THB |
| Business | 2,290 THB | 22,900 THB |
| Pro | 4,490 THB | 44,900 THB |
| Enterprise | Custom | Custom |

Setup Fee (ครั้งเดียว สำหรับขึ้นระบบ + ตั้งค่า LINE OA + White Label)

| Plan | Setup Fee |
|--------|--------|
| Starter | 3,000 THB |
| Business | 5,000 THB |
| Pro | 9,000 THB |
| Enterprise | Custom |

หมายเหตุ: Setup Fee ฟรีช่วงโปรเปิดตัว / สำหรับลูกค้า Design Partner กลุ่มแรก

---

# 3. Limits

ตัวคุมขนาดเป็นกลางทางกีฬา — ใช้ "สาขา" เป็นหลัก ไม่ cap คอร์ทและบุ๊คกิ้ง

| Limit | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Branches | 1 | 3 | Unlimited | Unlimited |
| Courts / Fields (ต่อสาขา) | Unlimited | Unlimited | Unlimited | Unlimited |
| Monthly Bookings | Unlimited | Unlimited | Unlimited | Unlimited |
| Staff Users | 5 | 20 | Unlimited | Unlimited |
| Storage | 5 GB | 20 GB | 100 GB | Unlimited |

หมายเหตุ: "Court / Field" คือ bookable resource เดียวกันในเชิงระบบ (1 คอร์ทแบด = 1 สนามบอล = 1 row ใน `courts`) จึงไม่นับแยกตามกีฬา

---

# 4. Core Booking

ครบสำหรับทุกกีฬาตั้งแต่ Starter — รวมมัดจำและจองประจำ เพื่อให้สนามฟุตบอล/ฟุตซอลใช้งานได้เต็มตั้งแต่ก้าวแรก

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Court / Field Booking | ✅ | ✅ | ✅ | ✅ |
| Multi Sport Support | ✅ | ✅ | ✅ | ✅ |
| Deposit / มัดจำ | ✅ | ✅ | ✅ | ✅ |
| Recurring Booking / จองประจำ | ✅ | ✅ | ✅ | ✅ |
| Whole-field / Team Booking | ✅ | ✅ | ✅ | ✅ |
| Check-in / Check-out | ✅ | ✅ | ✅ | ✅ |
| Booking History | ✅ | ✅ | ✅ | ✅ |
| Booking Reminder | ✅ | ✅ | ✅ | ✅ |
| Dynamic Pricing (Peak / Off-Peak) | ✅ | ✅ | ✅ | ✅ |
| Waitlist | ❌ | ✅ | ✅ | ✅ |
| Auto Rebooking | ❌ | ✅ | ✅ | ✅ |

---

# 5. Customer & LINE

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| LINE Login | ✅ | ✅ | ✅ | ✅ |
| Customer Profile | ✅ | ✅ | ✅ | ✅ |
| Customer Tags | ❌ | ✅ | ✅ | ✅ |
| Customer Notes | ❌ | ✅ | ✅ | ✅ |
| Customer Segments | ❌ | ❌ | ✅ | ✅ |

---

# 6. Payment

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Manual Transfer | ✅ | ✅ | ✅ | ✅ |
| Slip Upload | ✅ | ✅ | ✅ | ✅ |
| Slip Verification | ✅ | ✅ | ✅ | ✅ |
| Refund Management | ❌ | ✅ | ✅ | ✅ |
| Invoice | ❌ | ✅ | ✅ | ✅ |
| Tax Invoice | ❌ | ❌ | ✅ | ✅ |
| Payment Gateway | ❌ | ❌ | ✅ | ✅ |

---

# 7. Membership & Loyalty

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Membership | ❌ | ✅ | ✅ | ✅ |
| Membership Tier | ❌ | ✅ | ✅ | ✅ |
| Points System | ❌ | ✅ | ✅ | ✅ |
| Wallet | ❌ | ✅ | ✅ | ✅ |
| Package System (ชั่วโมงเหมา / คอร์ส) | ❌ | ✅ | ✅ | ✅ |

---

# 8. CRM

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Customer Timeline | ❌ | ❌ | ✅ | ✅ |
| CRM Dashboard | ❌ | ❌ | ✅ | ✅ |
| Customer Segmentation | ❌ | ❌ | ✅ | ✅ |
| CRM Automation | ❌ | ❌ | ✅ | ✅ |
| Customer Follow-up | ❌ | ❌ | ✅ | ✅ |

---

# 9. Marketing

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Coupons | ❌ | ✅ | ✅ | ✅ |
| Promotions | ❌ | ✅ | ✅ | ✅ |
| Broadcast LINE | ❌ | ❌ | ✅ | ✅ |
| Campaigns | ❌ | ❌ | ✅ | ✅ |
| Scheduled Campaigns | ❌ | ❌ | ✅ | ✅ |

---

# 10. Analytics

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Revenue Dashboard | ✅ | ✅ | ✅ | ✅ |
| Booking Dashboard | ✅ | ✅ | ✅ | ✅ |
| Utilization Report | ❌ | ✅ | ✅ | ✅ |
| Membership Analytics | ❌ | ❌ | ✅ | ✅ |
| CRM Analytics | ❌ | ❌ | ✅ | ✅ |
| Export Reports | ❌ | ✅ | ✅ | ✅ |

---

# 11. White Label

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Custom Logo | ✅ | ✅ | ✅ | ✅ |
| Custom Colors | ❌ | ✅ | ✅ | ✅ |
| Custom Domain | ❌ | ❌ | ✅ | ✅ |
| Custom Login Screen | ❌ | ❌ | ✅ | ✅ |
| Dedicated Server | ❌ | ❌ | ❌ | ✅ |

---

# 12. API & Integration

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| LINE OA | ✅ | ✅ | ✅ | ✅ |
| Webhook | ❌ | ❌ | ✅ | ✅ |
| Public API | ❌ | ❌ | ✅ | ✅ |
| Custom Integration | ❌ | ❌ | ❌ | ✅ |

---

# 13. Future Modules

| Feature | Starter | Business | Pro | Enterprise |
|----------|----------|----------|----------|----------|
| Tournament | Add-on | Add-on | ✅ | ✅ |
| Find Player | ❌ | ❌ | Add-on | ✅ |
| Coach Booking | ❌ | ❌ | Add-on | ✅ |
| Marketplace | ❌ | ❌ | Add-on | ✅ |

---

# 14. Add-on Features

ซื้อเพิ่มแยกจาก Plan

- Tournament Module
- Find Player Module
- Coach Module
- Marketplace Module
- Additional Storage
- Additional Staff Users
- Additional Branch (สาขาเพิ่ม)
- SMS Package
- Premium Analytics

หมายเหตุ: "สาขาเพิ่ม" คือ add-on หลักของการ scale (ไม่ใช่ "คอร์ทเพิ่ม") เพื่อคงความเป็นกลางทางกีฬา

---

# 15. Recommended Plan Positioning (ทุกกีฬา)

Starter — สนามเปิดใหม่ 1 สาขา ทุกกีฬา
- แบดมินตันร้านเล็ก
- สนามฟุตบอล / ฟุตซอล 1–2 สนาม (ใช้มัดจำ + จองประจำได้เต็ม)
- คอร์ทเทนนิส / พิคเคิลบอลขนาดเล็ก

Business — สนามที่มีลูกค้าประจำ ต้องการ Membership / Package / Wallet
- แบดมินตันที่ขายชั่วโมงเหมาให้สมาชิก
- สนามฟุตบอลที่มีก๊วนประจำหลายก๊วน
- คลับเทนนิสที่เก็บค่าสมาชิก

Pro — สนามที่ทำ CRM / การตลาดจริงจัง หรือมีหลายสาขา + อยากได้แบรนด์ตัวเอง
- Sports complex หลายกีฬาในที่เดียว
- สนามที่ยิง Broadcast / ทำ Automation / ดู Analytics ลึก

Enterprise — Chain หลายสาขา / White Label เต็มรูปแบบ / Dedicated Server

---

# 16. Feature Flag Mapping

Database Tables

- plans
- features
- plan_features
- subscriptions
- organization_feature_overrides
- feature_purchases
- usage_records

---

# 17. Architecture Rules

1. ห้าม Hardcode Feature ใน Source Code
2. ทุก Feature เปิดผ่าน Feature Flag
3. ใช้ **branch** เป็นตัวคุมขนาด ไม่ใช่จำนวนคอร์ทหรือจำนวนบุ๊คกิ้ง (sport-neutral)
4. ห้าม cap จำนวน Booking ในทุก Plan
5. ใช้ราคาชุดเดียวทุกกีฬา ให้ Feature เป็นตัวดึง Tier
6. Add-on ต้องแยกจาก Plan หลัก
7. Enterprise สามารถ Override Feature ได้
8. Usage Based Billing รองรับในอนาคต (ผ่าน `usage_records`)

---

# 18. Final Recommendation

MVP Launch

- เปิดขาย Starter / Business / Pro
- Enterprise เปิดแบบ Custom Project
- ลูกค้า 10 รายแรกเป็น Design Partner (ฟรี/ลดหนัก + Setup ฟรี แลก feedback + reference)

หลังมีลูกค้า 20+ สนาม
- เริ่มพิจารณา Usage-Based Billing (SMS, Storage, Broadcast) ผ่าน `usage_records`
