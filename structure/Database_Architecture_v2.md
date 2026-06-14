Database_Architecture_v2.md

SanamSpace Database Architecture

Version 2.0

Database Engine

MySQL 8

Architecture

Multi-Tenant SaaS

⸻

Core Principle

ทุก Table ต้องรองรับ

organization_id

เพื่อแยกข้อมูลของแต่ละสนาม

ตัวอย่าง

Everyday Badminton
TSR Badminton
NT Football
Semitennis

ข้อมูลไม่สามารถเห็นข้ามกันได้

⸻

Database Domains

01 Platform
02 Authentication
03 Organization
04 Subscription
05 User & Permission
06 Customer & LINE
07 Venue
08 Court
09 Booking
10 Payment
11 Membership
12 Wallet
13 CRM
14 Promotion
15 Notification
16 Reports
17 Support
18 Audit
19 Tournament
20 Coach
21 Marketplace

⸻

01 Platform Domain

organizations

Tenant หลัก

⸻

organization_settings

⸻

organization_domains

Custom Domain

⸻

organization_themes

Branding

⸻

organization_storage

Storage Usage

⸻

organization_usage

Usage Statistics

⸻

organization_health

Health Score

⸻

organization_api_usage

API Usage

⸻

02 Authentication

users

ระบบกลาง

⸻

sessions

⸻

refresh_tokens

⸻

login_logs

⸻

password_resets

⸻

oauth_accounts

LINE Login

Google Login

Apple Login

⸻

03 Subscription

plans

Starter

Business

Pro

Enterprise

⸻

features

Feature Catalog

⸻

plan_features

⸻

subscriptions

⸻

subscription_history

⸻

subscription_invoices

⸻

subscription_payments

⸻

feature_overrides

⸻

04 User & Permission

roles

⸻

permissions

⸻

role_permissions

⸻

user_roles

⸻

staff_profiles

⸻

staff_activity_logs

⸻

05 Customer & LINE

customers

Global Customer

⸻

customer_profiles

Per Organization

⸻

customer_addresses

⸻

customer_tags

⸻

customer_tag_assignments

⸻

customer_notes

⸻

customer_timeline

⸻

line_profiles

LINE User

⸻

line_friendships

Relationship with Venue

⸻

line_messages

Message Logs

⸻

06 Venue

venues

⸻

venue_images

⸻

venue_facilities

⸻

facilities

⸻

venue_reviews

⸻

venue_review_images

⸻

venue_announcements

⸻

venue_business_hours

⸻

branches

⸻

07 Courts

sports

Badminton

Football

Tennis

Pickleball

⸻

court_types

⸻

courts

⸻

court_images

⸻

court_schedules

⸻

court_availability

⸻

court_price_rules

⸻

court_maintenance

⸻

court_checklists

⸻

08 Booking

bookings

Master Booking

⸻

booking_items

⸻

booking_status_logs

⸻

booking_checkins

⸻

booking_checkouts

⸻

booking_extensions

⸻

booking_waitlists

⸻

booking_reviews

⸻

booking_cancellations

⸻

booking_no_shows

⸻

booking_participants

⸻

booking_notifications

⸻

09 Payment

payment_methods

⸻

payments

⸻

payment_slips

⸻

payment_verifications

⸻

refunds

⸻

refund_transactions

⸻

invoices

⸻

invoice_items

⸻

tax_invoices

⸻

payment_audit_logs

⸻

10 Membership

membership_tiers

⸻

membership_benefits

⸻

memberships

⸻

membership_transactions

⸻

membership_history

⸻

membership_expiry_logs

⸻

11 Wallet

wallets

⸻

wallet_transactions

⸻

wallet_topups

⸻

wallet_deductions

⸻

wallet_refunds

⸻

wallet_adjustments

⸻

wallet_audit_logs

⸻

12 Packages

packages

⸻

package_items

⸻

customer_packages

⸻

package_usage_logs

⸻

package_expiry_logs

⸻

13 CRM

customer_segments

⸻

customer_segment_members

⸻

campaigns

⸻

campaign_recipients

⸻

broadcasts

⸻

broadcast_logs

⸻

automation_rules

⸻

automation_actions

⸻

automation_runs

⸻

followups

⸻

14 Promotion

coupons

⸻

coupon_redemptions

⸻

promotions

⸻

promotion_rules

⸻

promotion_usage_logs

⸻

15 Notifications

notification_templates

⸻

notifications

⸻

notification_jobs

⸻

notification_logs

⸻

notification_preferences

⸻

scheduled_notifications

⸻

16 Reports

daily_metrics

⸻

monthly_metrics

⸻

fact_bookings

⸻

fact_payments

⸻

fact_customers

⸻

fact_memberships

⸻

fact_wallets

⸻

17 Support

support_tickets

⸻

support_comments

⸻

support_attachments

⸻

support_assignments

⸻

support_status_logs

⸻

18 Audit

audit_logs

Master Audit Table

⸻

security_events

⸻

permission_change_logs

⸻

impersonation_logs

⸻

api_logs

⸻

19 Tournament

tournaments

⸻

tournament_categories

⸻

tournament_registrations

⸻

tournament_teams

⸻

tournament_players

⸻

tournament_matches

⸻

tournament_results

⸻

tournament_rankings

⸻

20 Coach

coaches

⸻

coach_profiles

⸻

coach_schedules

⸻

coach_bookings

⸻

coach_reviews

⸻

coach_payments

⸻

21 Marketplace

product_categories

⸻

products

⸻

product_images

⸻

inventory

⸻

inventory_movements

⸻

orders

⸻

order_items

⸻

order_payments

⸻

shipments

⸻

Database Relationship

Organization

organizations
 ├── branches
 ├── venues
 ├── users
 ├── subscriptions
 ├── customers
 ├── bookings
 ├── payments
 ├── memberships
 ├── wallets
 └── reports

⸻

Customer

customers
 ├── customer_profiles
 ├── memberships
 ├── wallets
 ├── bookings
 ├── payments
 ├── packages
 └── timeline

⸻

Venue

venues
 ├── courts
 ├── facilities
 ├── schedules
 ├── reviews
 └── announcements

⸻

Booking

bookings
 ├── booking_items
 ├── payments
 ├── checkins
 ├── checkouts
 ├── reviews
 └── notifications

⸻

Membership

membership_tiers
 └── memberships
      └── membership_transactions

⸻

Wallet

wallets
 └── wallet_transactions

⸻

Estimated Tables

Domain	Tables
Platform	8
Authentication	6
Subscription	8
User & Permission	6
Customer & LINE	10
Venue	9
Court	9
Booking	12
Payment	10
Membership	6
Wallet	7
Packages	5
CRM	10
Promotion	5
Notification	6
Reports	7
Support	5
Audit	5
Tournament	8
Coach	6
Marketplace	9

Total

≈ 157 Tables

⸻

Performance Strategy

Indexes

organization_id
customer_id
booking_id
payment_id
venue_id
court_id
created_at

⸻

Partition Tables

audit_logs
notifications
booking_logs
payment_logs
api_logs

⸻

Soft Delete

deleted_at

ทุก Table

⸻

Audit

created_by
updated_by
deleted_by

ทุก Transaction Table

⸻

Final Goal

รองรับ

* 500+ Venues
* 1,000,000+ Customers
* 10,000,000+ Bookings
* Multi Tenant SaaS
* White Label Platform

โดยไม่ต้องเปลี่ยน Database Architecture ในอนาคต