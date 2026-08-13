# Session 2026-08-13 14:20 — membership matte sport card

## Goal
Update the customer app membership screen so the main membership card follows the provided Matte Stealth UI
and shows the venue's own sport icon, e.g. a badminton venue shows badminton.

## What changed
- Modified `frontend/app/v/[slug]/(app)/membership/page.tsx`.
- Replaced the old amber gradient membership card with a `MembershipStealthCard` component in the same file.
- The card now chooses the sport badge from `tenant.sportMeta`, preferring `tenant.sport`, then the first
  venue sport, then the first available sport metadata row.
- Kept the existing points-disabled, loading, error, rewards, pending redemptions, history, and auto-earn
  sections unchanged.
- Did not touch the existing local changes in `frontend/lib/i18n/messages/th.ts`,
  `frontend/lib/i18n/messages/en.ts`, or `frontend/app/owner/pos/page.tsx`.

## Verification
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx eslint 'app/v/[slug]/(app)/membership/page.tsx'` — clean.

## State at end
Local-only UI change is implemented and type/lint verified. No browser visual smoke was run in this round.

## Next step
Open `/v/{slug}/membership` on a seeded venue with points enabled and check the matte card visually on mobile.
