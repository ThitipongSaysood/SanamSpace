API_Specification_Full_v1.md

SanamSpace API Specification

Version 1.0

Base URL

https://api.sanamspace.com/api/v1

Authentication

Bearer Token (JWT)

⸻

API Groups

Module	APIs
Auth	10
Organizations	10
Branches	8
Venues	10
Courts	12
Bookings	20
Payments	12
Membership	10
Wallet	10
Customers	15
CRM	10
Promotions	8
Notifications	8
Reports	12
Staff	8
Subscription	8
Feature Flags	5
Support	5
System	5

Total ≈ 186 APIs

⸻

01 Authentication

AUTH-001

POST /auth/line/login

LINE Login

⸻

AUTH-002

POST /auth/refresh

⸻

AUTH-003

POST /auth/logout

⸻

AUTH-004

GET /auth/me

⸻

AUTH-005

POST /auth/owner/login

⸻

AUTH-006

POST /auth/admin/login

⸻

AUTH-007

POST /auth/change-password

⸻

AUTH-008

POST /auth/request-reset

⸻

AUTH-009

POST /auth/reset-password

⸻

AUTH-010

POST /auth/verify-token

⸻

02 Organizations

ORG-001

GET /organizations

⸻

ORG-002

POST /organizations

⸻

ORG-003

GET /organizations/{id}

⸻

ORG-004

PUT /organizations/{id}

⸻

ORG-005

DELETE /organizations/{id}

⸻

ORG-006

POST /organizations/{id}/suspend

⸻

ORG-007

POST /organizations/{id}/activate

⸻

ORG-008

GET /organizations/{id}/usage

⸻

ORG-009

GET /organizations/{id}/logs

⸻

ORG-010

POST /organizations/{id}/impersonate

⸻

03 Branches

BRANCH-001

GET /branches

BRANCH-002

POST /branches

BRANCH-003

GET /branches/{id}

BRANCH-004

PUT /branches/{id}

BRANCH-005

DELETE /branches/{id}

BRANCH-006

GET /branches/{id}/stats

BRANCH-007

GET /branches/{id}/courts

BRANCH-008

GET /branches/{id}/bookings

⸻

04 Venues

VENUE-001

GET /venues

VENUE-002

POST /venues

VENUE-003

GET /venues/{id}

VENUE-004

PUT /venues/{id}

VENUE-005

DELETE /venues/{id}

VENUE-006

GET /venues/{id}/gallery

VENUE-007

POST /venues/{id}/gallery

VENUE-008

GET /venues/{id}/facilities

VENUE-009

GET /venues/{id}/reviews

VENUE-010

GET /venues/{id}/occupancy

⸻

05 Courts

COURT-001

GET /courts

COURT-002

POST /courts

COURT-003

GET /courts/{id}

COURT-004

PUT /courts/{id}

COURT-005

DELETE /courts/{id}

COURT-006

GET /courts/{id}/schedule

COURT-007

POST /courts/{id}/schedule

COURT-008

GET /courts/{id}/maintenance

COURT-009

POST /courts/{id}/maintenance

COURT-010

GET /courts/{id}/pricing

COURT-011

POST /courts/{id}/pricing

COURT-012

GET /courts/{id}/analytics

⸻

06 Bookings

BOOK-001

GET /bookings

BOOK-002

POST /bookings

BOOK-003

GET /bookings/{id}

BOOK-004

PUT /bookings/{id}

BOOK-005

DELETE /bookings/{id}

BOOK-006

POST /bookings/{id}/cancel

BOOK-007

POST /bookings/{id}/checkin

BOOK-008

POST /bookings/{id}/checkout

BOOK-009

GET /bookings/calendar

BOOK-010

GET /bookings/upcoming

BOOK-011

GET /bookings/history

BOOK-012

POST /bookings/rebook

BOOK-013

POST /bookings/waitlist

BOOK-014

DELETE /bookings/waitlist

BOOK-015

