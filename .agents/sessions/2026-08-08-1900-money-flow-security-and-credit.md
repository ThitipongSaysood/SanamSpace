# 2026-08-08 19:00 — Payment-flow security, PDPA, counter gaps, CRM engine, deposits/coupons, and one credit balance

Long session, one thread running through it: **things that looked finished but were not**. A payment
method with no code behind it, a permission catalogue nothing read, a timeline only the seeder wrote,
a wallet money could enter and never leave.

## Goal

Started as "why does the app ask me to pay again after I uploaded a slip". Ended as a rebuild of the
customer money model. Every intermediate ask from the venue is listed below in the order it arrived.

## What was actually done

### 1. Payment flow — the reported bug, and a hole underneath it (`77efce7`, `dab2da4`, `31b7179`)

- **Reported**: pay → upload slip → app still says ไปชำระเงิน. Two faults: `pending_payment` covers
  both "nobody paid" and "slip is with the venue", and `POST /payments` opened a NEW payment row on
  every call — so the venue got two slips for one booking and the customer could genuinely pay twice.
  `Booking::latestPayment()` + `paymentStatus` on the resource; `store()` made idempotent.
- **Found while fixing it — a security hole.** `POST /payments/{id}/verify` and `/reject` sat on the
  **customer** route table, unscoped, carrying a `TODO: restrict to owner/staff role`. Reproduced:
  book a court, call verify with your own token → **booking confirmed, no slip, no money**. Also
  allowed deciding any other venue's payment by id. Both routes deleted. The suite had *encoded* the
  hole — two tests used it as a shortcut to "make this booking paid".
- **The slip queue never agreed with the booking.** Cancelling/deleting a booking left its slip in
  ตรวจสลิป, and approving it silently un-cancelled the booking. Verify/reject are now once-only and
  refuse a cancelled booking; cancel/delete close outstanding payments (new `cancelled` payment status).
- **Slip review moved into the booking panel** — it used to say "อนุมัติที่หน้าตรวจสลิป", which meant
  leaving the booking, finding the row again in another queue, and matching it by name and time.

### 2. MySQL — first time the suite has ever run against prod's database (`2ff870b`)

Dev is SQLite, prod is MySQL, CI runs **no tests at all**. Ran all 60 migrations + the seeder + the
full suite against local MySQL 9.6. Found a live production bug SQLite cannot see:
`reviews.sort_order` is `unsignedInteger` and `ReviewController` writes `min - 1` (= -1 for a
branch's first review) → **every customer review would 500 in production**. Column made signed.

### 3. PDPA — WP1's remaining half (`09b1f53`)

`GET /me/data` (portable JSON download) and `DELETE /me`. Erasure is **not** deletion of the books:
Thai accounting law requires the transactions, so the person is anonymised and the money stays.
`line_user_id` is cleared (otherwise the next LINE login resurrects the erased record),
`unsubscribed_at` survives, tokens are revoked.

### 4. Counter gaps (`29f1e71`)

POS sales history + void from the UI (the API existed and no screen called it) · equipment returns
with partial support (`returned_qty`), deliberately **not** an availability input · renting equipment
on a walk-in booking at the counter.

### 5. CRM WP3 / WP4 / WP5 (`9b5467e`)

Timeline written by observers from real events (it was seeder-only — the screen was showing
fixtures) · `broadcast_recipients` + `delivery_stats` so a send is auditable, with `skipped` and
`failed` kept apart · dynamic segments from the unused `criteria` column, plus RFM scored by rank
within the venue. **The first RFM scoring pass was wrong and the tests caught it**: count-below/total
put the *worst* customer at 3 in a two-customer venue and made 5 unreachable.

### 6. Deposits and discounts (`3ef4829`, `ae33600`)

Deposits: hold the court for part of the money. The ripple is that **"confirmed" stops meaning "paid
in full"** — everything that treated them as the same now keys on the money. Coupons + member rate,
replacing the `// TODO: member discount / coupons` that had been on the pricing line since the first
commit. They do not stack; the larger wins.

### 7. Dev DB reset + reseed (`17f0ad0`)

Wiped 818 load-test customers and a session of browser-test debris; `DemoBookingsSeeder` now seeds
the whole venue. Three bugs in the seeder, all found by running it: confirmed bookings left at
`paid_amount` 0 showed a false balance under deposits; the demo LINE customer was looked-up not
created (full DB, empty customer app); `wipe()` missed the catalogues so a second run duplicated
everything.

### 8. The reset killed every open session — and exposed a real bug (`5ada814`)

`migrate:fresh` dropped `personal_access_tokens`. The layouts only check a token **exists**, so a dead
token passed the guard and then failed every request, and every screen said "เกิดข้อผิดพลาด
ลองอีกครั้ง" — advice that can never work. **A 401 now clears the session and lands on login**, in all
three portals. Not my bug: any expired session in production did the same. Also: the wallet 404'd for
anyone who had never topped up, and returned 201 for a GET.

### 9. Booking shows its whole price (`5ada814`)

Credit and discounts were invisible — a package-paid booking showed a bare ฿0 and looked free.
`package_hours_used` is snapshotted, not derived from the slot length (which drifts on reschedule);
there is a test that reschedules and checks the receipt still says two hours.

### 10. Wallet → Credit (`a31c959`, `89e3740`)

The venue asked whether wallet and credit were the same. **The wallet was worse than a duplicate: a
dead end.** `wallet` was an accepted payment-method string with no deduction code anywhere, and the
payment screen never even offered it. Made it spendable (locked + re-read inside the transaction),
then — on the venue's decision — **collapsed the two balances into one: credit, in baht**.

- Cancelling a paid booking returns the money as credit immediately. Equipment money comes back to
  the same place; splitting it by what it paid for recreates the two-balance problem.
- **Audit trail** (venue asked): every movement carries the staff member behind it and a `source`.
  A row with no name is one the customer caused themselves.
- Existing hour packages are **not** deleted — they stay spendable and visible as "แพ็กเกจเดิม".

## State at end

🟢 backend **438/438** · tsc clean · vitest **24/24** · lint **13 = baseline** · e2e **38/38**
(e2e was 37/38 for several sessions — the long-standing `admin.spec.ts` "MRR" locator was ambiguous,
now `exact: true`.)

Three billing e2e specs broke after the DB reset and were fixed at the root: the seeded platform had
no company name, tax id, address or PromptPay details, so a fresh install issued receipts with nobody
issuing them and offered a QR it could not draw. VAT-enabling moved into the specs, since whether a
business is VAT-registered is its own decision and not a default to ship on.

🔴 **Deploy still blocked** — unchanged: `DEPLOY_PATH` does not exist on the server. Everything below
is pushed to `main` and none of it is in production.

## Next step

1. **Unblock the deploy.** ~26 migrations have never run on prod. They now apply cleanly to an empty
   MySQL database and the full suite passes against MySQL — that risk is measured, not guessed. Still
   **back up the prod DB first**: one earlier migration drops five columns from `organization_settings`.
2. **Put tests in CI.** `.github/workflows/deploy.yml` builds and deploys and runs nothing. Everything
   green is green because someone ran it locally. Run the suite against **MySQL**, not SQLite.
3. **Decide the package question.** Hour packages still sell in hours while credit is now baht. Left
   deliberately untouched: converting them changes the discount customers already paid for.
4. `composer audit`: 21 advisories (guzzle 9, psr7 2, commonmark 10).
