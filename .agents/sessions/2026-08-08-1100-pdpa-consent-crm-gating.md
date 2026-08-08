# 2026-08-08 11:00 — PDPA consent/opt-out + CRM permission gating (WP1, WP2)

_Agent: Claude (Opus 5)_

## Goal
CRM roadmap **Phase 0**: WP1 (PDPA consent + opt-out + suppression) and WP2 (permission-gate the CRM).

## What was actually done

### WP1 — consent and opt-out
- Migration `add_marketing_consent_to_customers`: `marketing_consent` (**nullable**), `consent_at`,
  `unsubscribed_at`, plus an `(organization_id, unsubscribed_at)` index — every broadcast asks that
  exact question.
  Nullable is the point: `null` = nobody ever asked, which is a different fact from "asked and said no".
  Backfilling everyone to `true` would invent consent; to `false` would claim they refused.
- `Customer::scopeMarketingReachable()` — **the single place suppression is expressed**.
- `BroadcastController::resolveAudience` applies it on the **base query** (so `all`/`lost`/`new`/
  `one_time`/`regulars` inherit it, and so does whatever preset someone adds next) **and** to segment
  members, which is a hand-picked list and therefore exactly where an opt-out gets missed.
- `audience-preview` now also returns `suppressedCount`.
- `ConsentController`: `GET /me/consent`, `POST /me/consent`, `POST /me/unsubscribe`, `POST /me/resubscribe`.
  **No id in any route**, so one customer cannot touch another's consent. Staff deliberately have no
  endpoint to set it for someone — consent a third party ticked is not consent.

### The thing that made this urgent
The customer app's **"แจ้งเตือนโปรโมชั่น" switch was `useState(true)`** — a marketing opt-out wired to
nothing. It rendered, it flipped, it opted nobody out. That is worse than not offering one, and it is
what a regulator would be shown. It now reads and writes the real endpoint, and the copy says what is
still sent ("การแจ้งเตือนเรื่องการจองของคุณยังส่งตามปกติ"). The neighbouring "การแจ้งเตือนการจอง" toggle
was equally fake and was removed rather than left as a second dead switch.

### WP2 — permission-gate the CRM
- New codes: `crm.view`, `crm.manage`, `segment.manage`, `broadcast.send` (in `RolePermissions`, the one
  definition the migration and seeder share).
- Gated: `crm/overview`, `segments*`, `timeline`, `broadcasts*` (incl. send/store/update/delete),
  `memberships` + points, and `GET /customers` — the list was ungated while the detail was gated.
- Migration `grant_crm_permissions` grants them to existing roles. Without it, gating would have taken
  the CRM away from every role except the venue's owner. reception/viewer/accountant get `crm.view` only:
  reading the customer list is front-desk work, firing a marketing blast is not.

### Owner-facing
- Customer detail: read-only consent badge with **three** states — ยินยอม / ขอไม่รับ / ยังไม่ได้ถาม.
- Broadcast audience step: "ไม่รวมลูกค้า N คนที่ขอไม่รับข่าวโปรโมชั่น", so a shrinking audience reads as
  the law working rather than as a broken filter.

## State at end
🟢 **Local green.** backend **260/260** (+14) · tsc clean · vitest 24/24 · lint **13 errors** (= baseline)
· e2e **37/38** (the 1 is the long-standing `admin.spec.ts` "MRR" locator bug).

Verified live, not just unit-tested: tapped the toggle in the customer app → server returned
`marketingAllowed:false` → survived a reload → the owner's audience preview dropped by one and showed the
suppression note.

**Not committed yet.**

## Decisions to surface

**Suppression is opt-OUT, not opt-IN.** The roadmap specified filtering on `unsubscribed_at`, which is
what shipped: customers who were never asked still receive marketing. Strict PDPA marketing is opt-in,
which would silence every existing customer overnight until they consent. That is a business decision,
not a code one — `marketing_consent` is recorded and indexed so flipping to opt-in later is a one-line
scope change (`->where('marketing_consent', true)`).

## Next step
1. **WP1's remaining half: data-subject export + delete.** Not built.
2. WP3 — persist broadcast delivery (`broadcast_recipients`, `sent_by`, `delivery_stats`); the transient
   `delivery` block is still thrown away.
3. Two migrations added here join the pile that has **never run on production** (deploy still blocked on
   `DEPLOY_PATH`).
