# PlayCourt Database Architecture v1.0
## White Label Multi-Tenant Sports Venue Booking SaaS

เอกสารนี้สรุปโครงสร้าง Database ทั้งหมดของระบบ PlayCourt ตามแนวทางที่คุยกัน:
- ระบบกลาง Admin เดียว
- รองรับหลายสนาม / หลายองค์กร
- ลูกค้าแยกกันตามสนาม
- Login ลูกค้าผ่าน LINE เป็นหลัก
- Plan / Subscription หมดอายุรายเดือน
- Feature แต่ละสนามเปิดไม่เท่ากัน
- รองรับ CRM, Notification, Reminder, Slip Upload, Wallet, Membership, Tournament, Find Player, Coach, Marketplace และ Analytics ในอนาคต

---

# 0. Database Design Principles

## 0.1 Multi-Tenant First

ทุกตารางที่เป็นข้อมูลของสนามต้องมี:

```sql
organization_id
```

เพื่อแยกข้อมูลของแต่ละสนาม เช่น

- Everyday Badminton
- TSR Badminton
- Yes Badminton
- Soccer Pro Tiwanon
- สนามฟุตบอล NT งามวงศ์วาน
- semitennis

## 0.2 Organization = สนาม / เจ้าของธุรกิจ

ระบบนี้ไม่ควรผูกข้อมูลกับ User โดยตรง แต่ควรมีโครงสร้างแบบ:

```text
PlayCourt Platform
 ├── Organization: Everyday Badminton
 ├── Organization: TSR Badminton
 ├── Organization: Soccer Pro Tiwanon
 └── Organization: semitennis
```

User แต่ละคนสามารถอยู่ได้หลาย Organization

## 0.3 Feature Flag + Subscription

Plan เป็นตัวกำหนดว่า Organization ใช้ Feature ไหนได้

```text
Organization
 -> Subscription
 -> Plan
 -> Plan Features
 -> Enabled Menus / Enabled API
```

## 0.4 Customer แยกตามสนาม

ลูกค้า Login ด้วย LINE คนเดียวกัน แต่อาจเป็นสมาชิกหลายสนามได้

```text
Global User: LINE User A
 ├── Customer Profile: Everyday Badminton
 ├── Customer Profile: TSR Badminton
 └── Customer Profile: NT Football
```

คะแนน, Wallet, Package, Membership ไม่ปนกัน

---

# 1. Platform Core Domain

ใช้จัดการสนามทั้งหมดบน Platform

---

## 1.1 organizations

เก็บข้อมูลสนาม / ธุรกิจ / Workspace

```sql
organizations
-------------
id UUID PRIMARY KEY
name VARCHAR(255)
slug VARCHAR(100) UNIQUE
business_type VARCHAR(100)
status VARCHAR(50)
timezone VARCHAR(100)
trial_start_at TIMESTAMP NULL
trial_end_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
deleted_by UUID NULL
```

ตัวอย่าง:

```text
Everyday Badminton
TSR Badminton
Yes Badminton
Soccer Pro Tiwanon
NT Football Complex
semitennis
```

---

## 1.2 organization_settings

เก็บ Branding และค่าตั้งค่าของแต่ละสนาม

```sql
organization_settings
---------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
logo_file_id UUID NULL
favicon_file_id UUID NULL
cover_file_id UUID NULL
primary_color VARCHAR(20)
secondary_color VARCHAR(20)
accent_color VARCHAR(20)
font_family VARCHAR(100)
line_oa_url TEXT NULL
facebook_url TEXT NULL
website_url TEXT NULL
phone VARCHAR(50)
email VARCHAR(255)
address TEXT
google_map_url TEXT
default_language VARCHAR(20)
timezone VARCHAR(100)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 1.3 branches

รองรับหลายสาขาในอนาคต

```sql
branches
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
slug VARCHAR(100)
address TEXT
province VARCHAR(100)
district VARCHAR(100)
subdistrict VARCHAR(100)
postal_code VARCHAR(20)
latitude DECIMAL(10,8) NULL
longitude DECIMAL(11,8) NULL
phone VARCHAR(50)
opening_time TIME
closing_time TIME
timezone VARCHAR(100)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

---

## 1.4 system_settings

ค่า Config กลางของระบบ PlayCourt

```sql
system_settings
---------------
id UUID PRIMARY KEY
key VARCHAR(255) UNIQUE
value JSONB
description TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- default_trial_days
- default_timezone
- default_point_rate
- default_booking_reminder_hours

---

# 2. User, Role & Permission Domain

ใช้จัดการผู้ใช้งานฝั่ง Admin / Staff / Owner

---

## 2.1 users

บัญชีผู้ใช้ระบบฝั่ง Admin, Owner, Staff

```sql
users
-----
id UUID PRIMARY KEY
name VARCHAR(255)
email VARCHAR(255) UNIQUE NULL
phone VARCHAR(50) NULL
password_hash TEXT NULL
avatar_file_id UUID NULL
status VARCHAR(50)
last_login_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

---

## 2.2 organization_users

เชื่อม User กับ Organization

```sql
organization_users
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
user_id UUID FK -> users.id
display_name VARCHAR(255) NULL
status VARCHAR(50)
joined_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- User A เป็น Owner ของ Everyday
- User B เป็น Owner ของ semitennis
- User C เป็น Owner ของ NT Football

---

## 2.3 roles

บทบาทในระบบ

```sql
roles
-----
id UUID PRIMARY KEY
organization_id UUID NULL
code VARCHAR(100)
name VARCHAR(255)
description TEXT NULL
is_system_role BOOLEAN DEFAULT FALSE
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- owner
- manager
- cashier
- reception
- marketing
- coach
- accountant

---

## 2.4 permissions

สิทธิ์การใช้งานละเอียด

```sql
permissions
-----------
id UUID PRIMARY KEY
code VARCHAR(150) UNIQUE
name VARCHAR(255)
module VARCHAR(100)
description TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- booking.view
- booking.create
- booking.cancel
- payment.verify
- promotion.manage
- subscription.manage

---

## 2.5 role_permissions

เชื่อม Role กับ Permission

```sql
role_permissions
----------------
id UUID PRIMARY KEY
role_id UUID FK -> roles.id
permission_id UUID FK -> permissions.id
created_at TIMESTAMP
```

---

## 2.6 user_roles

กำหนด Role ให้ User ใน Organization

```sql
user_roles
----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
user_id UUID FK -> users.id
role_id UUID FK -> roles.id
created_at TIMESTAMP
```

---

## 2.7 sessions

เก็บ Session การ Login

```sql
sessions
--------
id UUID PRIMARY KEY
user_id UUID FK -> users.id
token_hash TEXT
ip_address VARCHAR(100)
user_agent TEXT
expires_at TIMESTAMP
created_at TIMESTAMP
revoked_at TIMESTAMP NULL
```

---

# 3. Subscription, Plan & Billing Domain

ใช้จัดการ Package รายเดือน / รายปี / Trial / Feature

---

## 3.1 plans

แพ็กเกจหลัก

```sql
plans
-----
id UUID PRIMARY KEY
code VARCHAR(100) UNIQUE
name VARCHAR(255)
description TEXT NULL
base_price DECIMAL(12,2)
billing_cycle VARCHAR(50)
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- starter
- business
- pro
- enterprise

