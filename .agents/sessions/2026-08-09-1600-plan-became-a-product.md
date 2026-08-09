# 2026-08-09 16:00 — The plan became a product: gating, ceilings, an admin who can run a subscription, and a support desk with a way in

Same thread as 2026-08-08, followed further: **things that looked finished but were not.** This time
the plan matrix (stored, editable, enforced nowhere), the audit log (a page, a table, and no writer),
the trial columns (present since the first migration, never read), and the support inbox (readable,
answerable, and impossible to put anything into).

## Goal

Started as "finish the in-app reward redemption", then followed the venue's asks — one universal
scanner, a merge tool for duplicate customers, a grouped sidebar, an operations centre — and ended in
the platform layer: what a package actually buys, and what an admin can do about it.

## What was actually done

### Part 1 — the previous session's work, committed (10 commits)

Nothing from the reward/scanner/operations work had been committed. Split into ten commits, each one
topic, verified by type-checking every intermediate commit in a throwaway worktree (3–9 all compile):

1. `fix(billing)` **wallet_transactions.sort_order signed.** Same bug family as `reviews.sort_order`
   the day before, in the table that holds people's money: `CreditService::nextSort` writes `min - 1`,
   which is `-1` for a customer's first transaction, into an unsigned column. SQLite does not enforce
   it; MySQL does. **Every top-up, refund-to-credit and credit payment 500s in production today.**
   Found by running the suite against MySQL — the search last time was for the symptom, not the pattern.
2. `fix(owner)` **dashboard reads the venue's clock**, not the server's UTC. "Today" reported yesterday
   until 07:00 Bangkok, and the 2-hour "arriving soon" window looked at 06:26–08:26 while the wall
   clock said 13:26. New `VenueClock`.
3. `feat(app)` **customers redeem rewards themselves**, slide-to-confirm, a short collection code
   (no 0/O/1/I — it is read aloud), pending redemptions on the home screen, uncollected ones expire
   and give the points and the stock back. Off by default.
4. `feat(owner)` **one scanner** for every code the counter meets. Permission checked per branch
   *inside* the controller so a single entry point cannot become a skeleton key.
5. `feat(crm)` **walk-ins matched by phone** + a merge tool. Matching is phone-only: two customers
   called สมชาย are two people. Merging uses raw queries to empty the duplicate, because going through
   the model fires the observer and writes a false "แต้มสะสม -100" onto a timeline already moved.
6. `feat(owner)` **live court board** — what is on each court, minutes left, who is next.
7. `feat(owner)` **operations centre that is actually today.** "Timeline วันนี้" was the six
   most-recently-created bookings, any date.
8. `feat(owner)` **sidebar in seven groups**, ordered by how often the venue touches it.
   "การชำระเงิน" renamed ตรวจสลิป and moved into the daily work.
9. `feat(plans)` **feature gating that enforces** — `feature:` on 58 routes, 402, menus hidden not
   greyed, admin grid toggles a cell, a venue can be moved between packages. **Enterprise retired**
   (฿0, no subscribers, its only distinct feature a white-label domain that has never been built) —
   deactivated, not deleted, because invoices reference plans by id.
10. `ci` **the suite runs before deploy, on MySQL.** The deploy workflow ran no tests at all.

### Part 2 — the admin portal (this session's new work)

**Subscription management where the expiry date is.** Renewing a venue meant three screens: read the
date on `/admin/organizations`, raise the invoice on `/admin/billing`, come back and approve it. The
"การสมัครใช้งาน" tab in the org drawer said "กำลังพัฒนา". It now renews (1/3/6/12 months, price shown
before committing), changes plan, starts a trial and — behind a reason — sets the expiry by hand.

**`markPaid` for money that arrived before the paperwork.** Still issues the invoice and the receipt
and still lands in the platform ledger; it just closes in one step. Without it an admin edits the
expiry date instead and the payment exists nowhere. An invoice the venue already owes is reused
rather than a second one raised beside it.

