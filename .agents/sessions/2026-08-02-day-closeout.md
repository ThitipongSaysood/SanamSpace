# 2026-08-02 — Day close-out

_Agent: Claude (Opus 5)_

One long session. Feature detail lives in the three companion files; this is the shape of the day, the
decisions that would be expensive to rediscover, and the state the repo is in.

- `2026-08-02-welcome-banners.md`
- `2026-08-02-portal-gaps.md`
- `2026-08-02-qr-checkin.md`

## What shipped

| Area | Summary |
| --- | --- |
| Welcome banners | One slot → a `welcome_banners` table. Many per venue, each on/off, orderable, optional entry popup (swipeable when several). Images uncropped. |
| Portal gaps ×4 | Admin creates/suspends users · admin edits role permissions **and they are now enforced** · owner customer detail · cancel/suspend/resume a subscription. |
| QR check-in | Rebuilt as a real feature on both sides, switchable per venue. |
| Bookings list | Own sidebar menu: search, date range, status tabs, add/edit/delete. |
| Payments | Cards → table with a slip lightbox. |
| Responsive | Finished. Bespoke cards on the two screens staff hold a phone for; a `.stack-table` CSS pattern for the other 13. |
| Demo data | 3,052 load-test rows → 10 readable bookings covering every status. |

## The three findings that reframed the work

Each of these turned "add the requested feature" into something larger, and each is the kind of thing
that is cheap to find and expensive to ship without.

**1. Role permissions were read by nothing.** Asked to build a permission editor, I grepped for anything
consulting `role_permissions` and found zero call sites. Every role — Viewer, Cashier, Owner — could do
exactly the same things. An editor on top of that would have been an elaborate no-op, so the feature
became the editor **plus** `EnsurePermission` on 30 owner routes.

**2. QR check-in was theatre, and one part was actively wrong.** The "QR" was an 8×8 grid of `<div>`s
coloured by `(i * 7 + (i % 5)) % 3 === 0`; the countdown was a hard-coded `00:15:32`; and the button was
on the customer's own screen, marking their booking complete. Not a check-in — a customer recording their
own attendance.

**3. The app runs on UTC while bookings store the venue's wall clock.** Found by the check-in e2e, which
built a booking from the runner's local (ICT) clock and got told it was in the future. Every Thai
afternoon arrival would have been refused as "ยังไม่ถึงเวลา". **Anything new that reasons about "has this
slot happened yet" has the same bug waiting.**

## Decisions worth not re-litigating

- **Suspend, don't delete** (platform users, banners, subscriptions). An account that approved payments
  should keep its name on them; a seasonal banner should be parked, not retyped next year.
- **`owner` and `super_admin` bypass every permission check.** A venue must not be able to lock itself out
  of its own portal by editing a list. The UI says so instead of offering a save that would be refused.
- **Cancel ≠ suspend for subscriptions.** Cancel lets the paid period run out; suspend pulls `ends_at` to
  now, which is what actually closes the portal. `EnsureSubscriptionActive` reads the date, not the
  status.
- **Delete a booking is refused once an approved payment exists.** That row is a financial record; the way
  out is cancel-and-refund.
- **jsQR over `BarcodeDetector`** — the built-in API is Chromium-only and a counter on an iPad would have
  had no scanner at all.
- **One definition, two callers** (`App\Support\RolePermissions`) for the permission catalogue. The first
  draft duplicated it in the migration and the seeder, which is how environments end up disagreeing about
  what a Cashier may do.

## Test-writing traps hit today

Collected because every one of them cost time and will recur.

- **Playwright `locator.count()` does not auto-wait.** Counting rows before the query resolved returned 0
  and made a "one more row" assertion pass against an empty table.
- **Substring matching on button names.** "ระบบเช็คอิน: เปิด" also matches `name: "เช็คอิน"`; the empty
  state's "เพิ่มแบนเนอร์แรก" also matches `name: "เพิ่มแบนเนอร์"`. Use `exact: true`.
- **Branding paints from localStorage first**, then the refetch lands. Acting on the first paint means
  acting on stale data — the popup swipe test scrolled a strip that did not overflow yet, silently doing
  nothing.
- **Specs that book a real slot must release it.** Against a persistent dev database, the check-in test
  permanently consumed one court per run until every court was busy at that hour.
- **Do not scrape display text for identity.** `venue-isolation` asserted on a name that only appeared
  inside an upcoming-booking card, so it passed at 12:30 and failed at 13:45 when that booking ended.
  `owner-customer-detail` read the first `<div>` of a card and picked up a phone number the moment
  customers had one. Both now read from the API.

## Repo state

**Committed on `feat/venue-content-portal-gaps-checkin`, pushed, NOT merged.**

```
6587d7b  feat(ui): make every back-office table usable on a phone
42fb4e4  feat: venue banners, portal gaps, real QR check-in, bookings list
```

`.codex/` is deliberately left untracked — it belongs to another agent.

⚠️ **14 migrations have never run on production.** The deploy workflow runs `php artisan migrate --force`
on any push to `main`, so merging deploys and migrates in one step.

One of them is destructive: `2026_08_03_000000_create_welcome_banners_table` copies the existing welcome
banner into the new table and then **drops five columns** from `organization_settings`. It is written to
carry the data first and `down()` folds it back, but take a database backup before the first production
run regardless.

## Verified

backend **223/223** · tsc clean · vitest **24/24** · lint **13 errors / 24 warnings** (2 fewer warnings
than the session baseline, no new errors) · playwright **37/38**.

The 1 failure is the long-standing `admin.spec.ts` "MRR" locator bug, confirmed pre-existing in an earlier
session by re-running against stashed code.

New this session: **48 backend tests** across `OwnerWelcomeBannerApiTest`, `AdminUserManagementTest`,
`RolePermissionTest`, `OwnerCustomerDetailTest`, `AdminSubscriptionActionsTest`, `OwnerCheckinTest`, plus
booking-delete cases; and **5 e2e specs** (`owner-banners`, `admin-users-roles`, `owner-customer-detail`,
`checkin`, extended `branding`).

The check-in spec **decodes the rendered QR with jsQR and asserts it equals the booking's token** — the
previous decorative version would have failed that, which is why it is written that way rather than
checking an element exists.

## On measuring the right thing

Worth keeping because it cost a full round trip. The first responsive audit checked
`scrollWidth > clientWidth` on every route and came back **clean everywhere** — tables already sit in
`overflow-x-auto`, so nothing overflows the document. The metric was answering the wrong question.

The question that mattered was *can you do the page's job*, and the measurement that answered it counts
interactive elements inside tables whose bounding box falls outside the viewport. Same pages, same
browser, opposite answer.

## Picking this up tomorrow

Start at `.agents/active.md` → `Next Steps`, then `Known risks found by audit, NOT yet fixed`. The two
that cost a venue real money are the double-booking race and the unpaid booking that holds a court
forever; neither has been touched.
