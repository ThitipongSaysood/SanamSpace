# Session 2026-08-11 ~16:40 — promotions↔coupons, slip auto-verification (Slip2Go), payment countdown + hold expiry

Baseline at close: backend **648/648** · tsc clean · vitest **31/31** · lint **0 errors**.
11 commits, `095a500` → `f034022`. Committed to `main` locally; **push at close**.

## What was done

### Promotions linked to coupons + on/off toggle (option B)
A promo can carry a coupon so tapping it auto-applies the discount at booking, and promos can be turned off.
- Backend: `Promotion.coupon()` belongsTo + `is_active` cast; owner `PromotionController` store/update accept
  `couponId` (Rule::exists scoped to org) + `isActive`; customer `PromotionController` filters `is_active` and
  loads the coupon. Resources expose `couponId`/`couponCode`/`isActive`. Migrations
  `add_coupon_to_promotions`, `add_active_to_promotions`. Tests: `PromotionCouponTest` (4).
- Frontend: home shows **all** active promos (capped 3 + "ดูทั้งหมด"); each card links coupon→
  `/booking/new?coupon=CODE` else `/promotions`. `booking/new` `CouponField` auto-applies `initialCode` once
  amount>0 (guarded by an `autoTried` ref). "กดใช้ไม่ได้" root cause was a stale React Query cache, not the API.
- Also this session (carried in `095a500`): settings **หน้าลูกค้า** redesign (color-well pickers, unified
  section headers, full home preview), checkbox→**Switch** UI (`components/ui/switch.tsx`), and `/owner/checkin`
  "เช็คอินล่าสุด" dynamic rows-per-page (ResizeObserver fills the card, only overflow paginates).

### README rewrite (`c8f3a00`)
Rewrote the top-level README to reflect the real monorepo (Laravel 13 + Next.js 16, three portals, getting
started, tests, structure).

### Slip auto-verification — Phase 0 (dedupe) + Phase 1 (provider) + Slip2Go driver + platform control
The big piece. A customer's transfer slip can now be screened for reuse and auto-approved by a provider, with
the whole thing gated so it only runs where it's paid for and turned on.
- **Phase 0 — dedupe (`04fa26d`).** `SlipVerificationService::screen()` flags a slip as `duplicate` when the
  same file (`sha256`) or transaction ref (`trans_ref`, sha1 of the QR payload) was already submitted on another
  payment in the venue. Migration adds verification columns to `payment_slips`. Flagged, not hard-blocked — the
  owner decides. Runs on **every** plan/mode (no external call). Tests: `SlipDedupeTest` (5).
- **Phase 1 — provider seam (`04fa26d`, `d694971`).** `SlipVerifier` interface + `NullSlipVerifier` default +
  `SlipVerification` DTO. `process()` orchestrates: screen → owner toggle `slip_verify_mode==='auto'` → verify →
  `passes()` (real · amount covers · receiver matches the venue's promptpay/bank trailing-4) → auto-approve
  through the **same** `DepositService::applyPayment` as a manual approval (points/receipt once). Provider
  failure logs + falls back to manual, never blocks. Idempotent (guards `pending_review`). Client reads the slip
  QR (`BarcodeDetector` in `http.ts`, `readSlipQr`, never throws) and sends `qrPayload`. Owner payments UI shows
  the read amount/sender + a "used before" badge. Plan feature `slip_auto_verify` (Business/Pro) + monthly cap
  (`MONTHLY_AUTO_LIMIT` 1000). Owner toggle is its **own** gated route (`feature:slip_auto_verify`), not the
  general settings save. Tests: `SlipAutoVerifyTest` (7).
- **Slip2Go driver (`878bef5`).** `Slip2GoVerifier` — `POST {payload:{qrCode}}` + `Authorization: Bearer`,
  maps `code "2000…"` + `data.{amount,transRef,dateTime,sender,receiver}` into `SlipVerification`; falls to
  manual on any non-2xxxxx / HTTP error / missing QR. Endpoint defaults to Slip2Go's URL (only DRIVER+KEY
  required). Confirmed API shape from slip2go.com/guide (**use REST API, not Queue API** which is async).
  `SlipOkVerifier` kept as an alternative. Tests: `Slip2GoVerifierTest` (4), `SlipOkVerifierTest` (3).
