# 2026-08-02 — The four reported portal gaps, closed

_Agent: Claude (Opus 5)_

The four items reported as missing in the earlier audit, built out:

1. admin สร้าง/ระงับ user ไม่ได้
2. แก้สิทธิ์ role ไม่ได้
3. owner ไม่มีหน้ารายละเอียดลูกค้ารายคน
4. ยกเลิก/ระงับ subscription ตรง ๆ ไม่ได้

## 1. Platform users: create + suspend

New `users.status` (`active` | `suspended`). The admin list already **displayed** a สถานะ column — it was
a hard-coded `'active'` for everyone, so deleting the account was the only way to remove access, which
also takes the person's name off every payment they approved.

`POST /admin/users` · `PUT /admin/users/{id}` · `POST /admin/users/{id}/suspend` · `.../activate`

- **Suspension deletes their Sanctum tokens.** Blocking the login alone would leave the session they are
  already holding working indefinitely — tested explicitly.
- The status check in `adminLogin` runs **after** the password check, so a wrong password and a suspended
  account are indistinguishable to someone guessing.
- Guards: cannot suspend yourself; cannot suspend the last active admin. Both are one-way doors.
- `PUT` leaves the password alone when the field is blank.

## 2. Role permissions — and making them mean something

**The discovery that reframed this one:** `grep` for anything reading `role_permissions` returned
**nothing**. Roles and permissions were tables, the admin screen counted them, and no middleware, policy,
or gate ever consulted them. Every staff member — Viewer, Cashier, Owner — could do exactly the same
things. Shipping a permission editor on top of that would have been an elaborate no-op.

So the feature is the editor **plus** the enforcement:

- `EnsurePermission` middleware, aliased as `permission:`, on **30 owner write routes**
  (`court.manage`, `payment.verify`, `promotion.manage`, `staff.manage`, `settings.manage`, …).
- A 12-entry catalogue (was 5) and a default set per system role.
- **`owner` and `super_admin` bypass every check.** A venue must never be able to lock itself out of its
  own portal by editing a permission list. The role cards say "มีสิทธิ์ทั้งหมดเสมอ" and are disabled,
  rather than offering an editor whose save would be refused.
- `GET /admin/permissions` · `PUT /admin/roles/{id}/permissions` (full replace, so unchecking counts).
  Unknown ids are dropped rather than rejected — a stale tab should not fail a whole save.

**`app/Support/RolePermissions.php` holds the catalogue and the defaults once**, called by both the
migration (upgrades an existing database) and the seeder (builds a fresh one). The first draft duplicated
the list in the migration; that is exactly how two environments end up disagreeing about what a Cashier
may do.

## 3. Owner customer detail

`GET /owner/customers/{id}` → `/owner/customers/[id]`. Standing, wallet balance, membership tier and
points, and the **20 most recent** bookings (a "recent" list, not the whole history — the counter needs to
recognise a regular, not audit them). The list rows were previously a dead end; they are links now.

Another venue's customer id returns **404, not 403** — a 403 confirms the id exists.

## 4. Subscription: cancel vs suspend

Two genuinely different decisions, so two actions:

| | status | ends_at | owner portal |
| --- | --- | --- | --- |
| **ยกเลิก** | `cancelled` | untouched | keeps working until the date passes |
| **ระงับทันที** | `cancelled` | `now()` | locked immediately |
| **เปิดใช้อีกครั้ง** | `active` | future date | open again |

**The subtlety that makes this work:** `EnsureSubscriptionActive` reads `ends_at`, **not** `status`. So
setting a plan to `cancelled` alone changes nothing an owner would notice — suspend has to pull the date
to the present. And resume has to hand back a *future* date, or the action meant to let a venue back in
leaves them exactly as locked out as before. Both are asserted.

Customers keep booking in every case; only the owner portal locks.

## Gotchas worth keeping

- **`role_permissions.id` is an auto-increment bigint**, unlike the uuid tables it joins. Supplying a UUID
  there fails with SQLite's unhelpful `datatype mismatch`.
- **`permissions` has a uuid primary key with no database default**, so `updateOrInsert` leaves a blank id
  on insert. Check-then-insert with an explicit `Str::uuid()`.
- Adding permission enforcement risks locking out existing staff. It does not here because every seeded
  role got defaults and `owner` bypasses — but any *new* role starts with nothing and can do nothing.

## Verified

backend **206/206** (25 new) · tsc clean · vitest **24/24** · lint **13 = baseline**

New backend coverage:
- `AdminUserManagementTest` (7) — create → sign in · duplicate email rejected · suspend blocks sign-in and
  **revokes held tokens** · activate restores · cannot suspend self · cannot suspend the last admin ·
  blank password on edit leaves it alone.
- `RolePermissionTest` (9) — a cashier may verify payments but not create courts · a viewer reads but
  cannot write · the owner role passes everything · **granting a permission opens the route it guards** ·
  revoking closes it · owner/super_admin refuse edits · unknown ids ignored · a non-member is denied.
- `OwnerCustomerDetailTest` (3) — shape and identity · counts agree and the recent list is capped ·
  another venue's customer 404s.
- `AdminSubscriptionActionsTest` (6) — cancel does not lock the venue out · suspend does, immediately ·
  customers keep booking either way · resume gives an expired plan a future date · explicit date wins ·
  an owner cannot cancel their own plan.

New e2e: `admin-users-roles.spec.ts` (add → suspend → the API really refuses the login → restore; role
edit changes the stored permission set, owner card is disabled) and `owner-customer-detail.spec.ts`.

## Still open

- Nothing committed. Migrations pending (`composer install` + `php artisan migrate`).
- The bigger risks found during the audit are **untouched**: the double-booking race, `pending_payment`
  holding a slot forever, nothing ever creating a Notification, LINE messaging never used, no scheduler,
  no login rate limit. See the audit notes in the session log.
- New roles created from scratch start with zero permissions and therefore cannot do anything until an
  admin ticks boxes. Intentional, but worth a hint in the UI if org-scoped roles are ever added.
