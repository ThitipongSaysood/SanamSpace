# Active Task

_Last updated: 2026-08-10 (~16:00) · Last agent: Claude (Opus 4.8, 1M ctx)_

## ✅ Done 2026-08-10 (~16:00) — LINE reply builder, app toasts, sport loader, points-gating, week lanes
**Committed + pushed** (ends the deploy/commit hold). backend **623/623** · tsc clean · vitest **31/31** ·
lint **0 errors**. Full detail: `sessions/2026-08-10-1600-line-reply-builder-toast-loader.md`.
- **LINE reply builder (3 phases).** Venues design the Flex card LINE sends on booking/payment/cancel, and it
  actually sends now (was broadcast-only). `line_message_templates` + `LineFlexRenderer` +
  `DefaultLineTemplates` + `BookingLineVars` + `LineMessagingService::pushFlex`, wired into
  `NotificationService` and the credit-pay path. Owner API `Owner/LineTemplateController` (get/save/test).
  Frontend drag-drop block builder at `/owner/line-templates` with a live phone preview + placeholder palette.
- **App-wide toasts.** `sonner` was never mounted — now top-right in `providers.tsx`, every `toast.*`/
  `toastSave` routed through a venue-branded card (`app-toast.tsx`, sport emoji icon). All 20 `window.alert`
  → `toast.error`. **`toastSave` must `dismiss(id)` the loading toast** (custom toasts don't swap by id).
- **Sport loader** on first app entry (`sport-loader.tsx`, ported from the user's HTML) — morphs through the
  venue's **own** sports only; sized to the app column.
- **Points respected in the app.** `pointsEnabled` on `/orgs/{slug}/public` → hide the points UI (home tile,
  greeting, membership page, profile row) when the venue has it off.
- **Week view lane-packs overlapping courts** (`packDay`) so every court at a time is visible side by side.
- **`http.ts` fetch is `cache:"no-store"`** — no more stale config after an owner change.

## ✅ Done 2026-08-10 (~13:40) — Customer peek from any page + booking-list pagination
Local only, not committed. backend **608/608** · tsc clean · vitest **31/31** · lint **0 errors**.
- **See a customer without leaving the page.** New `components/customer-peek.tsx` — a `<CustomerName>`
  wrapper that turns a name into a dotted-underline button **only when a `customerId` is present** (walk-ins
  stay inert), opening a right-side drawer that reuses the `["owner","customer",id]` cache and shows the
  summary + a link to the full page. Provider mounted once in `owner/layout.tsx`.
- **The unlock was `customerId` on the list payloads** — most rows carried only `customerName`. Added it to
  Booking/Payment/Wallet/Membership resources + inline arrays (CourtBoard, Dashboard recent, RentalReturn,
  Reward ×2, Scan, PackagePurchase, Wallet top-ups, Operations timeline), with matching `customerId?` on the
  frontend types. See the session note for **which sites are deliberately left plain** (calendar drag blocks,
  the list mobile card = button-in-button, string-prop values) — don't "finish" those.
- **Pagination on รายการจอง** (`owner/bookings/list`), client-side (`PER_PAGE = 25`) since the range is
  already loaded for search. Prev / windowed numbers / Next, resets to page 1 on any filter change, scrolls
  back to the list top on page change.

## ✅ Done 2026-08-10 — Double-booking hardening, storage_gb, CRM notes/tasks, lint gate green
Local only, not committed. backend **606/606** · tsc clean · vitest **31/31** · lint **0 errors** (was 12) ·
`npm run build` passes.
- **🔴 Double-booking, closed on the counter path too.** The customer app booked under a per-court+date
  `Cache::lock`, but `Owner/BookingController::store` **and** `update` (walk-in create + reschedule) only
  called `assertNoOverlap` with no lock — two staff, or a staff booking racing an app booking, both passed.
  Both now run the overlap-check + write inside a `withCourtLock()` helper on the **same** key
  (`booking:court:{id}:{date}`) as the app, so every create/reschedule serialises together. New cross-path
  test proves counter↔app can't double-book a slot in either order.
- **`storage_gb` is now honest and enforced (A).** All five upload sites store under a per-venue path
  (`slips/{orgId}`, `venues/{orgId}`), so used bytes is a real sum. New `EnsureStorageLimit` (`limit.storage`)
  gates **owner uploads only** (venue images) — customer payment slips and the owner's own bill-slip are
  never blocked, the booking-limit ethic. `PlanLimits` gained storage methods; its "absent on purpose" note
  is retired.
- **CRM WP3 was already done** by the prior session (broadcast_recipients + delivery_stats); confirmed, not
  re-done.
- **CRM WP6 — customer notes + follow-up tasks (C).** `customer_notes` / `customer_tasks`, controllers,
  gated `crm.manage`; surfaced + editable on the customer detail (Notes + Tasks cards). A note also writes a
  `note` timeline entry. Both tables registered in the customer-merge coverage.
- **Lint gate is green (D).** Fixed the one real error (`react-hooks/immutability`: a function used before its
  declaration in `auth-context`). The other 10 were `react-hooks/set-state-in-effect` on legitimate
  client-hydration / reset-on-change patterns (a lazy `useState` initialiser would run during SSR) —
  downgraded that one rule to `warn`, so real bugs still fail the build and CI can finally enforce 0 errors.

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

## ✅ Done 2026-08-08 — POS: selling drinks at the counter
- `/owner/pos` (till) + `/owner/products` (catalogue & stock). Cash or **PromptPay QR** for the sale total,
  drawn from the venue's existing promptpay id; 422 rather than a QR that pays nobody when unset.
- **Three tables, not two.** `product_sale_items` **snapshots name + unit price** — joining back to
  `products` would rewrite last month's takings the first time someone edits a price.
- **Stock moves inside a transaction with `lockForUpdate()`**, rows locked in id order. Two staff selling
  the last bottle at once is the double-booking race with a different table. Duplicate cart lines are
  merged *before* the check, or each half passes a check the pair fails.
- Low stock **warns, never blocks** — only zero stops a sale. A **void is a new fact**, not an edit: the
  receipt keeps its number and gains a reason, and voiding twice is refused so stock cannot return twice.
- Stock is **not editable from the product form** — it moves through เติมของ (`delta` / `set`), so editing
  a price cannot silently rewrite the shelf count.
- `pos.sell` / `pos.void` / `product.manage`: cashier and reception sell but cannot void, which changes the
  day's takings.
- backend **277/277** (+17) · verified by selling through the UI, not just unit-tested.
  Detail: `sessions/2026-08-08-1500-pos.md`.

## ✅ Done 2026-08-08 — PDPA consent + opt-out, and the CRM is no longer ungated (WP1, WP2)
- **The customer app's "แจ้งเตือนโปรโมชั่น" switch was `useState(true)`** — a marketing opt-out wired to
  nothing. Now real: `GET/POST /me/consent`, `POST /me/unsubscribe|resubscribe`, no id in any route so one
  customer cannot touch another's.
- `customers.marketing_consent` is **nullable on purpose** — `null` = nobody ever asked, which is not
  "said no". Suppression filters on `unsubscribed_at` via `Customer::scopeMarketingReachable()`, applied on
  the **base query** in `resolveAudience` and to segment members, so a future audience preset inherits it.
- **CRM gated**: new `crm.view` / `crm.manage` / `segment.manage` / `broadcast.send` on crm/overview,
  segments, timeline, broadcasts, memberships(+points) and `GET /customers` (list was open while detail was
  gated). A migration grants them to existing roles, or gating would have locked everyone but the owner out.
- Owner sees a read-only 3-state consent badge on the customer detail, and "ไม่รวมลูกค้า N คน" on the
  broadcast audience step.
- **Open decision:** suppression is opt-**out**. Strict PDPA marketing is opt-**in**, which silences every
  existing customer until they consent — a business call. `marketing_consent` is recorded so the switch is
  one clause away.
- Verified live end-to-end, not just unit-tested. backend **260/260** (+14) · tsc clean · vitest 24/24 ·
  lint 13 = baseline · e2e 37/38. Detail: `sessions/2026-08-08-1100-pdpa-consent-crm-gating.md`.

## ✅ Done 2026-08-08 — Payment-flow security, PDPA, CRM engine, one credit balance
Committed and pushed to `main`, not deployed. Started as "the app asks me to pay again after I
uploaded a slip" and turned into a rebuild of the customer money model: a customer could confirm
their own booking for free (`/payments/{id}/verify` sat unscoped on the customer route table), the
slip queue and the booking state could disagree, the wallet was money-in-nothing-out. First MySQL run
of the suite caught `reviews.sort_order` unsigned. backend **438/438** · e2e 38/38.
Detail: `sessions/2026-08-08-1900-money-flow-security-and-credit.md`.

## ✅ Done 2026-08-09 — The plan became a product
Committed and pushed. The plan matrix (stored, editable, enforced nowhere), the audit log (a page, a
table, and no writer), the trial columns (unread since the first migration) and the support inbox
(readable, answerable, impossible to put anything into) were all made real. Plan ceilings enforced on
branch/court/staff; an admin can renew, re-plan, trial and hand-edit an expiry from the venue's own
screen. Found: changing a plan could hand a venue the platform free forever (no `ends_at`).
Detail: `sessions/2026-08-09-1600-plan-became-a-product.md`.

## Current Task
Session 2026-08-10 (evening) — **committed and pushed to `main`**, none of it deployed. Driven
entirely by holding the product on a real phone instead of a browser tab; almost everything found
was invisible on a desk. Detail:
`sessions/2026-08-10-2150-customer-app-polish-and-the-counter-scanner.md`.

An earlier session the same day (another agent, `d1a24cb`) landed the LINE reply builder, customer
peek, app toasts, the sport loader and storage_gb enforcement.

## Status
🟢 **Local: all green.** backend **623/623** · tsc **clean** · vitest **31/31** · eslint **0 errors**
· e2e **44/44** — including the two specs that had been red since `d1a24cb`.

🔴 **Deploy still blocked** (unchanged since 2026-08-07): `DEPLOY_PATH` does not exist on the server.
**Production is still running the broken credit system** — every top-up, refund-to-credit and credit
payment 500s there.

⚠️ **Pull the code, then run `php artisan migrate`.** Two migrations from `d1a24cb` had never run
locally, so `/owner/line-templates` answered "เกิดข้อผิดพลาด ลองอีกครั้ง" and an e2e spec failed —
both with nothing on screen pointing at the real cause.

⚠️ **Do not `npm install` with `next dev` running.** Swapping `node_modules` under a live dev server
leaves it answering 500 on every page.

## What's Done
1. **Opening the app on a phone was blocked by Next, not by login.** It answers **403 to every
   `_next/static/chunks/*`** for a cross-origin dev request, so the HTML arrived, no JavaScript did,
   and the app sat on the loader with nothing explaining why. `allowedDevOrigins`, scoped to the
   RFC1918 ranges rather than `*`.
2. **Development now serves the API same-origin, like production** — `next.config.ts` proxies
   `/api/*` and `/storage/*` to Laravel and `NEXT_PUBLIC_API_URL` is back to `/api/v1`. No more
   editing `.env.local` when the Wi-Fi changes, and an https dev server can reach the API without
   mixed content blocking it.
3. **Check-in status updates itself** — the customer's QR screen polls while waiting and stops the
   moment it is scanned. The scan happens on someone else's device; before this the customer had to
   think to pull-to-refresh while standing at the counter.
4. **`/scan`** — the scanner outside the owner layout, installable on a staff phone for venues with
   no hardware. Its own manifest at `/scan/manifest.webmanifest`; the root `app/manifest.ts` stays
   the CUSTOMER app's (I overwrote it once — a customer would have installed the staff tool).
   Reached from a QR on the check-in screen, not a sidebar entry: it is set up once.
5. **The camera cannot work over http and now says so.** `getUserMedia` needs a secure origin; the
   old message blamed the browser permission. Four causes are now named separately, and the
   type-the-code box opens by itself when a camera cannot be offered. Production is https.
6. **Owner settings** — every tab uses the screen; the payment tab is split into PromptPay and bank
   transfer, which is what it actually configures; one save row everywhere (there were three sizes,
   three positions, two labels).
7. **Six three-colour theme presets**, and the swatch circles now set **all three** colours. สีรอง
   and สีเน้น were only reachable through the native colour picker, which is why the demo venue's
   secondary still equalled its primary and every banner gradient rendered flat.
8. **Two long-red e2e specs fixed** — one waited on a `window.alert` the portal no longer raises,
   the other released its booked slot only on success, so one failure poisoned every later run.

## Blockers
None in code. Infra only: `DEPLOY_PATH` on the server, and a prod DB backup before the migrations.

## Next Steps
1. **Deploy.** Unchanged and still first: real customers' credit has been broken in production since
   it shipped. Back up the database — an earlier migration drops five columns from
   `organization_settings`. `php artisan storage:link` + real SMTP/LINE env.
2. **The bottom nav still uses only the primary colour** while buttons and banners use all three.
   The settings copy claims the whole app, so either the nav or the copy should move.
3. **Camera on a phone in development** needs https — a tunnel or a certificate covering the LAN
   address. Deferred: the typed-code path covers it and production is https.
4. **`storage_gb`** is the one plan limit still unenforced; uploads need a per-venue home first.
5. **Self-serve signup** and an **automated payment gateway** — business decisions, not backlog.
6. Demo data keeps one duplicate customer pair (`0812345678`) unmerged, to demo the merge tool.

## ✅ Done 2026-08-07 — Four audit risks closed (#1, #3, #6, #7)
Local-only, verified: backend **233/233** (10 new) · tsc clean · vitest 24/24 · lint **13 errors** (=
baseline). Restored two out-of-sync dep trees on the way (`composer install` brought back
`barryvdh/laravel-dompdf`; `npm install` brought back `jsqr`/`pngjs`) — both were missing from
`vendor/`/`node_modules`, failing BillingDocument + tsc before a line of this work.
- **#1 Double-booking race** — `BookingController::store` now runs the overlap check + insert inside an
  application lock keyed per court+date (`Cache::lock("booking:court:{id}:{date}")->block(5, …)`) wrapping a
  `DB::transaction`. A portable DB unique index can't express "no time-range overlap" and would wrongly
  block re-booking a slot whose earlier booking was cancelled (cancelled rows are kept), so the guard is the
  lock, not an index. `cache_locks` table already exists (prod is `CACHE_STORE=database`). New tests:
  adjacent-slot-ok + straddle-rejected.
- **#7 Wallet top-up not transactional** — `Owner/WalletController::approveTopup` re-reads the txn
  `lockForUpdate` inside a transaction and re-asserts `pending_review`; two concurrent approvals no longer
  both credit (second 404s). Test: approve-twice-credits-once.
- **#3 Notifications now created** — new shared `App\Services\NotificationService` (one place, consistent
  wording, like the money services). Wired into Owner + App `PaymentController` verify/reject, `RefundService`
  approve/reject, `Owner/WalletController` approve/reject topup, and `Owner/BookingController::cancel`. Tests:
  slip-approve reaches the customer's bell (HTTP) + unit coverage of every event's title.
- **#6 Admin login rate limit** — done **inside** `AuthController::adminLogin` via `RateLimiter` keyed by
  email+IP, counting only FAILED attempts (a valid login clears it, so no lock-out). NOT route `throttle`
  middleware: that resolves `$request->user()` to key the limiter, which re-caches a leftover bearer identity
  on the sanctum guard and breaks the multi-actor test flow (spent a while finding this). 5 wrong guesses → 429.

## ✅ Done 2026-08-07 — Unpaid bookings expire and free the slot (#2, + scheduler #5)
- New `bookings:expire-unpaid` command (`app/Console/Commands/`) cancels `pending_payment` bookings older
  than `config('booking.hold_minutes')` (default 30, env `BOOKING_HOLD_MINUTES`) and notifies the customer
  (`NotificationService::bookingExpired`). Cancel — not a new `expired` status — because the overlap check
  excludes only `cancelled`, so cancelling is what actually frees the slot with zero query/UI changes.
- **A booking whose slip is uploaded and awaiting review (`payments.status = pending_review`) is protected**
  (`whereDoesntHave`) — that customer has paid; only the venue is slow. `chunkById(200)`.
- **Scheduler now exists** (#5): `routes/console.php` runs the command `everyFiveMinutes()->withoutOverlapping()`.
  ⚠️ Needs `* * * * * php artisan schedule:run` on the server (cron) at deploy — otherwise nothing fires.
- Tests: `ExpireUnpaidBookingsTest` 4/4 (stale→cancelled+notified, fresh untouched, awaiting-review protected,
  freed slot re-bookable via the API). Backend now **237/237**.

## ✅ Done 2026-08-07 — Broadcast menu: blast a promo over LINE (#4), + login UX fix
- **New Owner menu `/owner/broadcast` ("ยิงโปร LINE").** Compose a promo, pick an audience, see how many
  it reaches and how many are contactable on LINE, then send. History below.
- **`line_messaging_token` is finally read** (#4). New shared `App\Services\LineMessagingService::pushText`
  multicasts over the venue's own channel token (chunked at LINE's 500 cap). No token → the send is
  recorded but delivers nothing (`delivery.noToken`), never an exception — dev/self-hosted venues without
  LINE don't break. A customer with no linked LINE profile is `skipped`, not an error.
- **Audience presets from booking history** (`broadcasts.audience` + `inactive_days`, new columns):
  `lost` (churned — booked before, nothing within N days), `regulars` (≥ N bookings),
  `one_time`, `new`, `all`, and saved `segment`. `GET /owner/broadcasts/audience-preview` returns
  `{recipientCount, reachableCount}` so the UI previews reach before sending. Thresholds in `config/broadcast.php`.
- **Back-compat kept**: the old CRM broadcast tab posts a bare `segmentId` with no `audience` — `store`
  derives `audience=segment` from it, so that screen still works.
- **Enhanced 2026-08-07 (same day):** the menu now also lets the owner (a) **choose the delivery target** —
  `channel: line` (push over LINE) **or `channel: app`** (drop a `kind=promo` notification into each targeted
  customer's in-app bell via `NotificationService::promo`; every targeted customer is reachable in-app, no
  LINE profile needed); (b) **pick a message template** (5 audience-tuned presets, frontend constants that
  prefill title+message, still editable); (c) **preview before sending** — a live **LINE-chat bubble mockup**
  for the LINE channel and an **in-app notification-card mockup** for the app channel. `BroadcastLineTest`
  now 5/5 (added app-channel → promo-notification test). Live-smoked both channels on the server.
- Verified: backend **241/241** (4 new in `BroadcastLineTest`, incl. a real `Http::fake` multicast asserting
  exactly the reachable ids + no-token safety + preset resolution) · tsc clean · vitest 24/24 · lint 13.
  **Live smoke** on the running server: preview → create → send returns `delivery:{sent:0,skipped:1,noToken:true}`
  for the dev org (no LINE token configured), exactly as intended.
- **Login UX fix (fallout from #6):** the owner/admin login pages only special-cased HTTP 401, but the API
  returns **422** for bad credentials and **429** when rate-limited — both fell through to the generic
  "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง". A user who tripped the new rate limit saw that and kept retrying
  (staying locked). Both pages now show "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (401/422) and a distinct
  "พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่" (429). Cleared the stuck dev rate-limit keys.

⚠️ **Dev-data note:** the seeded `everyday-badminton` subscription had expired (2026-07-05), so every
`owner.subscribed` route 402'd — the whole owner portal was unusable in dev. Renewed it to +1yr so the
Broadcast menu (and everything else) can be exercised. This is dev data, not code.

## Known risks found by audit, NOT yet fixed
**#1, #2, #3, #4, #6, #7 fixed 2026-08-07 (see above). Remaining:**

5. **Scheduler has only the one job** (expiry). No subscription-expiry warning before a venue is locked
   out (see the dev-data note — this is exactly the surprise it would prevent), no booking reminder.
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
