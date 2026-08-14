# Session 2026-08-14 16:40 — LINE-only login/profile, broadcast unsubscribe, LINE onboarding doc

## Goal
Follow-on work after the earlier close-out (`8850c39`), driven by the user tightening the customer app
around **LINE-only sign-in** and wiring the already-live PDPA unsubscribe endpoints:
1. Wire the one-tap **unsubscribe** flow into LINE broadcasts + a customer opt-out page.
2. Make the customer surface honest about LINE-only login (profile + login page).
3. Advise on multi-tenant LINE architecture and write a per-venue **onboarding checklist**.

## What changed
**4 commits `8850c39`→`46ed47c`, pushed to `main`.**

- `feat(pdpa)` **bb4aef9** — every LINE broadcast now appends a "ยกเลิกรับข่าวสาร" link to
  `/v/{slug}/unsubscribe` (built from `services.line.customer_app_url` + org slug; silent no-op when
  unset, so dev still sends). New customer page `app/v/[slug]/(app)/unsubscribe/page.tsx` opts out on
  arrival (one tap, no confirm) with a resubscribe button. `api.unsubscribe/resubscribe` added to the
  customer client (http + mock + the `Api` type) + bilingual `app.unsubscribe` copy. Footer built in
  `BroadcastController::withUnsubscribeFooter()`; `BroadcastDeliveryTest` asserts the pushed LINE payload
  carries the link.
- `feat(app)` **5c29e96** — profile info page trimmed to LINE-only fields: dropped the email row (it showed
  a mock `example@email.com`) and the duplicate full-name row (the header card already shows the LINE
  display name). Editing is now just the phone. Removed unused `profileInfo` i18n keys
  (errName/errEmail/fullName/email).
- `feat(app)` **8946497** — the venue login page (`app/v/[slug]/page.tsx`) is LINE-only: removed the
  disabled phone/email login buttons and the dead "สมัครสมาชิก" link (they promised methods that don't
  exist). Kept the LINE button + demo fallback.
- `docs(line)` **46ed47c** — `docs/line-onboarding.md`: per-venue LINE setup checklist (provider → OA +
  Login/LIFF channels → LIFF endpoint `/v/{slug}` → paste 4 values → test) + troubleshooting.

## Key architectural advice given (no code change — the system already does this)
Customer data is isolated per venue by design: **Customer is keyed `(organization_id, line_user_id)`**, so
the same LINE person at two venues is two separate records. Each venue configures its **own** LINE Login
channel + LIFF + Messaging OA in `organization_settings` (`line_channel_id/secret`, `line_liff_id`,
`line_messaging_token`; secrets encrypted). `LineTokenVerifier` verifies the id_token against the org's
channel and checks `aud`. **The decisive rule for onboarding:** a venue's Login channel and Messaging OA
must live in the **same LINE Provider**, because LINE `userId` is provider-scoped — a shared login channel
with per-venue OAs would log customers in but silently fail to deliver that OA's broadcasts. Documented in
`docs/line-onboarding.md`.

## Verification
- `cd backend && php artisan test` — **696/696** (added the broadcast-footer test).
- `cd frontend && npx vitest run` — **44/44**. tsc + eslint clean.

## State at end
**Done and pushed.** `main` synced with origin at `46ed47c`. Working tree clean.

## Next step
- Optional: surface the 4 LINE fields nicely on the owner settings screen (there is a validated endpoint
  already — `Owner/SettingController` + `Admin/OrganizationController`); check the UI makes all four easy
  to fill per `docs/line-onboarding.md`.
- Unsubscribe deep-link caveat: a logged-OUT tap lands on the (app) guard → redirect to `/` (venue login);
  LINE users authenticate via the normal LIFF flow. Fully seamless one-tap for logged-out users would want
  the login redirect to preserve the return path — a small follow-up if it matters.
- Still open from before: P3 launch/ops (baseline API throttle, CI, Sentry, monitoring, backup verify),
  cross-portal Playwright E2E.
- If MySQL prod hasn't run these: no migrations this batch, but run `migrate + test` on MySQL before
  release per the standing rule.
