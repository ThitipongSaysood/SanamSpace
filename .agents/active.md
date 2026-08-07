# Active Task

_Last updated: 2026-08-07 · Last agent: Claude (Opus 5)_

## ✅ Done 2026-08-02 — "รายการจอง" as its own menu + demo data reset
- **New sidebar menu `/owner/bookings/list`.** First attempt put it as a 4th tab inside the calendar; the
  venue wanted it as its own menu, so it moved. The calendar keeps วัน/สัปดาห์/เดือน only.
- Search (รหัส / ชื่อลูกค้า / คอร์ท) · **date range** (server-side — a venue's whole history is not
  something to pull down and filter in the browser) · status tabs with counts taken **before** filtering ·
  add / edit / **delete**. Table on `md+`, cards below.
- **New `DELETE /owner/bookings/{id}`** (`permission:booking.cancel`). Soft delete, and **refused once an
  approved payment exists** — that row is a financial record and the way out of it is cancel-and-refund,
  not making it disappear. Delete is for a mistake at the counter; the confirm text says so.
- **`BookingDialog` extracted** to `app/owner/bookings/booking-dialog.tsx`, shared by both screens.
- **Fixed a nav bug this introduced:** `isActive` used `pathname.startsWith(href)`, so
  `/owner/bookings/list` lit up *both* "การจอง" and "รายการจอง". Now picks the most specific match, and the
  boundary check also stops `/owner/bookings` matching a future `/owner/bookings-archive`.
- **Demo data reset** (`DemoBookingsSeeder`): the 3,000-row load-test pile made every list unreadable.
  Now **10 bookings covering every status**, distinct Thai customer names so search is demonstrable, one
  slip in the ตรวจสลิป queue, one checked-in booking. Destructive — dev/demo only. DB backed up first.

## ✅ Done 2026-08-02 — Responsive pass, finished
- **Bookings gained a 4th view: "รายการ"** — every booking in the month, **every status**, with tab
  filters carrying live counts (ทั้งหมด / รอชำระเงิน / ยืนยันแล้ว / เสร็จสิ้น / ยกเลิก). The calendar
  answers "what is on court 3 at 18:00"; this answers "what happened this month", including the cancelled
  and unpaid rows a time grid has nowhere to draw. Counts are taken **before** filtering. No API change —
  `/owner/bookings` never filtered by status by default.
- **Responsive audit was measured, not guessed.** Visited every owner + admin route at 390px and checked
  `scrollWidth > clientWidth`: **zero pages overflow the document**, because tables already sit in
  `overflow-x-auto`. That metric turned out to be the wrong question — the real problem is that on a phone
  the **action column scrolls out of sight**, so you cannot approve a slip without dragging sideways on
  the one screen whose whole purpose is a two-tap decision.
- Fixed with the pattern the codebase already had in `admin/subscriptions`: `md:hidden` cards +
  `hidden md:block` table. Done so far: **owner/bookings (list view), owner/payments** — the two screens
  staff actually hold a phone for. `owner/staff`, `owner/wallet`, `owner/membership`, `owner/page`,
  `admin/subscriptions` already had it.
- **The remaining 13 use a `.stack-table` CSS pattern instead of hand-written cards.** Below `md` each row
  becomes label/value lines (header text supplied per cell as `data-label`) and the actions cell takes the
  full width. One definition in `globals.css` rather than thirteen duplicate mobile layouts — thirteen
  copies is thirteen chances for the two views to drift apart.
- Applied to `admin/{billing,features,logs,organizations,payments,refunds,support,transactions,users,page}`,
  `owner/{banner,billing}`, `owner/customers/[id]`. Any `min-w-[Npx]` on those tables became
  `md:min-w-[Npx]`, or it would have forced the old width straight back.
- **Verified by measurement, not by eye:** a script walks every owner + admin route at 390px and counts
  interactive elements inside tables whose bounding box falls outside the viewport. **0 offscreen controls,
  0 document overflow** across 22 routes.

## ✅ Done 2026-08-02 — Owner payments (ตรวจสลิป) is a table
- Cards → table. This is a **queue worked top to bottom**; full-size slip images stacked two-up meant
  scrolling past a photo of someone's banking app to reach the next row.
