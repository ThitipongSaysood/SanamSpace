# PlayCourt Platform PRD Master v2.0

# White Label Sports Venue Booking SaaS

## Executive Summary
PlayCourt เป็นแพลตฟอร์ม SaaS สำหรับสนามกีฬาแบบ White Label Multi-Tenant
รองรับสนามแบดมินตัน ฟุตบอล ฟุตซอล เทนนิส พิคเคิลบอล บาสเกตบอล และกีฬาอื่นๆ

---

# 1. Product Vision

เป้าหมายคือเปลี่ยนจาก "ระบบจองสนาม" ไปสู่

Venue Operating System (Venue OS)

ประกอบด้วย
- Booking
- CRM
- Membership
- Loyalty
- Payment
- Revenue Management
- Analytics

---

# 2. Business Model

## White Label SaaS

ตัวอย่าง Tenant

- Everyday Badminton
- TSR Arena
- Yes Badminton
- Soccer Pro Tiwanon
- NT Football Complex

ลูกค้าแต่ละสนามแยกข้อมูลกัน 100%

---

# 3. User Roles

## Customer
จองสนาม

## Staff
ดูการจอง
ตรวจสลิป

## Owner
จัดการสนาม

## Super Admin
จัดการ Tenant

---

# 4. Customer Mobile App

## Authentication
- LINE Login
- Google Login
- Apple Login
- OTP Login

## Home
- Greeting
- Promotion Banner
- Quick Action
- Recommended Courts
- Membership Status

## Venue Detail
- Gallery
- Facilities
- Venue Map
- Court Specification
- Reviews
- Google Maps

## Booking Flow
1. Select Sport
2. Select Venue
3. Select Court
4. Select Date
5. Select Time
6. Summary
7. Payment
8. Confirmation
9. QR Check-in

## Payment
- PromptPay
- Card
- Wallet
- Bank Transfer

## Slip Upload
- Upload Image
- OCR Verification
- Duplicate Detection
- Staff Approval

## Booking History
- Upcoming
- Completed
- Cancelled

## Membership
- Silver
- Gold
- Platinum

## Wallet
- Topup
- Balance
- Transactions

## Point System
100 THB = 1 Point

## Package
- 10 Hours
- 20 Hours
- 50 Hours
- Monthly

## Promotion
- Coupon
- Happy Hour
- Flash Promotion

## Notification
- Booking Reminder
- Promotion
- Membership

## Profile
- Personal Information
- Membership
- Wallet
- Point

---

# 5. Facilities Module

## Facility Information
- Parking
- Locker
- Shower
- Cafe
- WiFi
- Air Condition
- Equipment Shop

## Facility Booking
- Locker
- Meeting Room
- Coach
- Equipment Rental

---

# 6. Venue Map Module

## Simple Map
- Entrance
- Parking
- Court

## Interactive Map
- Court Status
- Facilities
- Navigation

---

# 7. CRM & Loyalty

## Customer Profile
- Total Spending
- Visits
- Favorite Sport

## Loyalty
- Point
- Tier
- Rewards

## Broadcast
- LINE OA
- Email
- SMS

## Auto Promotion
สนามว่าง → ส่งโปร

---

# 8. Revenue Features

## Dynamic Pricing
Peak / Off Peak

## Auto Rebooking
จองซ้ำอัตโนมัติ

## Waitlist
คิวรอ

## Find Player
หาเพื่อนเล่น

---

# 9. Tournament Module

- Registration
- Bracket
- Ranking
- Leaderboard

---

# 10. Owner Portal

## Dashboard
- Revenue
- Booking
- Utilization
- Members

## Court Management
- Create Court
- Maintenance
- Availability

## Booking Management
- Approve
- Cancel
- Refund

## Payment Management
- Verify Slip
- Refund

## Membership Management

## Promotion Management

## Reports

---

# 11. Super Admin Portal

## Tenant Management

## Subscription Management

## Billing

## Platform Analytics

---

# 12. Subscription Plan

## Starter
- 1 Branch
- 5 Courts

## Business
- CRM
- Package
- Membership

## Pro
- Multi Branch
- API
- Analytics

## Enterprise
- Unlimited

---

# 13. Database Modules

Core Tables

- tenants
- venues
- courts
- bookings
- customers
- payments
- payment_slips
- memberships
- points
- wallets
- promotions
- notifications
- reviews
- tournaments

---

# 14. API Modules

- Auth API
- Booking API
- Payment API
- Membership API
- Wallet API
- Promotion API
- CRM API
- Analytics API

---

# 15. Design System

## Typography
Thai: Prompt
English: Inter

## Colors
Primary #16A34A
Success #16A34A
Warning #F59E0B
Danger #EF4444

---

# 16. MVP Roadmap

Phase 1
- Booking
- Payment
- Slip Upload
- Membership
- QR Check-in

Phase 2
- CRM
- Waitlist
- Auto Rebooking
- Wallet

Phase 3
- Tournament
- Find Player
- AI Revenue Assistant

---

# 17. Recommended Tech Stack

Frontend
- Next.js
- React Native / Expo

Backend
- Supabase
or
- Firebase

Authentication
- LINE Login
- Google Login

Storage
- Cloud Storage

Payment
- PromptPay
- Omise
- GB Prime Pay

Analytics
- BigQuery
- Looker Studio

---

# 18. Success Metrics

- Booking Growth
- Utilization Rate
- Repeat Customer Rate
- Membership Conversion
- MRR
- Active Venues
