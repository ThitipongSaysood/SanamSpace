# API_Specification_v1

## Base URL
/api/v1

## Auth
POST /auth/line/login
POST /auth/admin/login
POST /auth/logout
GET /auth/me

## Organizations
GET /organizations
GET /organizations/{id}
POST /organizations
PUT /organizations/{id}

## Branches
GET /branches
POST /branches
PUT /branches/{id}
DELETE /branches/{id}

## Courts
GET /courts
GET /courts/{id}
POST /courts
PUT /courts/{id}
DELETE /courts/{id}

## Court Schedule
GET /courts/{id}/schedules
POST /courts/{id}/schedules

## Bookings
GET /bookings
GET /bookings/{id}
POST /bookings
PUT /bookings/{id}
POST /bookings/{id}/cancel
POST /bookings/{id}/checkin
POST /bookings/{id}/checkout

## Payments
GET /payments
POST /payments
POST /payments/{id}/upload-slip
POST /payments/{id}/verify
POST /payments/{id}/reject

## Refunds
POST /refunds
POST /refunds/{id}/approve

## Customers
GET /customers
GET /customers/{id}
PUT /customers/{id}

## Membership
GET /memberships
POST /memberships

## Wallet
GET /wallets
GET /wallets/{id}/transactions
POST /wallets/{id}/adjust

## Promotions
GET /promotions
POST /promotions
GET /coupons
POST /coupons

## CRM
GET /segments
POST /segments
GET /timeline/{customerId}

## Notifications
GET /notifications
POST /broadcasts

## Reports
GET /reports/revenue
GET /reports/bookings
GET /reports/utilization

## Subscription
GET /subscriptions
POST /subscriptions/renew

## Admin
GET /users
POST /users
GET /roles
GET /permissions