---

## 3.2 features

Feature ทั้งหมดของระบบ

```sql
features
--------
id UUID PRIMARY KEY
code VARCHAR(150) UNIQUE
name VARCHAR(255)
module VARCHAR(100)
description TEXT NULL
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- booking
- payment_slip
- membership
- wallet
- promotion
- crm
- tournament
- find_player
- coach_booking
- marketplace
- analytics
- api_access

---

## 3.3 plan_features

กำหนดว่า Plan ไหนใช้ Feature ไหนได้

```sql
plan_features
-------------
id UUID PRIMARY KEY
plan_id UUID FK -> plans.id
feature_id UUID FK -> features.id
limit_value INTEGER NULL
limit_unit VARCHAR(50) NULL
created_at TIMESTAMP
```

ตัวอย่าง:
- Starter ใช้ booking + payment_slip
- Business เพิ่ม membership + wallet + promotion
- Pro เพิ่ม crm + analytics + tournament

---

## 3.4 subscriptions

Subscription ของแต่ละ Organization

```sql
subscriptions
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
plan_id UUID FK -> plans.id
status VARCHAR(50)
start_at TIMESTAMP
expire_at TIMESTAMP
trial_start_at TIMESTAMP NULL
trial_end_at TIMESTAMP NULL
cancelled_at TIMESTAMP NULL
grace_period_end_at TIMESTAMP NULL
auto_renew BOOLEAN DEFAULT FALSE
created_at TIMESTAMP
updated_at TIMESTAMP
```

Status:
- trial
- active
- expired
- suspended
- cancelled

---

## 3.5 subscription_invoices

ใบแจ้งหนี้รายเดือน / รายปี

```sql
subscription_invoices
---------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
subscription_id UUID FK -> subscriptions.id
invoice_no VARCHAR(100) UNIQUE
billing_period_start DATE
billing_period_end DATE
subtotal DECIMAL(12,2)
discount DECIMAL(12,2)
vat DECIMAL(12,2)
total DECIMAL(12,2)
status VARCHAR(50)
due_date DATE
paid_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

Status:
- unpaid
- paid
- overdue
- cancelled

---

## 3.6 subscription_payments

การชำระเงินค่า Subscription

```sql
subscription_payments
---------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
subscription_invoice_id UUID FK -> subscription_invoices.id
method VARCHAR(50)
amount DECIMAL(12,2)
slip_file_id UUID NULL
status VARCHAR(50)
verified_by UUID NULL
verified_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 3.7 organization_feature_overrides

เปิด/ปิด Feature พิเศษราย Organization

```sql
organization_feature_overrides
------------------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
feature_id UUID FK -> features.id
enabled BOOLEAN
limit_value INTEGER NULL
reason TEXT NULL
start_at TIMESTAMP NULL
end_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 3.8 feature_purchases

ซื้อ Feature เพิ่มแยกจาก Plan

```sql
feature_purchases
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
feature_id UUID FK -> features.id
price DECIMAL(12,2)
billing_cycle VARCHAR(50)
status VARCHAR(50)
start_at TIMESTAMP
expire_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 3.9 usage_records

รองรับ Usage-Based Billing

```sql
usage_records
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
feature_id UUID FK -> features.id
usage_key VARCHAR(100)
quantity DECIMAL(12,2)
unit VARCHAR(50)
recorded_at TIMESTAMP
metadata JSONB NULL
created_at TIMESTAMP
```

ตัวอย่าง:
- SMS จำนวนกี่ข้อความ
- Broadcast จำนวนกี่ครั้ง
- Storage กี่ GB
- Active Member กี่คน

---

# 4. LINE Identity & Customer Domain

ลูกค้า Login ผ่าน LINE เป็นหลัก

---

## 4.1 global_customers

Identity กลางของลูกค้าจาก LINE

```sql
global_customers
----------------
id UUID PRIMARY KEY
line_user_id VARCHAR(255) UNIQUE
display_name VARCHAR(255)
picture_url TEXT NULL
status_message TEXT NULL
language VARCHAR(20) NULL
email VARCHAR(255) NULL
phone VARCHAR(50) NULL
birthdate DATE NULL
gender VARCHAR(50) NULL
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

---

## 4.2 line_profiles

ข้อมูลจาก LINE Login / LIFF

```sql
line_profiles
-------------
id UUID PRIMARY KEY
global_customer_id UUID FK -> global_customers.id
line_user_id VARCHAR(255)
display_name VARCHAR(255)
picture_url TEXT NULL
status_message TEXT NULL
language VARCHAR(20) NULL
email VARCHAR(255) NULL
raw_profile JSONB NULL
last_synced_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 4.3 customer_profiles

ข้อมูลลูกค้าแยกตามสนาม

```sql
customer_profiles
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
global_customer_id UUID FK -> global_customers.id
member_no VARCHAR(100)
display_name VARCHAR(255)
phone VARCHAR(50) NULL
email VARCHAR(255) NULL
birthdate DATE NULL
gender VARCHAR(50) NULL
tier_id UUID NULL
status VARCHAR(50)
first_joined_at TIMESTAMP
last_visit_at TIMESTAMP NULL
total_spending DECIMAL(12,2) DEFAULT 0
total_bookings INTEGER DEFAULT 0
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

---

## 4.4 customer_addresses

ที่อยู่ลูกค้า

```sql
customer_addresses
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
label VARCHAR(100)
address TEXT
province VARCHAR(100)
district VARCHAR(100)
subdistrict VARCHAR(100)
postal_code VARCHAR(20)
is_default BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 4.5 customer_tags

Tag สำหรับ CRM

```sql
customer_tags
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(100)
color VARCHAR(20)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 4.6 customer_tag_assignments

เชื่อมลูกค้ากับ Tag

```sql
customer_tag_assignments
------------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
customer_tag_id UUID FK -> customer_tags.id
created_at TIMESTAMP
```

---

## 4.7 customer_notes

บันทึก Note ลูกค้า

