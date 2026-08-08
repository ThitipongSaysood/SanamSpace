# 2026-08-08 17:00 — Equipment rental, from the booking screen

_Agent: Claude (Opus 5)_

## Goal
"เพิ่มมีระบบเช่า อุปกรณ์ ด้วย โดยที่ลูกค้าสามารถเช่าได้ตั้งแต่หน้าจองเลย รายละเอียดแจ้งลูกค้าเป็นรายการ
ต่างๆ แล้วจำนวนเงินที่ลูกค้าต้องโอน แล้วมีการจัดการอุปกรณ์ที่หน้าหลังบ้านด้วย"

Three parts: rent while booking · an itemised total to transfer · back-office management.

## The distinction the whole feature rests on

Rental is **not** POS. A sold bottle is gone; a rented racket comes back. So `stock_qty` is *how many the
venue owns*, and "how many are free" is a question about a **time window**:

> free = owned − Σ(quantity on overlapping, non-cancelled bookings)

Four rackets can be rented all day, just not to two overlapping bookings at once. The overlap rule is the
same one the court check uses (`existing.start < new.end AND existing.end > new.start`), deliberately, so
the two cannot drift apart. A stored "remaining" counter would have been wrong the moment a booking ended.

## Money

`bookings.amount` becomes the **grand total** (court + rentals), so every existing payment, refund and
revenue path keeps working without knowing rentals exist. The court portion moved to `court_amount`,
**backfilled from the current amount** — without it the breakdown could not be reconstructed for old rows.

`booking_rentals` snapshots `name`, `unit_price` and `price_unit`, like `product_sale_items` does. A later
reprice must not change what a customer was quoted and paid. Tested.

Two pricing units, because both are real: `per_session` (a racket, one flat charge) and `per_hour` (a ball
machine, × the booking's hours).

## Ordering that matters

Rentals are priced and checked **before** the booking row is created, inside the same transaction and the
same per-court lock as the double-booking guard. A basket the venue cannot equip therefore takes no court
slot either — tested by asserting zero bookings exist after a failed rental.

Duplicate lines are merged before the check: two picks of the same racket is one line of two, and checking
them separately would let each pass a check the pair fails.

## Screens
- **Customer, `/booking/new`**: a 4th step appears *only once a slot is picked* — "3 rackets left" is
  meaningless without saying left *when*. Changing the slot clears the picks, because what was free at
  18:00 may not be at 20:00. Sticky summary is itemised: court · each item · **ยอดที่ต้องโอน**.
- The same breakdown repeats on the **payment** screen (where they are about to transfer) and the
  **booking detail** (where they check later).
- **Owner, `/owner/rentals`**: catalogue with price unit and how many are owned, plus "กำลังถูกยืมวันนี้"
  listing what is out and with whom — the question actually asked at the counter.

`rental.manage` is a new permission; counter staff (`pos.sell`) can see what is out but changing what the
venue owns is not counter work.

## State at end
🟢 backend **292/292** (+15) · tsc clean · vitest 24/24 · lint **13 errors** (= baseline; warnings 24→27,
all three the same unused-mock-param pattern `lib/api/mock.ts` already has 11 of) · e2e 37/38.

Verified by booking through the real UI: picked a slot, added 2 rackets, summary read
`Court 1 ฿250 · ไม้แบดมินตัน × 2 ฿100 · ยอดที่ต้องโอน ฿350`, the payment screen asked ฿350, and the owner's
"กำลังถูกยืม" panel showed the 2 rackets against booking `BK260808HYHTBD`.

Demo data: 3 items (ไม้แบด ฿50/ครั้ง ×8, รองเท้า ฿40/ครั้ง ×6, เครื่องยิงลูก ฿200/ชม. ×1).

## Next step
- Not built, deliberately: deposits as a tracked amount (the note field carries it as text today),
  returning/checking equipment back in, adding a rental to a booking *after* it was made, and rentals on
  owner-created (walk-in) bookings — the owner booking dialog does not offer them yet.
