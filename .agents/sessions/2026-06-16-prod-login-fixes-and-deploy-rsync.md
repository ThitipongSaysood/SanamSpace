# Session: prod LINE login fixes + deploy pipeline → rsync (2026-06-16)

**Context:** Site is now LIVE at https://sanam.semitennis.com (public). This session was
all production debugging of the real customer (LINE) login flow, then speeding up the
deploy pipeline. No multi-agent work — direct fixes.

## What was done (commits a5e5679-era → 33a84ad)

### 1. LINE login bounced back to /login — `1a90f27`
After `liff.login()` redirected to LINE and back to `/login?code&state`, nothing completed
the token exchange → user stuck on /login. Added a **silent resume**:
- `frontend/lib/auth/liff.ts`: `resumeLineIdToken()` (init + read id_token, never redirects) +
  `isReturningFromLineLogin()` (detects `?code&state` / `liffClientId`).
- `auth-context.tsx`: on load, if returning from LINE, complete login silently then strip the
  params from the URL.
- `(auth)/login/page.tsx`: redirect to `/` once authed; spinner while resuming.

### 2. customer login 500 "Data truncated for tokenable_id" — `968204c`
`Customer` uses `HasUuids` but Sanctum's `morphs('tokenable')` made
`personal_access_tokens.tokenable_id` a BIGINT → inserting a UUID on **MySQL** failed (SQLite
ignores types, so dev/tests never caught it). Migration
`2026_06_16_130000_widen_personal_access_tokens_tokenable_id` ALTERs it to `CHAR(36)`
(MySQL/MariaDB only; no-op on sqlite). Found via a temp diagnostic that surfaced the real
exception in the response (added then removed in `a5e5679`).

### 3. GET /membership 404 — `fd9856d`
`MembershipController@show` did `firstOrFail()` → a fresh LINE customer (no membership row) got
404 and the home screen broke. Now `firstOrCreate` a default **Silver** membership (member id
`SM-000000N`, expiry one year out as a Thai date).

### 4. Show real images — `20e5edd` (venue photos) + `380989c` (LINE avatar)
The customer UI ignored available image data and always showed placeholders:
- `components/venue-media.tsx` (`VenueMedia`): renders `venue.imageUrl` (owner-uploaded photo)
  with graceful fallback to the branded `SportMedia` placeholder on missing/broken image. Wired
  into `venue-card.tsx` + venue detail cover.
- `components/avatar.tsx` (`Avatar`): renders the customer's LINE photo (`avatarUrl`, already
  returned by `UserResource`) with initial fallback. Wired into home header + profile page.
- Uses plain `<img>` + `referrerPolicy="no-referrer"` (no `next/image` remote-domain config).

### 5. Deploy pipeline sped up — `c7f6d63` → `592f603` → `ca62a9e` → `33a84ad`
Evolution this session:
- `c7f6d63`: **incremental** (dorny/paths-filter decides FE/BE; build only the changed side on
  the runner, scp it up). Known-good.
- `592f603`: tried a **pull-model** (single SSH → `git pull` + build on server). **FAILED** at the
  SSH step in ~8s — server not actually set up to build (git auth / Node / PATH). Reverted in
  `ca62a9e`.
- `33a84ad` (current): keep runner build, but **ship with rsync + ssh via `sshpass`** (reuse
  `SERVER_PASSWORD`) instead of the appleboy scp/ssh Docker actions. rsync = delta transfer
  (only changed files); dropping the Docker actions removes ~10-30s/run. Backend rsync excludes
  `.env` + `storage/`. **Green.** See memory `sanamspace-deploy-model`.

## State at end
- ✅ Prod login works (LINE), membership/avatar/images all live, deploys green via rsync.
- Expected deploy times now: backend-only ~20s, frontend ~60-65s, both/workflow-change ~2min.
- Tests: backend auth 11/11 + membership 7/7 green; frontend tsc clean + vitest 23/23.

## Next / backlog
- LINE profile photo only appears for customers whose channel grants the `picture` claim; old
  customers get the avatar on their next login.
- `line_channel_id` per org must equal the LIFF's owning channel or verify fails (422) — see
  memory `sanamspace-line-login`.
- Untouched backlog from prior sessions: owner staff edit/delete, customer detail page, peak
  pricing; landing polish (move to `/`, lead-form backend, public GET /plans).