**A bug found while consolidating:** there were **two** change-plan endpoints that did not know about
each other — the pre-existing `PUT /admin/organizations/{id}/plan` and the one added yesterday on the
subscription. The older one created a subscription with **no `ends_at`**, and `isExpired()` reads a
null end date as "never expires". Changing the plan of a venue that had none handed it the platform
**free, forever**, with no invoice anyone would ever see. Both now call one method on
`SubscriptionRenewalService`. My own duplication, from not checking for the existing route.

**An audit log that something writes to.** `AuditLog`, its controller, its resource and its page all
existed; `AuditLog::create` appeared **nowhere in the codebase**. The six rows on screen were seeded
fixtures. Now every platform action against a venue is recorded — create/delete/suspend/activate,
change plan, renew, hand-edit an expiry (with the reason), approve or reject a slip, and
**impersonate the owner**. That last one matters most: for a stretch afterwards everything done in
that venue's portal was done by a platform admin wearing the owner's face, and only that row says so.
New `user_id` / `organization_id` columns, nullable and **without foreign keys on purpose** — an
audit entry has to outlive the row it points at.

**Expiry warnings.** A venue found out its plan had lapsed by being locked out mid-shift. Now warned
at 7, 3 and 1 days — exact-day matching, because a daily command that mails every morning for a week
teaches people to filter it. The same command ages unpaid invoices past their due date into
`overdue`, a status that was in the schema, in every outstanding-invoice query, and set by nothing.

**Trials.** `trial_start_at` / `trial_end_at` have been on `organizations` since the first migration
with nothing reading or writing them. A trial keeps the subscription `status = 'active'` and lives on
the organisation: `activeSubscription()` filters on `active`, so a separate `trialing` status would
blank the plan on every screen that loads a venue through it. Every lockout path already reads
`ends_at`, so a trial that runs out locks the portal exactly like a lapsed plan. Paying ends the
trial (the date is moved to today, not cleared — when they started trying is worth keeping).

Also found: the owner announcement audience called a venue whose plan had **lapsed** a "trial" and a
venue actually on a free trial a paying customer — exactly backwards. Now reads `onTrial()`.

### Part 3 — ceilings, support, dependencies

**Plan limits.** `branch_limit`, `court_limit`, `staff_limit`, `monthly_booking_limit`, `storage_gb`
appeared in exactly two places: a cast on the model and the admin edit form. A Starter venue at ฿990
could open fifty courts across twenty branches. New `limit:` middleware (402, naming the number).

The deliberate asymmetry: **structural limits are hard, volume is not.** Branches, courts and staff
are added one click at a time by an owner looking at the screen that says why it stopped. A booking
arrives from a customer who has no idea a plan exists — blocking it takes the venue's revenue to
enforce the platform's billing, and this system already decided the other way once (an expired venue
is locked out of its portal while its customers keep booking). The monthly count is reported, never
enforced. **`storage_gb` was left out**: every upload lands in one shared `slips` folder with no
organisation in the path, so there is no honest way to say what a venue is using.

Gated only on **create**. A venue that downgrades is over its ceiling by definition; gating edits too
would lock an owner out of their own courts, a worse bug than the one being fixed. `PlanLimits` does
not memoise — a cache would need flushing at every place a plan can change, and the one call site
that got missed would be the one that let a venue past.

**`advanced_reports` was gating nothing.** Ten codes in the catalogue, nine with routes behind them.
I had reported "all ten gated" the day before; that was wrong. It now gates the CSV export (reading
the reports stays core), and a new test walks every code in the catalogue and fails if it enforces
nothing anywhere.

**A support desk with a way in.** The platform could read tickets, answer them and close them.
`SupportTicket::create` existed only in the seeder, and the "ติดต่อฝ่ายสนับสนุน" link in the owner
sidebar pointed at the settings page. New `/owner/support`: open a ticket, read the thread, reply.
Tickets gained `organization_id` — matching on `organization_name` was fine while the desk was
read-only and would show one venue another's conversation the day two venues are named the same. The
admin reply email now resolves the venue by id for the same reason. A reply from the venue reopens a
settled ticket.