- The slip is still the point, so its thumbnail opens **full size** — that is what the money gets approved
  against. Cropping in the thumbnail is honest: it is a handle, not the document.
- `ImageLightbox` extracted to `components/` — the banner screen already had its own copy, and slip review
  needs exactly the same thing.
- Package purchases below became a table too, and **stopped reporting failures through `window.alert()`**
  — a modal that halts the whole screen for a message about one row. It is inline on the row now.
- The admin payments screen was already a table; unchanged.

## ✅ Done 2026-08-02 — QR check-in made real (customer + counter), and toggleable
- **What was there was theatre, and one part was wrong.** The "QR" was a decorative 8×8 grid of `<div>`s
  no reader could parse; the countdown was a hard-coded `00:15:32`; and the button let the **customer mark
  their own booking complete** — which is not a check-in. Kept and finished rather than removed, because a
  venue does want proof of arrival — but it is now **switchable per venue** (`checkin_enabled`, on by
  default): a small venue whose staff know every regular should not show a QR nobody scans.
- **Customer side**: a real scannable QR of a new `bookings.checkin_token` (32 chars, not the booking
  code — codes are short enough to guess and a guessed one would check in a stranger), a live countdown to
  the slot, and the checked-in state with the time. **No button** — the self-service routes are gone.
- **Counter side**: new `/owner/checkin` — camera scanner (**jsQR**, not `BarcodeDetector`, which is
  Chromium-only and would leave an iPad counter with no scanner) plus **manual code entry**, which is the
  path that always works. Live result card and a recent-arrivals list. New `booking.checkin` permission,
  granted to manager/reception/cashier.
- **Every refusal says something a staff member can repeat out loud** — "ยังไม่ถึงเวลา — เริ่ม 18:00 น.
  วันที่ 05/08/2026", "ยังไม่ได้ชำระเงิน", "การจองนี้ถูกยกเลิกแล้ว". A second scan reports the first one
  rather than erroring: scanning twice is normal at a busy counter.
- **Timezone bug found and fixed by the e2e**: the app runs on **UTC** while booking times are the venue's
  **wall clock**. The window check compared them directly, so every Thai afternoon arrival was refused as
  "too early". Now converted via the venue's own `timezone` setting, with a test pinned to a real
  afternoon.
- Verified: backend **220/220** (14 new) · tsc clean · vitest 24/24 · lint 13 = baseline · e2e checkin 4/4,
  including **decoding the rendered QR with jsQR and asserting it equals the token** — the old one would
  have failed that.

## ✅ Done 2026-08-02 — The four reported portal gaps, closed
- **Admin can create / suspend a platform user.** New `users.status`; the list's "สถานะ" column was a
  hard-coded "active" for everyone. Suspend **also deletes their Sanctum tokens** — otherwise the session
  they are already holding keeps working. Guards: cannot suspend yourself, cannot suspend the last active
  admin. Suspend rather than delete, so an account keeps its name on the payments it approved.
- **Admin can edit a role's permissions — and permissions now mean something.** Discovered while building
  it: `role_permissions` was read by **nothing**. A "Viewer" could verify payments and delete courts
  exactly like an Owner. Shipping an editor for a field nobody reads would have been theatre, so:
  new `permission:` middleware on **30 owner write routes**, a 12-entry catalogue, and sensible defaults
  per system role. `owner` and `super_admin` bypass by design (a venue must not be able to lock itself out
  of its own portal), and the UI says so instead of offering a dead editor.
  Definitions live in `app/Support/RolePermissions.php` — **one list, used by both the migration and the
  seeder**, because two copies is how the environments end up disagreeing about what a Cashier may do.
- **Owner customer detail** at `/owner/customers/[id]`: standing, wallet, membership, and the 20 most
  recent bookings. The list rows were a dead end before. Cross-venue ids 404 rather than 403.