```sql
customer_notes
--------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
note TEXT
created_by UUID FK -> users.id
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 4.8 line_friendships

สถานะเป็นเพื่อน LINE OA ของสนาม

```sql
line_friendships
----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
global_customer_id UUID FK -> global_customers.id
line_user_id VARCHAR(255)
is_friend BOOLEAN
followed_at TIMESTAMP NULL
unfollowed_at TIMESTAMP NULL
blocked_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 4.9 organization_line_accounts

LINE OA ของแต่ละสนาม

```sql
organization_line_accounts
--------------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
oa_name VARCHAR(255)
basic_id VARCHAR(100) NULL
channel_id VARCHAR(255)
channel_secret TEXT
channel_access_token TEXT
webhook_url TEXT NULL
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 5. Venue, Sport & Court Domain

---

## 5.1 sports

ประเภทกีฬา

```sql
sports
------
id UUID PRIMARY KEY
code VARCHAR(100) UNIQUE
name_th VARCHAR(255)
name_en VARCHAR(255)
icon_file_id UUID NULL
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- badminton
- football
- futsal
- tennis
- pickleball
- basketball
- volleyball

---

## 5.2 venues

ข้อมูลสถานที่ภายใน Organization / Branch

```sql
venues
------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
branch_id UUID FK -> branches.id
name VARCHAR(255)
description TEXT NULL
cover_file_id UUID NULL
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

---

## 5.3 court_types

ประเภทสนาม

```sql
court_types
-----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
sport_id UUID FK -> sports.id
name VARCHAR(255)
description TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 5.4 courts

สนามย่อย / คอร์ท

```sql
courts
------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
branch_id UUID FK -> branches.id
venue_id UUID FK -> venues.id
sport_id UUID FK -> sports.id
court_type_id UUID NULL
name VARCHAR(255)
code VARCHAR(100)
description TEXT NULL
floor_type VARCHAR(100) NULL
ceiling_height VARCHAR(100) NULL
lighting_type VARCHAR(100) NULL
is_indoor BOOLEAN
has_aircon BOOLEAN
capacity INTEGER NULL
base_price DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

Status:
- active
- inactive
- maintenance
- closed

---

## 5.5 court_schedules

เวลาเปิดให้จองของแต่ละ Court

```sql
court_schedules
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
court_id UUID FK -> courts.id
day_of_week INTEGER
open_time TIME
close_time TIME
slot_duration_minutes INTEGER
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 5.6 court_price_rules

กฎราคา

```sql
court_price_rules
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
court_id UUID FK -> courts.id
name VARCHAR(255)
day_of_week INTEGER NULL
start_time TIME NULL
end_time TIME NULL
price DECIMAL(12,2)
priority INTEGER
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- Weekday Off-Peak
- Weekend Prime Time
- Holiday Price

---

## 5.7 court_maintenance

ปิดสนามซ่อม / ปิดปรับปรุง

```sql
court_maintenance
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
court_id UUID FK -> courts.id
title VARCHAR(255)
description TEXT NULL
start_at TIMESTAMP
end_at TIMESTAMP
status VARCHAR(50)
created_by UUID FK -> users.id
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 5.8 court_images

รูปสนาม

```sql
court_images
------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
court_id UUID FK -> courts.id
file_id UUID FK -> files.id
sort_order INTEGER
created_at TIMESTAMP
```

---

## 5.9 facilities

สิ่งอำนวยความสะดวก

```sql
facilities
----------
id UUID PRIMARY KEY
code VARCHAR(100)
name_th VARCHAR(255)
name_en VARCHAR(255)
icon_file_id UUID NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- parking
- locker
- shower
- cafe
- wifi
- aircon
- equipment_shop
- phone_charging

---

## 5.10 venue_facilities

เชื่อม Venue กับ Facilities

```sql
venue_facilities
----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
venue_id UUID FK -> venues.id
facility_id UUID FK -> facilities.id
description TEXT NULL
is_available BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 5.11 venue_maps

แผนผังสนาม

```sql
venue_maps
----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
venue_id UUID FK -> venues.id
name VARCHAR(255)
map_file_id UUID FK -> files.id
map_data JSONB NULL
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 6. Booking Domain

---

## 6.1 bookings

หัวใจของระบบจอง

```sql
bookings
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
branch_id UUID FK -> branches.id
venue_id UUID FK -> venues.id
customer_profile_id UUID FK -> customer_profiles.id
booking_no VARCHAR(100) UNIQUE
booking_date DATE
start_at TIMESTAMP
end_at TIMESTAMP
status VARCHAR(50)
subtotal DECIMAL(12,2)
discount DECIMAL(12,2)
total_amount DECIMAL(12,2)
payment_status VARCHAR(50)
source VARCHAR(50)
created_by UUID NULL
created_at TIMESTAMP
updated_at TIMESTAMP
cancelled_at TIMESTAMP NULL
cancelled_by UUID NULL
deleted_at TIMESTAMP NULL
```

Booking Status:
- draft
- pending_payment
- waiting_verify
- confirmed
- checked_in
- completed
- cancelled
- expired
- refunded

---

## 6.2 booking_items

รายการใน Booking เช่น Court, Coach, Locker

```sql
booking_items
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID FK -> bookings.id
item_type VARCHAR(50)
item_id UUID
name VARCHAR(255)
quantity INTEGER
unit_price DECIMAL(12,2)
total_price DECIMAL(12,2)
start_at TIMESTAMP NULL
end_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

item_type:
- court
- coach
- locker
- equipment
- package
- product

---

## 6.3 booking_status_logs

เก็บประวัติสถานะ Booking

```sql
booking_status_logs
-------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID FK -> bookings.id
from_status VARCHAR(50) NULL
to_status VARCHAR(50)
changed_by UUID NULL
reason TEXT NULL
created_at TIMESTAMP
```

---

## 6.4 booking_checkins

เช็คอิน / เช็คเอาท์

```sql
booking_checkins
----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID FK -> bookings.id
customer_profile_id UUID FK -> customer_profiles.id
checkin_at TIMESTAMP
checkout_at TIMESTAMP NULL
checkin_method VARCHAR(50)
checked_by UUID NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 6.5 booking_waitlists

คิวรอเมื่อตารางเต็ม

```sql
booking_waitlists
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
court_id UUID NULL
sport_id UUID NULL
preferred_date DATE
preferred_start_time TIME
preferred_end_time TIME
status VARCHAR(50)
notified_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 6.6 booking_reviews

รีวิวหลังใช้บริการ

