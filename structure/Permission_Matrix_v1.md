# PlayCourt Permission Matrix v1.0

## Roles

- Super Admin
- Owner
- Manager
- Reception
- Cashier
- Marketing
- Coach
- Accountant
- Viewer

---

# Permission Modules

- dashboard
- organization
- branch
- court
- booking
- checkin
- payment
- refund
- membership
- wallet
- customer
- crm
- promotion
- coupon
- broadcast
- notification
- report
- analytics
- subscription
- staff
- integration
- coach
- marketplace
- tournament

---

# Permission Actions

- view
- create
- update
- delete
- approve
- export

---

# Role Summary

## Owner
Full access to all modules within own organization.

## Manager
Manage daily operations except subscription and organization ownership.

## Reception
Manage bookings, check-in, check-out and customers.

## Cashier
Manage payments, refunds, invoices and wallet adjustments.

## Marketing
Manage CRM, campaigns, promotions, coupons and broadcasts.

## Coach
Access coach schedule, coaching bookings and students.

## Accountant
Access financial reports, invoices and tax invoices.

## Viewer
Read-only access.

---

# Permission Matrix

| Module | Owner | Manager | Reception | Cashier | Marketing | Coach | Accountant | Viewer |
|----------|----------|----------|----------|----------|----------|----------|----------|----------|
| Dashboard | Full | View | View | View | View | View | View | View |
| Organization | Full | View | None | None | None | None | None | None |
| Branch | Full | Manage | None | None | None | None | None | None |
| Court | Full | Manage | View | None | None | None | None | View |
| Booking | Full | Manage | Manage | View | View | View | View | View |
| Check-in | Full | Full | Full | None | None | None | None | None |
| Payment | Full | Verify | Upload Slip | Full | None | None | View | View |
| Refund | Full | Approve | None | Approve | None | None | View | None |
| Membership | Full | Manage | View | View | View | None | None | View |
| Wallet | Full | View | None | Adjust | None | None | None | View |
| Customer | Full | Manage | Manage | View | View | View | None | View |
| CRM | Full | Manage | None | None | Full | None | None | View |
| Promotion | Full | Manage | None | None | Full | None | None | View |
| Broadcast | Full | View | None | None | Full | None | None | None |
| Analytics | Full | View | None | None | View | None | View | View |
| Subscription | Full | None | None | None | None | None | None | None |
| Staff | Full | None | None | None | None | None | None | None |

---

# Database Mapping

roles
permissions
role_permissions
user_roles

---

# Architecture Rules

1. All permissions are scoped by organization_id.
2. No cross-tenant access.
3. All permission changes must be logged to audit_logs.
4. Owner can customize role permissions within organization.
5. Super Admin permissions cannot be modified by tenants.
