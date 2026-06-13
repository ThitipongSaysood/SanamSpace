---
date: 2026-06-13
agent: Claude (Claude Code)
branch: main
task: Owner Portal sections (settings/promotions/staff/membership/wallet) + restyle
status: done
---

# Owner Portal sections — real pages + restyle

## What was done
- backend (commit a166d62, 48 tests): 10 owner endpoints — GET/PUT /owner/settings, /owner/promotions CRUD,
  GET /owner/staff + /owner/roles, GET /owner/memberships, GET /owner/wallets (org-scoped via owner.org, reuse existing models/seed)
- frontend (commit fb17260): replaced 5 placeholders with REAL pages (Settings edit form, Promotions CRUD,
  Staff+Roles, Membership list, Wallet list) + ownerApi methods/types; restyled bookings/courts/customers/payments
  headers to the new shell (text-2xl + subtitle + space-y-5). CRM still placeholder (needs new models).
- Verify: backend 48 tests; frontend tsc/build/22 vitest; owner e2e real pass; all 5 section endpoints 200.

## Owner Portal status now
13-menu shell + dashboard (recharts) + Operations + Reports + Bookings + Courts + Customers + Payments
+ Settings + Promotions + Staff + Membership + Wallet = REAL. Only **CRM** = placeholder (needs segments/timeline/broadcast models).

## Next step
- CRM: add segments/timeline/broadcast models + endpoints + page (the only owner placeholder left)
- Staff/Membership/Wallet currently read-only owner views — add mutations (invite staff, adjust points, wallet topup) if needed
- LINE LIFF real, payment gateway, payment verify role restriction
- Customer remaining real (done); 3 portals live: / (customer), /owner (owner@everyday.test/password), /admin (super@sanamspace.test/password)

## For the next agent
- owner section endpoints follow owner.org pattern; resources in app/Http/Resources/Owner*
- owner frontend client = lib/api/owner.ts (token key sanamspace.owner_token); pages in app/owner/*
- real mode: backend serve + frontend .env.local; real e2e: E2E_OWNER=1 npx playwright test
