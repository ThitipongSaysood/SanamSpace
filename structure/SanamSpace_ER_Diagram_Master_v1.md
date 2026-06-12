# PlayCourt ER Diagram Master v1.0

## Domains

1. Platform Domain
2. User & Permission Domain
3. Subscription Domain
4. Customer & LINE Domain
5. Venue & Court Domain
6. Booking Domain
7. Payment Domain
8. Membership & Wallet Domain
9. CRM & Notification Domain
10. Analytics Domain

---

# Platform Domain

organizations
├─ organization_settings
├─ branches
├─ organization_users
├─ subscriptions
└─ organization_line_accounts

Tables:
- organizations
- organization_settings
- branches
- system_settings

---

# User & Permission Domain

users
├─ organization_users
├─ user_roles
└─ sessions

roles
└─ role_permissions
   └─ permissions

Tables:
- users
- organization_users
- roles
- permissions
- role_permissions
- user_roles
- sessions

---

# Subscription Domain

plans
├─ plan_features
│  └─ features
└─ subscriptions
   ├─ subscription_invoices
   └─ subscription_payments

Tables:
- plans
- features
- plan_features
- subscriptions
- subscription_invoices
- subscription_payments
- organization_feature_overrides
- feature_purchases
- usage_records

---

# Customer & LINE Domain

global_customers
├─ line_profiles
├─ customer_profiles
│  ├─ customer_addresses
│  ├─ customer_notes
│  ├─ memberships
│  ├─ wallets
│  ├─ bookings
│  └─ customer_timeline
└─ line_friendships

Tables:
- global_customers
- line_profiles
- customer_profiles
- customer_addresses
- customer_tags
- customer_tag_assignments
- customer_notes
- line_friendships
- organization_line_accounts

---

# Venue & Court Domain

branches
└─ venues
   ├─ venue_maps
   ├─ venue_facilities
   └─ courts
      ├─ court_schedules
      ├─ court_price_rules
      ├─ court_images
      └─ court_maintenance

Tables:
- sports
- venues
- court_types
- courts
- court_schedules
- court_price_rules
- court_maintenance
- court_images
- facilities
- venue_facilities
- venue_maps

---

# Booking Domain

customer_profiles
└─ bookings
   ├─ booking_items
   ├─ booking_status_logs
   ├─ booking_checkins
   ├─ booking_reviews
   └─ payments

Tables:
- bookings
- booking_items
- booking_status_logs
- booking_checkins
- booking_waitlists
- booking_reviews
- cancellation_rules

---

# Payment Domain

bookings
└─ payments
   ├─ payment_slips
   ├─ refunds
   │  └─ refund_transactions
   └─ invoices
      ├─ invoice_items
      └─ tax_invoices

Tables:
- payment_methods
- payments
- payment_slips
- refunds
- refund_transactions
- invoices
- invoice_items
- tax_invoices

---

# Membership & Wallet Domain

Tables:
- membership_tiers
- membership_benefits
- memberships
- membership_transactions
- point_transactions
- packages
- customer_packages
- package_transactions
- wallets
- wallet_transactions

---

# CRM & Notification Domain

Tables:
- customer_segments
- customer_segment_members
- customer_timeline
- customer_patterns
- customer_followups
- notifications
- notification_templates
- notification_jobs
- notification_logs
- communications
- automation_rules
- automation_actions
- automation_runs

---

# Analytics Domain

Tables:
- daily_metrics
- monthly_metrics
- fact_bookings
- fact_payments
- feature_usage_logs

---

# Future Modules

Tournament
- tournaments
- tournament_categories
- tournament_teams
- tournament_players
- tournament_matches
- tournament_results

Find Player
- player_groups
- player_requests
- player_group_members

Coach
- coaches
- coach_schedules
- coach_bookings
- coach_reviews

Marketplace
- product_categories
- products
- inventory
- orders
- order_items

API & Integration
- integrations
- api_keys
- webhooks
- webhook_logs

Dynamic Forms
- custom_fields
- custom_field_values

PDPA
- export_jobs
- customer_data_requests

---

# Summary

Core Platform ≈ 40 Tables
Growth Modules ≈ 35 Tables
Enterprise Modules ≈ 45 Tables

Total ≈ 120+ Tables
