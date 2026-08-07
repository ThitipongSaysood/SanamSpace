# 2026-08-01 — Per-venue isolation, subscription billing, documents, portal audit & performance

**Agent:** Claude (Opus 5) · **Branch:** main · **Deployed:** ❌ not yet (4 new migrations)

---

## Goal of the session

Started as "open the local app". Became five pieces of work, each asked for in turn:

1. Make the customer app **per-venue** (สนามใครสนามมัน) instead of a cross-venue marketplace
2. Give owner + admin the **venue's customer link**, ready to copy
3. **Subscription expiry + renewal by bank transfer**, and the admin side of it
4. **Invoices and receipts** as real documents, viewable as **PDF**
5. **Audit both portals** for gaps, then make the system **fast at scale**

---

## What was actually done

### 1. Tenant isolation — the customer app is per-venue

Two real data leaks existed and were reproduced against the dev DB before fixing:

- `GET /branches` returned **every venue on the platform**
- `/packages` + `/promotions` sat OUTSIDE `auth:sanctum`, so `$request->user()` was always null and
  `resolveOrganization()` fell through to its **"oldest organization"** default — a TSR Arena customer
  was served Chic Badminton's catalogue

**Rule now:** the tenant comes from `X-Venue-Slug` (stamped on every request by the app) / `?venueId` /
the signed-in customer — and there is **no fallback**. Unresolvable → 404. Customer + foreign slug → 403.

- Backend: rewrote `ResolvesOrganization` (+`resolveOrganizationOrFail`, sanctum-guard lookup so public
  catalogue routes still see the customer); scoped `Branch`, `Court` (incl. `show`/`schedules` — a court
  UUID from another venue now 404s), `Review`, `Package`, `Promotion`. `AuthController` no longer binds a
  new customer to an arbitrary org.
- Frontend: `app/(app)/*` → `app/v/[slug]/(app)/*`, home at `/v/{slug}/home`; `lib/tenant/active-venue.ts`
  + `lib/tenant/venue-nav.tsx` (`VenueLink`, `useVenueRouter`) so screens link venue-relative and cannot
  escape their tenant; `/` → `/landing`; deleted the venue-less `app/(auth)/login`.
- **LIFF Endpoint URL is unchanged** (`/v/{slug}`) — no LINE console work needed.

### 2. Customer link

`components/customer-link.tsx` (`CustomerLink` + `customerLinkFor` + `useOrigin`) — copy button with
inline confirmation, wraps rather than truncates. On the **owner dashboard** (sharing is a daily job,
not a setting) and in the **admin org drawer**. Needed a read-only `orgSlug` on `OwnerSettingResource`.

### 3. Subscription expiry + renewal

`subscriptions.ends_at` existed but **nothing ever checked it**, and there was no way to pay.

- **User's calls:** on expiry, **lock the Owner Portal but let the venue's customers keep booking** (they
  already paid the venue). Renewal works **both** ways — venue renews itself, or the platform bills it.
- `SubscriptionRenewalService` (mirrors `RefundService`): raise → approve → reject. **Approval is the
  only thing that moves `ends_at`**, guarded to outstanding invoices so one transfer can't buy two
  periods. Early renewal extends from the old end date; renewal after a lapse starts today.
- `EnsureSubscriptionActive` (`owner.subscribed`) → 402 on owner routes, `/owner/billing*` exempt.
- Owner `/owner/billing`: countdown, renew (1/3/6/12 mo), history, and a **pay dialog that pops straight
  up** with a scannable PromptPay QR (amount embedded) + bank fallback + slip upload.
- Admin: `pending_review` first, renders the slip, **อนุมัติและต่ออายุ / ไม่ผ่าน**; `ออกใบแจ้งหนี้` action on
  `/admin/subscriptions`; sidebar badge counting slips awaiting review.

### 4. Invoices & receipts as real documents + PDF

The "receipt" was the invoice number with `INV`→`RCP` swapped at render time — nothing stored.

- `invoices` gained `subtotal`/`vat_amount`/`vat_rate` (frozen at issue) and `receipt_number`/
  `receipt_date` (own unique series, issued once inside the approve transaction).
