---
date: 2026-06-13 22:10
agent: Claude Opus 4.8 (1M context) in Claude Code
branch: main
task: Owner CRM domain (segments/timeline/broadcasts) + owner mutations (staff invite, points adjust, wallet topup)
status: done
---

# Owner CRM domain + owner section mutations

## Goal
Build the last owner placeholder (CRM) as real endpoints, and add write mutations
to the previously read-only owner Staff/Membership/Wallet sections. All org-scoped
via the `owner.org` middleware. Backend only (no frontend, no git push).

## What was done
PART 1 — CRM domain:
- Migration `database/migrations/2026_06_13_160000_create_crm_tables.php`:
  `customer_segments` (uuid, soft del), `customer_segment_members` (uuid pivot),
  `customer_timeline` (uuid), `broadcasts` (uuid, soft del). All `organization_id` FK cascade.
- Models: `app/Models/CustomerSegment.php` (belongsToMany members using pivot),
  `CustomerSegmentMember.php` (uuid Pivot, like PlanFeature),
  `CustomerTimelineEntry.php` (table `customer_timeline`), `Broadcast.php`.
- Resources: `OwnerSegmentResource` {id,name,description,memberCount},
  `OwnerTimelineResource` {id,type,title,description,occurredAt},
  `OwnerBroadcastResource` {id,title,message,channel,status,recipientCount,sentAt,segmentName}.
- Controllers (Api/Owner): `CrmController@overview` (unwrapped JSON),
  `SegmentController` (index/store/destroy), `TimelineController@show` (404 cross-org customer),
  `BroadcastController` (index/store/send).

PART 2 — mutations (extended existing controllers):
- `StaffController@store` POST /owner/staff — create User (random pw) + organization_users row;
  422 if email already a member of THIS org; reuses an existing User row for the email if present.
- `MembershipController@adjustPoints` POST /owner/memberships/{id}/points — points = max(0, points+delta), org-scoped 404.
- `WalletController@topup` POST /owner/wallets/{id}/topup — balance += amount (validate gt:0),
  +amount wallet_transactions row (label default "เติมเงินโดยแอดมิน", txn_date = Thai short date), returns new transactionCount.

- Routes added to the `/owner` group in `routes/api.php` (+ 5 imports).
- Seeder `database/seeders/SanamSpaceSeeder.php`: new `seedEverydayCrm()` — 3 segments
  (VIP, "ไม่เคลื่อนไหว 30 วัน", "สมาชิกใหม่"), demo customer attached to VIP, 4 timeline entries
  (signup/booking/payment/points), 2 broadcasts (1 sent rc=1, 1 draft).
- Tests: `tests/Feature/OwnerCrmApiTest.php` (11) + `tests/Feature/OwnerMutationsApiTest.php` (8).

## Decisions / assumptions (commented in CrmController)
- vipCount = members of segment named "VIP" (segment-based; lines up with segmentDistribution + seed).
- inactive30d = customers with NO booking dated in the last 30 days (real bookings.date check, not visits proxy).
- Wallet `txn_date` is a pre-formatted Thai short date string (column's existing purpose); topup formats today the same way.
- Membership `note` accepted but NOT persisted (no points-ledger table yet).

## Current state — VERIFIED this session
- `php artisan migrate:fresh --seed` clean (new CRM migration runs, seeder OK).
- `php artisan test` → 65 passed / 517 assertions (was 48; +17). Full suite green.
- Live curl on :8011 (server started + killed): CRM overview {total1,new1,inactive1,vip1,3 segments};
  segments list 3, create→delete→3; broadcasts 2; create draft→send→status sent + recipientCount 1;
  timeline 4 newest-first (points→payment→booking→signup); staff invite→created (Manager,active),
  dup→422; points 820→870; topup balance 580→780 + transactionCount 3→4; customer token→403 on
  crm/segments/topup. Server killed, no lingering serve procs.

## Next step
- Owner CRM is now REAL (no owner placeholders left on backend). Optional: frontend CRM page
  to consume these endpoints; LINE LIFF real; payment gateway; payment-verify role restriction.

## For the next agent
- `users.id` is bigint auto-increment (NOT uuid); `organization_users.user_id` is bigint — staff invite relies on this.
- Owner endpoints: org id via `$request->attributes->get('currentOrganizationId')`, scope with `forOrganization($orgId)`.
- Resources auto-wrap in `{data}`; counts are int-cast. In tests, whole-number float balances JSON-encode
  without `.0`, so assert balance via a closure (`fn($v)=>(float)$v===...`) not a strict float literal.
- Between two requests reusing the same bearer token in a test, call `$this->app['auth']->forgetGuards()`.
