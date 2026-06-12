# SanamSpace

> **White‑Label, Multi‑Tenant SaaS สำหรับธุรกิจสนามกีฬา** — ยกระดับจาก "ระบบจองสนาม" ไปสู่ **Venue Operating System (Venue OS)**

SanamSpace เป็นแพลตฟอร์มเดียวที่รวม **Booking · Payment · CRM · Membership · Loyalty · Revenue Management · Analytics** ไว้ด้วยกัน รองรับสนามหลายประเภท (แบดมินตัน ฟุตบอล ฟุตซอล เทนนิส พิคเคิลบอล บาสเกตบอล วอลเลย์บอล ฯลฯ) โดยแต่ละสนาม/องค์กรเป็น **Tenant แยกข้อมูลกัน 100%**

> ℹ️ **เรื่องชื่อ:** repo และเอกสารชุดแรกใช้ชื่อ **SanamSpace** ส่วนเอกสารสถาปัตยกรรมชุดหลังหลายฉบับใช้โค้ดเนม **"PlayCourt"** — ทั้งสองหมายถึงโปรเจกต์เดียวกัน

> 🚧 **สถานะปัจจุบัน:** repository นี้อยู่ในขั้น **Design / Specification** — เก็บเอกสารออกแบบระบบ (PRD, สถาปัตยกรรม, Database, API, UX) และภาพอ้างอิง ยังไม่มีโค้ด application

---

## สารบัญ

