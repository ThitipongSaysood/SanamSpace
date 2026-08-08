# CRM roadmap — to standard / PDPA

Reviewed 2026-08-07. The current CRM is MVP-level: static segments (the `customer_segments.criteria` JSON is
unused), timeline written only by the seeder (real bookings/payments never append), broadcasts persist only
`recipient_count`, **no consent/PDPA layer at all**, no CRM permission gating, customers read-only with no
tags/lifecycle/source/notes/consent.

Work packages, split so they can be handed to parallel coding agents. Anything touching `Customer` model,
migrations, `RolePermissions.php`, `routes/api.php`, or `NotificationService` is **co-owned** → note it in
`active.md → Shared changes`. Every WP needs tests; WP1/WP3 are compliance/money paths.

## PHASE 0 — Compliance & correctness (do first)
- **WP1 — PDPA consent + opt-out + suppression** `[L]` (Owner + App) — ✅ **DONE 2026-08-08**, except
  data-subject export/delete (see below). Migration added `marketing_consent` (**nullable** — null means
  nobody ever asked, which is not "said no"), `consent_at`, `unsubscribed_at`.
  `Customer::scopeMarketingReachable()` is the single place suppression is expressed, applied on the base
  query in `resolveAudience` **and** to segment members, so a new audience preset inherits it instead of
  having to remember. The customer app's "แจ้งเตือนโปรโมชั่น" switch was `useState(true)` wired to nothing
  — now `GET/POST /me/consent`, `POST /me/unsubscribe|resubscribe`. Owner sees a read-only consent badge on
  the customer detail and a "ไม่รวมลูกค้า N คน" note on the broadcast audience step.
  **Still open:** data-subject export + delete (the roadmap's other WP1 half).
  **Open decision:** suppression is opt-**out** (`unsubscribed_at`). Strict PDPA marketing is opt-**in**,
  which would silence every pre-existing customer until they consent — a business call, not a code one.
- **WP2 — Permission-gate the CRM** `[S]` (Owner) — ✅ **DONE 2026-08-08**. Added `crm.view`, `crm.manage`,
  `segment.manage`, `broadcast.send`; gated crm/overview, segments*, broadcasts*, timeline,
  memberships(+points) and `GET /customers`. A migration grants them to existing roles, or gating would
  have taken the CRM away from everyone but the owner. reception/viewer/accountant get `crm.view` only —
  reading is front-desk work, sending marketing is not.
- **WP3 — Persist broadcast delivery + audit** `[M]` (Owner). New `broadcast_recipients` table +
  `broadcasts.sent_by` / `delivery_stats`. Stop throwing away the transient `delivery`.

## PHASE 1 — Core CRM value
- **WP4 — Auto-write timeline from real events** `[M]` (App + Owner) — Observers/listeners on booking,
  payment, points, checkin, broadcast → `CustomerTimelineEntry` (stop relying on the seeder).
- **WP5 — Dynamic segments + RFM** `[L]` (Owner) — use `customer_segments.criteria`; rule builder;
  add/remove-member endpoints; compute RFM per customer.
- **WP6 — Customer notes + follow-up tasks** `[M]` (Owner) — `customer_notes`, `customer_tasks`; surface on
  the customer detail page (the `timeline.type = 'note'` value already exists, unused).
- **WP7 — Broadcast analytics (delivered/read + attribution)** `[M]` (Owner + App) — LINE webhook; rebooked-
  after-promo. Depends on WP3.

## PHASE 2 — Enrichment
- **WP8** enrich Customer (lifecycle stage, tags, source, assigned staff, last_contacted, birthday) `[L]`.
- **WP9** overview analytics: churn, retention, LTV/CLV, cohort (replaces the 4 counts) `[M]`.
- **WP10** data quality: dedup, verify email/phone, flag unreachable customers `[M]`.
- **WP11** consolidate UI: the `/owner/crm` broadcast tab is stale (no `app` channel, no image, no presets)
  vs the new `/owner/broadcast` — point it at the new page `[S]`.

## Sequencing for parallel agents
1. One agent lands ALL migrations (WP1/3/6/8) in a single batch first → note in `active.md`.
2. Round 1 (parallel): WP1 · WP2 · WP4.  Round 2: WP3 · WP5 · WP6.  Round 3: WP7 (needs WP3) · WP9 · WP11.
   Round 4: WP8 · WP10.

Baseline to hold: backend green · tsc clean · vitest · lint ≤ 13.