- **Cancel / suspend a subscription directly.** Two different decisions, so two actions: **ยกเลิก** stops
  the renewal and lets the paid period run out; **ระงับทันที** pulls `ends_at` to now, which is what
  actually locks the portal — `EnsureSubscriptionActive` reads the date, not the status, so flipping the
  status alone would have changed nothing. **Resume gives an expired plan a future date**, or the action
  meant to let a venue back in would leave them locked out. Customers keep booking throughout.
- Verified: backend **206/206** (25 new across 4 test classes) · tsc clean · vitest 24/24 · lint 13 = baseline.

## ✅ Done 2026-08-02 — Welcome banners: a list, on/off, popup, shown uncropped
- **`welcome_banners` table replaces the single `organization_settings.welcome_*` slot.** A venue running a
  holiday notice AND a promotion had to pick one, or retype the same field every season. Each banner now has
  `is_active` (park it, don't delete it), `popup`, and `sort_order`. The migration **carries the existing
  banner over and then drops the old columns** — two places to read the same thing is how they drift apart.
- **New menu:** `/owner/banner` ("แบนเนอร์/ต้อนรับ") — a **table**: ลำดับ (↑↓) · thumbnail · หัวข้อ ·
  popup · เปิด-ปิด · แก้ไข/ลบ. Stacked full-height forms meant scrolling past a whole poster to reach the
  next banner. The editor is a dialog; the thumbnail opens a **full-size lightbox** (Escape closes it —
  clicking the image must not, that is the thing being looked at). Owner settings keeps a pointer to it.
- **Popup:** per banner, off by default. Several flagged banners become **one dialog paged through**
  ("ถัดไป" + dots), never a stack of dialogs. Dismissal is keyed to the *set* of banners shown, so leaving
  them alone never nags and changing one reaches everyone.
- **Images are no longer cropped.** `aspect-[16/7] object-cover` sliced ~66% off the demo poster — measured:
  the file is **1751×2250** (portrait), so a 16:7 strip cut both the promo ribbon and the expiry date. Cards
  now render `h-auto w-full` (rendered ratio == natural ratio, verified in-browser), the popup uses
  `object-contain` with a viewport cap, and the owner editor scales down without letterboxing.
- **Gotcha:** `TenantBranding` is cached in localStorage. A customer carrying an older build's copy has no
  `welcomeBanners`, which would throw on `.map` before the refetch lands — the restore now merges onto
  `DEFAULT`.
- **Fixed a pre-existing time bomb** found on the way: `venue-isolation.spec.ts` asserted on a venue name
  that only appeared inside the *upcoming-booking card*, so it passed at 12:30 and failed at 13:45 when the
  seeded 10:00–13:00 booking ended. Now reads both names from the API and anchors on the header wordmark.
- Verified: backend **181/181** (7 new in `OwnerWelcomeBannerApiTest`, incl. cross-tenant 404s and reorder
  ignoring foreign ids) · tsc clean · vitest 24/24 · lint 13 = baseline · e2e **28/29** (the 1 is the
  pre-existing `admin.spec.ts` "MRR" bug).

## ✅ Done 2026-08-02 — Venue-authored welcome message + real promo banner
- **Welcome message** (`organization_settings.welcome_title` / `welcome_message`): the venue writes it in
  its own settings and it appears on the customer home. Blank hides the card rather than leaving an empty
  box — asserted both ways in `OwnerSectionsApiTest` and `e2e/branding.spec.ts`.
- **The promo banner was fake.** Every venue's home showed a hard-coded "โปรโมชั่นลด 10% / จองวันนี้รับ
  ส่วนลดทันที" whether or not it ran one. It now renders the venue's **own first `promotions` row** (title,
  subtitle, tag) — data the owner already manages at `/owner/promotions`, so no new schema — and is simply
  absent when there are none.
- The owner settings preview shows the greeting too, so the whole home surface is previewable before save.

## ✅ Done 2026-08-02 — Branding actually reaches customers + customer UI pass
- **Dead controls made live.** A venue could pick สีรอง/สีเน้น/ฟอนต์ in its own settings and **nothing
  downstream read them** — `/orgs/{slug}/public` only ever sent `primary`. All of them now travel, with
  `--brand-secondary` / `--brand-accent` tokens (`bg-brand-secondary`, `bg-brand-accent`) and the font
  applied to `--font-sans`. Hard-coded `to-emerald-700` / `bg-amber-400` on the customer app's brand
  surfaces were replaced so a venue's own colours show up there.
