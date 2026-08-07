# 2026-08-02 — QR check-in made real, on both sides, and switchable

_Agent: Claude (Opus 5)_

Asked: remove QR check-in, or make it toggleable — but finish it across the customer app and the
owner/admin side.

## What was actually there

Worth writing down, because it is why "finish it" meant "rebuild it":

- The **QR was not a QR**. `components/qr-ticket.tsx` drew an 8×8 grid of `<div>`s coloured by
  `(i * 7 + (i % 5)) % 3 === 0`. No reader could parse it.
- The **countdown was hard-coded** `00:15:32`. Same on every booking, never moved.
- The **button was on the wrong side**. `POST /bookings/{id}/checkin` was a customer route that set their
  own booking to `completed`. That is a customer recording their own attendance, not a check-in. It was
  labelled "เช็คอิน (เดโม่)" in the UI.
- There was **no staff side at all**.

Recommendation given and taken: keep it, make it real, and make it **switchable per venue**.

## Data

- `bookings.checkin_token` (32 chars, unique) — what the QR encodes. **Not** the booking code: codes are
  short and typeable, and a guessed one would check in a stranger. Backfilled for existing rows; issued by
  a `creating` hook on the model so the controller, the seeder and every test get one.
- `bookings.checked_in_at` — when they actually arrived, which is what makes no-show reporting possible.
- `organization_settings.checkin_enabled` (default on).

## Customer side

`/v/{slug}/booking/{id}/qr` — real scannable QR, a **live countdown** to the slot, and the checked-in
state with the time. **No button.** The QR entry on the booking detail is hidden when the venue has
check-in off, and the screen says why if reached by URL.

## Counter side

`/owner/checkin`, new sidebar entry:

- **Camera scan** via **jsQR**, not the built-in `BarcodeDetector` — that API is Chromium-only, and a
  counter running an iPad would have had no scanner at all.
- **Manual code entry**, which always works: no camera permission, any device, and it covers "the
  customer's phone is dead".
- Result card + recent arrivals. One scan per code (the camera reads the same QR ~30×/second).
- New `booking.checkin` permission → manager, reception, cashier.

`POST /owner/checkin` always answers 200 with an `ok` flag; a refusal is information for the person at the
desk, not an error condition. Only an unknown code is 404.

**Every refusal names the reason and the fact behind it:**

| code | message |
| --- | --- |
| `too_early` | ยังไม่ถึงเวลา — เริ่ม 18:00 น. วันที่ 05/08/2026 |
| `expired` | เลยเวลาแล้ว — รอบนี้จบไปเมื่อ 09:00 น. … |
| `unpaid` | ยังไม่ได้ชำระเงิน — รับชำระที่เคาน์เตอร์ก่อน |
| `cancelled` | การจองนี้ถูกยกเลิกแล้ว |
| `already` | เช็คอินแล้วเมื่อ 08:44 |

`already` is a **success**, not a failure — scanning twice is normal at a busy counter, and the original
arrival time is never rewritten.

## The bug the e2e caught

**The app runs on `UTC`; a booking's `start` is the venue's wall clock.** The window check compared
`Carbon::parse("{$date} {$start}")` against `now()` directly — seven hours out in Thailand, so **every
afternoon arrival was refused as "ยังไม่ถึงเวลา"**. Found because the e2e built a booking from the test
runner's local (ICT) clock and the server said it was in the future.

Fixed by parsing against the venue's own `timezone` setting, with a regression test pinned to
`2026-08-02 15:30 Asia/Bangkok`.

Worth remembering: **any other comparison of a stored `date`+`start` against `now()` has the same bug.**
The overlap check in `BookingController::store` compares strings to strings so it is safe, but anything
new that reasons about "has this slot happened yet" must convert.

## Verified

backend **220/220** (14 new) · tsc clean · vitest **24/24** · lint **13 = baseline** · e2e **36/37**

The check-in e2e **decodes the rendered QR image with jsQR and asserts it equals the booking's token** —
the previous decorative version would have failed that assertion, which is the point of writing it that
way rather than checking an element exists.

Also covered: idempotent second scan; switching the venue setting off removes the QR from the customer app
and explains itself by URL; the customer can neither call the removed route (404) nor the counter's one
(403); a role without `booking.checkin` is refused while reception is allowed.

The 1 e2e failure is the long-standing `admin.spec.ts` "MRR" locator bug.

## The switch, after a follow-up

Asked "ปิด/เปิดยังไง" — checking, the toggle was on the **second tab** of ตั้งค่า ("หน้าลูกค้า"), which is
not where anyone looks for it. Added a switch to the **`/owner/checkin` header** as well: that is the
screen someone is looking at when they decide whether the venue scans. Both write the same setting.

Changing it needs `settings.manage`, so reception/cashier can scan but cannot switch the system off. The
button surfaces that as "เปลี่ยนไม่ได้ — ต้องมีสิทธิ์ ตั้งค่า" rather than failing silently.

Deliberate: **staff can still scan while it is off.** A venue that just switched it off may still have a
customer arriving with the QR already open — refusing them would be the wrong side to fail on.

**Trap:** the new switch reads "ระบบเช็คอิน: เปิด", which Playwright's substring matching also resolves for
`getByRole("button", { name: "เช็คอิน" })` — the form's submit button. The spec needs `exact: true`.

**Trap:** the counter test books a real slot for *right now*, so against the persistent dev database each
run permanently consumed one court at that hour — after six runs "every court is busy" and the test
fails. It cancels its own booking at the end now, same as `booking.spec.ts`.

## Still open

- Nothing committed. Migrations pending.
- New dependencies: **jsqr** (runtime, ~10KB, MIT) and **pngjs** + **@types/pngjs** (dev, for the decode
  assertion).
- `checked_in_at` is recorded but nothing reads it yet — no-show reporting is the obvious next use.
- Check-in still sets `status = 'completed'`, kept from the old behaviour so reports counting completed
  bookings do not change meaning underneath them. Arguably a booking is not "completed" until the slot
  ends; worth revisiting with whoever owns the reports.