POST /bookings/no-show

BOOK-016

POST /bookings/extend

BOOK-017

POST /bookings/change-court

BOOK-018

POST /bookings/change-time

BOOK-019

GET /bookings/stats

BOOK-020

GET /bookings/export

⸻

07 Payments

PAY-001

GET /payments

PAY-002

POST /payments

PAY-003

GET /payments/{id}

PAY-004

POST /payments/{id}/upload-slip

PAY-005

POST /payments/{id}/verify

PAY-006

POST /payments/{id}/reject

PAY-007

POST /payments/{id}/refund

PAY-008

GET /payments/pending

PAY-009

GET /payments/history

PAY-010

GET /payments/export

PAY-011

POST /payments/manual

PAY-012

GET /payments/summary

⸻

08 Membership

MEM-001

GET /membership-tiers

MEM-002

POST /membership-tiers

MEM-003

GET /memberships

MEM-004

POST /memberships

MEM-005

GET /memberships/{id}

MEM-006

PUT /memberships/{id}

MEM-007

POST /memberships/upgrade

MEM-008

POST /memberships/downgrade

MEM-009

POST /memberships/renew

MEM-010

GET /memberships/report

⸻

09 Wallet

WAL-001

GET /wallets

WAL-002

GET /wallets/{id}

WAL-003

GET /wallets/{id}/transactions

WAL-004

POST /wallets/topup

WAL-005

POST /wallets/deduct

WAL-006

POST /wallets/refund

WAL-007

POST /wallets/transfer

WAL-008

GET /wallets/report

WAL-009

POST /wallets/adjust

WAL-010

GET /wallets/export

⸻

10 Customers

CUSTOMER-001 ถึง CUSTOMER-015

ครอบคลุม

* Customer Profile
* Tags
* Notes
* Timeline
* Segments
* Booking History
* Wallet History
* Membership History

⸻

11 CRM

CRM-001 ถึง CRM-010

ครอบคลุม

* Segments
* Broadcast
* Campaign
* Automation
* Follow Up

⸻

12 Promotions

PROMO-001 ถึง PROMO-008

ครอบคลุม

* Coupons
* Discounts
* Campaigns
* Voucher Codes

⸻

13 Notifications

NOTI-001 ถึง NOTI-008

ครอบคลุม

* LINE Push
* Booking Reminder
* Membership Expiry
* Wallet Alert

⸻

14 Reports

REPORT-001 ถึง REPORT-012

ครอบคลุม

* Revenue
* Booking
* Customer
* Membership
* Utilization
* Export

⸻

15 Staff

STAFF-001 ถึง STAFF-008

ครอบคลุม

* Staff Management
* Roles
* Permissions

⸻

16 Subscription

SUB-001 ถึง SUB-008

ครอบคลุม

* Plans
* Renew
* Upgrade
* Downgrade
* Billing

⸻

17 Feature Flags

FEATURE-001 ถึง FEATURE-005

ครอบคลุม

* Enable Feature
* Disable Feature
* Override

⸻

18 Support Center

SUPPORT-001 ถึง SUPPORT-005

ครอบคลุม

* Tickets
* Organization Health
* Impersonate

⸻

19 System

SYSTEM-001 ถึง SYSTEM-005

ครอบคลุม

* Health Check
* Queue Status
* Storage Status
* Maintenance Mode
* Audit Logs

⸻

API Response Standard

Success

{
  "status": "success",
  "message": "Booking created successfully",
  "data": {}
}

Error

{
  "status": "error",
  "message": "Validation failed",
  "errors": {}
}

⸻

Security Standards

* JWT Authentication
* RBAC Authorization
* Organization Isolation
* Audit Logs
* Rate Limiting
* CSRF Protection
* XSS Protection

⸻

Final Summary

Total APIs

≈ 186 APIs

รองรับ

* Customer App
* Owner Portal
* Super Admin
* Multi Tenant SaaS
* White Label Sports Venue Platform