- **Edits now reach customers already signed in.** Branding used to refresh only on the `/v/{slug}`
  login page, so a logo or colour change never reached an existing session. `TenantProvider` re-reads
  `getOrgPublic(slug)` on every customer visit; localStorage keeps the old look visible meanwhile so
  there is no flash of default.
- **Live preview** in owner settings showing exactly what the customer app will render.
- **Customer UI pass against `/ref`** (a Thai court-booking app): the home screen gained a brand-coloured
  greeting card (name + membership tier + points), an **"การจองที่กำลังจะถึง"** section — the thing a
  returning customer opens the app for — and a notification bell with an unread dot. The slot picker now
  shows each slot's **end time and price**, and its legend was **wrong** (it described ว่าง/ใกล้เต็ม/เต็ม
  while the grid only renders ว่าง/เลือกแล้ว/ไม่ว่าง) — now it matches what is on screen.
- **Gotcha:** editing `@theme` in `globals.css` needs `rm -rf .next`; the running dev server kept a stale
  Tailwind build and `to-brand-secondary` silently resolved to *transparent*, fading both brand cards out
  to white. Caught by reading the computed `background-image`, not by looking at the page.
- Verified: backend **174/174** · tsc clean · vitest **24/24** · lint 13 (= baseline) · e2e **22/23**
  (the 1 is the pre-existing `admin.spec.ts` "MRR" bug). New `e2e/branding.spec.ts` proves a colour
  change reaches a signed-in customer and never leaks into owner/admin.

## Current Task
Session 2026-08-02 is closed. Everything below is done and verified **locally only** — nothing has been
deployed. The work spans three areas: venue-authored content (welcome banners), the four portal gaps
reported in the last audit, and QR check-in rebuilt as a real feature — plus a bookings list screen and
the start of a responsive pass.

## Status
🔴 **Merged to `main` (9c3ef49) — deploy FAILED, production still on the old code.**

`Deploy to Production #63` died at the *rsync frontend* step: `DEPLOY_PATH` does not exist on the server.
Infrastructure, not code — any push would have failed the same way. **No migrations ran, no files were
overwritten**, so production is untouched and working. See
`sessions/2026-08-07-merge-to-main-deploy-blocked.md` for how to unblock it.

Verified locally:

backend **223/223** · tsc clean · vitest **24/24** · lint **13 errors / 24 warnings** (2 fewer warnings
than the session baseline; no new errors) · playwright **37/38**.

The 1 e2e failure is the long-standing `admin.spec.ts` "MRR" locator bug, confirmed pre-existing in an
earlier session by re-running it against stashed code.

⚠️ **The 14 migrations are still pending on production** — the failed deploy never reached them. One
**drops five columns** from `organization_settings`. They have only ever been run against SQLite; prod is
MySQL, which has a 65,535-byte row limit that SQLite does not. **Back up the production database and
verify the migrations against a copy before re-running the deploy.**

Full detail per feature:
- `sessions/2026-08-02-welcome-banners.md`
- `sessions/2026-08-02-portal-gaps.md`
- `sessions/2026-08-02-qr-checkin.md`
- `sessions/2026-08-02-day-closeout.md` ← starts here

## What's Done
1. **Welcome banners** — `organization_settings.welcome_*` became a `welcome_banners` table: many per
   venue, each switchable on/off, orderable, optionally an entry popup (swipeable when several).
   Images render at the file's own proportions instead of being cropped to a 16:7 strip.
2. **The four reported portal gaps** — admin creates/suspends platform users · admin edits role
   permissions, **and those permissions are now actually enforced** (they were read by nothing) · owner
   customer-detail page · cancel/suspend/resume a subscription.
3. **QR check-in, rebuilt** — the old one was a decorative grid of `<div>`s, a hard-coded countdown, and
   a button letting the customer complete their own booking. Now a real scannable QR of a per-booking
   token, a counter-side scanner (jsQR + manual code entry), and a per-venue on/off switch.