- [ภาพรวม](#ภาพรวม)
- [ความสามารถหลัก](#ความสามารถหลัก)
- [ผู้ใช้งานและแอป](#ผู้ใช้งานและแอป)
- [สถาปัตยกรรม](#สถาปัตยกรรม)
- [แพ็กเกจและ Feature Flag](#แพ็กเกจและ-feature-flag)
- [โครงสร้างข้อมูล (Database)](#โครงสร้างข้อมูล-database)
- [API](#api)
- [Roadmap](#roadmap)
- [โครงสร้าง Repository](#โครงสร้าง-repository)
- [ดัชนีเอกสาร](#ดัชนีเอกสาร)
- [`.agents/` — Shared AI Context](#agents--shared-ai-context)

---

## ภาพรวม

เป้าหมายของ SanamSpace คือเป็น **ระบบปฏิบัติการของสนามกีฬา** ที่เจ้าของสนามใช้บริหารทุกอย่างในที่เดียว และให้ลูกค้าจอง/จ่าย/สะสมแต้มผ่านมือถือ (LINE เป็นหลัก)

หลักคิด 3 ข้อ:

- **Multi‑Tenant First** — ทุกข้อมูลผูกกับ `organization_id` ไม่มีการเข้าถึงข้ามสนาม
- **White Label** — แต่ละสนามปรับแบรนด์ได้เอง (โลโก้ สี โดเมน หน้า login)
- **Feature Flag Driven** — เปิด/ปิดฟีเจอร์ตาม Subscription Plan โดยไม่ hardcode ในโค้ด

---

## ความสามารถหลัก

| โดเมน | รายละเอียด |
|---|---|
| 🗓️ **Booking** | จองคอร์ทหลายกีฬา, ตารางเวลา, Check‑in/Check‑out, ประวัติการจอง, Waitlist, Auto‑Rebooking |
| 💳 **Payment** | โอนเงิน + อัปโหลดสลิป, ตรวจสลิป (OCR + กันสลิปซ้ำ), Refund, Invoice/Tax Invoice, Payment Gateway, PromptPay |
| 👥 **CRM & Loyalty** | โปรไฟล์ลูกค้า, Segment, Customer Timeline, Membership (Silver/Gold/Platinum), Points, Wallet, Package |
| 📣 **Marketing** | คูปอง, โปรโมชั่น, Happy Hour, Broadcast ผ่าน LINE OA, Campaign |
| 💰 **Revenue** | Dynamic Pricing (Peak/Off‑Peak), Find Player, Auto Promotion เมื่อสนามว่าง |
| 📊 **Analytics** | Revenue / Booking / Utilization / Membership / MRR Dashboard, Export Report |
| 🏆 **Future Modules** | Tournament, Coach Booking, Marketplace |
| 🎨 **White Label** | Custom Logo/Color/Domain/Login, Dedicated Server (Enterprise) |

---

## ผู้ใช้งานและแอป

**4 บทบาทหลัก:** Customer · Staff · Owner · Super Admin
(ฝั่ง Staff แบ่งย่อยเป็น Manager / Reception / Cashier / Marketing / Coach / Accountant / Viewer — สิทธิ์คุมด้วย RBAC ที่ scope ตาม `organization_id` ดู [Permission Matrix](structure/Permission_Matrix_v1.md))

**3 แอป ใช้ API ชุดเดียวกัน:**

1. **Customer App** — LINE LIFF / PWA + Mobile (React Native / Expo): จองสนาม, จ่ายเงิน, สมาชิก, Wallet, QR Check‑in
2. **Owner Admin Portal** — Dashboard, จัดการ Booking/Court/Payment, CRM, Report
3. **Super Admin Portal** — จัดการ Tenant, Subscription, Billing, Feature, Platform Analytics

---

## สถาปัตยกรรม

**หลักการ:** Multi‑Tenant First · API First · Feature Flag Driven · Event Driven

```
Customer PWA / Owner Portal / Super Admin Portal
                    │
              API Layer (PHP)
                    │
             Business Services
                    │
              MySQL Database
        ├─ Cloudflare R2 (ไฟล์/สลิป/รูป)
        ├─ LINE Messaging API (แจ้งเตือน)
        └─ Job Queue (Cron)
```

**Tech Stack** (อ้างอิง [System Architecture v1](structure/SanamSpace_System_Architecture_v1.md)):

| ชั้น | เทคโนโลยี |
|---|---|
| Frontend | Next.js, React, Tailwind CSS, LINE LIFF |
| Backend | PHP 8.3, REST API |
| Database | MySQL 8 (InnoDB, UTF8MB4) — PK เป็น BIGINT/UUID, soft delete |
| Storage | Cloudflare R2 |
| Notification | LINE Messaging API (+ Email / SMS / Push) |
| Queue / Jobs | MySQL `jobs` + Cron (`* * * * *`) |
| Auth | LINE LIFF (ลูกค้า) · Email/Password (แอดมิน) |
| Analytics | BigQuery + Looker Studio |
| Deploy | Ubuntu + Nginx + PHP‑FPM + MySQL (VPS) |

> 📝 หมายเหตุ: [PRD v2](structure/SanamSpace_PRD_Master_v2.md) ลิสต์ทางเลือกอื่นไว้ด้วย (เช่น Supabase/Firebase, Omise/GB Prime Pay) แต่สถาปัตยกรรมที่ยึดเป็นหลักคือชุด PHP 8.3 + MySQL ข้างต้น

---

## แพ็กเกจและ Feature Flag

แบ่งเป็น 4 แพ็กเกจ คุมความสามารถผ่าน Feature Flag (ดูตารางเต็มใน [Feature Matrix](structure/Feature_Matrix_v1.md)):

| Plan | ราคา/เดือน | กลุ่มเป้าหมาย |
|---|---|---|
| **Starter** | 990 THB | สนามเปิดใหม่ 1 สาขา (≤10 คอร์ท) |
| **Business** | 1,990 THB | สนามเล็ก–กลาง ที่มีสมาชิกประจำ (CRM/Membership/Wallet) |
| **Pro** | 3,990 THB | สนามที่ทำ CRM + การตลาดจริงจัง, Multi‑Branch, API |
| **Enterprise** | Custom | Chain หลายสาขา, White Label เต็มรูปแบบ, Dedicated Server |

**กฎสถาปัตยกรรม:** ห้าม hardcode ฟีเจอร์ · ทุกฟีเจอร์เปิดผ่าน Feature Flag · Add‑on แยกจาก Plan หลัก · Enterprise override ได้ · รองรับ Usage‑Based Billing ในอนาคต

---

## โครงสร้างข้อมูล (Database)

Multi‑tenant schema แบ่งเป็น 10 โดเมน (ดู [ER Diagram](structure/SanamSpace_ER_Diagram_Master_v1.md) และ [Database Architecture ฉบับเต็ม](structure/SanamSpace_Database_Architecture_v1_Full.md)):

`Platform` · `User & Permission` · `Subscription` · `Customer & LINE` · `Venue & Court` · `Booking` · `Payment` · `Membership & Wallet` · `CRM & Notification` · `Analytics`

หลักการ: ทุกตารางของสนามมี `organization_id` · ลูกค้า LINE คนเดียวมีได้หลาย Customer Profile (แต้ม/Wallet/Membership ไม่ปนกันข้ามสนาม) · มาตรฐานคอลัมน์ `created_at` / `updated_at` / `deleted_at`

---

## API

REST API ภายใต้ base path **`/api/v1`** (รายการเต็มใน [API Specification](structure/API_Specification_v1.md)) ครอบคลุม:

`auth` · `organizations` · `branches` · `courts` (+ schedules) · `bookings` (+ cancel/checkin/checkout) · `payments` (+ upload‑slip/verify/reject) · `refunds` · `customers` · `memberships` · `wallets` · `promotions`/`coupons` · `crm` (segments/timeline) · `notifications`/`broadcasts` · `reports` · `subscriptions` · `admin` (users/roles/permissions)

---

## Roadmap

| Phase | โฟกัส | เป้าหมาย |
|---|---|---|
| **1 — MVP** (8–12 สัปดาห์) | Multi‑Tenant Core, LINE Login, Booking, Check‑in/out, Manual Transfer + Slip Verify, Customer + Reminder | 5–10 สนามแรก |
| **2 — Growth** | CRM (Segment/Broadcast/Timeline), Loyalty (Membership/Wallet/Package/Points), Analytics | 50+ สนาม |
| **3 — Scale** | Automation (CRM/Rebooking), Integrations (Payment Gateway/Public API/Webhook), White Label (Custom Domain/Branding) | 100+ สนาม |
| **4 — Enterprise** | Tournament, Coach, Marketplace, Data Warehouse / BI | 500+ สนาม |

รายละเอียดใน [Development Roadmap](structure/Development_Roadmap_v1.md)

---

## โครงสร้าง Repository

**ปัจจุบัน** (ขั้น spec):

```
.
├── structure/   # เอกสารออกแบบระบบทั้งหมด (PRD, Architecture, DB, API, UX)
├── image/       # ภาพหน้าจอ/อ้างอิงดีไซน์
├── .agents/     # Shared AI context (ดูด้านล่าง)
└── README.md
```

**โครงสร้างเป้าหมาย** ตอนเริ่มพัฒนา (จาก [Project Structure](structure/Project_Structure_v1.md)) เป็น monorepo: `frontend/` (Next.js) · `backend/` (PHP 8.3 — Controllers/Services/Repositories/Middleware/Jobs/Events) · `database/` (migrations/seeders/views) · `infra/` (nginx/cron/deploy) · `docs/`

เอกสาร UX จัดเก็บตามมาตรฐานใน `docs/ux/` (1 Screen = 1 File, 1 Flow = 1 File) — ดู [UX Folder Structure](structure/SanamSpace_UX_Folder_Structure_v1.md)

---

## ดัชนีเอกสาร

| เอกสาร | เนื้อหา |
|---|---|
| [PRD Master v2](structure/SanamSpace_PRD_Master_v2.md) | Product Requirements ฉบับล่าสุด (vision, modules, MVP) |
| [PRD Master v1](structure/SanamSpace_PRD_Master_v1.md) | PRD ฉบับแรก |
| [System Architecture v1](structure/SanamSpace_System_Architecture_v1.md) | สถาปัตยกรรมระบบ + tech stack |
| [Database Architecture (Full)](structure/SanamSpace_Database_Architecture_v1_Full.md) | สคีมาฐานข้อมูลฉบับเต็ม |
| [ER Diagram Master v1](structure/SanamSpace_ER_Diagram_Master_v1.md) | ความสัมพันธ์ระหว่างตารางตามโดเมน |
| [Feature Matrix v1](structure/Feature_Matrix_v1.md) | ฟีเจอร์แยกตาม Plan + ราคา |
| [Permission Matrix v1](structure/Permission_Matrix_v1.md) | RBAC: บทบาท × โมดูล |
| [API Specification v1](structure/API_Specification_v1.md) | REST endpoints |
| [Development Roadmap v1](structure/Development_Roadmap_v1.md) | แผนพัฒนา 4 เฟส |
| [Project Structure v1](structure/Project_Structure_v1.md) | โครงสร้างโค้ดเป้าหมาย |
| [UX Folder Structure v1](structure/SanamSpace_UX_Folder_Structure_v1.md) | มาตรฐานจัดเก็บเอกสาร UX |

---

## `.agents/` — Shared AI Context

โปรเจกต์นี้ใช้โฟลเดอร์ [`.agents/`](.agents/) เพื่อให้ผู้ช่วย AI (Claude, Cursor, Codex ฯลฯ) แชร์ context ข้าม session ได้:

- **`AGENTS.md`** — กติกาที่ AI ต้องอ่านก่อนเริ่มงาน
- **`active.md`** — งานที่กำลังทำ / ติดอะไร / step ถัดไป
- **`sessions/`** — checkpoint แต่ละรอบ ไว้ resume ต่อ
- **`topics/`** — โน้ตยาวข้าม task
- **`private/`** — โน้ตส่วนตัว (gitignored ไม่ขึ้น repo)
- **`skills/`** — skills ที่ติดตั้งไว้ในโปรเจกต์

---

<sub>© SanamSpace — เอกสารภายใน (Proprietary &amp; Confidential)</sub>