```sql
booking_reviews
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID FK -> bookings.id
customer_profile_id UUID FK -> customer_profiles.id
rating INTEGER
comment TEXT NULL
cleanliness_rating INTEGER NULL
value_rating INTEGER NULL
court_quality_rating INTEGER NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 6.7 cancellation_rules

กติกายกเลิกของแต่ละสนาม

```sql
cancellation_rules
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
hours_before INTEGER
refund_percent DECIMAL(5,2)
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 7. Payment, Slip, Refund & Invoice Domain

---

## 7.1 payment_methods

ช่องทางจ่ายเงินของสนาม

```sql
payment_methods
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
method_type VARCHAR(50)
name VARCHAR(255)
account_name VARCHAR(255) NULL
account_number VARCHAR(100) NULL
bank_name VARCHAR(100) NULL
promptpay_id VARCHAR(100) NULL
qr_file_id UUID NULL
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 7.2 payments

การชำระเงินของ Booking

```sql
payments
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID FK -> bookings.id
customer_profile_id UUID FK -> customer_profiles.id
payment_no VARCHAR(100) UNIQUE
method VARCHAR(50)
amount DECIMAL(12,2)
status VARCHAR(50)
paid_at TIMESTAMP NULL
verified_by UUID NULL
verified_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

Status:
- pending
- uploaded
- verified
- rejected
- refunded
- expired

---

## 7.3 payment_slips

สลิปโอนเงิน

```sql
payment_slips
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
payment_id UUID FK -> payments.id
booking_id UUID FK -> bookings.id
file_id UUID FK -> files.id
uploaded_by_customer_id UUID FK -> customer_profiles.id
ocr_amount DECIMAL(12,2) NULL
ocr_bank VARCHAR(100) NULL
ocr_datetime TIMESTAMP NULL
ocr_raw JSONB NULL
duplicate_check_hash VARCHAR(255) NULL
status VARCHAR(50)
rejected_reason TEXT NULL
reviewed_by UUID NULL
reviewed_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 7.4 refunds

คำขอคืนเงิน

```sql
refunds
-------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID FK -> bookings.id
payment_id UUID FK -> payments.id
customer_profile_id UUID FK -> customer_profiles.id
refund_no VARCHAR(100) UNIQUE
amount DECIMAL(12,2)
reason TEXT
status VARCHAR(50)
requested_by UUID NULL
approved_by UUID NULL
approved_at TIMESTAMP NULL
completed_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 7.5 refund_transactions

รายการโอนคืนเงินจริง

```sql
refund_transactions
-------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
refund_id UUID FK -> refunds.id
method VARCHAR(50)
amount DECIMAL(12,2)
bank_name VARCHAR(100) NULL
account_no VARCHAR(100) NULL
account_name VARCHAR(255) NULL
slip_file_id UUID NULL
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 7.6 invoices

ใบเสร็จ / Invoice ลูกค้า

```sql
invoices
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
booking_id UUID NULL
invoice_no VARCHAR(100) UNIQUE
subtotal DECIMAL(12,2)
discount DECIMAL(12,2)
vat DECIMAL(12,2)
total DECIMAL(12,2)
status VARCHAR(50)
issued_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 7.7 invoice_items

รายการใน Invoice

```sql
invoice_items
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
invoice_id UUID FK -> invoices.id
description TEXT
quantity INTEGER
unit_price DECIMAL(12,2)
total_price DECIMAL(12,2)
created_at TIMESTAMP
```

---

## 7.8 tax_invoices

ใบกำกับภาษี

```sql
tax_invoices
------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
invoice_id UUID FK -> invoices.id
tax_invoice_no VARCHAR(100) UNIQUE
tax_name VARCHAR(255)
tax_id VARCHAR(50)
tax_address TEXT
issued_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 8. Membership, Loyalty & Package Domain

---

## 8.1 membership_tiers

ระดับสมาชิก

```sql
membership_tiers
----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
code VARCHAR(100)
description TEXT NULL
required_spending DECIMAL(12,2) NULL
required_points INTEGER NULL
discount_percent DECIMAL(5,2) NULL
valid_days INTEGER NULL
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- Silver
- Gold
- Platinum
- VIP

---

## 8.2 membership_benefits

สิทธิประโยชน์ของ Tier

```sql
membership_benefits
-------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
membership_tier_id UUID FK -> membership_tiers.id
benefit_type VARCHAR(100)
benefit_value JSONB
description TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 8.3 memberships

สมาชิกของลูกค้า

```sql
memberships
-----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
membership_tier_id UUID FK -> membership_tiers.id
status VARCHAR(50)
start_at TIMESTAMP
expire_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 8.4 membership_transactions

ประวัติการเปลี่ยน Tier

```sql
membership_transactions
-----------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
from_tier_id UUID NULL
to_tier_id UUID NULL
reason TEXT NULL
created_at TIMESTAMP
```

---

## 8.5 point_transactions

ธุรกรรมคะแนน

```sql
point_transactions
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
transaction_type VARCHAR(50)
points INTEGER
reference_type VARCHAR(50) NULL
reference_id UUID NULL
description TEXT NULL
expire_at TIMESTAMP NULL
created_at TIMESTAMP
```

transaction_type:
- earn
- redeem
- adjust
- expire
- refund

---

## 8.6 packages

แพ็กเกจชั่วโมง / รายเดือน

```sql
packages
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
description TEXT NULL
package_type VARCHAR(50)
total_hours DECIMAL(8,2) NULL
total_sessions INTEGER NULL
price DECIMAL(12,2)
valid_days INTEGER
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 8.7 customer_packages

แพ็กเกจที่ลูกค้าซื้อ

```sql
customer_packages
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
package_id UUID FK -> packages.id
remaining_hours DECIMAL(8,2) NULL
remaining_sessions INTEGER NULL
status VARCHAR(50)
start_at TIMESTAMP
expire_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 8.8 package_transactions

การใช้แพ็กเกจ

```sql
package_transactions
--------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_package_id UUID FK -> customer_packages.id
booking_id UUID NULL
transaction_type VARCHAR(50)
hours DECIMAL(8,2) NULL
sessions INTEGER NULL
description TEXT NULL
created_at TIMESTAMP
```

---

# 9. Wallet Domain

---

## 9.1 wallets

กระเป๋าเงินลูกค้าแยกตามสนาม