4. **Bookings list** — its own sidebar menu with search, date range, status tabs, add/edit/delete, plus a
   new `DELETE /owner/bookings/{id}` that refuses once money has been taken.
5. **Payments screen → table** with a slip lightbox; `ImageLightbox` extracted for reuse.
6. **Demo data reset** — the 3,000-row load-test pile became 10 readable bookings covering every status.

## Blockers
None locally. The only thing standing between here and production is the review + merge decision below.

## Next Steps
1. **Unblock the deploy** — create `DEPLOY_PATH` on the server (or fix the secret), then re-run #63.
   Detail: `sessions/2026-08-07-merge-to-main-deploy-blocked.md`.
2. **Back up the production database first, and understand the destructive migration.**
   `2026_08_03_000000_create_welcome_banners_table` copies the existing single welcome banner into the new
   table and then **drops** `welcome_title / welcome_message / welcome_image_url / welcome_link /
   welcome_popup`. It is written to carry data over first, and `down()` folds it back — but take a
   database backup before the first production run regardless.
3. **Three earlier `2026_08_02_*` welcome migrations are still uncommitted-to-prod and now redundant** —
   they add columns that the fourth immediately drops. Harmless (223 tests prove a from-scratch run), but
   they could be collapsed into one before shipping.
4. **Finish the responsive pass** — 12 table pages still have no mobile layout: `owner/banner`,
   `owner/billing`, `owner/customers/[id]`, and 9 admin pages. Admin is a desktop tool so its horizontal
   scroll is defensible; the three owner ones are not.
5. **The real risks found in the audit are still untouched** — see `Known risks` below. The double-booking
   race and the slot held forever by an unpaid booking are the two that cost a venue money.
6. **Pre-existing**: `composer audit` flags 9 advisories in `guzzlehttp/guzzle` 7.11.1 + `psr7`.

## Known risks found by audit, NOT yet fixed
Ranked by what they cost a real venue. None of these were introduced this session; all were found while
auditing it.

1. **Double-booking race.** `BookingController::store` reads then writes with no transaction, no lock and
   no unique index. Two people tapping the same slot both pass the overlap check.
2. **An unpaid booking holds a court forever.** The overlap check counts every status except `cancelled`,
   and nothing ever releases a `pending_payment` row.
3. **Nothing ever creates a Notification.** `Notification::create` appears nowhere; the customer's bell
   reads a table only the seeder fills. Slip approved, slip rejected, booking cancelled — the customer is
   told nothing.
4. **LINE messaging is stored and never used.** Every venue has an encrypted `line_messaging_token` that
   no code path reads.
5. **No scheduler at all.** `routes/console.php` has only Laravel's `inspire`. No expiry warning before a
   venue is locked out, no booking reminder, no cleanup of (2).
6. **No rate limit on `/auth/admin/login`.** Unlimited password guesses against owner and super-admin
   accounts.
7. **Wallet top-ups are not transactional** (`increment()` alone), unlike `RefundService`.
8. **`MAIL_MAILER=log`** — "ส่งใบแจ้งหนี้" writes to a file. `QUEUE_CONNECTION=database` with no worker, so
   mail sends inside the request.

## Gotchas worth knowing before you touch this
- **Laravel caches the resolved guard user between HTTP calls inside one test** — a second `withToken()`
  stays authenticated as the FIRST user. Use the `as()` helper (`$this->app['auth']->forgetGuards()`).
- **e2e run with `--workers=1`**; parallel runs lose to the dev server's cold compile. Billing/booking
  specs clean up after themselves because they write to the real dev DB.
- **dompdf needs the bundled Sarabun font** (`resources/fonts`, installed to `storage/fonts` on boot) —
  without it Thai silently renders as boxes. Google Fonts' CSS API serves a Latin-only subset; use the
  `google/fonts` GitHub copy.
- **`rm -rf frontend/.next`** if you hit `Could not find the module ... in the React Client Manifest`.

---