- **Platform-level control (`2fc8543`).** Owners rent the system, so the paid Slip2Go account is the operator's,
  not each venue's. `platform_settings` gains `slip_verify_enabled` (master switch), `slip_verify_driver`,
  `slip_verify_endpoint`, `slip_verify_key` (encrypted, write-only like SMTP). Admin settings UI (Payment tab)
  edits the connection + global on/off. The `SlipVerifier` binding reads the platform connection, `rescue()`-ing
  to env config for local/CI. `process()` now gates: **owner toggle → admin master switch → plan feature →
  monthly cap**. Three clean levels: admin owns connection + kill switch, admin grants entitlement per plan,
  owner flips their own venue. **Receiver bank account is set per-venue in OUR settings, NOT in Slip2Go** — the
  provider only reads the slip; we match its receiver against the venue's account.

### Toast "saving…" hang fixed (`266fdce`)
The endpoints answer in ~15ms, so a save resolved before sonner mounted the loading toast — the `.then()`
dismiss raced the mount, was lost, and the `duration:Infinity` loading card hung next to the success one.
`toastSave` now uses a **delayed spinner**: arm the loading toast after 400ms, cancel it if the promise settles
first. Fast saves show only the result; slow ones show a spinner that's mounted by the time it's dismissed.
Explicit id + finite 20s duration as backstops. Covers all 6 `toastSave` callers.

### Customer app: pay-by countdown + "รอชำระเงิน" alert + real 5-min hold expiry
An unpaid booking holds its slot; the app now pushes the customer to pay before it lapses and clears it when it
does.
- Hold window **5 min** (was 30, still env-overridable), swept **every minute** (was every 5). `BookingResource`
  exposes `expiresAt` (created_at + hold) while the hold is live. `useCountdown` hook.
- Sticky `PendingPaymentBanner` across the app counts down + links to payment; clears + refetches at zero.
  Payment screen shows the same countdown and switches to a "หมดเวลาชำระเงิน" screen once it lapses. "จองสนามนี้
  ใหม่" returns to `/booking/new?venueId=…` (per-venue app — not the cross-venue `/search`).
- **Lazy expiry (`f034022`).** The cron doesn't run in dev, so overdue holds lingered as "รอชำระเงิน". Extracted
  the sweep into `BookingExpiryService`, shared by the command **and** the customer bookings index — opening the
  list cancels that customer's overdue holds and frees the slot right then (falls into ยกเลิก). A slip already
  sent (`pending_review`) is still never expired. Tests: `ExpireUnpaidBookingsTest` (+ lazy end-to-end).

### Docs (`99c8d30`)
`docs/slip-verification-flow.md` (flow + Mermaid flowchart), `docs/slip2go-setup.md` (step-by-step admin setup,
what value goes where, testing, troubleshooting), `docs/pricing.md` (whole-system cost estimate + per-plan
pricing: server/domain ~฿3,500/mo fixed + ~฿0.40/slip Slip2Go; LINE borne by each venue's own OA).

## Key decisions / gotchas
- **Slip2Go = one platform account (admin), not per-venue.** Venues only get an on/off toggle. Receiver bank
  account is configured per-venue in our settings; the provider just decodes the slip.
- **`slip_auto_verify` on Business + Pro**, not Pro-only — it's operational (Business theme), and the monthly cap
  + Business paying more than Starter covers the per-check cost. Pro-only is a one-line change if wanted.
- Every catalogue feature must be enforced by a `feature:{code}` route (`PlanFeatureTest` invariant) — that's
  why the owner slip-mode toggle became its own gated route.
- Toast hang was a **fast-endpoint race**, not backend latency (verified: both settings endpoints ~12ms).

## Paused (explicitly, by the user) — not started
- **Payment gateway / real-time methods** (card removed; PromptPay QR only). If resumed: same driver seam as
  `SlipVerifier`; **GB Prime Pay** cheapest for PromptPay-only, or stay on QR+Slip2Go (free-ish, needs slip
  upload). Mobile-banking app-switch comes with any gateway via a `source.type`. Start at Phase 0 (seam). Money
  flow: each venue BYO gateway keys (like LINE OA) so the platform never holds funds / needs no e-money license.

## Follow-ups / watch
- **5 min is tight for bank-transfer + slip** (fine for QR scan). Bump `BOOKING_HOLD_MINUTES` if venues complain.
- Real sweep needs `schedule:run` on cron in prod; dev relies on the lazy on-read sweep.
- Slip2Go field mapping is from docs, **not yet verified against a real response** — send one test slip and
  check `payment_slips.verify_payload`; adjust `Slip2GoVerifier` paths if keys differ.
- CI runs **no** tests → run migrate+test on MySQL before release (dev is SQLite).