```sql
wallets
-------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
balance DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 9.2 wallet_transactions

ธุรกรรม Wallet แบบ Ledger

```sql
wallet_transactions
-------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
wallet_id UUID FK -> wallets.id
customer_profile_id UUID FK -> customer_profiles.id
transaction_type VARCHAR(50)
amount DECIMAL(12,2)
balance_before DECIMAL(12,2)
balance_after DECIMAL(12,2)
reference_type VARCHAR(50) NULL
reference_id UUID NULL
description TEXT NULL
created_at TIMESTAMP
```

transaction_type:
- topup
- payment
- refund
- bonus
- adjustment
- expire

---

# 10. Promotion, Coupon & Campaign Domain

---

## 10.1 promotions

โปรโมชั่น

```sql
promotions
----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
description TEXT NULL
promotion_type VARCHAR(50)
discount_type VARCHAR(50)
discount_value DECIMAL(12,2)
start_at TIMESTAMP
end_at TIMESTAMP
usage_limit INTEGER NULL
per_customer_limit INTEGER NULL
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 10.2 promotion_rules

เงื่อนไขโปรโมชั่น

```sql
promotion_rules
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
promotion_id UUID FK -> promotions.id
rule_type VARCHAR(100)
rule_value JSONB
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 10.3 coupons

คูปอง

```sql
coupons
-------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
promotion_id UUID NULL
code VARCHAR(100)
name VARCHAR(255)
discount_type VARCHAR(50)
discount_value DECIMAL(12,2)
start_at TIMESTAMP
end_at TIMESTAMP
usage_limit INTEGER NULL
used_count INTEGER DEFAULT 0
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 10.4 coupon_redemptions

การใช้คูปอง

```sql
coupon_redemptions
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
coupon_id UUID FK -> coupons.id
customer_profile_id UUID FK -> customer_profiles.id
booking_id UUID NULL
redeemed_at TIMESTAMP
discount_amount DECIMAL(12,2)
created_at TIMESTAMP
```

---

## 10.5 campaigns

แคมเปญ CRM

```sql
campaigns
---------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
description TEXT NULL
campaign_type VARCHAR(50)
target_segment_id UUID NULL
status VARCHAR(50)
start_at TIMESTAMP NULL
end_at TIMESTAMP NULL
created_by UUID FK -> users.id
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 10.6 broadcasts

Broadcast ผ่าน LINE / Email / SMS / Push

```sql
broadcasts
----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
campaign_id UUID NULL
channel VARCHAR(50)
title VARCHAR(255)
message TEXT
target_type VARCHAR(50)
target_data JSONB NULL
scheduled_at TIMESTAMP NULL
sent_at TIMESTAMP NULL
status VARCHAR(50)
created_by UUID FK -> users.id
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 10.7 broadcast_logs

Log การส่ง Broadcast

```sql
broadcast_logs
--------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
broadcast_id UUID FK -> broadcasts.id
customer_profile_id UUID FK -> customer_profiles.id
channel VARCHAR(50)
status VARCHAR(50)
provider_message_id VARCHAR(255) NULL
error_message TEXT NULL
sent_at TIMESTAMP NULL
created_at TIMESTAMP
```

---

# 11. Notification & Communication Domain

---

## 11.1 notification_templates

Template การแจ้งเตือน

```sql
notification_templates
----------------------
id UUID PRIMARY KEY
organization_id UUID NULL
code VARCHAR(150)
channel VARCHAR(50)
title_template TEXT
body_template TEXT
metadata JSONB NULL
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- booking_confirmed
- booking_reminder_1_day
- booking_reminder_1_hour
- payment_verified
- package_expiring
- membership_expiring

---

## 11.2 notifications

แจ้งเตือนที่แสดงใน App

```sql
notifications
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID NULL
user_id UUID NULL
title VARCHAR(255)
body TEXT
type VARCHAR(100)
data JSONB NULL
read_at TIMESTAMP NULL
created_at TIMESTAMP
```

---

## 11.3 notification_jobs

Job แจ้งเตือนในอนาคต เช่น ใกล้ถึงวันจอง

```sql
notification_jobs
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
booking_id UUID NULL
template_id UUID FK -> notification_templates.id
channel VARCHAR(50)
send_at TIMESTAMP
status VARCHAR(50)
attempt_count INTEGER DEFAULT 0
last_attempt_at TIMESTAMP NULL
sent_at TIMESTAMP NULL
error_message TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

Status:
- pending
- processing
- sent
- failed
- cancelled

---

## 11.4 notification_logs

ประวัติส่งจริง

```sql
notification_logs
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
notification_job_id UUID NULL
customer_profile_id UUID NULL
channel VARCHAR(50)
provider VARCHAR(50)
provider_message_id VARCHAR(255) NULL
status VARCHAR(50)
payload JSONB NULL
response JSONB NULL
error_message TEXT NULL
sent_at TIMESTAMP NULL
created_at TIMESTAMP
```

---

## 11.5 communications

ข้อความทุกช่องทางแบบกลาง

```sql
communications
--------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID NULL
channel VARCHAR(50)
direction VARCHAR(50)
subject VARCHAR(255) NULL
message TEXT
provider VARCHAR(50) NULL
provider_message_id VARCHAR(255) NULL
status VARCHAR(50)
metadata JSONB NULL
created_at TIMESTAMP
```

channel:
- line
- email
- sms
- push
- whatsapp

---

# 12. CRM Automation Domain

---

## 12.1 customer_segments

กลุ่มลูกค้า

```sql
customer_segments
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
description TEXT NULL
segment_type VARCHAR(50)
rules JSONB NULL
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง:
- VIP
- Inactive 30 Days
- High Value
- Badminton Lover
- Football Lover

---

## 12.2 customer_segment_members

สมาชิกใน Segment

```sql
customer_segment_members
------------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_segment_id UUID FK -> customer_segments.id
customer_profile_id UUID FK -> customer_profiles.id
created_at TIMESTAMP
```

---

## 12.3 customer_timeline

Timeline ลูกค้า

```sql
customer_timeline
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
event_type VARCHAR(100)
title VARCHAR(255)
description TEXT NULL
reference_type VARCHAR(50) NULL
reference_id UUID NULL
metadata JSONB NULL
created_at TIMESTAMP
```

ตัวอย่าง Event:
- customer_registered
- booking_created
- payment_verified
- point_earned
- coupon_used
- package_purchased

---

## 12.4 customer_patterns

Pattern การจองซ้ำ

```sql
customer_patterns
-----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
pattern_type VARCHAR(100)
day_of_week INTEGER NULL
preferred_start_time TIME NULL
preferred_end_time TIME NULL
sport_id UUID NULL
court_id UUID NULL
confidence_score DECIMAL(5,2)
last_detected_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 12.5 customer_followups

งาน Follow-up ลูกค้า

```sql
customer_followups
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
followup_type VARCHAR(100)
title VARCHAR(255)
description TEXT NULL
due_at TIMESTAMP
status VARCHAR(50)
assigned_to UUID NULL
completed_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 12.6 automation_rules

กฎ Automation

```sql
automation_rules
----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
trigger_type VARCHAR(100)
conditions JSONB
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง Trigger:
- customer_inactive_30_days
- booking_created
- package_remaining_less_than_2_hours
- birthday
- booking_reminder