## Shared changes (read if you touch auth / api layer)
- **API contract**: `POST /auth/line/login` now accepts `idToken`; when `LINE_CHANNEL_ID` is configured
  it REQUIRES a verified `idToken` and ignores raw `lineUserId` (was: trusted lineUserId always).
- **config/services.php**: new `line` block (channel_id/secret/messaging_token/verify_url).
- **frontend api layer (co-owned)**: `api.me()` added to mock + http; `idToken` added to `LinePayload`
  (in `lib/api/mock.ts`). `lib/types.ts` was NOT changed.
- **Refund — ✅ DONE & wired** (was parked scaffold): `refunds` table + `Refund` model now live; see the
  Refund section below.
- **Refund — Owner zone DONE (2026-06-15)**: `Owner/RefundController` (index/approve/reject) wired to the
  pre-registered `/owner/refunds*` routes; all money logic via shared `App\Services\RefundService` (never
  re-implements wallet credit). `index` returns `{data:[OwnerRefund]}` (requested-first, then newest);
  `approve` validates `method∈{wallet,manual}` (default wallet) + nullable `note`; `reject` nullable `note`.
  Approve(wallet) credits the customer wallet + logs a WalletTransaction + sets booking `status='cancelled'`;
  approve(manual) records only (no wallet). Org-scoped (cross-org=404), re-process guarded (422). Frontend:
  `ownerApi.getRefunds/approveRefund(id,method,note?)/rejectRefund(id,note?)`, new `app/owner/refunds/page.tsx`,
  nav entry "คืนเงิน". Tests: `OwnerRefundTest` 6/6. Did NOT touch any shared file. App may surface
  `bookingCode`/refund status on booking detail; Admin's cross-org refund controller still to be built.

### Per-venue LINE config (✅ DONE — 3-agent build, 2026-06-15)
**Integrated green: backend 101/101 · tsc clean · vitest 23/23.** Built by 3 parallel agents
(App/Owner/Admin) on an orchestrator-laid foundation (DB+model+routes+types). No agent touched
shared files; integrated on first try. Owner sets per-venue LINE; Admin can override per-org.
- **DB**: `organization_settings` + `line_channel_id`, `line_channel_secret`(enc), `line_liff_id`,
  `line_messaging_token`(enc). `OrganizationSetting` casts the two secrets `encrypted`.
- **Routes (pre-registered)**: `GET /line-config` → `AuthController@lineConfig` (App);
  `PUT /admin/organizations/{id}/settings` → `AdminOrganizationController@updateSettings` (Admin).
- **types.ts (done)**: `OwnerSettings` + `AdminOrganizationDetail.settings` got `lineChannelId`,
  `lineLiffId`, `lineChannelSecretSet`, `lineMessagingTokenSet`; new `LineConfig = { liffId }`.
- **Masking rule**: secrets are WRITE-ONLY — never return `line_channel_secret`/`line_messaging_token`;
  expose only `*Set: boolean`. channelId + liffId may be returned.
- **Resolution**: `LineTokenVerifier` reads the org's settings first, falls back to `services.line.*` (.env).
  `lineLogin` resolves the org BEFORE verifying.
- **Zone split**: App = verifier+lineLogin+lineConfig+frontend auth. Owner = /owner/settings CRUD + UI.
  Admin = updateSettings override + org-detail UI.
- ✅ **Admin zone DONE (2026-06-15)**: `AdminOrganizationController@updateSettings` (write-only secrets, blank≠wipe);
  `AdminOrganizationDetailResource` exposes `lineChannelId`/`lineLiffId` + `*Set` flags only; new
  `superAdminApi.updateOrganizationSettings(id,patch)`; org drawer got a "LINE" tab (password fields,
  "ตั้งค่าแล้ว" hints). New `tests/Feature/AdminLineSettingsTest.php` 3/3 green (Admin tests 15/15).