**Dependencies.** `composer audit` **17 advisories across 3 packages → 0**. Frontend production tree
**12 (8 high) → 0**; Next 16.2.9 → 16.3.0, sharp 0.34.5 → 0.35.3. Found while doing it: **`shadcn`
was in `dependencies`** — a CLI that scaffolds component files, imported by nothing, dragging the MCP
SDK, hono and express-rate-limit into the tree that ships. Moved to devDependencies. The 8 advisories
that remain are all in build tooling (eslint, shadcn) and never reach the server.

## Bugs found this session

| | Where | Effect |
|---|---|---|
| 🔴 | `wallet_transactions.sort_order` unsigned | every credit movement 500s on production **today** |
| 🔴 | `changePlan` with no subscription | venue gets the platform free, forever, no invoice |
| 🟠 | dashboard on UTC | "today" is yesterday until 07:00 Bangkok |
| 🟠 | walk-in bookings | a new customer row every visit, points and credit split across copies |
| 🟠 | `/admin/operations` | stray duplicate route pointing at an owner controller with no org context |
| 🟡 | "Timeline วันนี้" | the six newest-created bookings, any date |
| 🟡 | announcement audience | "trial" meant "lapsed"; real trials were told they were paying customers |
| 🟡 | support reply email | resolved the venue by name |
| 🟡 | `advanced_reports` | sold on the pricing page, enforced nowhere (my miss from the day before) |
| 🟡 | `shadcn` in `dependencies` | build-only CLI shipped in the production dependency tree |

## Decisions worth keeping

- **Anything absent from `PlanCatalogue` is core.** Booking, check-in, slip review, customers,
  refunds, reports, courts, staff. A venue that cannot take a booking has no reason to pay, and a new
  page cannot vanish for everybody because nobody added a row.
- **402, not 403.** Both for features and for ceilings: nothing is wrong with the request or the
  person making it. 403 sends an owner to their manager; 402 points at the pricing page.
- **Menus are hidden, not greyed.** A control that answers 402 is a dead end. Nothing is hidden while
  the subscription is still loading — flashing the full menu and then removing half reads as a bug.
- **Structural limits hard, volume soft** (see above). Reversible in one line if the venue disagrees.
- **Audit rows have no foreign keys.** Deleting a venue must not delete the record of it being
  suspended.
- **A trial is an organisation property, not a subscription status.**

## Status at close

🟢 **Local: all green.** backend **599/599** · tsc **clean** · vitest **31/31** · `npm run build`
**passes on Next 16.3** · e2e **44/44** · lint **12 errors** (below the 13 baseline).

🟢 **Dependencies clean** in everything that ships (composer 0, npm production 0).

🔴 **Deploy still blocked** — `DEPLOY_PATH` does not exist on the server. Unchanged since 2026-08-07.
**Production is running the broken credit system** (`wallet_transactions.sort_order`): every top-up,
refund-to-credit and credit payment 500s there, and has since it shipped.

⚠️ **~38 migrations pending on prod.** Back the database up first — an earlier one drops five columns
from `organization_settings`.

## Next steps

1. **Deploy.** Everything above is local. The credit fix is the reason this is first.
2. **`storage_gb`** — needs uploads to have a per-venue home before the number can mean anything.
3. **Self-serve signup** and **an automated payment gateway** — both business decisions, not backlog.
   Today a new venue is created by an admin, and every renewal is PromptPay + a slip + a human.
4. **Lint debt** — 12 errors, reported by CI but not enforced, because a gate that is red on arrival
   teaches people to ignore the red X.
5. **Demo data** — one real duplicate customer pair (`0812345678`) left unmerged on purpose, as a
   demo of the merge tool.