---

## 12.7 automation_actions

Action ของ Automation

```sql
automation_actions
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
automation_rule_id UUID FK -> automation_rules.id
action_type VARCHAR(100)
action_config JSONB
sort_order INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง Action:
- send_line_message
- issue_coupon
- create_followup_task
- add_segment
- send_booking_reminder

---

## 12.8 automation_runs

ประวัติการทำงาน Automation

```sql
automation_runs
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
automation_rule_id UUID FK -> automation_rules.id
customer_profile_id UUID NULL
status VARCHAR(50)
input_data JSONB NULL
result_data JSONB NULL
error_message TEXT NULL
started_at TIMESTAMP
finished_at TIMESTAMP NULL
created_at TIMESTAMP
```

---

# 13. File Management Domain

---

## 13.1 files

ไฟล์กลางทั้งหมด

```sql
files
-----
id UUID PRIMARY KEY
organization_id UUID NULL
uploaded_by_user_id UUID NULL
uploaded_by_customer_id UUID NULL
file_category_id UUID NULL
storage_provider VARCHAR(50)
bucket VARCHAR(255)
path TEXT
original_name VARCHAR(255)
mime_type VARCHAR(100)
size_bytes BIGINT
checksum VARCHAR(255) NULL
is_public BOOLEAN
created_at TIMESTAMP
deleted_at TIMESTAMP NULL
```

ใช้เก็บ:
- Logo
- Banner
- Gallery
- Slip
- Invoice
- Tax Invoice
- Venue Map
- Customer Document

---

## 13.2 file_categories

ประเภทไฟล์

```sql
file_categories
---------------
id UUID PRIMARY KEY
code VARCHAR(100)
name VARCHAR(255)
description TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 14. Audit, Event & Job Queue Domain

---

## 14.1 audit_logs

Log การกระทำในระบบ

```sql
audit_logs
----------
id UUID PRIMARY KEY
organization_id UUID NULL
actor_type VARCHAR(50)
actor_id UUID NULL
action VARCHAR(150)
entity_type VARCHAR(100)
entity_id UUID NULL
old_values JSONB NULL
new_values JSONB NULL
ip_address VARCHAR(100) NULL
user_agent TEXT NULL
created_at TIMESTAMP
```

ตัวอย่าง:
- approve_payment
- cancel_booking
- update_court
- change_subscription
- delete_customer

---

## 14.2 events

Event Driven Architecture

```sql
events
------
id UUID PRIMARY KEY
organization_id UUID NULL
event_type VARCHAR(150)
aggregate_type VARCHAR(100)
aggregate_id UUID NULL
payload JSONB
occurred_at TIMESTAMP
created_at TIMESTAMP
```

ตัวอย่าง Event:
- booking.created
- booking.cancelled
- payment.verified
- membership.upgraded
- package.expiring
- customer.inactive

---

## 14.3 event_logs

Log การประมวลผล Event

```sql
event_logs
----------
id UUID PRIMARY KEY
event_id UUID FK -> events.id
handler_name VARCHAR(150)
status VARCHAR(50)
error_message TEXT NULL
processed_at TIMESTAMP NULL
created_at TIMESTAMP
```

---

## 14.4 jobs

Job Queue กลาง

```sql
jobs
----
id UUID PRIMARY KEY
organization_id UUID NULL
job_type VARCHAR(150)
payload JSONB
status VARCHAR(50)
priority INTEGER DEFAULT 0
run_at TIMESTAMP
attempt_count INTEGER DEFAULT 0
max_attempts INTEGER DEFAULT 3
locked_at TIMESTAMP NULL
completed_at TIMESTAMP NULL
failed_at TIMESTAMP NULL
error_message TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 14.5 job_logs

Log การรัน Job

```sql
job_logs
--------
id UUID PRIMARY KEY
job_id UUID FK -> jobs.id
status VARCHAR(50)
message TEXT NULL
created_at TIMESTAMP
```

---

# 15. Analytics & Data Warehouse Domain

---

## 15.1 daily_metrics

Metric รายวันต่อ Organization

```sql
daily_metrics
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
metric_date DATE
revenue DECIMAL(12,2)
booking_count INTEGER
cancelled_booking_count INTEGER
new_customer_count INTEGER
active_customer_count INTEGER
court_utilization_rate DECIMAL(5,2)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 15.2 monthly_metrics

Metric รายเดือน

```sql
monthly_metrics
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
metric_month DATE
revenue DECIMAL(12,2)
booking_count INTEGER
new_customer_count INTEGER
active_customer_count INTEGER
repeat_customer_rate DECIMAL(5,2)
court_utilization_rate DECIMAL(5,2)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 15.3 fact_bookings

Fact Table สำหรับ Analytics

```sql
fact_bookings
-------------
id UUID PRIMARY KEY
organization_id UUID
branch_id UUID
court_id UUID
customer_profile_id UUID
booking_id UUID
booking_date DATE
sport_id UUID
duration_minutes INTEGER
revenue DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
```

---

## 15.4 fact_payments

Fact Payment

```sql
fact_payments
-------------
id UUID PRIMARY KEY
organization_id UUID
payment_id UUID
booking_id UUID NULL
payment_date DATE
method VARCHAR(50)
amount DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
```

---

## 15.5 feature_usage_logs

เก็บการใช้ Feature เพื่อ Analytics / Billing

```sql
feature_usage_logs
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
feature_id UUID FK -> features.id
usage_type VARCHAR(100)
quantity DECIMAL(12,2)
metadata JSONB NULL
created_at TIMESTAMP
```

---

# 16. Tournament Module

เผื่อ Phase 3

---

## 16.1 tournaments

```sql
tournaments
-----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
sport_id UUID FK -> sports.id
name VARCHAR(255)
description TEXT NULL
start_at TIMESTAMP
end_at TIMESTAMP
registration_start_at TIMESTAMP
registration_end_at TIMESTAMP
max_teams INTEGER
entry_fee DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 16.2 tournament_categories

```sql
tournament_categories
---------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
tournament_id UUID FK -> tournaments.id
name VARCHAR(255)
description TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 16.3 tournament_teams

```sql
tournament_teams
----------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
tournament_id UUID FK -> tournaments.id
name VARCHAR(255)
captain_customer_id UUID FK -> customer_profiles.id
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 16.4 tournament_players

```sql
tournament_players
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
tournament_team_id UUID FK -> tournament_teams.id
customer_profile_id UUID FK -> customer_profiles.id
created_at TIMESTAMP
```

