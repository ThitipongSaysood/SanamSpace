# Customer Booking Web — Design Spec (Milestone 1)

_Date: 2026-06-13 · Status: approved · Owner: SanamSpace_

## 1. Overview

สร้าง **Customer Booking Web App** ของ SanamSpace — เว็บ (Next.js PWA, mobile-first)
ที่ลูกค้าใช้ค้นหาสนาม จองคอร์ท ชำระเงินด้วยการอัปสลิป และเช็คอินด้วย QR
Milestone 1 โฟกัส **foundation + booking happy-path** โดยใช้ **mock data** (ยังไม่มี backend)

อ้างอิง: [System Architecture](../../../structure/SanamSpace_System_Architecture_v1.md),
[API Spec](../../../structure/API_Specification_v1.md), UX specs ใน [docs/ux/customer](../../ux/customer/),
mockups `image/image1.*.png` (ธีม Everyday Badminton)

## 2. Goals & Non-Goals

**Goals**
- เห็น booking flow ครบ end-to-end เป็นเว็บที่กดใช้ได้จริง (ด้วย mock data)
- โครงสร้างพร้อมสลับไป PHP REST `/api/v1` จริงภายหลังโดยแก้จุดเดียว (data layer)
- Design system (โทเค็นสี/ฟอนต์ตาม PRD) ใช้ซ้ำได้ + white-label-ready

**Non-Goals (Milestone 1)**
- Membership / Wallet / Package / Profile / Settings / Notification screens
- LINE LIFF จริง (ใช้ mock auth), PHP backend, payment gateway, OCR สลิปจริง
- Service worker / offline, push notification
- Owner Admin Portal, Super Admin Portal

## 3. Tech Stack

| ด้าน | เลือกใช้ |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives) — restyle เป็นธีมเขียว |
| Data fetching | TanStack Query v5 ครอบ typed service layer |
| Fonts | Prompt (ไทย), Inter (อังกฤษ) ผ่าน `next/font` |
| Testing | Vitest + React Testing Library; Playwright (e2e, stretch) |
| Package manager | npm |

**Design tokens** (จาก PRD §15): primary/success `#16A34A`, warning `#F59E0B`, danger `#EF4444`.
ตั้งใน Tailwind theme + CSS variables เพื่อให้ tenant override ได้

## 4. Project Structure

วางใน `frontend/` (ตาม [Project_Structure_v1](../../../structure/Project_Structure_v1.md)):

```
frontend/
├── app/
│   ├── (auth)/login/page.tsx        # CUS-AUTH-002 — LINE login (mock)
│   ├── (app)/
│   │   ├── layout.tsx               # app shell + BottomNav
│   │   ├── page.tsx                 # Home  CUS-HOME-001
│   │   ├── venue/[venueId]/page.tsx # Venue Detail  CUS-VENUE-001
│   │   ├── booking/new/page.tsx     # เลือก court+วัน+เวลา → summary  CUS-BOOK-001
│   │   ├── payment/[bookingId]/page.tsx  # method + อัปสลิป + status  CUS-PAY-001..004
│   │   ├── booking/[bookingId]/page.tsx  # confirmation + QR  CUS-BOOK-002/005
│   │   └── bookings/page.tsx        # history (อ่านอย่างเดียว)  CUS-BOOK-003
│   ├── layout.tsx                   # root: fonts, providers
│   └── globals.css
├── components/ui/                   # shadcn primitives
├── components/                      # Card, CourtSlotGrid, BottomNav, VenueCard, SlipUploader, QRTicket ...
├── lib/api/                         # typed service + mock fixtures (swap point)
│   ├── client.ts                    # service interface (mock impl ตอนนี้)
│   ├── fixtures/                    # mock JSON (venues, courts, schedules, bookings)
│   └── queries.ts                   # TanStack Query hooks
├── lib/types/                       # types ตาม /api/v1
├── lib/auth/                        # mock auth context + useAuth()
├── config/tenant.ts                 # ธีม/แบรนด์ tenant (white-label-ready)
└── tests/
```

> ภายหลังถ้ามี owner/admin portal: พิจารณาแยกเป็น monorepo (`apps/`) — ตอนนี้ YAGNI

## 5. Data Layer (Mock-first)

**หลักการ:** UI เรียกผ่าน typed service ใน `lib/api/client.ts` ไม่เรียก fetch ตรง
ตอนนี้ service คืน mock fixtures (มี artificial delay จำลอง network) — สลับเป็น `fetch('/api/v1/...')`
ภายหลังแก้แค่ `client.ts`

