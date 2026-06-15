# Session: LINE LIFF real login (env-gated) — App zone

_2026-06-15 ~11:22_

## Goal
Make customer LINE login real (was mocked) — next-step #1 in active.md. User chose:
"ทำจริงทั้ง backend+frontend (env-gated)" + "ยังไม่มี credentials — build เผื่อไว้".
Also: check API + DB state first.

## Check findings (before building)
- **DB ✅ ready, no change**: `customers` has `line_user_id` (indexed w/ org), `display_name`,
  `picture_url`, `email`, `phone`; `line_profiles` snapshot table both already exist
  (both created inside `2026_06_13_120005_create_customers_table.php`).
- **API ⚠️ stub + security hole**: `AuthController::lineLogin` trusted the client-supplied
  `lineUserId` with no verification (anyone could mint a token for any customer).
  `config/services.php` had no `line` key.
- **Frontend ⚠️ mock**: no `@line/liff`, hardcoded `LINE_PAYLOAD`, no `liff.init`, and a
  **refresh bug** — `(app)/layout.tsx` redirected to `/login` on every reload because the
  session was never rehydrated from the stored token.

## What was done (App zone)
Backend:
- `config/services.php` — added `line` block (channel_id/secret/messaging_token/verify_url).
- `app/Services/LineTokenVerifier.php` (NEW) — verifies LIFF id_token via LINE
  `oauth2/v2.1/verify`, checks `aud == channel_id`, returns trusted sub/name/picture/email.
- `app/Http/Controllers/Api/AuthController.php` — `lineLogin` now: if a channel is configured
  → REQUIRE & verify `idToken` (trust the verified `sub`); else → dev/test stub (unchanged,
  trusts `lineUserId`/`code`). Backward compatible with existing tests.
- `tests/Feature/AuthLineLoginTest.php` (NEW) — 5 tests: fallback login, real requires idToken,
  verified login, wrong-audience reject, failed-verify reject (Http::fake).

Frontend:
- `lib/auth/liff.ts` (NEW) — `isLiffEnabled()` / `getLineIdToken()` (dynamic import @line/liff).
- `lib/api/mock.ts` + `lib/api/http.ts` — added `me()` to the Api; `idToken` added to `LinePayload`.
- `lib/auth/auth-context.tsx` — real LIFF login when `NEXT_PUBLIC_LIFF_ID` set (else stub);
  **session rehydrate on mount** via `api.me()`; new `ready` flag.
- `app/(app)/layout.tsx` — gate redirect on `ready` (fixes refresh bug).
- `app/(auth)/login/page.tsx` — hide the "เดโม่" note when LIFF is enabled.
- `lib/auth/auth-context.test.tsx` — added a rehydrate test (refresh stays logged in).
- env docs: `frontend/.env.production.example` (NEXT_PUBLIC_LIFF_ID), `backend/.env.example` (LINE_*).
- `@line/liff ^2.29.0` added to package.json.

## Env setup done this session (fresh checkout)
- `backend/vendor` was missing → ran `composer install`.
- `backend/.env` was missing → `cp .env.example .env` + `php artisan key:generate`
  (this is why ExampleTest first failed with "No application encryption key").
- `npm install @line/liff` in frontend.

## State at end — GREEN
- backend **92/92** (87 + 5 new) · tsc **clean** · vitest **23/23** (22 + 1 new).

## To go LIVE (needs user's LINE credentials)
1. Backend `.env`: `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET` (from a LINE Login channel).
2. Frontend build env: `NEXT_PUBLIC_LIFF_ID` (LIFF app under that channel) + `NEXT_PUBLIC_API_URL`.
3. Rebuild frontend (NEXT_PUBLIC_* is inlined at build time).
Until then everything runs in dev/mock/stub mode (tests + local dev unaffected).

## Parked
Refund-flow demo (3-agent) was started then superseded by this task. Left as inert scaffold:
`database/migrations/2026_06_15_100000_create_refunds_table.php` + `app/Models/Refund.php`.
Not wired (no routes/controllers). Migration runs cleanly (tests pass). Head-start for
next-step #2 (refund) — keep or delete as desired.

## Next step
- Get LINE credentials → flip env → end-to-end test real login on a device.
- Then resume refund flow (Owner approve → wallet credit, Admin oversight, App status).