---

## 16.5 tournament_matches

```sql
tournament_matches
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
tournament_id UUID FK -> tournaments.id
court_id UUID NULL
team_a_id UUID NULL
team_b_id UUID NULL
scheduled_at TIMESTAMP NULL
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 16.6 tournament_results

```sql
tournament_results
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
tournament_match_id UUID FK -> tournament_matches.id
winner_team_id UUID NULL
score_data JSONB
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 17. Find Player Module

---

## 17.1 player_groups

```sql
player_groups
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID NULL
sport_id UUID FK -> sports.id
title VARCHAR(255)
skill_level VARCHAR(50) NULL
needed_players INTEGER
status VARCHAR(50)
created_by_customer_id UUID FK -> customer_profiles.id
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 17.2 player_requests

```sql
player_requests
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
player_group_id UUID FK -> player_groups.id
customer_profile_id UUID FK -> customer_profiles.id
message TEXT NULL
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 17.3 player_group_members

```sql
player_group_members
--------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
player_group_id UUID FK -> player_groups.id
customer_profile_id UUID FK -> customer_profiles.id
role VARCHAR(50)
joined_at TIMESTAMP
created_at TIMESTAMP
```

---

# 18. Coach Module

---

## 18.1 coaches

```sql
coaches
-------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
user_id UUID NULL
customer_profile_id UUID NULL
name VARCHAR(255)
bio TEXT NULL
hourly_rate DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 18.2 coach_schedules

```sql
coach_schedules
---------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
coach_id UUID FK -> coaches.id
day_of_week INTEGER
start_time TIME
end_time TIME
is_active BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 18.3 coach_bookings

```sql
coach_bookings
--------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
booking_id UUID NULL
coach_id UUID FK -> coaches.id
customer_profile_id UUID FK -> customer_profiles.id
start_at TIMESTAMP
end_at TIMESTAMP
amount DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 18.4 coach_reviews

```sql
coach_reviews
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
coach_id UUID FK -> coaches.id
customer_profile_id UUID FK -> customer_profiles.id
rating INTEGER
comment TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 19. Marketplace Module

---

## 19.1 product_categories

```sql
product_categories
------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
parent_id UUID NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 19.2 products

```sql
products
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
product_category_id UUID NULL
name VARCHAR(255)
description TEXT NULL
sku VARCHAR(100) NULL
price DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 19.3 inventory

```sql
inventory
---------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
product_id UUID FK -> products.id
branch_id UUID NULL
quantity INTEGER
updated_at TIMESTAMP
```

---

## 19.4 orders

```sql
orders
------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
order_no VARCHAR(100) UNIQUE
subtotal DECIMAL(12,2)
discount DECIMAL(12,2)
total DECIMAL(12,2)
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 19.5 order_items

```sql
order_items
-----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
order_id UUID FK -> orders.id
product_id UUID FK -> products.id
quantity INTEGER
unit_price DECIMAL(12,2)
total_price DECIMAL(12,2)
created_at TIMESTAMP
```

---

# 20. Dynamic Form Module

---

## 20.1 custom_fields

```sql
custom_fields
-------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
entity_type VARCHAR(100)
field_key VARCHAR(100)
field_label VARCHAR(255)
field_type VARCHAR(50)
options JSONB NULL
is_required BOOLEAN
sort_order INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
```

entity_type:
- customer
- booking
- tournament
- coach
- team

---

## 20.2 custom_field_values

```sql
custom_field_values
-------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
custom_field_id UUID FK -> custom_fields.id
entity_type VARCHAR(100)
entity_id UUID
value JSONB
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

# 21. API & Integration Domain

---

## 21.1 integrations

```sql
integrations
------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
provider VARCHAR(100)
name VARCHAR(255)
config JSONB
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

ตัวอย่าง Provider:
- line
- google_calendar
- omise
- gb_prime_pay
- email
- sms

---

## 21.2 api_keys

```sql
api_keys
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
name VARCHAR(255)
key_hash TEXT
scopes JSONB
last_used_at TIMESTAMP NULL
expires_at TIMESTAMP NULL
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 21.3 webhooks

```sql
webhooks
--------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
url TEXT
events JSONB
secret TEXT
status VARCHAR(50)
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 21.4 webhook_logs

```sql
webhook_logs
------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
webhook_id UUID FK -> webhooks.id
event_id UUID NULL
payload JSONB
response_status INTEGER NULL
response_body TEXT NULL
status VARCHAR(50)
attempt_count INTEGER
created_at TIMESTAMP
```

---

# 22. Export, PDPA & Data Retention Domain

---

## 22.1 export_jobs

ให้สนาม Export ข้อมูลตอนเลิกใช้ หรือใช้งานรายงาน

```sql
export_jobs
-----------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
requested_by UUID FK -> users.id
export_type VARCHAR(100)
status VARCHAR(50)
file_id UUID NULL
requested_at TIMESTAMP
completed_at TIMESTAMP NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 22.2 customer_data_requests

คำขอเกี่ยวกับข้อมูลส่วนบุคคลตาม PDPA

```sql
customer_data_requests
----------------------
id UUID PRIMARY KEY
organization_id UUID FK -> organizations.id
customer_profile_id UUID FK -> customer_profiles.id
request_type VARCHAR(50)
status VARCHAR(50)
requested_at TIMESTAMP
processed_at TIMESTAMP NULL
processed_by UUID NULL
note TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

request_type:
- export
- delete
- anonymize
- update

---

# 23. Recommended Indexes

ควรทำ Index ตั้งแต่แรก

```sql
CREATE INDEX idx_bookings_org_date ON bookings (organization_id, booking_date);
CREATE INDEX idx_bookings_org_status ON bookings (organization_id, status);
CREATE INDEX idx_bookings_customer ON bookings (organization_id, customer_profile_id);

CREATE INDEX idx_payments_org_status ON payments (organization_id, status);
CREATE INDEX idx_payment_slips_org_status ON payment_slips (organization_id, status);

CREATE INDEX idx_customer_profiles_org ON customer_profiles (organization_id);
CREATE INDEX idx_customer_profiles_global ON customer_profiles (global_customer_id);

CREATE INDEX idx_notification_jobs_send_at ON notification_jobs (status, send_at);

CREATE INDEX idx_events_org_type ON events (organization_id, event_type);
CREATE INDEX idx_audit_logs_org_entity ON audit_logs (organization_id, entity_type, entity_id);

