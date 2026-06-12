# SanamSpace_PRD_Master_v1

# Product Requirements Document

Version: 1.0

## Vision

SanamSpace คือ White Label Multi-Tenant SaaS สำหรับบริหารธุรกิจสนามกีฬา

จากระบบจองสนามธรรมดา สู่

Venue Operating System for Sports Business

รองรับ
- Badminton
- Tennis
- Pickleball
- Football
- Futsal
- Basketball
- Volleyball

---

# Business Model

## SaaS Subscription

Plans
- Starter
- Business
- Pro
- Enterprise

Revenue
- Monthly Subscription
- Annual Subscription
- Add-on Features
- Setup Fee
- Enterprise Customization

---

# Target Customers

- สนามแบดมินตัน
- สนามฟุตบอล
- สนามฟุตซอล
- สนามเทนนิส
- สนาม Pickleball
- Sports Complex

---

# Core Architecture

## Multi Tenant

Organization Examples

- Everyday Badminton
- TSR Badminton
- Yes Badminton
- Soccer Pro Tiwanon
- NT Football
- Semitennis

ทุกข้อมูลต้องมี

organization_id

---

# Technology Stack

Frontend
- Next.js
- React
- Tailwind CSS

Backend
- PHP 8.3

Database
- MySQL 8
- phpMyAdmin

Storage
- Cloudflare R2

Auth
- LINE LIFF Login

Notification
- LINE Messaging API

Queue
- MySQL Jobs + Cron

---

# Main Modules

## Platform

- Organizations
- Branches
- Users
- Roles
- Permissions
- Subscription
- Feature Flags

## Customer

- LINE Login
- Customer Profile
- Customer Tags
- Notes
- Timeline

## Booking

- Venue
- Court
- Schedule
- Booking
- Check-in
- Check-out
- Waitlist

## Payment

- Transfer
- Slip Upload
- Verification
- Refund
- Invoice
- Tax Invoice

## Membership

- Membership Tier
- Points
- Package
- Wallet

## CRM

- Segments
- Broadcast
- Promotions
- Coupons
- Automation

## Analytics

- Revenue
- Booking
- Utilization
- Membership
- CRM

---

# Roles

- Super Admin
- Owner
- Manager
- Reception
- Cashier
- Marketing
- Coach
- Accountant
- Viewer

Permission Model

RBAC

Tables
- roles
- permissions
- role_permissions
- user_roles

---

# Feature Matrix

Starter
- Booking
- Slip Upload
- Revenue Dashboard

Business
- Membership
- Wallet
- Package
- Promotions

Pro
- CRM
- Broadcast
- Analytics
- API

Enterprise
- White Label
- Custom Domain
- Dedicated Infrastructure

---

# Database

Total Estimated Tables

120+

Domains

- Platform
- User & Permission
- Subscription
- Customer & LINE
- Venue & Court
- Booking
- Payment
- Membership
- Wallet
- CRM
- Notification
- Analytics
- Tournament
- Coach
- Marketplace

---

# API Standard

Base URL

/api/v1

Modules

- auth
- organizations
- branches
- courts
- bookings
- payments
- memberships
- wallets
- crm
- reports
- subscriptions

---

# Customer Journey

LINE Login

↓

Select Venue

↓

View Courts

↓

Create Booking

↓

Upload Slip

↓

Verification

↓

Booking Confirmed

↓

Reminder Notification

↓

Check-in

↓

Complete Booking

---

# Owner Journey

Login

↓

Manage Courts

↓

Manage Bookings

↓

Verify Payments

↓

Manage Customers

↓

Run Promotions

↓

View Analytics

---

# Development Phases

## Phase 1

MVP

- Multi Tenant
- LINE Login
- Court Management
- Booking
- Slip Upload
- Notifications

## Phase 2

Growth

- CRM
- Membership
- Wallet
- Package
- Promotions

## Phase 3

Scale

- API
- Webhook
- Automation
- White Label

## Phase 4

Enterprise

- Tournament
- Coach
- Marketplace
- Data Warehouse

---

# Architecture Rules

1. Multi Tenant First
2. API First
3. Feature Flag Driven
4. Event Driven
5. Wallet Ledger Only
6. Queue Based Notifications
7. Soft Delete
8. Audit Log Required
9. No Cross Tenant Access
10. Organization Scoped Data

---

# Success Metrics

Business
- 100+ Active Venues
- MRR Growth
- Low Churn

Product
- Booking Success Rate
- Payment Verification Time
- Customer Retention

System
- 99.9% Uptime
- Multi Tenant Isolation
- Scalable to 500+ Venues

---

# Source of Truth

This document is the master reference for:

- Product
- UX
- UI
- Database
- API
- Backend
- Frontend
- Infrastructure
- Development Roadmap

All future documents must align with this PRD.
