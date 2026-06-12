---
date: 2026-06-13 01:35
agent: Claude Opus 4.8 (1M context) in Claude Code
branch: main (merged from feat/customer-web-ui)
task: ปรับ UI เว็บ customer ให้ตรง mockup ใน image/
status: done
---

# Customer Web UI — match mockups (image/image1.1.png, image1.3.png)

## Goal
"ui ตามนี้ image/" + "ปรับให้ตรงตามรูป" — ยกระดับ UI จากเรียบๆ ให้ตรงดีไซน์
Everyday Badminton (โทนเขียว) ใน mockup

## What was done
- **Design system + UI kit:** เพิ่ม `--color-app` token; สร้าง `components/`:
  `media.tsx` (SportMedia gradient+emoji placeholder), `chip.tsx` (FacilityChip),
  `status-badge.tsx` (StatusBadge), `app-header.tsx` (sticky back header)
- **Bottom nav → 4 แท็บ** (หน้าหลัก/การจอง/แจ้งเตือน/โปรไฟล์) + placeholder pages /notifications, /profile
- **ทุกจอ restyle ตรง mockup:** Login (ขาว, 3 ปุ่ม), Home (green header card + promo + quick-actions 4 + venue cards ราคา/ระยะทาง/rating), Venue detail (hero + tenant subtitle + facility chips + คำอธิบาย + "เลือกคอร์ท"), Booking (court list rows + slot grid + legend), Payment (method list + slip dropzone), Confirmation (check-circle + booking code + StatusBadge + QR ticket), QR (countdown 00:15:32), History (tabs + cards)
- **Data:** เพิ่ม `Venue.pricePerHour` + `distanceKm`
- ทำผ่าน: ผมวาง kit + flagship (Home/Venue) เอง → subagent 3 ตัว (restyle รอบแรก + precise-match 2 ตัวที่ "อ่านรูป mockup จริง")
- Merge → main (`3e2fd5d`) + push

## Current state
22 เทสต์เขียว, `npm run build` ผ่าน (10 routes), local==remote main
**ข้าม Playwright screenshot** เพราะ disk เครื่องเต็ม 100% (เหลือ ~240Mi) — เสี่ยงทำ disk เต็มจนพัง
เคลียร์ frontend build cache (.next/.turbo/node_modules/.cache) คืนพื้นที่แล้ว

## Blockers / open questions
- ⚠️ disk เครื่องเกือบเต็ม (184/228Gi) — operations หนัก (build/screenshot/install) อาจ ENOSPC
- ยังไม่ได้ตรวจ UI ด้วยตา (screenshot) — ถ้าอยากชัวร์ ให้รัน `npm run dev` ดูเอง หรือเคลียร์ disk แล้วค่อย screenshot

## Next step
ดู UI จริงด้วย `cd frontend && npm run dev`; ถ้าอยากตรงขึ้นอีก: แยก booking flow เป็น 3 จอ (คอร์ท/วันที่/เวลา)
ตาม mockup #8/#9/#10, ทำจอ membership/wallet/package/profile จริง, หรือเริ่ม backend

## For the next agent
- subagent อ่าน mockup ได้จาก `image/image1.1.png` (full customer flow) + `image1.3.png` (venue close-ups)
- UI kit: SportMedia/FacilityChip/StatusBadge/AppHeader ใน `frontend/components/`; tokens `bg-brand`/`bg-app`
- bottom nav แสดงเฉพาะ tab routes (`/`,`/bookings`,`/notifications`,`/profile`); flow screens full-bleed + sticky CTA
- จอ booking ตอนนี้รวมคอร์ท+วัน+เวลาในจอเดียว (mockup แยก 3 จอ) — ยังไม่แยก
- slot มีแค่ available/booked/closed (legend "ใกล้เต็ม" amber เป็น decorative)
- ⚠️ disk: เคลียร์ `frontend/.next` ได้เสมอถ้าต้องการพื้นที่
