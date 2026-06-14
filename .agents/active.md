# Active Task

_Last updated: 2026-06-13 (deploy pipeline live)_

## Project type (auto-detected)

Next.js 16 (frontend/: customer + owner + super-admin portals) + Laravel 13 (backend/ /api/v1) + database/schema.sql (123 ตาราง) + docs

## Current goal

**Deploy pipeline LIVE** — push to `main` → GitHub Actions builds + ships to the real server → migrate + restart. First green run done (workflow commit 1759aa1). App deployed at `/var/www/html/sanamspace`, served same-origin via NEW vhost `sanam.semitennis.com`.

Server = **readyidc**: ssh.semitennis.com = **157.85.97.241**, Debian 12, root (password). **Shared box with OTHER live projects — do NOT touch `backend.semitennis.com`/`admin`/`mysql`/`default` vhosts.** nginx+php8.4-fpm(Sury)+MariaDB+Node24. Secrets set: SERVER_HOST/USER/PASSWORD + DEPLOY_PATH=/var/www/html/sanamspace.

**เหลือทำให้เปิดสาธารณะ:** (1) Cloudflare A record `sanam` → 157.85.97.241 (grey/DNS-only) (2) `certbot --nginx -d sanam.semitennis.com` (3) verify https. Full server state + gotchas: `sessions/2026-06-13-2330-deploy-pipeline-live-readyidc.md`.

Real-integration TODOs (unchanged): LINE LIFF, payment gateway, R2/S3 slips, rotate demo users.

## (prev goal)

Production deploy artifacts (Docker Compose + VPS guide; MySQL-verified; Next standalone) — see DEPLOYMENT.md.

## (prev goal)

Owner Portal ครบ 13/13 เมนูเป็นของจริงแล้ว (CRM + mutations เสร็จ). เหลือ integrations: LINE LIFF จริง, payment gateway, deploy MySQL.

## (prev goal)

Owner backend feature-complete. CRM domain (segments/timeline/broadcasts) + owner mutations (staff invite, membership points adjust, wallet topup) DONE and verified. No owner placeholders left on backend.

## What just happened

Built CRM: migration 2026_06_13_160000_create_crm_tables, models (CustomerSegment, CustomerSegmentMember pivot, CustomerTimelineEntry, Broadcast), resources (OwnerSegment/Timeline/Broadcast), controllers (Crm/Segment/Timeline/Broadcast), routes, seeder (3 segments + VIP membership + 4 timeline + 2 broadcasts). Added mutations to Staff/Membership/Wallet controllers. Tests: 65 pass (+17). Live curl on :8011 all green (incl. customer→403). See sessions/2026-06-13-2210-owner-crm-and-mutations.md.

## Assumptions (CRM overview, commented in CrmController)
- vipCount = members of segment named "VIP".
- inactive30d = customers with no booking dated in last 30 days (real bookings.date check).

## Blockers
none

## Next step
Optional: frontend CRM page consuming the new endpoints; LINE LIFF real; payment gateway; payment-verify role restriction.

## Run (real)
backend: cd backend && php artisan serve  (:8000)
frontend: cd frontend && npm run dev  (.env.local) →  / (ลูกค้า) · /owner (owner@everyday.test/password) · /admin (super@sanamspace.test/password)
real e2e: E2E_OWNER=1 npx playwright test