CREATE INDEX idx_subscriptions_org_status ON subscriptions (organization_id, status);
CREATE INDEX idx_subscriptions_expire ON subscriptions (expire_at);
```

---

# 24. MVP Table List

ตารางที่ควรสร้างใช้งานจริงใน Phase 1

## Platform
- organizations
- organization_settings
- branches
- system_settings

## User & Permission
- users
- organization_users
- roles
- permissions
- role_permissions
- user_roles
- sessions

## Subscription
- plans
- features
- plan_features
- subscriptions
- subscription_invoices
- subscription_payments
- organization_feature_overrides

## Customer & LINE
- global_customers
- line_profiles
- customer_profiles
- organization_line_accounts
- line_friendships

## Venue & Court
- sports
- venues
- courts
- court_schedules
- court_price_rules
- court_maintenance
- facilities
- venue_facilities
- venue_maps

## Booking
- bookings
- booking_items
- booking_status_logs
- booking_checkins
- booking_waitlists
- cancellation_rules

## Payment
- payment_methods
- payments
- payment_slips
- refunds
- invoices
- invoice_items

## Membership / Wallet
- membership_tiers
- memberships
- point_transactions
- packages
- customer_packages
- package_transactions
- wallets
- wallet_transactions

## Notification / CRM
- notification_templates
- notifications
- notification_jobs
- notification_logs
- communications
- customer_segments
- customer_timeline
- customer_patterns
- customer_followups

## System
- files
- file_categories
- audit_logs
- events
- event_logs
- jobs
- job_logs
- daily_metrics
- monthly_metrics

ประมาณ 70 ตารางสำหรับ MVP แบบเผื่อ Scale

---

# 25. Full Enterprise Table List

รวมทั้งหมดประมาณ 110+ ตาราง

## Core Platform
1. organizations
2. organization_settings
3. branches
4. system_settings

## User & Permission
5. users
6. organization_users
7. roles
8. permissions
9. role_permissions
10. user_roles
11. sessions

## Subscription & Billing
12. plans
13. features
14. plan_features
15. subscriptions
16. subscription_invoices
17. subscription_payments
18. organization_feature_overrides
19. feature_purchases
20. usage_records

## LINE & Customer
21. global_customers
22. line_profiles
23. customer_profiles
24. customer_addresses
25. customer_tags
26. customer_tag_assignments
27. customer_notes
28. line_friendships
29. organization_line_accounts

## Venue & Court
30. sports
31. venues
32. court_types
33. courts
34. court_schedules
35. court_price_rules
36. court_maintenance
37. court_images
38. facilities
39. venue_facilities
40. venue_maps

## Booking
41. bookings
42. booking_items
43. booking_status_logs
44. booking_checkins
45. booking_waitlists
46. booking_reviews
47. cancellation_rules

## Payment / Refund / Invoice
48. payment_methods
49. payments
50. payment_slips
51. refunds
52. refund_transactions
53. invoices
54. invoice_items
55. tax_invoices

## Membership / Loyalty / Package
56. membership_tiers
57. membership_benefits
58. memberships
59. membership_transactions
60. point_transactions
61. packages
62. customer_packages
63. package_transactions

## Wallet
64. wallets
65. wallet_transactions

## Promotion / Campaign
66. promotions
67. promotion_rules
68. coupons
69. coupon_redemptions
70. campaigns
71. broadcasts
72. broadcast_logs

## Notification / Communication
73. notification_templates
74. notifications
75. notification_jobs
76. notification_logs
77. communications

## CRM Automation
78. customer_segments
79. customer_segment_members
80. customer_timeline
81. customer_patterns
82. customer_followups
83. automation_rules
84. automation_actions
85. automation_runs

## File Management
86. files
87. file_categories

## Audit / Event / Jobs
88. audit_logs
89. events
90. event_logs
91. jobs
92. job_logs

## Analytics / Data Warehouse
93. daily_metrics
94. monthly_metrics
95. fact_bookings
96. fact_payments
97. feature_usage_logs

## Tournament
98. tournaments
99. tournament_categories
100. tournament_teams
101. tournament_players
102. tournament_matches
103. tournament_results

## Find Player
104. player_groups
105. player_requests
106. player_group_members

## Coach
107. coaches
108. coach_schedules
109. coach_bookings
110. coach_reviews

## Marketplace
111. product_categories
112. products
113. inventory
114. orders
115. order_items

## Dynamic Forms
116. custom_fields
117. custom_field_values

## API & Integration
118. integrations
119. api_keys
120. webhooks
121. webhook_logs

## Export & PDPA
122. export_jobs
123. customer_data_requests

---

# 26. Development Recommendation

แนะนำให้ทำ Database แบบ Enterprise Ready แต่เปิด UI แค่ MVP

```text
Database = รองรับเต็ม
UI = เปิดเฉพาะที่ต้องใช้
Feature = เปิดตาม Plan
```

## Phase 1
- Multi-Tenant
- Organization
- Branch
- User / Role / Permission
- Subscription
- LINE Login
- Customer Profile
- Court
- Booking
- Payment Slip
- Notification Reminder
- Membership / Package / Wallet เบื้องต้น

## Phase 2
- CRM
- Broadcast
- Promotion
- Waitlist
- Auto Rebooking
- Analytics

## Phase 3
- Tournament
- Find Player
- Coach
- Marketplace
- API / Webhook
- Data Warehouse

---

# 27. Key Architecture Rules

## Rule 1
ทุกข้อมูลของสนามต้องมี `organization_id`

## Rule 2
ลูกค้า LINE คนเดียวกัน ต้องแยก `customer_profiles` ตาม Organization

## Rule 3
ห้าม Hardcode Plan ใน Code ให้ใช้ Feature Flag

## Rule 4
Wallet ต้องใช้ Ledger Transaction เสมอ

## Rule 5
Booking Reminder ควรใช้ `notification_jobs` ไม่ใช่ Query Booking ตรงๆ

## Rule 6
ทุกการเปลี่ยนสถานะสำคัญต้องลง `events` และ `audit_logs`

## Rule 7
ไฟล์ทุกอย่างควรเก็บผ่าน `files` กลาง

## Rule 8
Subscription หมดอายุแล้วควร Soft Lock ไม่ลบข้อมูล

## Rule 9
Admin เดียวกันต้องเลือก Organization ก่อนเข้าระบบ

## Rule 10
ทุกตารางหลักควรมี `created_at`, `updated_at`, `deleted_at`

---

# 28. Final Notes

โครงสร้างนี้ออกแบบเพื่อให้ PlayCourt เติบโตจากระบบจองสนามธรรมดาไปเป็น:

```text
Venue Operating System for Sports Business
```

รองรับ:
- 1 สนาม
- 10 สนาม
- 100 สนาม
- 500+ สนาม

โดยไม่ต้องกลับมารื้อ Database หลักใหม่
