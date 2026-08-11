# SanamSpace

> **White-Label, Multi-Tenant SaaS สำหรับธุรกิจสนามกีฬา** — Venue Operating System ที่รวม **Booking · Payment · CRM · Membership · Loyalty · Marketing · Analytics** ไว้ในที่เดียว

แต่ละสนาม/องค์กรเป็น **Tenant แยกข้อมูลกัน 100%** รองรับหลายกีฬา (แบดมินตัน ฟุตซอล เทนนิส พิคเคิลบอล ฯลฯ) เจ้าของสนามบริหารทุกอย่างจากพอร์ทัลเดียว ลูกค้าจอง/จ่าย/สะสมแต้มผ่านมือถือ (LINE เป็นหลัก)

> ✅ **สถานะ:** เป็น **monorepo ที่ทำงานได้จริง** — Laravel 13 API + Next.js 16 App Router พร้อมชุดเทสต์ (backend 627 · frontend unit 31 · e2e) ไม่ใช่แค่เอกสารออกแบบอีกต่อไป (เอกสาร spec ชุดแรกยังเก็บไว้ใน [`structure/`](structure/))

---

## สารบัญ

- [ภาพรวม](#ภาพรวม)
- [Tech Stack](#tech-stack)
- [3 พอร์ทัล](#3-พอร์ทัล)
- [ความสามารถหลัก](#ความสามารถหลัก)
- [เริ่มต้นใช้งาน (Getting Started)](#เริ่มต้นใช้งาน-getting-started)
- [การทดสอบ](#การทดสอบ)
- [โครงสร้าง Repository](#โครงสร้าง-repository)
- [กติกาสถาปัตยกรรมที่สำคัญ](#กติกาสถาปัตยกรรมที่สำคัญ)
- [แพ็กเกจและ Feature Flag](#แพ็กเกจและ-feature-flag)
- [ดัชนีเอกสารออกแบบ](#ดัชนีเอกสารออกแบบ)
- [`.agents/` — Shared AI Context](#agents--shared-ai-context)

---

## ภาพรวม

หลักคิด 3 ข้อ:

- **Multi-Tenant First** — ทุกข้อมูลผูกกับ `organization_id` · tenant resolve จาก `X-Venue-Slug` **ไม่มี fallback** (resolve ไม่ได้ = 404) ไม่มีการเข้าถึงข้ามสนาม
- **White Label** — แต่ละสนามปรับแบรนด์เองได้ (โลโก้ · 3 สีธีม · หน้าลูกค้า) เห็นผลทันทีในแอปลูกค้า
- **Feature Flag Driven** — เปิด/ปิดฟีเจอร์และ limit ตาม Subscription Plan (`feature:*`, `limit:*` middleware) ไม่ hardcode

---

## Tech Stack

| ชั้น | เทคโนโลยี |
|---|---|
| **Backend** | PHP 8.3 · Laravel 13 · REST API ใต้ `/api/v1` |
| **Frontend** | Next.js 16 (App Router) · React 19 · Tailwind CSS · TanStack Query |
| **Database** | **Dev: SQLite** · **Prod: MySQL 8** (utf8mb4) — UUID PK, soft delete |
| **Auth** | LINE LIFF (ลูกค้า) · Email/Password + token (Owner/Admin) |
| **Notification** | LINE Messaging API (Flex receipt builder + broadcast) |
| **Storage** | local/`storage` (dev) — เสิร์ฟผ่าน `php artisan storage:link` |
| **Deploy** | Ubuntu + Nginx + PHP-FPM (VPS) — ดู [DEPLOYMENT.md](DEPLOYMENT.md) |

> ⚠️ **Dev เป็น SQLite แต่ Prod เป็น MySQL** และ CI **ไม่รันเทสต์** — ก่อน release ต้องรัน migrate + suite บน MySQL จริง (unsigned column รับค่าลบผ่าน SQLite แต่ 500 บน MySQL) ดูรายละเอียดใน [`.agents/AGENTS.md`](.agents/AGENTS.md)

---

## 3 พอร์ทัล

ทุกพอร์ทัลใช้ API ชุดเดียวกัน:

| พอร์ทัล | Route | ผู้ใช้ | ไฮไลต์ |
|---|---|---|---|
| **Customer App** | `/v/{slug}` (LINE LIFF / PWA) | ลูกค้า | จองสนาม · จ่าย/อัปโหลดสลิป · เครดิต/แพ็กเกจ · สมาชิก/แต้ม · QR เช็คอิน · โปรโมชั่น |
| **Owner Portal** | `/owner` | เจ้าของ/พนักงาน | ปฏิทินจอง · ตรวจสลิป · CRM · คูปอง/โปรโมชั่น · แต้ม · สแกน/เช็คอิน · รายงาน · ตั้งค่าแบรนด์ · LINE reply builder |
| **Admin Portal** | `/admin` | Super Admin | จัดการ Organization · Subscription/Billing · Plan/Feature · Announcement · Support |

> หน้าลูกค้าอยู่ใต้ `/v/{slug}` เพราะเป็น **LINE LIFF Endpoint URL** — เปลี่ยน path ไม่ได้ (ต้องแก้ที่ LINE console ทุกสนาม)

---

## ความสามารถหลัก

| โดเมน | ที่มีจริงในระบบ |
|---|---|
| 🗓️ **Booking** | ปฏิทินแยกคอร์ท (วัน/สัปดาห์/เดือน) · จองหน้าเคาน์เตอร์ (walk-in) · กันจองซ้ำด้วย lock ต่อคอร์ท+วัน · ยกเลิก/ปล่อย slot · ช่วงเวลาตามการตั้งค่าสนาม |
| 💳 **Payment** | โอน+อัปโหลดสลิป · ตรวจ/อนุมัติสลิป (กันสลิปซ้ำ) · มัดจำ · PromptPay QR · Refund (คืนเป็นเครดิต) |
| 💰 **Credit & Packages** | เครดิต (บาท) กับชั่วโมงแพ็กเกจ **แยกกันไม่รวม** · จ่ายด้วยเครดิต/แพ็กเกจ · ทุกการเคลื่อนไหวบันทึกว่าใครทำ |
| 🎟️ **ส่วนลด** | คูปอง (โค้ด · %/บาท · ขั้นต่ำ · เพดาน · วันใช้ได้) · ส่วนลดตามระดับสมาชิก · **โปรโมชั่นผูกคูปอง** (กดโปร→จอง+ใส่โค้ดอัตโนมัติ) |
| 👥 **CRM & Loyalty** | โปรไฟล์+ไทม์ไลน์ลูกค้า · โน้ต/งานติดตาม · Segment · Membership (Silver/Gold/Platinum) · แต้ม+หมดอายุ+แลกรางวัล |
| 📣 **Marketing** | Broadcast ผ่าน LINE OA (บันทึกผลส่งรายคน) · แบนเนอร์/ต้อนรับ · **LINE reply builder** (ออกแบบการ์ด Flex ตอนจอง/ชำระ/ยกเลิก แบบลากวาง) |
| ✅ **Check-in** | ลูกค้าแสดง QR · พนักงานสแกน · **`/scan` สแกนเนอร์สำหรับเคาน์เตอร์** (ติดตั้งเป็น PWA ได้) · สถานะอัปเดตเอง |
| 📊 **Analytics** | Dashboard รายได้/การจอง/utilization · รายงาน export |
| 🧾 **Platform** | Subscription/Billing · Plan + Feature Flag + Usage Limit · White-label theming |

---

## เริ่มต้นใช้งาน (Getting Started)

**ต้องมี:** PHP 8.3 · Composer · Node.js 20+ · npm

### 1) Backend (Laravel API — พอร์ต 8000)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed          # สร้าง schema + ข้อมูลเดโม (SanamSpaceSeeder)
php artisan storage:link            # ไม่งั้นรูป/สลิปที่อัปโหลดจะ 404
php artisan serve                   # http://localhost:8000
```

> Dev ใช้ SQLite โดยอัตโนมัติ (`database/database.sqlite`) — ไม่ต้องตั้งค่า DB

### 2) Frontend (Next.js — พอร์ต 3000)

```bash
cd frontend
npm install
# frontend/.env.local :
#   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm run dev                         # http://localhost:3000
```

> ถ้าไม่ตั้ง `NEXT_PUBLIC_API_URL` → พอร์ทัล owner/admin จะยิง API ผิดพอร์ต (404 ทุก call รวมล็อกอิน) ส่วนแอปลูกค้าจะ fallback ไป in-memory mock เงียบๆ · `NEXT_PUBLIC_*` ถูก inline ตอน start ต้อง restart `npm run dev` หลังแก้

### 3) ล็อกอินเดโม

| พอร์ทัล | เข้าที่ | บัญชี |
|---|---|---|
| Owner | `/owner` | `owner@everyday.test` / `password` |
| Customer | `/v/everyday-badminton?autologin=1` | auto-login (เฉพาะ dev) |

> venue เดโม: `everyday-badminton`, `tsr-arena`

---

## การทดสอบ

```bash
# Backend — PHPUnit (in-memory SQLite)
cd backend && php artisan test

# Frontend — type-check · lint · unit (Vitest)
cd frontend && npx tsc --noEmit && npm run lint && npm run test

# Frontend — e2e (Playwright, ต้องมี dev server รันอยู่)
cd frontend && npx playwright test --workers=1
```

**Baseline ที่ต้องรักษา:** backend เขียว · `tsc --noEmit` clean · vitest เขียว · **lint 0 errors** · e2e เขียว

---

## โครงสร้าง Repository

```
.
├── backend/          # Laravel 13 API
│   ├── app/
│   │   ├── Http/Controllers/Api/{Owner,Admin,…}   # แยกตามพอร์ทัล
│   │   ├── Http/Resources/         # API response shapes
│   │   ├── Http/Middleware/        # tenant · permission · feature · limit
│   │   ├── Models/  Services/  Support/
│   │   └── ...
│   ├── database/migrations · seeders
│   ├── routes/api.php
│   └── tests/{Feature,Unit}/
├── frontend/         # Next.js 16 App Router
│   ├── app/
│   │   ├── owner/     # Owner Portal
│   │   ├── admin/     # Super Admin Portal
│   │   └── v/[slug]/  # Customer App (LINE LIFF)
│   ├── components/  lib/{api,tenant,auth}/
│   └── e2e/          # Playwright specs
├── structure/        # เอกสารออกแบบชุดแรก (PRD, Architecture, DB, API)
├── docs/  image/  infra/
├── .agents/          # Shared AI context (ดูด้านล่าง)
├── DEPLOYMENT.md
└── README.md
```

---

## กติกาสถาปัตยกรรมที่สำคัญ

รายละเอียดเต็มใน [`.agents/AGENTS.md`](.agents/AGENTS.md) — สรุปข้อที่พลาดไม่ได้:

- **Multi-tenancy:** ทุกอย่าง scope ด้วย `organization_id` · resolve จาก `X-Venue-Slug` **ไม่มี fallback** · path `/v/{slug}` = LINE LIFF ห้ามเปลี่ยน
- **เงิน:** ผ่าน shared service (Refund/Credit/Deposit/Discount) เท่านั้น · state transition guarded · เพิ่ม double-processing test ทุกครั้ง · เครดิต(บาท) ≠ ชั่วโมงแพ็กเกจ · `confirmed ≠ จ่ายครบ` (เช็ค `paid_amount`)
- **Dev SQLite / Prod MySQL / CI ไม่รันเทสต์** → รัน migrate+test บน MySQL ก่อน release
- **UI feedback ผ่าน `toast`/`toastSave`** (`@/lib/toast`) ไม่ใช้ `window.alert` · **feature flag ของลูกค้าอยู่ที่ `/orgs/{slug}/public`** (API GET เป็น `cache:"no-store"`)

---

## แพ็กเกจและ Feature Flag

คุมความสามารถ + limit ผ่าน Feature Flag / Plan (ดู [Feature Matrix](structure/Feature_Matrix_v1.md)) — limit เชิงโครงสร้าง (สาขา/คอร์ท/พนักงาน) hard-block, limit เชิงปริมาณ (จำนวนจอง) ไม่บล็อกรายได้ venue

| Plan | กลุ่มเป้าหมาย |
|---|---|
| **Starter** | สนามเปิดใหม่ 1 สาขา |
| **Business** | สนามเล็ก–กลางที่มีสมาชิกประจำ (CRM/Membership) |
| **Pro** | สนามที่ทำการตลาดจริงจัง, Multi-Branch |
| **Enterprise** | Chain หลายสาขา, White Label เต็มรูปแบบ |

---

## ดัชนีเอกสารออกแบบ

เอกสาร spec ชุดแรก (ก่อนลงมือโค้ด) เก็บใน [`structure/`](structure/) — บางส่วนอาจต่างจากที่ implement จริง ให้ยึดโค้ด + `.agents/AGENTS.md` เป็นหลัก:

| เอกสาร | เนื้อหา |
|---|---|
| [PRD Master v2](structure/SanamSpace_PRD_Master_v2.md) | Product Requirements |
| [System Architecture v1](structure/SanamSpace_System_Architecture_v1.md) | สถาปัตยกรรม + tech stack (ฉบับ spec) |
| [Database Architecture (Full)](structure/SanamSpace_Database_Architecture_v1_Full.md) | สคีมาฐานข้อมูล |
| [ER Diagram Master v1](structure/SanamSpace_ER_Diagram_Master_v1.md) | ความสัมพันธ์ตาราง |
| [Feature Matrix v1](structure/Feature_Matrix_v1.md) | ฟีเจอร์ × Plan |
| [Permission Matrix v1](structure/Permission_Matrix_v1.md) | RBAC บทบาท × โมดูล |
| [API Specification v1](structure/API_Specification_v1.md) | REST endpoints (ฉบับ spec) |

---

## `.agents/` — Shared AI Context

โปรเจกต์ใช้โฟลเดอร์ [`.agents/`](.agents/) ให้ผู้ช่วย AI แชร์ context ข้าม session:

- **`AGENTS.md`** — กติกาที่ต้องอ่านก่อนเริ่มงาน (multi-tenancy, money, dev/prod DB, gotchas)
- **`active.md`** — งานล่าสุด / สถานะ / step ถัดไป
- **`sessions/`** — checkpoint แต่ละรอบ ไว้ resume
- **`topics/`** — โน้ตยาวข้าม task · **`private/`** — โน้ตส่วนตัว (gitignored)

---

<sub>© SanamSpace — Proprietary &amp; Confidential</sub>