- ✅ **App zone DONE (2026-06-15)**: `LineTokenVerifier` now per-org (`isConfigured`/`verify` take
  `?OrganizationSetting`, org channel first → .env fallback); `AuthController@lineLogin` resolves org
  BEFORE verify + loads `settings` (relation || `firstOrCreate`); added `AuthController@lineConfig`
  (`GET /line-config?organizationSlug=` → `{liffId}`, public, secrets never returned). Frontend:
  `api.getLineConfig()` (mock `{liffId:null}` + http `GET /line-config`), `getLineIdToken(liffId?)`,
  `auth-context.login()` resolves per-venue LIFF id in real mode (`NEXT_PUBLIC_LIFF_ID || config.liffId`),
  demo stub in mock mode. `tests/Feature/AuthLineLoginTest.php` 7/7 (added per-org-channel + line-config).
- ✅ **Owner zone DONE (2026-06-15)**: `Owner/SettingController@update` validates + saves
  `lineChannelId`/`lineLiffId` (columnMap) and `lineChannelSecret`/`lineMessagingToken` (separate
  `filled()`-guarded `$secretMap` — blank never wipes); `OwnerSettingResource` exposes ids + `*Set`
  flags only. Frontend: owner settings "การเชื่อมต่อ" tab got a LINE form (password secret fields,
  "ตั้งค่าแล้ว" hints, write-only); `ownerApi.updateSettings` signature widened. New
  `tests/Feature/OwnerLineSettingsTest.php` 4/4 (round-trip, encrypted-at-rest, blank-preserves, 401).
- **Open follow-ups**: (a) `lineConfig` resolves by `?organizationSlug`/default only — `venueId`
  resolution not wired (would need to extend shared `resolveOrganization`). (b) `messaging_token`
  is stored/managed but not yet USED (no push-messaging feature yet). (c) Frontend LINE UIs are
  compile-verified (tsc) but have no component tests / not visually run.

### Refund flow (✅ DONE — 3-agent build, 2026-06-15)
**Integrated green: backend 119/119 · tsc clean · vitest 23/23.** Foundation by orchestrator
(refunds table+model, `Booking`/`Payment` `refunds()`, **shared `App\Services\RefundService`** for the
money logic, 7 routes, types). Flow: customer requests → Owner/Admin approve (wallet credit) or reject.
- **RefundService** (shared, money-critical): `approve(refund, method=wallet|manual, note, processedBy)`
  — DB transaction, guards `status===requested` (no double-process/double-credit), wallet method credits
  the customer wallet (+WalletTransaction) and sets booking `cancelled`, manual records only; `reject(...)`.
- **App**: `RefundController@store` (eligibility: approved payment OR amount>0 & confirmed/completed; no
  duplicate open refund) + `@index`; `RefundResource`; booking-detail "ขอคืนเงิน" button + status badge;
  `api.requestRefund/getRefunds` (mock+http). `RefundRequestTest` 5/5.
- **Owner**: `Owner/RefundController` index/approve/reject (org-scoped, via RefundService); `app/owner/refunds`
  page + "คืนเงิน" nav; `ownerApi.getRefunds/approveRefund/rejectRefund`. `OwnerRefundTest` 6/6.
- **Admin**: `Admin/RefundController` index(all orgs)/approve/reject override (via RefundService);
  `app/admin/refunds` page + "การคืนเงิน" nav; `superAdminApi.*`. `AdminRefundTest` 7/7.
- **Open follow-ups**: full-amount refund only (schema supports partial via `amount`); approve sets booking
  `cancelled` even if completed; frontend refund UIs compile-verified (tsc) but not visually run / no
  component tests; live money E2E covered by feature tests (not curl-driven on the running server yet).

## Run (real)
backend: cd backend && php artisan serve  (:8000)
frontend: cd frontend && npm run dev
  ลูกค้า: /v/{slug} เท่านั้น — /v/everyday-badminton · /v/tsr-arena  (`/` เด้งไป /landing)
  owner: /owner (owner@everyday.test/password) · admin: /admin (super@sanamspace.test/password) · /landing
verify: cd backend && php artisan test  ·  cd frontend && npx tsc --noEmit && npx vitest run
e2e:    cd frontend && E2E_OWNER=1 ./node_modules/.bin/playwright test --workers=1
        (--workers=1 สำคัญ: รันขนานแล้ว owner/admin แพ้ cold-compile ของ dev server)
