# Session: Per-venue (multi-tenant) login — Path scheme, Phase 1

_2026-06-17 ~11:36_

## Goal
Separate the customer login per venue/tenant on the ONE live domain so each venue has its own branded
login that uses its own LINE channel. User chose **Path scheme** (`/v/{slug}`) after I recommended it
(zero infra change vs subdomain's wildcard DNS/cert). Done solo by orchestrator (cohesive App-zone work;
parallelism offered little). **Tested locally, NOT pushed** (site is live on prod).

## What was built (Phase 1)
**Backend**
- `app/Http/Controllers/Api/OrganizationPublicController@show` + route `GET /orgs/{slug}/public` — public,
  unauthenticated per-venue branding: `{ slug, name, logoText, logoUrl, liffId, theme:{primary,warning,danger},
  lineOaUrl, phone }`. Resolves by slug → 404 if unknown. NEVER exposes secrets (channel_secret/messaging_token).
- `tests/Feature/OrgPublicTest.php` 3/3 (shape, secrets-never-leak, 404).

**Frontend**
- `lib/types.ts` — `OrgPublic` type; `lib/api` — `getOrgPublic(slug)` (mock+http) + `getLineConfig(slug?)` now
  takes a slug; `LinePayload` gained `organizationSlug`.
- `lib/tenant/tenant-context.tsx` (NEW) — `TenantProvider`/`useTenant`. Resolves runtime branding; persists the
  active venue (`sanamspace.venue`); applies theme by overriding the `--brand-*` CSS vars on `<body>` → the whole
  app re-themes to the venue's colours automatically (no per-component change for colours). Wired into `providers.tsx`.
- `app/v/[slug]/page.tsx` (NEW) — branded login: fetches `getOrgPublic(slug)`, themes via `setVenue`, logs in via
  `login(slug)`; 404 state; LINE-redirect resume spinner; per-org "demo" note keyed on `org.liffId`.
- `lib/auth/auth-context.tsx` — `login(slug?)` + `completeLineResume()` are now slug-aware: derive the slug from
  the `/v/{slug}` path (LINE redirects back here) else the persisted slug; thread `organizationSlug` to
  `getLineConfig`/`lineLogin`; remember the active venue.
- `app/(auth)/login/page.tsx` — removed the misleading env-based "* เดโม่ ..." note (showed on prod even though
  login works; `isLiffEnabled()` only checks the build env, but prod uses the runtime LIFF id).

## State — GREEN (local)
backend **122/122** (119 + 3) · tsc **clean** · vitest **23/23**. Not run in the browser yet; not pushed.

## How it works (usage)
- Each venue's login = `https://sanam.semitennis.com/v/{slug}` (e.g. `/v/everyday-badminton`).
- ⚠️ **Manual step per venue**: the venue's LIFF **Endpoint URL** in the LINE Developers console MUST equal that
  `/v/{slug}` URL (LINE redirects back there). Otherwise the redirect lands on the wrong page.

## Deferred / follow-ups
- **Token is single** (one active venue session; switching venues = re-login overwrites). Phase 2: namespace the
  token by slug for simultaneous multi-venue sessions.
- **App-shell text** (`components/brand-logo.tsx`, app header, contact/venue pages) still uses the static
  `config/tenant.ts` name — COLOURS re-theme per venue via CSS vars, but the header *text* stays default.
  Converting brand-logo to `useTenant()` needs it to be a client component (check server-component usages first).
- **Admin convenience**: show each venue's login URL (`/v/{slug}`) in the admin org drawer so staff can copy it
  into the LINE console. (Owner/Admin zones untouched this session.)
- `/login` (no slug) still works → default org.

## Next step
- Run it in the browser locally (verify `/v/{slug}` renders branded + theme applies) before any push.
- Then decide: push to prod (triggers deploy), Phase 2 (per-slug token + full shell branding), or Admin URL display.