**Service surface ที่ milestone นี้ใช้** (ชื่อ → endpoint จริงที่จะ map ภายหลัง):
| Service fn | API `/api/v1` | หมายเหตุ |
|---|---|---|
| `getVenues()` / `getVenue(id)` | `GET /branches`, `GET /branches/{id}` | "Venue" (ศัพท์ลูกค้า) ≈ Branch ใน API |
| `getCourts(venueId)` | `GET /courts` | filter ตาม venue |
| `getCourtSchedule(courtId, date)` | `GET /courts/{id}/schedules` | slot ว่าง/ไม่ว่าง |
| `createBooking(payload)` | `POST /bookings` | |
| `getBooking(id)` | `GET /bookings/{id}` | |
| `createPayment(bookingId)` | `POST /payments` | |
| `uploadSlip(paymentId, file)` | `POST /payments/{id}/upload-slip` | |
| `getPaymentStatus(paymentId)` | `GET /payments` | poll สถานะ |
| `checkinBooking(id)` | `POST /bookings/{id}/checkin` | QR |

**Backend gaps (flag ไว้):** API spec ปัจจุบันไม่มี endpoint สำหรับ "รายการ venue สาธารณะฝั่งลูกค้า"
และ recommended courts/search — milestone นี้ใช้ mock; ต้องเพิ่มใน API spec ตอนทำ backend จริง

## 6. Screens & Flow

happy-path (ตาม [Booking_Flow](../../ux/flows/Booking_Flow.md)):

```
Login(mock) → Home → Venue Detail → เลือก Court+วัน+เวลา → Booking Summary
   → Payment Method → Transfer + Upload Slip → Payment Status(pending→approved)
   → Booking Confirmation + QR Check-in
```

แต่ละจอ implement ตาม UX spec ที่มีอยู่ (Components/Validation/Edge Cases) ใน `docs/ux/customer/`.
สถานะ payment ใน mock: หลังอัปสลิป → `pending` แล้วจำลอง auto-approve (หรือปุ่ม "จำลองอนุมัติ" สำหรับ demo)

## 7. Auth (Mock)

- `lib/auth/` มี `AuthProvider` + `useAuth()` คืน user จำลอง (เช่น "คุณสมชาย", LINE id ปลอม)
- ปุ่ม "เข้าสู่ระบบด้วย LINE" → set logged-in ทันที (ไม่เรียก LIFF)
- Route group `(app)` ต้อง logged-in; ถ้าไม่ → redirect ไป `/login`
- โครงเผื่อสลับเป็น LINE LIFF SDK จริงภายหลัง

## 8. Multi-tenant / White-label

- `config/tenant.ts` เก็บ `{ name, logo, theme: {primary,...}, lineOaUrl }` — ตอนนี้ hardcode Everyday Badminton
- ธีมถูก inject เป็น CSS variables ที่ root → เปลี่ยน tenant = เปลี่ยน config
- โครงสร้าง map กับ `organization_settings` ใน DB architecture (logo/สี/ฟอนต์ต่อสนาม)

## 9. Error Handling & States

ทุกหน้าจัดการ: **loading** (skeleton), **empty** (ไม่มีคอร์ท/ไม่มีประวัติ), **error** (เรียก mock fail → retry).
เคสเฉพาะ:
- เลือก slot ที่เพิ่งถูกจอง → แจ้ง "ช่วงเวลานี้ถูกจองแล้ว" + refresh schedule
- อัปสลิป: ตรวจชนิดไฟล์ (jpg/png), ขนาด (≤5MB), จำนวนเงินตรงกับ booking; ผิด → error inline
- QR หมดอายุ/เช็คอินซ้ำ → แจ้งสถานะ
- ยังไม่ logged-in เข้าหน้า `(app)` → redirect login

## 10. Testing Strategy (TDD)

- **Unit/component (Vitest + RTL):** slot selection logic, booking summary คำนวณราคา, slip validation,
  auth guard, tenant theme resolver
- **e2e (Playwright, stretch):** happy-path จอง 1 รอบจนถึง confirmation
- เขียนเทสต์ก่อน implement (ตาม test-driven-development skill) สำหรับ logic ที่มีกฎชัด

## 11. Build Order (milestone breakdown)

1. Scaffold Next.js + Tailwind + shadcn + fonts + tenant theme + app shell/BottomNav
2. Data layer: types + mock fixtures + service + TanStack Query provider
3. Mock auth + login screen + route guard
4. Home → Venue Detail (read screens)
5. Booking: เลือก court/วัน/เวลา → summary → createBooking
6. Payment: method → upload slip → status
7. Confirmation + QR + Booking history
8. Tests + polish (loading/empty/error, responsive, PWA manifest)

(รายละเอียดเป็น task จะอยู่ใน implementation plan ขั้นถัดไป)

## 12. Assumptions & Open Questions

- **ชื่อโปรเจกต์:** ใช้ "SanamSpace" เป็นแบรนด์เว็บ (PRD v2 ใช้ "PlayCourt" — ยังไม่ rebrand; ใช้ค่าจาก tenant config)
- ราคา/slot duration: ใช้ค่า mock สมเหตุผล (เช่น ราคา/ชม. ต่อคอร์ท) จนกว่าจะมี backend
- ภาษา: ไทยเป็นหลัก (ยังไม่ทำ i18n framework)
- mock payment auto-approve เพื่อ demo flow — ของจริงคือ staff verify ใน owner portal
