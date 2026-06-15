# Session: Per-venue LINE config — 3-agent parallel build

_2026-06-15 ~11:55_

## Goal
Make LINE channel/LIFF/messaging configurable **per venue (per-org) via DB + admin UI** instead of a
single global `.env`. User decisions: managed by **both** (Owner self-service + Super-Admin override);
store the **full** set (Login channel + LIFF + Messaging). Demonstrate the 3 custom agents working
together.

## Check findings (before building)
- Two existing config patterns: per-org `organization_settings` (PromptPay/bank precedent, `line_oa_url`
  already there) and platform-level `platform_settings` (encrypted `mail_password` via
  `PlatformConfigServiceProvider`). → per-venue LINE fits `organization_settings` exactly.
- Frontend is **single-tenant per deploy** (`config/tenant.ts`, white-label) → per-venue login is coherent.
- Owner has `GET/PUT /owner/settings` CRUD; Admin had no per-org settings update endpoint (added one).

## Approach
Orchestrator laid the **shared foundation** first (so 3 agents never touch the same file), then fanned
out 3 parallel agents (spawned as general-purpose — custom `.claude/agents/*` types aren't registered as
`subagent_type`; role/zone embedded in each prompt + pointer to their agent def).

### Foundation (orchestrator)
- `migrations/2026_06_15_140000_add_line_to_organization_settings.php` — `line_channel_id`,
  `line_channel_secret`, `line_liff_id`, `line_messaging_token`.
- `OrganizationSetting` — `casts`: the two secrets `encrypted`.
- `routes/api.php` — pre-registered `GET /line-config` (App) + `PUT /admin/organizations/{id}/settings` (Admin).
- `lib/types.ts` — `OwnerSettings` + `AdminOrganizationDetail.settings` got `lineChannelId`/`lineLiffId`/
  `lineChannelSecretSet`/`lineMessagingTokenSet`; new `LineConfig = { liffId }`.
- Contract: secrets WRITE-ONLY (return `*Set` bool only); resolution = org settings first → `.env` fallback.

### Agent results (each ran its own isolated backend test)
- **App** — `LineTokenVerifier` per-org; `lineLogin` resolves org before verify; `lineConfig` endpoint;
  frontend `getLineConfig()` + runtime LIFF id (`NEXT_PUBLIC_LIFF_ID || config.liffId`). AuthLineLoginTest 7/7.
- **Owner** — `/owner/settings` validates+saves LINE (secrets `filled()`-guarded, blank≠wipe); resource
  masks secrets; owner settings "การเชื่อมต่อ" tab LINE form. OwnerLineSettingsTest 4/4.
- **Admin** — `OrganizationController@updateSettings` override; detail resource masks; org drawer "LINE" tab;
  `superAdminApi.updateOrganizationSettings`. AdminLineSettingsTest 3/3.

## State at end — GREEN (integrated, run by orchestrator)
- backend **101/101** (92 → +2 App +4 Owner +3 Admin) · tsc **clean** · vitest **23/23**.
- No agent touched shared files; integrated on first try.

## To go LIVE (per venue)
Owner (or super-admin) fills LINE Channel ID / Channel Secret / LIFF ID / Messaging Token in settings UI.
Backend verifies that org's channel; frontend reads that org's LIFF id from `GET /line-config`. Global
`.env` `services.line.*` remains the fallback. No rebuild needed to change a venue's LIFF id at runtime.

## Open follow-ups
- `lineConfig`/`lineLogin` resolve org by `?organizationSlug`/default only — `venueId` not wired
  (extend shared `resolveOrganization`).
- `messaging_token` stored/managed but not yet USED (no push-messaging feature).
- Frontend LINE UIs compile-verified (tsc) but no component tests / not visually run.
- Refund scaffold still parked (migration + model, not wired).

## Next step
- Visually run owner/admin LINE settings + (with real credentials) test per-venue login end-to-end.
- Or resume refund flow (next-step #2).
