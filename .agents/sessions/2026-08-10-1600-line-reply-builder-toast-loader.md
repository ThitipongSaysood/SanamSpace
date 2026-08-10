# Session 2026-08-10 ~16:00 — LINE reply builder, app toasts, sport loader, points-gating, week-view lanes

Continues the same uncommitted tree (this is the session that gets committed + pushed at the end).

## What was done

### LINE reply builder — customise the card LINE sends the customer (3 phases)
The venue can now design the Flex message a customer receives on booking events, and the system actually
sends it. There was **no** booking-confirmation LINE message before — LINE was broadcast-only.
- **Phase 1 (backend send path).** `line_message_templates` table (`org` + `event` +
  `enabled` + `blocks` JSON); events `booking_confirmed` / `payment_received` / `booking_cancelled`.
  `LineFlexRenderer` (block tree → LINE Flex bubble + `{{placeholder}}` substitution; drops any button/image
  with a non-http url so LINE never rejects the card). `DefaultLineTemplates` (receipt/cancel defaults baked
  in code — a venue works before touching the builder; `payment_received` off by default so it never doubles
  `booking_confirmed`). `BookingLineVars` (booking → `{{customerName}}` etc.). `LineMessagingService::pushFlex`
  (single push; returns `sent`/`failed`/`noToken`/`noProfile`, never throws). Wired into `NotificationService`
  (`paymentApproved` → confirmed + payment_received; `bookingCancelled`/`bookingExpired` → cancelled) and into
  the **credit-pay path** (`Api/BookingController::payWithCredit` now fires `paymentApproved` on settle — the
  screenshot case). Tests: `LineFlexRendererTest`, `LineBookingReceiptTest`.
- **Phase 2 (owner API).** `Owner/LineTemplateController` — `GET /owner/line-templates` (all 3, saved-or-
  default), `PUT /owner/line-templates/{event}`, `POST /owner/line-templates/{event}/test` (render with sample
  vars + push to a chosen customer). `permission:settings.manage`. **Gotcha fixed:** `$request->validate()`
  strips un-ruled nested keys — persist `$request->input('blocks')`, not the validated copy, or every block
  prop but `type` is dropped. `{{bookingUrl}}` deep link added (config `services.line.customer_app_url`).
  Tests: `OwnerLineTemplateTest`.
- **Phase 3 (frontend builder).** `/owner/line-templates` (menu "ข้อความตอบกลับ LINE"). Block-based drag-drop
  editor (`components/line-flex-preview.tsx` mirrors the backend renderer for a live phone preview), placeholder
  palette (click-to-copy), test-send with a customer search. **Drag UX the user iterated on:** whole row + grip
  draggable (inline `<svg>` was swallowing the drag — `[&_svg]:pointer-events-none`), a "วางตรงนี้" gap opens at
  the drop point, dragged card unchanged, drag image = the full card via `setDragImage(cardRef)`.

### App-wide toasts (the system used to be silent on save)
`sonner` `<Toaster>` was never mounted. Mounted it top-right in `providers.tsx`. New `lib/toast.tsx` routes
**every** `toast.success/error/warning/info` and `toastSave` through a custom card (`components/app-toast.tsx`)
matching the user's sample: rounded accent bar (by type), the **venue's sport as a floating emoji** (drop-
shadow, no chip — sport from the public config), bold navy title, grey message, close ×. Converted all 20
`window.alert(...)` sites to `toast.error`, and wired `toastSave` into the settings/points/LINE saves.
**Gotcha:** a custom toast can't be swapped in place by id, so `toastSave` must `toast.dismiss(id)` the loading
toast then show the result — otherwise the `duration:Infinity` "saving…" toast hangs next to the success one.

### Sport loader on first app entry
Ported the user's `sanamspace_morphing_ball_loader.html` to `components/sport-loader.tsx` — a bouncing ball
that morphs through **only the venue's own sports** (`sports` now on the public config). Shown in the customer
`(app)/layout` while the session restores (min 1.5s). Sized to the app column (`mx-auto max-w-md`, not full-
bleed) and the bounce height was tuned down (−160px → −80px) to fit.

### Points programme now respected in the customer app
`points_enabled` was owner-only + gated awarding, but the app still showed the points UI. Exposed
`pointsEnabled` on `/orgs/{slug}/public` → `tenant.pointsEnabled`; the home greeting/points card, the แต้มสะสม
tile, the rewards teaser, the membership page and the profile row all hide when off (membership page shows a
"ปิดอยู่" state). Test in `OrgPublicTest`.

### Week-view shows every court
`Owner/bookings` week view drew each booking full-width in its day column, so different courts at the same
time hid each other. New `packDay()` lane-packs overlapping bookings side by side; the grid widens to keep the
busiest day's lanes readable (≥48px/lane, horizontal scroll when very full).

### Stale-config fix
`lib/api/http.ts` fetch now `cache: "no-store"` — a setting the owner just changed no longer reads stale from
the browser HTTP cache (React Query owns caching).

## State at end
backend **623/623** · tsc clean · vitest **31/31** · lint **0 errors** (45 warnings baseline). Committed +
pushed at session close (this session ends the "hold deploy/commit" instruction).

## Next
- LINE receipt push is synchronous inside the request (like broadcasts) — move to a queue if payment-approval
  latency matters.
- Consider a shared paginated-list pattern; extend toasts to remaining customer-app mutations.