- **VAT (user's call):** switchable in `/admin/settings`, prices are **VAT-INCLUSIVE** — tax is backed
  OUT of the price (฿2,970 → net 2,775.70 + VAT 194.30), never added on top, so the QR amount and the
  advertised price stay identical. Rate snapshotted per invoice.
- `BillingDocumentService` builds one payload; owner and admin endpoints return it identically (an e2e
  asserts `toEqual`). Rendered by `components/billing-document.tsx`.
- **PDF** via `barryvdh/laravel-dompdf` + a Blade template, opened as a blob (endpoint needs the token).

### 5. Portal audit

Drove all **31** owner+admin pages: **0** HTTP errors, **0** console errors, **0** error states. API wired
both directions; every mutation endpoint appears in a test. Incomplete screens are honest (`admin/users`
ships a `disabled title="เร็วๆ นี้"` button).

**Two gaps closed:**
- `admin/support` could only READ → replies (`support_ticket_replies`) + resolve/reopen. A reply is
  recorded **and emailed** (venues have no support inbox); `emailed` is stored per reply and the UI warns
  when it was false.
- `owner/staff` could only INVITE → edit (name/role/status) + remove, with the two guards that matter:
  nobody may change their **own** role/status, and the **last owner** may not be removed or demoted.

### 6. Performance — measured against 3,000 bookings / 800 customers

| | before | after |
|---|---|---|
| `/owner/bookings` payload | **1,135 KB** | **8.7 KB** |
| `/owner/bookings` time | 180 ms | 13 ms |
| `/owner/customers` | 21 ms / 138 KB | 3.6 ms / 10 KB |

- **Worst offender:** the booking calendar fetched *every booking the venue had ever taken* to draw ONE
  day. Now `?from=&to=` matches the visible window.
- **No pagination existed anywhere.** `PaginatesLists` (default 50, max 200) bounds owner
  bookings/customers/payments and admin invoices/transactions. `{data:[...]}` shape kept, so callers were
  unaffected — and `LoadMore` was added wherever a list is now capped (silent truncation looks like data
  loss).
- **`bookings` had no index on `organization_id` at all.** Added org-scoped indexes on
  bookings/payments/customers/timeline.
- Dashboards run 29/19 queries but they're distinct aggregates, not N+1 (~45 ms) — left alone.

---

## Traps hit (worth not re-discovering)

1. **Google Fonts serves a Latin-only subset.** The Sarabun TTF from the CSS API was 26 KB with **zero**
   Thai glyphs — the PDF would have been a page of boxes. The full file is on the `google/fonts` GitHub
   repo (~90 KB, 87 Thai glyphs). *Always verify the cmap before trusting a downloaded font.*
2. **dompdf `registerFont()` returns `false` with no exception** when the TTF is outside its chroot
   (`public/` by default), then silently falls back to Helvetica. Options must set fontDir/fontCache AND
   `setChroot([resource_path('fonts'), base_path()])`. Caught only by noticing a 2.4 KB PDF and grepping
   `/BaseFont` — hence the test asserting `Sarabun` present and `Helvetica` absent.
3. **Laravel caches the resolved guard user between HTTP calls inside one test.** A second `withToken()`
   stays authenticated as the FIRST user — admin calls silently became owner calls (403). Fix:
   `$this->app['auth']->forgetGuards()` — see the `as()` helper in the newer test classes.
4. **`lib/api/owner.ts`'s `req()` JSON-stringified everything**, so FormData uploads posted `{}` and slip
   uploads failed silently. The customer client already handled it; the owner one did not.
5. **The `.next` cache can go stale** and throw `Could not find the module ... in the React Client
   Manifest`. `rm -rf frontend/.next` fixes it.
6. **e2e specs were sharing state through the real dev DB.** `booking.spec.ts` ate a court slot per run
   until Court 1 was full for the day; billing specs handed each other outstanding invoices. Both now
   clean up after themselves (`billing-helpers.ts`, booking cancels its own slot).

---

## State at end

- backend **174/174** · tsc clean · vitest **23/23** · lint **13 errors = baseline** (added none)
- playwright **19/20** — the 1 failure is the **pre-existing** `admin.spec.ts` "MRR" strict-mode locator
  bug, confirmed by re-running it on stashed (pre-session) code
- dev DB cleaned of all test data; VAT + company details left configured so the feature is demoable
- **Nothing committed.** 154 files changed, 4 new migrations.

---

## Next step for whoever picks this up

1. Review + commit (nothing is staged). Deploy needs `composer install` + `php artisan migrate`.
2. Decide on the remaining portal gaps — admin users create/suspend, admin role permissions, owner
   customer-detail page.
3. `composer audit` reports 9 advisories in `guzzlehttp/guzzle` 7.11.1 + `psr7` — **pre-existing**, not
   from dompdf (verified against the old lock). One `composer update` away, but wants testing.
