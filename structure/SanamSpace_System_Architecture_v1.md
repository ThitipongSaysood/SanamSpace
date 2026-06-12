# PlayCourt System Architecture v1.0

## White Label Sports Venue Operating System

### Technology Stack

Frontend
- Next.js
- React
- Tailwind CSS
- LINE LIFF

Backend
- PHP 8.3
- REST API

Database
- MySQL 8
- phpMyAdmin

Storage
- Cloudflare R2

Notification
- LINE Messaging API

Queue
- MySQL Jobs + Cron

---

## Architecture Principles

### Multi Tenant First
ทุกข้อมูลต้องผูกกับ organization_id

### API First
Customer App, Owner Portal และ Super Admin ใช้ API ชุดเดียวกัน

### Feature Flag Driven
ควบคุมสิทธิ์การใช้งานตาม Plan

### Event Driven
รองรับ Notification, Analytics และ Automation

---

## High Level Architecture

Customer PWA
↓
Owner Admin Portal
↓
Super Admin Portal
↓
API Layer (PHP)
↓
Business Services
↓
MySQL Database
├─ Cloudflare R2
├─ LINE Messaging API
└─ Job Queue

---

## Frontend Layer

### Customer App
- Login with LINE
- Booking
- Upload Slip
- Membership
- Wallet
- Package
- QR Check-in

### Owner Admin Portal
- Dashboard
- Booking Management
- Court Management
- CRM
- Reports

### Super Admin Portal
- Tenant Management
- Subscription Management
- Billing
- Feature Management

---

## Backend Layer

Modules
- Auth Service
- Booking Service
- Payment Service
- Membership Service
- Wallet Service
- CRM Service
- Notification Service
- Subscription Service
- Analytics Service

---

## Authentication

Customer
- LINE LIFF Login

Admin
- Email/Password
- Future Google Login

---

## Database

Engine
- MySQL 8
- InnoDB
- UTF8MB4

Primary Key
- BIGINT AUTO_INCREMENT

Additional Key
- UUID

Standard Columns
- created_at
- updated_at
- deleted_at

---

## Storage

Cloudflare R2

Store
- Logo
- Gallery
- Banner
- Payment Slip
- Invoice
- Tax Invoice
- Venue Map

---

## Notification Architecture

Channels
- LINE
- Email
- SMS
- Push

Templates
- Booking Confirmed
- Booking Reminder
- Payment Success
- Package Expiring
- Membership Expiring

---

## Queue Architecture

Tables
- jobs
- job_logs

Cron
* * * * *

Job Types
- send_line_message
- broadcast
- expire_booking
- expire_package
- expire_subscription
- generate_report

---

## Event Architecture

Tables
- events
- event_logs

Events
- booking.created
- booking.cancelled
- payment.verified
- membership.upgraded
- wallet.topup

---

## Subscription Architecture

Plans
- Starter
- Business
- Pro
- Enterprise

Tables
- plans
- features
- plan_features
- subscriptions
- subscription_invoices
- subscription_payments
- organization_feature_overrides

---

## CRM Architecture

Customer Identity
- LINE User

Segments
- VIP
- Gold
- Inactive 30 Days
- Inactive 90 Days
- High Value

Automation
- Send Coupon
- Birthday Coupon
- Rebooking Reminder

---

## Analytics

Tables
- daily_metrics
- monthly_metrics
- fact_bookings
- fact_payments
- feature_usage_logs

KPIs
- Revenue
- Booking
- Utilization
- Membership Growth
- MRR

---

## Security

RBAC

Tables
- users
- roles
- permissions
- role_permissions
- user_roles

Roles
- Owner
- Manager
- Reception
- Cashier
- Marketing
- Coach
- Accountant

---

## Deployment

Recommended VPS
- 4 CPU
- 8 GB RAM

Software
- Ubuntu
- Nginx
- PHP-FPM
- MySQL

---

## Roadmap

Phase 1
- Booking
- Payment Slip
- Membership
- Package
- Wallet

Phase 2
- CRM
- Promotion
- Broadcast
- Analytics

Phase 3
- Tournament
- Find Player
- Coach
- Marketplace
- API & Webhook

---

## Final Goal

PlayCourt = Venue Operating System

รองรับ
- 1 สนาม
- 10 สนาม
- 100 สนาม
- 500+ สนาม
