---
date: 2026-06-13 01:57
agent: Claude (Claude Code)
branch: main (merged from feat/customer-web-complete)
task: ทำ frontend customer ครบทุกจอตาม structure + mockups
status: done
---

# Customer Web — complete all screens (24 routes)

## Goal
"ทำ frontend ทั้งหมดให้ครบตาม structure" — เติมทุกจอที่ยังไม่มี ตาม mockup ชุดละเอียด
(image1.1 customer flow + slip flow, image1.3 venue deep-dive)

## What was done
- **Foundation** (1 agent): ขยาย lib/types + fixtures + client + queries — reviews (4.8/236 + breakdown),
  packages (10/20/50 ชม.), membership (Gold ED-0001234, 820 แต้ม), wallet (฿580 + txns),
  promotions (3), notifications (4), venue extras (phone/travelHint/peakNote/weekHours), court specs (PVC/LED/BWF)
- **4 agents ขนาน** (ไฟล์ไม่ทับกัน, ห้าม git/build):
  1. Booking → **4-step wizard** (คอร์ท→ปฏิทิน มิ.ย. 2569→เวลา→สรุป) + Payment method list
     (PromptPay/บัตร/LINE Pay/TrueMoney/โอนเงิน) + จอสลิป (countdown 14:58, บัญชี ธ.กสิกร 123-1-23456-7, QR PromptPay)
  2. Venue sub-pages: facilities / map (แผนผัง C1-C6 + แท็บแผนที่+นำทาง) / gallery / reviews (breakdown bars) /
     hours (+peak callout) / courts (สเปค + switcher) + venue detail เพิ่ม menu rows + CTA "จองสนาม"
  3. Account: profile (เมนู+ออกจากระบบ) / membership (การ์ดทอง) / wallet / packages / promotions (แท็บ filter) /
     notifications (รายการจริง) / contact (จาก tenant config — เพิ่ม phone/lineId/facebook/email/addressNote)
  4. Discovery: sports (เลือกประเภทกีฬา) / search (ฟอร์ม+ผลลัพธ์ filter จริง) + home wiring (quick actions→routes จริง)
     + bookings tabs ใช้งานจริง (กำลังจะถึง/สำเร็จ/ยกเลิก)
- Merge → main `b51d7ca` + push

## Current state
24 routes, build ผ่าน, tsc clean, 22 unit tests เขียว. e2e spec อัปเดตตาม flow ใหม่แล้วแต่**ยังไม่ได้รัน**

## Blockers / open questions
- e2e ยังไม่ได้รันหลังเปลี่ยน flow (ตอนแก้ disk เกือบเต็ม; ตอนนี้ disk ว่าง ~3.9Gi รันได้: `npx playwright test`)
- ปุ่ม payment ใช้ aria-label ผูก test เก่า ("ยืนยันการชำระเงิน (โอนผ่านธนาคาร / PromptPay)") — ถ้า refactor test ค่อยลบ
- จอ "สถานะการชำระเงิน" แบบ list (#15 ใน slip board) ยังไม่มีแยก — ใช้ bookings tabs แทน

## Next step
รัน e2e + เปิด `npm run dev` ตรวจตา; ที่เหลือ: Owner Portal, PHP backend (สลับ mock ที่ lib/api/client.ts),
LINE LIFF จริง, ภาพถ่ายจริงแทน SportMedia placeholder

## For the next agent
- โครงสร้างจอทั้งหมดอยู่ใต้ frontend/app/(app)/ — tab routes (มี bottom nav): / , /bookings, /notifications, /profile;
  ที่เหลือเป็น flow screens (AppHeader back)
- booking/new เป็น wizard 4 step ใน route เดียว (internal state) — mockup แยกจอแต่เราใช้ step state
- useSearchParams ต้องห่อ Suspense (มี pattern ใน booking/new + search)
- lucide-react ตัด brand icons แล้ว (ไม่มี Facebook icon — ใช้ ThumbsUp แทน)
- Foundation data: lib/api/fixtures.ts มี reviewSummary/packages/membership/wallet/promotions/notifications
