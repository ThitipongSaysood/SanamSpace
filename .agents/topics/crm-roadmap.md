# CRM roadmap — to standard / PDPA

Reviewed 2026-08-07. The current CRM is MVP-level: static segments (the `customer_segments.criteria` JSON is
unused), timeline written only by the seeder (real bookings/payments never append), broadcasts persist only
`recipient_count`, **no consent/PDPA layer at all**, no CRM permission gating, customers read-only with no
tags/lifecycle/source/notes/consent.

Work packages, split so they can be handed to parallel coding agents. Anything touching `Customer` model,
migrations, `RolePermissions.php`, `routes/api.php`, or `NotificationService` is **co-owned** → note it in
`active.md → Shared changes`. Every WP needs tests; WP1/WP3 are compliance/money paths.

## PHASE 0 — Compliance & correctness (do first)
- **WP1 — PDPA consent + opt-out + suppression** `[L]` (Owner + App). Migration: `customers.marketing_consent`,
  `consent_at`, `unsubscribed_at`. `BroadcastController::resolveAudience` must filter out `unsubscribed_at`
  on every audience. App: `POST /me/unsubscribe` + `/me/consent`, customer-facing unsubscribe UI, data-subject
  export/delete. **Biggest gap — legal risk** (marketing with no consent/opt-out).
- **WP2 — Permission-gate the CRM** `[S]` (Owner). Add `crm.view`, `segment.manage`, `broadcast.send` to
  `RolePermissions.php`; put `permission:` on crm/overview, segments*, broadcasts* (esp. send/store/delete),
  memberships/points, and `GET /customers` (list currently ungated while detail is gated).
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
