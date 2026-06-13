-- =============================================================================
-- SanamSpace / PlayCourt Database Schema
-- White Label Multi-Tenant Sports Venue Booking SaaS
--
-- Generated from:
--   - SanamSpace_Database_Architecture_v1_Full.md  (per-table column definitions)
--   - SanamSpace_ER_Diagram_Master_v1.md            (domain map + relationships)
--
-- Target:   MySQL 8+  (verified loadable on MySQL 9.6 / InnoDB)
-- Engine:   InnoDB
-- Charset:  utf8mb4 / utf8mb4_unicode_ci
--
-- Conventions (per Architecture doc, sections 0 & 27):
--   - Every tenant-scoped table carries organization_id.
--   - Standard soft-delete / audit columns where the doc shows them:
--       created_at, updated_at, deleted_at.
--   - UUID surrogate keys are mapped to CHAR(36).
--   - Money / amount columns are DECIMAL(12,2).
--   - Booleans are TINYINT(1).
--   - Timestamps are TIMESTAMP NULL (no implicit ON UPDATE / DEFAULT, so the
--     application controls values; MySQL otherwise auto-magics the first TIMESTAMP).
--   - "enum-like" status/type columns are kept as VARCHAR with an inline
--     "-- enum: ..." comment instead of a hard MySQL ENUM (per requirement).
--   - JSONB (Postgres pseudo-type in the doc) -> MySQL JSON.
--
-- FK strategy:
--   - ON DELETE CASCADE for tightly-owned children (rows meaningless without parent).
--   - ON DELETE RESTRICT for shared lookup / master references.
--   - ON DELETE SET NULL for optional / nullable references.
--   - FOREIGN_KEY_CHECKS is disabled during load so table order is forgiving;
--     tables are still grouped by domain for readability.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Optional database bootstrap (commented; table DDL below runs on the selected DB)
-- -----------------------------------------------------------------------------
-- CREATE DATABASE IF NOT EXISTS sanamspace
--   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE sanamspace;
-- -----------------------------------------------------------------------------

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- =============================================================================
-- ===== File Management (Domain 13) =====
-- Defined early because many tables reference files.id (logos, slips, maps, etc.)
-- =============================================================================

-- 13.2 file_categories : ประเภทไฟล์
CREATE TABLE file_categories (
  id          CHAR(36)     NOT NULL,
  code        VARCHAR(100) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  created_at  TIMESTAMP    NULL,
  updated_at  TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_file_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13.1 files : ไฟล์กลางทั้งหมด (logo, slip, invoice, venue map, customer doc, ...)
CREATE TABLE files (
  id                      CHAR(36)     NOT NULL,
  organization_id         CHAR(36)     NULL,         -- note: nullable; platform-global files allowed
  uploaded_by_user_id     CHAR(36)     NULL,
  uploaded_by_customer_id CHAR(36)     NULL,
  file_category_id        CHAR(36)     NULL,
  storage_provider        VARCHAR(50)  NULL,         -- enum: local | s3 | gcs | r2 | ...
  bucket                  VARCHAR(255) NULL,
  path                    TEXT         NULL,
  original_name           VARCHAR(255) NULL,
  mime_type               VARCHAR(100) NULL,
  size_bytes              BIGINT       NULL,
  checksum                VARCHAR(255) NULL,
  is_public               TINYINT(1)   NULL,
  created_at              TIMESTAMP    NULL,
  deleted_at              TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_files_org (organization_id),
  KEY idx_files_user (uploaded_by_user_id),
  KEY idx_files_customer (uploaded_by_customer_id),
  KEY idx_files_category (file_category_id),
  KEY idx_files_checksum (checksum),
  CONSTRAINT fk_files_category FOREIGN KEY (file_category_id) REFERENCES file_categories (id) ON DELETE SET NULL
  -- note: organization_id / uploaded_by_* FKs intentionally omitted to keep files
  --       usable platform-wide and to avoid load-order coupling; enforced in app layer.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Platform Core (Domain 1) =====
-- =============================================================================

-- 1.1 organizations : สนาม / ธุรกิจ / Workspace
CREATE TABLE organizations (
  id            CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL,
  business_type VARCHAR(100) NULL,
  status        VARCHAR(50)  NULL,        -- enum: active | trial | suspended | closed
  timezone      VARCHAR(100) NULL,
  trial_start_at TIMESTAMP   NULL,
  trial_end_at   TIMESTAMP   NULL,
  created_at    TIMESTAMP    NULL,
  updated_at    TIMESTAMP    NULL,
  deleted_at    TIMESTAMP    NULL,
  deleted_by    CHAR(36)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizations_slug (slug),
  KEY idx_organizations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.2 organization_settings : Branding และค่าตั้งค่า
CREATE TABLE organization_settings (
  id               CHAR(36)     NOT NULL,
  organization_id  CHAR(36)     NOT NULL,
  logo_file_id     CHAR(36)     NULL,
  favicon_file_id  CHAR(36)     NULL,
  cover_file_id    CHAR(36)     NULL,
  primary_color    VARCHAR(20)  NULL,
  secondary_color  VARCHAR(20)  NULL,
  accent_color     VARCHAR(20)  NULL,
  font_family      VARCHAR(100) NULL,
  line_oa_url      TEXT         NULL,
  facebook_url     TEXT         NULL,
  website_url      TEXT         NULL,
  phone            VARCHAR(50)  NULL,
  email            VARCHAR(255) NULL,
  address          TEXT         NULL,
  google_map_url   TEXT         NULL,
  default_language VARCHAR(20)  NULL,
  timezone         VARCHAR(100) NULL,
  created_at       TIMESTAMP    NULL,
  updated_at       TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_org_settings_org (organization_id),
  KEY idx_org_settings_logo (logo_file_id),
  KEY idx_org_settings_favicon (favicon_file_id),
  KEY idx_org_settings_cover (cover_file_id),
  CONSTRAINT fk_org_settings_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_org_settings_logo FOREIGN KEY (logo_file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT fk_org_settings_favicon FOREIGN KEY (favicon_file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT fk_org_settings_cover FOREIGN KEY (cover_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.3 branches : สาขา
CREATE TABLE branches (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  slug            VARCHAR(100)  NULL,
  address         TEXT          NULL,
  province        VARCHAR(100)  NULL,
  district        VARCHAR(100)  NULL,
  subdistrict     VARCHAR(100)  NULL,
  postal_code     VARCHAR(20)   NULL,
  latitude        DECIMAL(10,8) NULL,
  longitude       DECIMAL(11,8) NULL,
  phone           VARCHAR(50)   NULL,
  opening_time    TIME          NULL,
  closing_time    TIME          NULL,
  timezone        VARCHAR(100)  NULL,
  status          VARCHAR(50)   NULL,    -- enum: active | inactive | closed
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  deleted_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_branches_org (organization_id),
  KEY idx_branches_slug (slug),
  CONSTRAINT fk_branches_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.4 system_settings : ค่า Config กลางของระบบ
CREATE TABLE system_settings (
  id          CHAR(36)     NOT NULL,
  `key`       VARCHAR(255) NOT NULL,
  value       JSON         NULL,         -- note: doc JSONB -> JSON
  description TEXT         NULL,
  created_at  TIMESTAMP    NULL,
  updated_at  TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_system_settings_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== User, Role & Permission (Domain 2) =====
-- =============================================================================

-- 2.1 users : บัญชีฝั่ง Admin / Owner / Staff
CREATE TABLE users (
  id            CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NULL,
  phone         VARCHAR(50)  NULL,
  password_hash TEXT         NULL,
  avatar_file_id CHAR(36)    NULL,
  status        VARCHAR(50)  NULL,       -- enum: active | inactive | invited | suspended
  last_login_at TIMESTAMP    NULL,
  created_at    TIMESTAMP    NULL,
  updated_at    TIMESTAMP    NULL,
  deleted_at    TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_avatar (avatar_file_id),
  CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.2 organization_users : เชื่อม User กับ Organization
CREATE TABLE organization_users (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  user_id         CHAR(36)     NOT NULL,
  display_name    VARCHAR(255) NULL,
  status          VARCHAR(50)  NULL,     -- enum: active | inactive | invited
  joined_at       TIMESTAMP    NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_users_org_user (organization_id, user_id),
  KEY idx_org_users_org (organization_id),
  KEY idx_org_users_user (user_id),
  CONSTRAINT fk_org_users_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_org_users_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.3 roles : บทบาท (organization_id NULL = system role)
CREATE TABLE roles (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NULL,
  code            VARCHAR(100) NOT NULL, -- e.g. owner | manager | cashier | reception | coach
  name            VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  is_system_role  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_roles_org (organization_id),
  KEY idx_roles_code (code),
  CONSTRAINT fk_roles_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.4 permissions : สิทธิ์ละเอียด (global)
CREATE TABLE permissions (
  id          CHAR(36)     NOT NULL,
  code        VARCHAR(150) NOT NULL,     -- e.g. booking.view | payment.verify
  name        VARCHAR(255) NOT NULL,
  module      VARCHAR(100) NULL,
  description TEXT         NULL,
  created_at  TIMESTAMP    NULL,
  updated_at  TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code),
  KEY idx_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.5 role_permissions : เชื่อม Role กับ Permission
CREATE TABLE role_permissions (
  id            CHAR(36)  NOT NULL,
  role_id       CHAR(36)  NOT NULL,
  permission_id CHAR(36)  NOT NULL,
  created_at    TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_role_permissions_pair (role_id, permission_id),
  KEY idx_role_permissions_role (role_id),
  KEY idx_role_permissions_perm (permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.6 user_roles : กำหนด Role ให้ User ใน Organization
CREATE TABLE user_roles (
  id              CHAR(36)  NOT NULL,
  organization_id CHAR(36)  NOT NULL,
  user_id         CHAR(36)  NOT NULL,
  role_id         CHAR(36)  NOT NULL,
  created_at      TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_roles_triple (organization_id, user_id, role_id),
  KEY idx_user_roles_org (organization_id),
  KEY idx_user_roles_user (user_id),
  KEY idx_user_roles_role (role_id),
  CONSTRAINT fk_user_roles_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.7 sessions : Session การ Login
CREATE TABLE sessions (
  id         CHAR(36)     NOT NULL,
  user_id    CHAR(36)     NOT NULL,
  token_hash TEXT         NULL,
  ip_address VARCHAR(100) NULL,
  user_agent TEXT         NULL,
  expires_at TIMESTAMP    NULL,
  created_at TIMESTAMP    NULL,
  revoked_at TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Subscription, Plan & Billing (Domain 3) =====
-- =============================================================================

-- 3.1 plans
CREATE TABLE plans (
  id            CHAR(36)      NOT NULL,
  code          VARCHAR(100)  NOT NULL,  -- e.g. starter | business | pro | enterprise
  name          VARCHAR(255)  NOT NULL,
  description   TEXT          NULL,
  base_price    DECIMAL(12,2) NULL,
  billing_cycle VARCHAR(50)   NULL,      -- enum: monthly | yearly | one_time
  is_active     TINYINT(1)    NULL,
  created_at    TIMESTAMP     NULL,
  updated_at    TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.2 features
CREATE TABLE features (
  id          CHAR(36)     NOT NULL,
  code        VARCHAR(150) NOT NULL,     -- e.g. booking | wallet | crm | analytics
  name        VARCHAR(255) NOT NULL,
  module      VARCHAR(100) NULL,
  description TEXT         NULL,
  is_active   TINYINT(1)   NULL,
  created_at  TIMESTAMP    NULL,
  updated_at  TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_features_code (code),
  KEY idx_features_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.3 plan_features
CREATE TABLE plan_features (
  id          CHAR(36)    NOT NULL,
  plan_id     CHAR(36)    NOT NULL,
  feature_id  CHAR(36)    NOT NULL,
  limit_value INT         NULL,
  limit_unit  VARCHAR(50) NULL,
  created_at  TIMESTAMP   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plan_features_pair (plan_id, feature_id),
  KEY idx_plan_features_plan (plan_id),
  KEY idx_plan_features_feature (feature_id),
  CONSTRAINT fk_plan_features_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_features_feature FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.4 subscriptions
CREATE TABLE subscriptions (
  id                  CHAR(36)   NOT NULL,
  organization_id     CHAR(36)   NOT NULL,
  plan_id             CHAR(36)   NOT NULL,
  status              VARCHAR(50) NULL,   -- enum: trial | active | expired | suspended | cancelled
  start_at            TIMESTAMP  NULL,
  expire_at           TIMESTAMP  NULL,
  trial_start_at      TIMESTAMP  NULL,
  trial_end_at        TIMESTAMP  NULL,
  cancelled_at        TIMESTAMP  NULL,
  grace_period_end_at TIMESTAMP  NULL,
  auto_renew          TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP  NULL,
  updated_at          TIMESTAMP  NULL,
  PRIMARY KEY (id),
  KEY idx_subscriptions_org (organization_id),
  KEY idx_subscriptions_plan (plan_id),
  KEY idx_subscriptions_org_status (organization_id, status),
  KEY idx_subscriptions_expire (expire_at),
  CONSTRAINT fk_subscriptions_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.5 subscription_invoices
CREATE TABLE subscription_invoices (
  id                   CHAR(36)      NOT NULL,
  organization_id      CHAR(36)      NOT NULL,
  subscription_id      CHAR(36)      NOT NULL,
  invoice_no           VARCHAR(100)  NOT NULL,
  billing_period_start DATE          NULL,
  billing_period_end   DATE          NULL,
  subtotal             DECIMAL(12,2) NULL,
  discount             DECIMAL(12,2) NULL,
  vat                  DECIMAL(12,2) NULL,
  total                DECIMAL(12,2) NULL,
  status               VARCHAR(50)   NULL,  -- enum: unpaid | paid | overdue | cancelled
  due_date             DATE          NULL,
  paid_at              TIMESTAMP     NULL,
  created_at           TIMESTAMP     NULL,
  updated_at           TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sub_invoices_no (invoice_no),
  KEY idx_sub_invoices_org (organization_id),
  KEY idx_sub_invoices_sub (subscription_id),
  KEY idx_sub_invoices_status (status),
  CONSTRAINT fk_sub_invoices_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_invoices_sub FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.6 subscription_payments
CREATE TABLE subscription_payments (
  id                      CHAR(36)      NOT NULL,
  organization_id         CHAR(36)      NOT NULL,
  subscription_invoice_id CHAR(36)      NOT NULL,
  method                  VARCHAR(50)   NULL,  -- enum: transfer | card | promptpay | ...
  amount                  DECIMAL(12,2) NULL,
  slip_file_id            CHAR(36)      NULL,
  status                  VARCHAR(50)   NULL,  -- enum: pending | verified | rejected
  verified_by             CHAR(36)      NULL,
  verified_at             TIMESTAMP     NULL,
  created_at              TIMESTAMP     NULL,
  updated_at              TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_sub_payments_org (organization_id),
  KEY idx_sub_payments_invoice (subscription_invoice_id),
  KEY idx_sub_payments_slip (slip_file_id),
  KEY idx_sub_payments_verified_by (verified_by),
  CONSTRAINT fk_sub_payments_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_payments_invoice FOREIGN KEY (subscription_invoice_id) REFERENCES subscription_invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_payments_slip FOREIGN KEY (slip_file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT fk_sub_payments_verified_by FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.7 organization_feature_overrides
CREATE TABLE organization_feature_overrides (
  id              CHAR(36)  NOT NULL,
  organization_id CHAR(36)  NOT NULL,
  feature_id      CHAR(36)  NOT NULL,
  enabled         TINYINT(1) NULL,
  limit_value     INT       NULL,
  reason          TEXT      NULL,
  start_at        TIMESTAMP NULL,
  end_at          TIMESTAMP NULL,
  created_at      TIMESTAMP NULL,
  updated_at      TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_feature_overrides_pair (organization_id, feature_id),
  KEY idx_org_feature_overrides_org (organization_id),
  KEY idx_org_feature_overrides_feature (feature_id),
  CONSTRAINT fk_org_feature_overrides_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_org_feature_overrides_feature FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.8 feature_purchases
CREATE TABLE feature_purchases (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  feature_id      CHAR(36)      NOT NULL,
  price           DECIMAL(12,2) NULL,
  billing_cycle   VARCHAR(50)   NULL,    -- enum: monthly | yearly | one_time
  status          VARCHAR(50)   NULL,
  start_at        TIMESTAMP     NULL,
  expire_at       TIMESTAMP     NULL,
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_feature_purchases_org (organization_id),
  KEY idx_feature_purchases_feature (feature_id),
  CONSTRAINT fk_feature_purchases_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_feature_purchases_feature FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3.9 usage_records : Usage-Based Billing
CREATE TABLE usage_records (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  feature_id      CHAR(36)      NOT NULL,
  usage_key       VARCHAR(100)  NULL,
  quantity        DECIMAL(12,2) NULL,
  unit            VARCHAR(50)   NULL,
  recorded_at     TIMESTAMP     NULL,
  metadata        JSON          NULL,
  created_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_usage_records_org (organization_id),
  KEY idx_usage_records_feature (feature_id),
  KEY idx_usage_records_org_key (organization_id, usage_key),
  CONSTRAINT fk_usage_records_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_records_feature FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Customer & LINE (Domain 4) =====
-- =============================================================================

-- 4.1 global_customers : Identity กลางของลูกค้าจาก LINE
CREATE TABLE global_customers (
  id             CHAR(36)     NOT NULL,
  line_user_id   VARCHAR(255) NULL,
  display_name   VARCHAR(255) NULL,
  picture_url    TEXT         NULL,
  status_message TEXT         NULL,
  language       VARCHAR(20)  NULL,
  email          VARCHAR(255) NULL,
  phone          VARCHAR(50)  NULL,
  birthdate      DATE         NULL,
  gender         VARCHAR(50)  NULL,
  created_at     TIMESTAMP    NULL,
  updated_at     TIMESTAMP    NULL,
  deleted_at     TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_customers_line_user (line_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.2 line_profiles : ข้อมูลจาก LINE Login / LIFF
CREATE TABLE line_profiles (
  id                 CHAR(36)     NOT NULL,
  global_customer_id CHAR(36)     NOT NULL,
  line_user_id       VARCHAR(255) NULL,
  display_name       VARCHAR(255) NULL,
  picture_url        TEXT         NULL,
  status_message     TEXT         NULL,
  language           VARCHAR(20)  NULL,
  email              VARCHAR(255) NULL,
  raw_profile        JSON         NULL,
  last_synced_at     TIMESTAMP    NULL,
  created_at         TIMESTAMP    NULL,
  updated_at         TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_line_profiles_global (global_customer_id),
  KEY idx_line_profiles_line_user (line_user_id),
  CONSTRAINT fk_line_profiles_global FOREIGN KEY (global_customer_id) REFERENCES global_customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.3 customer_profiles : ลูกค้าแยกตามสนาม (tier_id -> membership_tiers, see Domain 8)
CREATE TABLE customer_profiles (
  id                 CHAR(36)      NOT NULL,
  organization_id    CHAR(36)      NOT NULL,
  global_customer_id CHAR(36)      NOT NULL,
  member_no          VARCHAR(100)  NULL,
  display_name       VARCHAR(255)  NULL,
  phone              VARCHAR(50)   NULL,
  email              VARCHAR(255)  NULL,
  birthdate          DATE          NULL,
  gender             VARCHAR(50)   NULL,
  tier_id            CHAR(36)      NULL,  -- note: FK -> membership_tiers.id (added after that table)
  status             VARCHAR(50)   NULL,
  first_joined_at    TIMESTAMP     NULL,
  last_visit_at      TIMESTAMP     NULL,
  total_spending     DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_bookings     INT           NOT NULL DEFAULT 0,
  created_at         TIMESTAMP     NULL,
  updated_at         TIMESTAMP     NULL,
  deleted_at         TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_customer_profiles_org (organization_id),
  KEY idx_customer_profiles_global (global_customer_id),
  KEY idx_customer_profiles_org_member (organization_id, member_no),
  KEY idx_customer_profiles_tier (tier_id),
  CONSTRAINT fk_customer_profiles_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_profiles_global FOREIGN KEY (global_customer_id) REFERENCES global_customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.4 customer_addresses
CREATE TABLE customer_addresses (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  customer_profile_id CHAR(36)     NOT NULL,
  label               VARCHAR(100) NULL,
  address             TEXT         NULL,
  province            VARCHAR(100) NULL,
  district            VARCHAR(100) NULL,
  subdistrict         VARCHAR(100) NULL,
  postal_code         VARCHAR(20)  NULL,
  is_default          TINYINT(1)   NULL,
  created_at          TIMESTAMP    NULL,
  updated_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_customer_addresses_org (organization_id),
  KEY idx_customer_addresses_customer (customer_profile_id),
  CONSTRAINT fk_customer_addresses_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.5 customer_tags
CREATE TABLE customer_tags (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,
  color           VARCHAR(20)  NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_customer_tags_org (organization_id),
  CONSTRAINT fk_customer_tags_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.6 customer_tag_assignments
CREATE TABLE customer_tag_assignments (
  id                  CHAR(36)  NOT NULL,
  organization_id     CHAR(36)  NOT NULL,
  customer_profile_id CHAR(36)  NOT NULL,
  customer_tag_id     CHAR(36)  NOT NULL,
  created_at          TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_tag_assignments_pair (customer_profile_id, customer_tag_id),
  KEY idx_customer_tag_assignments_org (organization_id),
  KEY idx_customer_tag_assignments_customer (customer_profile_id),
  KEY idx_customer_tag_assignments_tag (customer_tag_id),
  CONSTRAINT fk_customer_tag_assignments_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_tag_assignments_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_tag_assignments_tag FOREIGN KEY (customer_tag_id) REFERENCES customer_tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.7 customer_notes
CREATE TABLE customer_notes (
  id                  CHAR(36)  NOT NULL,
  organization_id     CHAR(36)  NOT NULL,
  customer_profile_id CHAR(36)  NOT NULL,
  note                TEXT      NULL,
  created_by          CHAR(36)  NULL,
  created_at          TIMESTAMP NULL,
  updated_at          TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_customer_notes_org (organization_id),
  KEY idx_customer_notes_customer (customer_profile_id),
  KEY idx_customer_notes_created_by (created_by),
  CONSTRAINT fk_customer_notes_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_notes_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_notes_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.8 line_friendships
CREATE TABLE line_friendships (
  id                 CHAR(36)     NOT NULL,
  organization_id    CHAR(36)     NOT NULL,
  global_customer_id CHAR(36)     NOT NULL,
  line_user_id       VARCHAR(255) NULL,
  is_friend          TINYINT(1)   NULL,
  followed_at        TIMESTAMP    NULL,
  unfollowed_at      TIMESTAMP    NULL,
  blocked_at         TIMESTAMP    NULL,
  created_at         TIMESTAMP    NULL,
  updated_at         TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_line_friendships_org (organization_id),
  KEY idx_line_friendships_global (global_customer_id),
  CONSTRAINT fk_line_friendships_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_line_friendships_global FOREIGN KEY (global_customer_id) REFERENCES global_customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.9 organization_line_accounts : LINE OA ของแต่ละสนาม
CREATE TABLE organization_line_accounts (
  id                   CHAR(36)     NOT NULL,
  organization_id      CHAR(36)     NOT NULL,
  oa_name              VARCHAR(255) NULL,
  basic_id             VARCHAR(100) NULL,
  channel_id           VARCHAR(255) NULL,
  channel_secret       TEXT         NULL,
  channel_access_token TEXT         NULL,
  webhook_url          TEXT         NULL,
  is_active            TINYINT(1)   NULL,
  created_at           TIMESTAMP    NULL,
  updated_at           TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_org_line_accounts_org (organization_id),
  CONSTRAINT fk_org_line_accounts_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Venue, Sport & Court (Domain 5) =====
-- =============================================================================

-- 5.1 sports
CREATE TABLE sports (
  id           CHAR(36)     NOT NULL,
  code         VARCHAR(100) NOT NULL,    -- e.g. badminton | football | tennis
  name_th      VARCHAR(255) NULL,
  name_en      VARCHAR(255) NULL,
  icon_file_id CHAR(36)     NULL,
  status       VARCHAR(50)  NULL,
  created_at   TIMESTAMP    NULL,
  updated_at   TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sports_code (code),
  KEY idx_sports_icon (icon_file_id),
  CONSTRAINT fk_sports_icon FOREIGN KEY (icon_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.2 venues
CREATE TABLE venues (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  branch_id       CHAR(36)     NULL,     -- note: doc shows FK; made nullable so a venue can predate a branch
  name            VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  cover_file_id   CHAR(36)     NULL,
  status          VARCHAR(50)  NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  deleted_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_venues_org (organization_id),
  KEY idx_venues_branch (branch_id),
  KEY idx_venues_cover (cover_file_id),
  CONSTRAINT fk_venues_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_venues_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_venues_cover FOREIGN KEY (cover_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.3 court_types
CREATE TABLE court_types (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  sport_id        CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_court_types_org (organization_id),
  KEY idx_court_types_sport (sport_id),
  CONSTRAINT fk_court_types_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_court_types_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.4 courts
CREATE TABLE courts (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  branch_id       CHAR(36)      NULL,
  venue_id        CHAR(36)      NULL,
  sport_id        CHAR(36)      NOT NULL,
  court_type_id   CHAR(36)      NULL,
  name            VARCHAR(255)  NOT NULL,
  code            VARCHAR(100)  NULL,
  description     TEXT          NULL,
  floor_type      VARCHAR(100)  NULL,
  ceiling_height  VARCHAR(100)  NULL,
  lighting_type   VARCHAR(100)  NULL,
  is_indoor       TINYINT(1)    NULL,
  has_aircon      TINYINT(1)    NULL,
  capacity        INT           NULL,
  base_price      DECIMAL(12,2) NULL,
  status          VARCHAR(50)   NULL,   -- enum: active | inactive | maintenance | closed
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  deleted_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_courts_org (organization_id),
  KEY idx_courts_branch (branch_id),
  KEY idx_courts_venue (venue_id),
  KEY idx_courts_sport (sport_id),
  KEY idx_courts_court_type (court_type_id),
  KEY idx_courts_org_status (organization_id, status),
  CONSTRAINT fk_courts_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_courts_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_courts_venue FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE SET NULL,
  CONSTRAINT fk_courts_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE RESTRICT,
  CONSTRAINT fk_courts_court_type FOREIGN KEY (court_type_id) REFERENCES court_types (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.5 court_schedules
CREATE TABLE court_schedules (
  id                    CHAR(36)  NOT NULL,
  organization_id       CHAR(36)  NOT NULL,
  court_id              CHAR(36)  NOT NULL,
  day_of_week           INT       NULL,   -- note: 0-6 (Sun-Sat) or 1-7 per app convention
  open_time             TIME      NULL,
  close_time            TIME      NULL,
  slot_duration_minutes INT       NULL,
  is_active             TINYINT(1) NULL,
  created_at            TIMESTAMP NULL,
  updated_at            TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_court_schedules_org (organization_id),
  KEY idx_court_schedules_court (court_id),
  CONSTRAINT fk_court_schedules_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_court_schedules_court FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.6 court_price_rules
CREATE TABLE court_price_rules (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  court_id        CHAR(36)      NOT NULL,
  name            VARCHAR(255)  NULL,
  day_of_week     INT           NULL,
  start_time      TIME          NULL,
  end_time        TIME          NULL,
  price           DECIMAL(12,2) NULL,
  priority        INT           NULL,
  is_active       TINYINT(1)    NULL,
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_court_price_rules_org (organization_id),
  KEY idx_court_price_rules_court (court_id),
  CONSTRAINT fk_court_price_rules_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_court_price_rules_court FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.7 court_maintenance
CREATE TABLE court_maintenance (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  court_id        CHAR(36)     NOT NULL,
  title           VARCHAR(255) NULL,
  description     TEXT         NULL,
  start_at        TIMESTAMP    NULL,
  end_at          TIMESTAMP    NULL,
  status          VARCHAR(50)  NULL,
  created_by      CHAR(36)     NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_court_maintenance_org (organization_id),
  KEY idx_court_maintenance_court (court_id),
  KEY idx_court_maintenance_created_by (created_by),
  CONSTRAINT fk_court_maintenance_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_court_maintenance_court FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE CASCADE,
  CONSTRAINT fk_court_maintenance_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.8 court_images
CREATE TABLE court_images (
  id              CHAR(36)  NOT NULL,
  organization_id CHAR(36)  NOT NULL,
  court_id        CHAR(36)  NOT NULL,
  file_id         CHAR(36)  NOT NULL,
  sort_order      INT       NULL,
  created_at      TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_court_images_org (organization_id),
  KEY idx_court_images_court (court_id),
  KEY idx_court_images_file (file_id),
  CONSTRAINT fk_court_images_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_court_images_court FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE CASCADE,
  CONSTRAINT fk_court_images_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.9 facilities : สิ่งอำนวยความสะดวก (global master)
CREATE TABLE facilities (
  id           CHAR(36)     NOT NULL,
  code         VARCHAR(100) NULL,        -- e.g. parking | locker | shower | wifi
  name_th      VARCHAR(255) NULL,
  name_en      VARCHAR(255) NULL,
  icon_file_id CHAR(36)     NULL,
  created_at   TIMESTAMP    NULL,
  updated_at   TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_facilities_code (code),
  KEY idx_facilities_icon (icon_file_id),
  CONSTRAINT fk_facilities_icon FOREIGN KEY (icon_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.10 venue_facilities
CREATE TABLE venue_facilities (
  id              CHAR(36)  NOT NULL,
  organization_id CHAR(36)  NOT NULL,
  venue_id        CHAR(36)  NOT NULL,
  facility_id     CHAR(36)  NOT NULL,
  description     TEXT      NULL,
  is_available    TINYINT(1) NULL,
  created_at      TIMESTAMP NULL,
  updated_at      TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_venue_facilities_pair (venue_id, facility_id),
  KEY idx_venue_facilities_org (organization_id),
  KEY idx_venue_facilities_venue (venue_id),
  KEY idx_venue_facilities_facility (facility_id),
  CONSTRAINT fk_venue_facilities_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_venue_facilities_venue FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE CASCADE,
  CONSTRAINT fk_venue_facilities_facility FOREIGN KEY (facility_id) REFERENCES facilities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.11 venue_maps
CREATE TABLE venue_maps (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  venue_id        CHAR(36)     NOT NULL,
  name            VARCHAR(255) NULL,
  map_file_id     CHAR(36)     NULL,     -- note: doc shows FK; nullable so a map record can predate its image
  map_data        JSON         NULL,
  is_active       TINYINT(1)   NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_venue_maps_org (organization_id),
  KEY idx_venue_maps_venue (venue_id),
  KEY idx_venue_maps_file (map_file_id),
  CONSTRAINT fk_venue_maps_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_venue_maps_venue FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE CASCADE,
  CONSTRAINT fk_venue_maps_file FOREIGN KEY (map_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Booking (Domain 6) =====
-- =============================================================================

-- 6.1 bookings : หัวใจของระบบจอง
CREATE TABLE bookings (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  branch_id           CHAR(36)      NULL,
  venue_id            CHAR(36)      NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  booking_no          VARCHAR(100)  NOT NULL,
  booking_date        DATE          NULL,
  start_at            TIMESTAMP     NULL,
  end_at              TIMESTAMP     NULL,
  status              VARCHAR(50)   NULL,  -- enum: draft|pending_payment|waiting_verify|confirmed|checked_in|completed|cancelled|expired|refunded
  subtotal            DECIMAL(12,2) NULL,
  discount            DECIMAL(12,2) NULL,
  total_amount        DECIMAL(12,2) NULL,
  payment_status      VARCHAR(50)   NULL,
  source              VARCHAR(50)   NULL,  -- enum: line | web | walk_in | admin
  created_by          CHAR(36)      NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  cancelled_at        TIMESTAMP     NULL,
  cancelled_by        CHAR(36)      NULL,
  deleted_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_no (booking_no),
  KEY idx_bookings_org (organization_id),
  KEY idx_bookings_branch (branch_id),
  KEY idx_bookings_venue (venue_id),
  KEY idx_bookings_customer (customer_profile_id),
  KEY idx_bookings_org_date (organization_id, booking_date),
  KEY idx_bookings_org_status (organization_id, status),
  KEY idx_bookings_org_customer (organization_id, customer_profile_id),
  CONSTRAINT fk_bookings_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_venue FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.2 booking_items : court | coach | locker | equipment | package | product
CREATE TABLE booking_items (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  booking_id      CHAR(36)      NOT NULL,
  item_type       VARCHAR(50)   NULL,    -- enum: court | coach | locker | equipment | package | product
  item_id         CHAR(36)      NULL,    -- note: polymorphic ref (no FK); resolved by item_type in app
  name            VARCHAR(255)  NULL,
  quantity        INT           NULL,
  unit_price      DECIMAL(12,2) NULL,
  total_price     DECIMAL(12,2) NULL,
  start_at        TIMESTAMP     NULL,
  end_at          TIMESTAMP     NULL,
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_booking_items_org (organization_id),
  KEY idx_booking_items_booking (booking_id),
  KEY idx_booking_items_item (item_type, item_id),
  CONSTRAINT fk_booking_items_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_items_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.3 booking_status_logs
CREATE TABLE booking_status_logs (
  id              CHAR(36)    NOT NULL,
  organization_id CHAR(36)    NOT NULL,
  booking_id      CHAR(36)    NOT NULL,
  from_status     VARCHAR(50) NULL,
  to_status       VARCHAR(50) NULL,
  changed_by      CHAR(36)    NULL,
  reason          TEXT        NULL,
  created_at      TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_booking_status_logs_org (organization_id),
  KEY idx_booking_status_logs_booking (booking_id),
  KEY idx_booking_status_logs_changed_by (changed_by),
  CONSTRAINT fk_booking_status_logs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_status_logs_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_status_logs_changed_by FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.4 booking_checkins
CREATE TABLE booking_checkins (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  booking_id          CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NOT NULL,
  checkin_at          TIMESTAMP   NULL,
  checkout_at         TIMESTAMP   NULL,
  checkin_method      VARCHAR(50) NULL,
  checked_by          CHAR(36)    NULL,
  created_at          TIMESTAMP   NULL,
  updated_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_booking_checkins_org (organization_id),
  KEY idx_booking_checkins_booking (booking_id),
  KEY idx_booking_checkins_customer (customer_profile_id),
  KEY idx_booking_checkins_checked_by (checked_by),
  CONSTRAINT fk_booking_checkins_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_checkins_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_checkins_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_checkins_checked_by FOREIGN KEY (checked_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.5 booking_waitlists
CREATE TABLE booking_waitlists (
  id                   CHAR(36)    NOT NULL,
  organization_id      CHAR(36)    NOT NULL,
  customer_profile_id  CHAR(36)    NOT NULL,
  court_id             CHAR(36)    NULL,
  sport_id             CHAR(36)    NULL,
  preferred_date       DATE        NULL,
  preferred_start_time TIME        NULL,
  preferred_end_time   TIME        NULL,
  status               VARCHAR(50) NULL,
  notified_at          TIMESTAMP   NULL,
  created_at           TIMESTAMP   NULL,
  updated_at           TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_booking_waitlists_org (organization_id),
  KEY idx_booking_waitlists_customer (customer_profile_id),
  KEY idx_booking_waitlists_court (court_id),
  KEY idx_booking_waitlists_sport (sport_id),
  CONSTRAINT fk_booking_waitlists_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_waitlists_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_waitlists_court FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE SET NULL,
  CONSTRAINT fk_booking_waitlists_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.6 booking_reviews
CREATE TABLE booking_reviews (
  id                   CHAR(36)  NOT NULL,
  organization_id      CHAR(36)  NOT NULL,
  booking_id           CHAR(36)  NOT NULL,
  customer_profile_id  CHAR(36)  NOT NULL,
  rating               INT       NULL,
  comment              TEXT      NULL,
  cleanliness_rating   INT       NULL,
  value_rating         INT       NULL,
  court_quality_rating INT       NULL,
  created_at           TIMESTAMP NULL,
  updated_at           TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_booking_reviews_org (organization_id),
  KEY idx_booking_reviews_booking (booking_id),
  KEY idx_booking_reviews_customer (customer_profile_id),
  CONSTRAINT fk_booking_reviews_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_reviews_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.7 cancellation_rules
CREATE TABLE cancellation_rules (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  name            VARCHAR(255) NULL,
  hours_before    INT          NULL,
  refund_percent  DECIMAL(5,2) NULL,
  is_active       TINYINT(1)   NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_cancellation_rules_org (organization_id),
  CONSTRAINT fk_cancellation_rules_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Payment, Slip, Refund & Invoice (Domain 7) =====
-- =============================================================================

-- 7.1 payment_methods
CREATE TABLE payment_methods (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  method_type     VARCHAR(50)  NULL,     -- enum: bank_transfer | promptpay | card | cash | wallet
  name            VARCHAR(255) NULL,
  account_name    VARCHAR(255) NULL,
  account_number  VARCHAR(100) NULL,
  bank_name       VARCHAR(100) NULL,
  promptpay_id    VARCHAR(100) NULL,
  qr_file_id      CHAR(36)     NULL,
  is_active       TINYINT(1)   NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_payment_methods_org (organization_id),
  KEY idx_payment_methods_qr (qr_file_id),
  CONSTRAINT fk_payment_methods_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_methods_qr FOREIGN KEY (qr_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.2 payments
CREATE TABLE payments (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  booking_id          CHAR(36)      NOT NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  payment_no          VARCHAR(100)  NOT NULL,
  method              VARCHAR(50)   NULL,
  amount              DECIMAL(12,2) NULL,
  status              VARCHAR(50)   NULL,  -- enum: pending | uploaded | verified | rejected | refunded | expired
  paid_at             TIMESTAMP     NULL,
  verified_by         CHAR(36)      NULL,
  verified_at         TIMESTAMP     NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_no (payment_no),
  KEY idx_payments_org (organization_id),
  KEY idx_payments_booking (booking_id),
  KEY idx_payments_customer (customer_profile_id),
  KEY idx_payments_org_status (organization_id, status),
  KEY idx_payments_verified_by (verified_by),
  CONSTRAINT fk_payments_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_verified_by FOREIGN KEY (verified_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.3 payment_slips
CREATE TABLE payment_slips (
  id                      CHAR(36)      NOT NULL,
  organization_id         CHAR(36)      NOT NULL,
  payment_id              CHAR(36)      NOT NULL,
  booking_id              CHAR(36)      NULL,
  file_id                 CHAR(36)      NULL,
  uploaded_by_customer_id CHAR(36)      NULL,
  ocr_amount              DECIMAL(12,2) NULL,
  ocr_bank                VARCHAR(100)  NULL,
  ocr_datetime            TIMESTAMP     NULL,
  ocr_raw                 JSON          NULL,
  duplicate_check_hash    VARCHAR(255)  NULL,
  status                  VARCHAR(50)   NULL,
  rejected_reason         TEXT          NULL,
  reviewed_by             CHAR(36)      NULL,
  reviewed_at             TIMESTAMP     NULL,
  created_at              TIMESTAMP     NULL,
  updated_at              TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_payment_slips_org (organization_id),
  KEY idx_payment_slips_payment (payment_id),
  KEY idx_payment_slips_booking (booking_id),
  KEY idx_payment_slips_file (file_id),
  KEY idx_payment_slips_customer (uploaded_by_customer_id),
  KEY idx_payment_slips_org_status (organization_id, status),
  KEY idx_payment_slips_dup_hash (duplicate_check_hash),
  KEY idx_payment_slips_reviewed_by (reviewed_by),
  CONSTRAINT fk_payment_slips_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_slips_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_slips_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_slips_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_slips_customer FOREIGN KEY (uploaded_by_customer_id) REFERENCES customer_profiles (id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_slips_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.4 refunds
CREATE TABLE refunds (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  booking_id          CHAR(36)      NULL,
  payment_id          CHAR(36)      NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  refund_no           VARCHAR(100)  NOT NULL,
  amount              DECIMAL(12,2) NULL,
  reason              TEXT          NULL,
  status              VARCHAR(50)   NULL,
  requested_by        CHAR(36)      NULL,
  approved_by         CHAR(36)      NULL,
  approved_at         TIMESTAMP     NULL,
  completed_at        TIMESTAMP     NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refunds_no (refund_no),
  KEY idx_refunds_org (organization_id),
  KEY idx_refunds_booking (booking_id),
  KEY idx_refunds_payment (payment_id),
  KEY idx_refunds_customer (customer_profile_id),
  KEY idx_refunds_approved_by (approved_by),
  CONSTRAINT fk_refunds_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL,
  CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE SET NULL,
  CONSTRAINT fk_refunds_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.5 refund_transactions
CREATE TABLE refund_transactions (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  refund_id       CHAR(36)      NOT NULL,
  method          VARCHAR(50)   NULL,
  amount          DECIMAL(12,2) NULL,
  bank_name       VARCHAR(100)  NULL,
  account_no      VARCHAR(100)  NULL,
  account_name    VARCHAR(255)  NULL,
  slip_file_id    CHAR(36)      NULL,
  status          VARCHAR(50)   NULL,
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_refund_transactions_org (organization_id),
  KEY idx_refund_transactions_refund (refund_id),
  KEY idx_refund_transactions_slip (slip_file_id),
  CONSTRAINT fk_refund_transactions_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_refund_transactions_refund FOREIGN KEY (refund_id) REFERENCES refunds (id) ON DELETE CASCADE,
  CONSTRAINT fk_refund_transactions_slip FOREIGN KEY (slip_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.6 invoices
CREATE TABLE invoices (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  booking_id          CHAR(36)      NULL,
  invoice_no          VARCHAR(100)  NOT NULL,
  subtotal            DECIMAL(12,2) NULL,
  discount            DECIMAL(12,2) NULL,
  vat                 DECIMAL(12,2) NULL,
  total               DECIMAL(12,2) NULL,
  status              VARCHAR(50)   NULL,
  issued_at           TIMESTAMP     NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_no (invoice_no),
  KEY idx_invoices_org (organization_id),
  KEY idx_invoices_customer (customer_profile_id),
  KEY idx_invoices_booking (booking_id),
  CONSTRAINT fk_invoices_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_invoices_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.7 invoice_items
CREATE TABLE invoice_items (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  invoice_id      CHAR(36)      NOT NULL,
  description     TEXT          NULL,
  quantity        INT           NULL,
  unit_price      DECIMAL(12,2) NULL,
  total_price     DECIMAL(12,2) NULL,
  created_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_invoice_items_org (organization_id),
  KEY idx_invoice_items_invoice (invoice_id),
  CONSTRAINT fk_invoice_items_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7.8 tax_invoices
CREATE TABLE tax_invoices (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  invoice_id      CHAR(36)     NOT NULL,
  tax_invoice_no  VARCHAR(100) NOT NULL,
  tax_name        VARCHAR(255) NULL,
  tax_id          VARCHAR(50)  NULL,
  tax_address     TEXT         NULL,
  issued_at       TIMESTAMP    NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tax_invoices_no (tax_invoice_no),
  KEY idx_tax_invoices_org (organization_id),
  KEY idx_tax_invoices_invoice (invoice_id),
  CONSTRAINT fk_tax_invoices_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_tax_invoices_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Membership, Loyalty & Package (Domain 8) =====
-- =============================================================================

-- 8.1 membership_tiers
CREATE TABLE membership_tiers (
  id                CHAR(36)      NOT NULL,
  organization_id   CHAR(36)      NOT NULL,
  name              VARCHAR(255)  NOT NULL,
  code              VARCHAR(100)  NULL,
  description       TEXT          NULL,
  required_spending DECIMAL(12,2) NULL,
  required_points   INT           NULL,
  discount_percent  DECIMAL(5,2)  NULL,
  valid_days        INT           NULL,
  is_active         TINYINT(1)    NULL,
  created_at        TIMESTAMP     NULL,
  updated_at        TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_membership_tiers_org (organization_id),
  KEY idx_membership_tiers_code (code),
  CONSTRAINT fk_membership_tiers_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Deferred FK: customer_profiles.tier_id -> membership_tiers.id (table now exists)
ALTER TABLE customer_profiles
  ADD CONSTRAINT fk_customer_profiles_tier FOREIGN KEY (tier_id) REFERENCES membership_tiers (id) ON DELETE SET NULL;

-- 8.2 membership_benefits
CREATE TABLE membership_benefits (
  id                 CHAR(36)     NOT NULL,
  organization_id    CHAR(36)     NOT NULL,
  membership_tier_id CHAR(36)     NOT NULL,
  benefit_type       VARCHAR(100) NULL,
  benefit_value      JSON         NULL,
  description        TEXT         NULL,
  created_at         TIMESTAMP    NULL,
  updated_at         TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_membership_benefits_org (organization_id),
  KEY idx_membership_benefits_tier (membership_tier_id),
  CONSTRAINT fk_membership_benefits_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_benefits_tier FOREIGN KEY (membership_tier_id) REFERENCES membership_tiers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.3 memberships
CREATE TABLE memberships (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NOT NULL,
  membership_tier_id  CHAR(36)    NOT NULL,
  status              VARCHAR(50) NULL,
  start_at            TIMESTAMP   NULL,
  expire_at           TIMESTAMP   NULL,
  created_at          TIMESTAMP   NULL,
  updated_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_memberships_org (organization_id),
  KEY idx_memberships_customer (customer_profile_id),
  KEY idx_memberships_tier (membership_tier_id),
  CONSTRAINT fk_memberships_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_memberships_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_memberships_tier FOREIGN KEY (membership_tier_id) REFERENCES membership_tiers (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.4 membership_transactions
CREATE TABLE membership_transactions (
  id                  CHAR(36)  NOT NULL,
  organization_id     CHAR(36)  NOT NULL,
  customer_profile_id CHAR(36)  NOT NULL,
  from_tier_id        CHAR(36)  NULL,
  to_tier_id          CHAR(36)  NULL,
  reason              TEXT      NULL,
  created_at          TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_membership_tx_org (organization_id),
  KEY idx_membership_tx_customer (customer_profile_id),
  KEY idx_membership_tx_from (from_tier_id),
  KEY idx_membership_tx_to (to_tier_id),
  CONSTRAINT fk_membership_tx_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_tx_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_tx_from FOREIGN KEY (from_tier_id) REFERENCES membership_tiers (id) ON DELETE SET NULL,
  CONSTRAINT fk_membership_tx_to FOREIGN KEY (to_tier_id) REFERENCES membership_tiers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.5 point_transactions
CREATE TABLE point_transactions (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NOT NULL,
  transaction_type    VARCHAR(50) NULL,  -- enum: earn | redeem | adjust | expire | refund
  points              INT         NULL,
  reference_type      VARCHAR(50) NULL,
  reference_id        CHAR(36)    NULL,  -- note: polymorphic ref (no FK)
  description         TEXT        NULL,
  expire_at           TIMESTAMP   NULL,
  created_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_point_tx_org (organization_id),
  KEY idx_point_tx_customer (customer_profile_id),
  KEY idx_point_tx_ref (reference_type, reference_id),
  CONSTRAINT fk_point_tx_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_point_tx_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.6 packages
CREATE TABLE packages (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  description     TEXT          NULL,
  package_type    VARCHAR(50)   NULL,    -- enum: hours | sessions | monthly
  total_hours     DECIMAL(8,2)  NULL,
  total_sessions  INT           NULL,
  price           DECIMAL(12,2) NULL,
  valid_days      INT           NULL,
  is_active       TINYINT(1)    NULL,
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_packages_org (organization_id),
  CONSTRAINT fk_packages_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.7 customer_packages
CREATE TABLE customer_packages (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  customer_profile_id CHAR(36)     NOT NULL,
  package_id          CHAR(36)     NOT NULL,
  remaining_hours     DECIMAL(8,2) NULL,
  remaining_sessions  INT          NULL,
  status              VARCHAR(50)  NULL,
  start_at            TIMESTAMP    NULL,
  expire_at           TIMESTAMP    NULL,
  created_at          TIMESTAMP    NULL,
  updated_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_customer_packages_org (organization_id),
  KEY idx_customer_packages_customer (customer_profile_id),
  KEY idx_customer_packages_package (package_id),
  CONSTRAINT fk_customer_packages_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_packages_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_packages_package FOREIGN KEY (package_id) REFERENCES packages (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.8 package_transactions
CREATE TABLE package_transactions (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  customer_package_id CHAR(36)     NOT NULL,
  booking_id          CHAR(36)     NULL,
  transaction_type    VARCHAR(50)  NULL,
  hours               DECIMAL(8,2) NULL,
  sessions            INT          NULL,
  description         TEXT         NULL,
  created_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_package_tx_org (organization_id),
  KEY idx_package_tx_customer_package (customer_package_id),
  KEY idx_package_tx_booking (booking_id),
  CONSTRAINT fk_package_tx_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_package_tx_customer_package FOREIGN KEY (customer_package_id) REFERENCES customer_packages (id) ON DELETE CASCADE,
  CONSTRAINT fk_package_tx_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Wallet (Domain 9) =====
-- =============================================================================

-- 9.1 wallets
CREATE TABLE wallets (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  balance             DECIMAL(12,2) NOT NULL DEFAULT 0,
  status              VARCHAR(50)   NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallets_org_customer (organization_id, customer_profile_id),
  KEY idx_wallets_org (organization_id),
  KEY idx_wallets_customer (customer_profile_id),
  CONSTRAINT fk_wallets_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_wallets_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9.2 wallet_transactions : Ledger (Rule 4 - ต้องใช้ Ledger Transaction เสมอ)
CREATE TABLE wallet_transactions (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  wallet_id           CHAR(36)      NOT NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  transaction_type    VARCHAR(50)   NULL,  -- enum: topup | payment | refund | bonus | adjustment | expire
  amount              DECIMAL(12,2) NULL,
  balance_before      DECIMAL(12,2) NULL,
  balance_after       DECIMAL(12,2) NULL,
  reference_type      VARCHAR(50)   NULL,
  reference_id        CHAR(36)      NULL,  -- note: polymorphic ref (no FK)
  description         TEXT          NULL,
  created_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_wallet_tx_org (organization_id),
  KEY idx_wallet_tx_wallet (wallet_id),
  KEY idx_wallet_tx_customer (customer_profile_id),
  KEY idx_wallet_tx_ref (reference_type, reference_id),
  CONSTRAINT fk_wallet_tx_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_tx_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Promotion, Coupon & Campaign (Domain 10) =====
-- (Part of CRM & Notification domain in the ER master)
-- =============================================================================

-- 10.1 promotions
CREATE TABLE promotions (
  id                 CHAR(36)      NOT NULL,
  organization_id    CHAR(36)      NOT NULL,
  name               VARCHAR(255)  NOT NULL,
  description        TEXT          NULL,
  promotion_type     VARCHAR(50)   NULL,
  discount_type      VARCHAR(50)   NULL,  -- enum: percent | fixed
  discount_value     DECIMAL(12,2) NULL,
  start_at           TIMESTAMP     NULL,
  end_at             TIMESTAMP     NULL,
  usage_limit        INT           NULL,
  per_customer_limit INT           NULL,
  status             VARCHAR(50)   NULL,
  created_at         TIMESTAMP     NULL,
  updated_at         TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_promotions_org (organization_id),
  CONSTRAINT fk_promotions_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10.2 promotion_rules
CREATE TABLE promotion_rules (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  promotion_id    CHAR(36)     NOT NULL,
  rule_type       VARCHAR(100) NULL,
  rule_value      JSON         NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_promotion_rules_org (organization_id),
  KEY idx_promotion_rules_promotion (promotion_id),
  CONSTRAINT fk_promotion_rules_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_rules_promotion FOREIGN KEY (promotion_id) REFERENCES promotions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10.3 coupons
CREATE TABLE coupons (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  promotion_id    CHAR(36)      NULL,
  code            VARCHAR(100)  NOT NULL,
  name            VARCHAR(255)  NULL,
  discount_type   VARCHAR(50)   NULL,
  discount_value  DECIMAL(12,2) NULL,
  start_at        TIMESTAMP     NULL,
  end_at          TIMESTAMP     NULL,
  usage_limit     INT           NULL,
  used_count      INT           NOT NULL DEFAULT 0,
  status          VARCHAR(50)   NULL,
  created_at      TIMESTAMP     NULL,
  updated_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupons_org_code (organization_id, code),
  KEY idx_coupons_org (organization_id),
  KEY idx_coupons_promotion (promotion_id),
  CONSTRAINT fk_coupons_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_coupons_promotion FOREIGN KEY (promotion_id) REFERENCES promotions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10.4 coupon_redemptions
CREATE TABLE coupon_redemptions (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  coupon_id           CHAR(36)      NOT NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  booking_id          CHAR(36)      NULL,
  redeemed_at         TIMESTAMP     NULL,
  discount_amount     DECIMAL(12,2) NULL,
  created_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_coupon_redemptions_org (organization_id),
  KEY idx_coupon_redemptions_coupon (coupon_id),
  KEY idx_coupon_redemptions_customer (customer_profile_id),
  KEY idx_coupon_redemptions_booking (booking_id),
  CONSTRAINT fk_coupon_redemptions_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_redemptions_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_redemptions_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10.5 campaigns
CREATE TABLE campaigns (
  id                CHAR(36)     NOT NULL,
  organization_id   CHAR(36)     NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT         NULL,
  campaign_type     VARCHAR(50)  NULL,
  target_segment_id CHAR(36)     NULL,  -- note: FK -> customer_segments.id (added after that table)
  status            VARCHAR(50)  NULL,
  start_at          TIMESTAMP    NULL,
  end_at            TIMESTAMP    NULL,
  created_by        CHAR(36)     NULL,
  created_at        TIMESTAMP    NULL,
  updated_at        TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_campaigns_org (organization_id),
  KEY idx_campaigns_segment (target_segment_id),
  KEY idx_campaigns_created_by (created_by),
  CONSTRAINT fk_campaigns_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_campaigns_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10.6 broadcasts
CREATE TABLE broadcasts (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  campaign_id     CHAR(36)     NULL,
  channel         VARCHAR(50)  NULL,    -- enum: line | email | sms | push
  title           VARCHAR(255) NULL,
  message         TEXT         NULL,
  target_type     VARCHAR(50)  NULL,
  target_data     JSON         NULL,
  scheduled_at    TIMESTAMP    NULL,
  sent_at         TIMESTAMP    NULL,
  status          VARCHAR(50)  NULL,
  created_by      CHAR(36)     NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_broadcasts_org (organization_id),
  KEY idx_broadcasts_campaign (campaign_id),
  KEY idx_broadcasts_created_by (created_by),
  CONSTRAINT fk_broadcasts_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_broadcasts_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL,
  CONSTRAINT fk_broadcasts_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10.7 broadcast_logs
CREATE TABLE broadcast_logs (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  broadcast_id        CHAR(36)     NOT NULL,
  customer_profile_id CHAR(36)     NOT NULL,
  channel             VARCHAR(50)  NULL,
  status              VARCHAR(50)  NULL,
  provider_message_id VARCHAR(255) NULL,
  error_message       TEXT         NULL,
  sent_at             TIMESTAMP    NULL,
  created_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_broadcast_logs_org (organization_id),
  KEY idx_broadcast_logs_broadcast (broadcast_id),
  KEY idx_broadcast_logs_customer (customer_profile_id),
  CONSTRAINT fk_broadcast_logs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_broadcast_logs_broadcast FOREIGN KEY (broadcast_id) REFERENCES broadcasts (id) ON DELETE CASCADE,
  CONSTRAINT fk_broadcast_logs_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Notification & Communication (Domain 11) =====
-- =============================================================================

-- 11.1 notification_templates (organization_id NULL = platform default template)
CREATE TABLE notification_templates (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NULL,
  code            VARCHAR(150) NULL,    -- e.g. booking_confirmed | booking_reminder_1_day
  channel         VARCHAR(50)  NULL,
  title_template  TEXT         NULL,
  body_template   TEXT         NULL,
  metadata        JSON         NULL,
  is_active       TINYINT(1)   NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_notification_templates_org (organization_id),
  KEY idx_notification_templates_code (code),
  CONSTRAINT fk_notification_templates_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11.2 notifications (in-app; either customer_profile_id or user_id)
CREATE TABLE notifications (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  customer_profile_id CHAR(36)     NULL,
  user_id             CHAR(36)     NULL,
  title               VARCHAR(255) NULL,
  body                TEXT         NULL,
  type                VARCHAR(100) NULL,
  data                JSON         NULL,
  read_at             TIMESTAMP    NULL,
  created_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_org (organization_id),
  KEY idx_notifications_customer (customer_profile_id),
  KEY idx_notifications_user (user_id),
  CONSTRAINT fk_notifications_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11.3 notification_jobs (Rule 5 - reminders via jobs)
CREATE TABLE notification_jobs (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NOT NULL,
  booking_id          CHAR(36)    NULL,
  template_id         CHAR(36)    NULL,  -- note: doc shows FK; nullable so ad-hoc jobs need no template
  channel             VARCHAR(50) NULL,
  send_at             TIMESTAMP   NULL,
  status              VARCHAR(50) NULL,  -- enum: pending | processing | sent | failed | cancelled
  attempt_count       INT         NOT NULL DEFAULT 0,
  last_attempt_at     TIMESTAMP   NULL,
  sent_at             TIMESTAMP   NULL,
  error_message       TEXT        NULL,
  created_at          TIMESTAMP   NULL,
  updated_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_notification_jobs_org (organization_id),
  KEY idx_notification_jobs_customer (customer_profile_id),
  KEY idx_notification_jobs_booking (booking_id),
  KEY idx_notification_jobs_template (template_id),
  KEY idx_notification_jobs_send_at (status, send_at),
  CONSTRAINT fk_notification_jobs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_jobs_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_jobs_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_jobs_template FOREIGN KEY (template_id) REFERENCES notification_templates (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11.4 notification_logs
CREATE TABLE notification_logs (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  notification_job_id CHAR(36)     NULL,
  customer_profile_id CHAR(36)     NULL,
  channel             VARCHAR(50)  NULL,
  provider            VARCHAR(50)  NULL,
  provider_message_id VARCHAR(255) NULL,
  status              VARCHAR(50)  NULL,
  payload             JSON         NULL,
  response            JSON         NULL,
  error_message       TEXT         NULL,
  sent_at             TIMESTAMP    NULL,
  created_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_notification_logs_org (organization_id),
  KEY idx_notification_logs_job (notification_job_id),
  KEY idx_notification_logs_customer (customer_profile_id),
  CONSTRAINT fk_notification_logs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_logs_job FOREIGN KEY (notification_job_id) REFERENCES notification_jobs (id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_logs_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11.5 communications : ข้อความทุกช่องทางแบบกลาง
CREATE TABLE communications (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  customer_profile_id CHAR(36)     NULL,
  channel             VARCHAR(50)  NULL,  -- enum: line | email | sms | push | whatsapp
  direction           VARCHAR(50)  NULL,  -- enum: inbound | outbound
  subject             VARCHAR(255) NULL,
  message             TEXT         NULL,
  provider            VARCHAR(50)  NULL,
  provider_message_id VARCHAR(255) NULL,
  status              VARCHAR(50)  NULL,
  metadata            JSON         NULL,
  created_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_communications_org (organization_id),
  KEY idx_communications_customer (customer_profile_id),
  CONSTRAINT fk_communications_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_communications_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== CRM Automation (Domain 12) =====
-- =============================================================================

-- 12.1 customer_segments
CREATE TABLE customer_segments (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  segment_type    VARCHAR(50)  NULL,
  rules           JSON         NULL,
  is_active       TINYINT(1)   NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_customer_segments_org (organization_id),
  CONSTRAINT fk_customer_segments_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Deferred FK: campaigns.target_segment_id -> customer_segments.id (table now exists)
ALTER TABLE campaigns
  ADD CONSTRAINT fk_campaigns_segment FOREIGN KEY (target_segment_id) REFERENCES customer_segments (id) ON DELETE SET NULL;

-- 12.2 customer_segment_members
CREATE TABLE customer_segment_members (
  id                  CHAR(36)  NOT NULL,
  organization_id     CHAR(36)  NOT NULL,
  customer_segment_id CHAR(36)  NOT NULL,
  customer_profile_id CHAR(36)  NOT NULL,
  created_at          TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_segment_members_pair (customer_segment_id, customer_profile_id),
  KEY idx_customer_segment_members_org (organization_id),
  KEY idx_customer_segment_members_segment (customer_segment_id),
  KEY idx_customer_segment_members_customer (customer_profile_id),
  CONSTRAINT fk_customer_segment_members_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_segment_members_segment FOREIGN KEY (customer_segment_id) REFERENCES customer_segments (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_segment_members_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.3 customer_timeline
CREATE TABLE customer_timeline (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  customer_profile_id CHAR(36)     NOT NULL,
  event_type          VARCHAR(100) NULL,
  title               VARCHAR(255) NULL,
  description         TEXT         NULL,
  reference_type      VARCHAR(50)  NULL,
  reference_id        CHAR(36)     NULL,  -- note: polymorphic ref (no FK)
  metadata            JSON         NULL,
  created_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_customer_timeline_org (organization_id),
  KEY idx_customer_timeline_customer (customer_profile_id),
  KEY idx_customer_timeline_ref (reference_type, reference_id),
  CONSTRAINT fk_customer_timeline_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_timeline_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.4 customer_patterns
CREATE TABLE customer_patterns (
  id                   CHAR(36)     NOT NULL,
  organization_id      CHAR(36)     NOT NULL,
  customer_profile_id  CHAR(36)     NOT NULL,
  pattern_type         VARCHAR(100) NULL,
  day_of_week          INT          NULL,
  preferred_start_time TIME         NULL,
  preferred_end_time   TIME         NULL,
  sport_id             CHAR(36)     NULL,
  court_id             CHAR(36)     NULL,
  confidence_score     DECIMAL(5,2) NULL,
  last_detected_at     TIMESTAMP    NULL,
  created_at           TIMESTAMP    NULL,
  updated_at           TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_customer_patterns_org (organization_id),
  KEY idx_customer_patterns_customer (customer_profile_id),
  KEY idx_customer_patterns_sport (sport_id),
  KEY idx_customer_patterns_court (court_id),
  CONSTRAINT fk_customer_patterns_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_patterns_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_patterns_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE SET NULL,
  CONSTRAINT fk_customer_patterns_court FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.5 customer_followups
CREATE TABLE customer_followups (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  customer_profile_id CHAR(36)     NOT NULL,
  followup_type       VARCHAR(100) NULL,
  title               VARCHAR(255) NULL,
  description         TEXT         NULL,
  due_at              TIMESTAMP    NULL,
  status              VARCHAR(50)  NULL,
  assigned_to         CHAR(36)     NULL,
  completed_at        TIMESTAMP    NULL,
  created_at          TIMESTAMP    NULL,
  updated_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_customer_followups_org (organization_id),
  KEY idx_customer_followups_customer (customer_profile_id),
  KEY idx_customer_followups_assigned (assigned_to),
  CONSTRAINT fk_customer_followups_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_followups_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_followups_assigned FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.6 automation_rules
CREATE TABLE automation_rules (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  trigger_type    VARCHAR(100) NULL,
  conditions      JSON         NULL,
  is_active       TINYINT(1)   NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_automation_rules_org (organization_id),
  CONSTRAINT fk_automation_rules_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.7 automation_actions
CREATE TABLE automation_actions (
  id                 CHAR(36)     NOT NULL,
  organization_id    CHAR(36)     NOT NULL,
  automation_rule_id CHAR(36)     NOT NULL,
  action_type        VARCHAR(100) NULL,
  action_config      JSON         NULL,
  sort_order         INT          NULL,
  created_at         TIMESTAMP    NULL,
  updated_at         TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_automation_actions_org (organization_id),
  KEY idx_automation_actions_rule (automation_rule_id),
  CONSTRAINT fk_automation_actions_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_automation_actions_rule FOREIGN KEY (automation_rule_id) REFERENCES automation_rules (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.8 automation_runs
CREATE TABLE automation_runs (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  automation_rule_id  CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NULL,
  status              VARCHAR(50) NULL,
  input_data          JSON        NULL,
  result_data         JSON        NULL,
  error_message       TEXT        NULL,
  started_at          TIMESTAMP   NULL,
  finished_at         TIMESTAMP   NULL,
  created_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_automation_runs_org (organization_id),
  KEY idx_automation_runs_rule (automation_rule_id),
  KEY idx_automation_runs_customer (customer_profile_id),
  CONSTRAINT fk_automation_runs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_automation_runs_rule FOREIGN KEY (automation_rule_id) REFERENCES automation_rules (id) ON DELETE CASCADE,
  CONSTRAINT fk_automation_runs_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Audit, Event & Job Queue (Domain 14) =====
-- =============================================================================

-- 14.1 audit_logs
CREATE TABLE audit_logs (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NULL,
  actor_type      VARCHAR(50)  NULL,    -- enum: user | customer | system
  actor_id        CHAR(36)     NULL,
  action          VARCHAR(150) NULL,
  entity_type     VARCHAR(100) NULL,
  entity_id       CHAR(36)     NULL,
  old_values      JSON         NULL,
  new_values      JSON         NULL,
  ip_address      VARCHAR(100) NULL,
  user_agent      TEXT         NULL,
  created_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_audit_logs_org (organization_id),
  KEY idx_audit_logs_org_entity (organization_id, entity_type, entity_id),
  KEY idx_audit_logs_actor (actor_type, actor_id)
  -- note: organization_id FK omitted; audit logs are retained even if org is removed.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14.2 events : Event Driven Architecture
CREATE TABLE events (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NULL,
  event_type      VARCHAR(150) NULL,
  aggregate_type  VARCHAR(100) NULL,
  aggregate_id    CHAR(36)     NULL,
  payload         JSON         NULL,
  occurred_at     TIMESTAMP    NULL,
  created_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_events_org (organization_id),
  KEY idx_events_org_type (organization_id, event_type),
  KEY idx_events_aggregate (aggregate_type, aggregate_id)
  -- note: organization_id FK omitted; events are an immutable append-only stream.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14.3 event_logs
CREATE TABLE event_logs (
  id            CHAR(36)     NOT NULL,
  event_id      CHAR(36)     NOT NULL,
  handler_name  VARCHAR(150) NULL,
  status        VARCHAR(50)  NULL,
  error_message TEXT         NULL,
  processed_at  TIMESTAMP    NULL,
  created_at    TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_event_logs_event (event_id),
  CONSTRAINT fk_event_logs_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14.4 jobs : Job Queue กลาง
CREATE TABLE jobs (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NULL,
  job_type        VARCHAR(150) NULL,
  payload         JSON         NULL,
  status          VARCHAR(50)  NULL,
  priority        INT          NOT NULL DEFAULT 0,
  run_at          TIMESTAMP    NULL,
  attempt_count   INT          NOT NULL DEFAULT 0,
  max_attempts    INT          NOT NULL DEFAULT 3,
  locked_at       TIMESTAMP    NULL,
  completed_at    TIMESTAMP    NULL,
  failed_at       TIMESTAMP    NULL,
  error_message   TEXT         NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_jobs_org (organization_id),
  KEY idx_jobs_status_run_at (status, run_at)
  -- note: organization_id FK omitted; jobs may be platform-level.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14.5 job_logs
CREATE TABLE job_logs (
  id         CHAR(36)    NOT NULL,
  job_id     CHAR(36)    NOT NULL,
  status     VARCHAR(50) NULL,
  message    TEXT        NULL,
  created_at TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_job_logs_job (job_id),
  CONSTRAINT fk_job_logs_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Analytics & Data Warehouse (Domain 15) =====
-- note: fact_* tables are denormalized warehouse tables; per the doc they carry
--       reference ids WITHOUT FK markers, so no FKs are enforced on them.
-- =============================================================================

-- 15.1 daily_metrics
CREATE TABLE daily_metrics (
  id                      CHAR(36)      NOT NULL,
  organization_id         CHAR(36)      NOT NULL,
  metric_date             DATE          NULL,
  revenue                 DECIMAL(12,2) NULL,
  booking_count           INT           NULL,
  cancelled_booking_count INT           NULL,
  new_customer_count      INT           NULL,
  active_customer_count   INT           NULL,
  court_utilization_rate  DECIMAL(5,2)  NULL,
  created_at              TIMESTAMP     NULL,
  updated_at              TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_daily_metrics_org_date (organization_id, metric_date),
  KEY idx_daily_metrics_org (organization_id),
  CONSTRAINT fk_daily_metrics_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15.2 monthly_metrics
CREATE TABLE monthly_metrics (
  id                     CHAR(36)      NOT NULL,
  organization_id        CHAR(36)      NOT NULL,
  metric_month           DATE          NULL,
  revenue                DECIMAL(12,2) NULL,
  booking_count          INT           NULL,
  new_customer_count     INT           NULL,
  active_customer_count  INT           NULL,
  repeat_customer_rate   DECIMAL(5,2)  NULL,
  court_utilization_rate DECIMAL(5,2)  NULL,
  created_at             TIMESTAMP     NULL,
  updated_at             TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_monthly_metrics_org_month (organization_id, metric_month),
  KEY idx_monthly_metrics_org (organization_id),
  CONSTRAINT fk_monthly_metrics_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15.3 fact_bookings (warehouse fact table; no FKs per doc)
CREATE TABLE fact_bookings (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NULL,
  branch_id           CHAR(36)      NULL,
  court_id            CHAR(36)      NULL,
  customer_profile_id CHAR(36)      NULL,
  booking_id          CHAR(36)      NULL,
  booking_date        DATE          NULL,
  sport_id            CHAR(36)      NULL,
  duration_minutes    INT           NULL,
  revenue             DECIMAL(12,2) NULL,
  status              VARCHAR(50)   NULL,
  created_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_fact_bookings_org_date (organization_id, booking_date),
  KEY idx_fact_bookings_court (court_id),
  KEY idx_fact_bookings_customer (customer_profile_id),
  KEY idx_fact_bookings_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15.4 fact_payments (warehouse fact table; no FKs per doc)
CREATE TABLE fact_payments (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NULL,
  payment_id      CHAR(36)      NULL,
  booking_id      CHAR(36)      NULL,
  payment_date    DATE          NULL,
  method          VARCHAR(50)   NULL,
  amount          DECIMAL(12,2) NULL,
  status          VARCHAR(50)   NULL,
  created_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_fact_payments_org_date (organization_id, payment_date),
  KEY idx_fact_payments_payment (payment_id),
  KEY idx_fact_payments_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15.5 feature_usage_logs
CREATE TABLE feature_usage_logs (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  feature_id      CHAR(36)      NOT NULL,
  usage_type      VARCHAR(100)  NULL,
  quantity        DECIMAL(12,2) NULL,
  metadata        JSON          NULL,
  created_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_feature_usage_logs_org (organization_id),
  KEY idx_feature_usage_logs_feature (feature_id),
  CONSTRAINT fk_feature_usage_logs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_feature_usage_logs_feature FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- ===== Future Modules (detailed in Architecture v1, sections 16-22) =====
-- These appear under "Future Modules" in the ER master but ARE fully specified
-- with columns in the Architecture doc, so they are implemented in full here.
-- (No minimal stubs were required: every ER table has columns in the doc.)
-- =============================================================================

-- ----- Tournament Module (Architecture section 16) -----

-- 16.1 tournaments
CREATE TABLE tournaments (
  id                    CHAR(36)      NOT NULL,
  organization_id       CHAR(36)      NOT NULL,
  sport_id              CHAR(36)      NOT NULL,
  name                  VARCHAR(255)  NOT NULL,
  description           TEXT          NULL,
  start_at              TIMESTAMP     NULL,
  end_at                TIMESTAMP     NULL,
  registration_start_at TIMESTAMP     NULL,
  registration_end_at   TIMESTAMP     NULL,
  max_teams             INT           NULL,
  entry_fee             DECIMAL(12,2) NULL,
  status                VARCHAR(50)   NULL,
  created_at            TIMESTAMP     NULL,
  updated_at            TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_tournaments_org (organization_id),
  KEY idx_tournaments_sport (sport_id),
  CONSTRAINT fk_tournaments_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournaments_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16.2 tournament_categories
CREATE TABLE tournament_categories (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  tournament_id   CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_tournament_categories_org (organization_id),
  KEY idx_tournament_categories_tournament (tournament_id),
  CONSTRAINT fk_tournament_categories_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_categories_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16.3 tournament_teams
CREATE TABLE tournament_teams (
  id                  CHAR(36)     NOT NULL,
  organization_id     CHAR(36)     NOT NULL,
  tournament_id       CHAR(36)     NOT NULL,
  name                VARCHAR(255) NOT NULL,
  captain_customer_id CHAR(36)     NULL,
  status              VARCHAR(50)  NULL,
  created_at          TIMESTAMP    NULL,
  updated_at          TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_tournament_teams_org (organization_id),
  KEY idx_tournament_teams_tournament (tournament_id),
  KEY idx_tournament_teams_captain (captain_customer_id),
  CONSTRAINT fk_tournament_teams_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_teams_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_teams_captain FOREIGN KEY (captain_customer_id) REFERENCES customer_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16.4 tournament_players
CREATE TABLE tournament_players (
  id                  CHAR(36)  NOT NULL,
  organization_id     CHAR(36)  NOT NULL,
  tournament_team_id  CHAR(36)  NOT NULL,
  customer_profile_id CHAR(36)  NOT NULL,
  created_at          TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_tournament_players_org (organization_id),
  KEY idx_tournament_players_team (tournament_team_id),
  KEY idx_tournament_players_customer (customer_profile_id),
  CONSTRAINT fk_tournament_players_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_players_team FOREIGN KEY (tournament_team_id) REFERENCES tournament_teams (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_players_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16.5 tournament_matches
CREATE TABLE tournament_matches (
  id              CHAR(36)    NOT NULL,
  organization_id CHAR(36)    NOT NULL,
  tournament_id   CHAR(36)    NOT NULL,
  court_id        CHAR(36)    NULL,
  team_a_id       CHAR(36)    NULL,
  team_b_id       CHAR(36)    NULL,
  scheduled_at    TIMESTAMP   NULL,
  status          VARCHAR(50) NULL,
  created_at      TIMESTAMP   NULL,
  updated_at      TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_tournament_matches_org (organization_id),
  KEY idx_tournament_matches_tournament (tournament_id),
  KEY idx_tournament_matches_court (court_id),
  KEY idx_tournament_matches_team_a (team_a_id),
  KEY idx_tournament_matches_team_b (team_b_id),
  CONSTRAINT fk_tournament_matches_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_matches_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_matches_court FOREIGN KEY (court_id) REFERENCES courts (id) ON DELETE SET NULL,
  CONSTRAINT fk_tournament_matches_team_a FOREIGN KEY (team_a_id) REFERENCES tournament_teams (id) ON DELETE SET NULL,
  CONSTRAINT fk_tournament_matches_team_b FOREIGN KEY (team_b_id) REFERENCES tournament_teams (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16.6 tournament_results
CREATE TABLE tournament_results (
  id                  CHAR(36)  NOT NULL,
  organization_id     CHAR(36)  NOT NULL,
  tournament_match_id CHAR(36)  NOT NULL,
  winner_team_id      CHAR(36)  NULL,
  score_data          JSON      NULL,
  created_at          TIMESTAMP NULL,
  updated_at          TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_tournament_results_org (organization_id),
  KEY idx_tournament_results_match (tournament_match_id),
  KEY idx_tournament_results_winner (winner_team_id),
  CONSTRAINT fk_tournament_results_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_results_match FOREIGN KEY (tournament_match_id) REFERENCES tournament_matches (id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_results_winner FOREIGN KEY (winner_team_id) REFERENCES tournament_teams (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- Find Player Module (Architecture section 17) -----

-- 17.1 player_groups
CREATE TABLE player_groups (
  id                    CHAR(36)     NOT NULL,
  organization_id       CHAR(36)     NOT NULL,
  booking_id            CHAR(36)     NULL,
  sport_id              CHAR(36)     NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  skill_level           VARCHAR(50)  NULL,
  needed_players        INT          NULL,
  status                VARCHAR(50)  NULL,
  created_by_customer_id CHAR(36)    NOT NULL,
  created_at            TIMESTAMP    NULL,
  updated_at            TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_player_groups_org (organization_id),
  KEY idx_player_groups_booking (booking_id),
  KEY idx_player_groups_sport (sport_id),
  KEY idx_player_groups_creator (created_by_customer_id),
  CONSTRAINT fk_player_groups_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_groups_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL,
  CONSTRAINT fk_player_groups_sport FOREIGN KEY (sport_id) REFERENCES sports (id) ON DELETE RESTRICT,
  CONSTRAINT fk_player_groups_creator FOREIGN KEY (created_by_customer_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17.2 player_requests
CREATE TABLE player_requests (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  player_group_id     CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NOT NULL,
  message             TEXT        NULL,
  status              VARCHAR(50) NULL,
  created_at          TIMESTAMP   NULL,
  updated_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_player_requests_org (organization_id),
  KEY idx_player_requests_group (player_group_id),
  KEY idx_player_requests_customer (customer_profile_id),
  CONSTRAINT fk_player_requests_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_requests_group FOREIGN KEY (player_group_id) REFERENCES player_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_requests_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17.3 player_group_members
CREATE TABLE player_group_members (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  player_group_id     CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NOT NULL,
  role                VARCHAR(50) NULL,
  joined_at           TIMESTAMP   NULL,
  created_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_player_group_members_org (organization_id),
  KEY idx_player_group_members_group (player_group_id),
  KEY idx_player_group_members_customer (customer_profile_id),
  CONSTRAINT fk_player_group_members_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_group_members_group FOREIGN KEY (player_group_id) REFERENCES player_groups (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_group_members_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- Coach Module (Architecture section 18) -----

-- 18.1 coaches
CREATE TABLE coaches (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  user_id             CHAR(36)      NULL,
  customer_profile_id CHAR(36)      NULL,
  name                VARCHAR(255)  NOT NULL,
  bio                 TEXT          NULL,
  hourly_rate         DECIMAL(12,2) NULL,
  status              VARCHAR(50)   NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_coaches_org (organization_id),
  KEY idx_coaches_user (user_id),
  KEY idx_coaches_customer (customer_profile_id),
  CONSTRAINT fk_coaches_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_coaches_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_coaches_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18.2 coach_schedules
CREATE TABLE coach_schedules (
  id              CHAR(36)   NOT NULL,
  organization_id CHAR(36)   NOT NULL,
  coach_id        CHAR(36)   NOT NULL,
  day_of_week     INT        NULL,
  start_time      TIME       NULL,
  end_time        TIME       NULL,
  is_active       TINYINT(1) NULL,
  created_at      TIMESTAMP  NULL,
  updated_at      TIMESTAMP  NULL,
  PRIMARY KEY (id),
  KEY idx_coach_schedules_org (organization_id),
  KEY idx_coach_schedules_coach (coach_id),
  CONSTRAINT fk_coach_schedules_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_coach_schedules_coach FOREIGN KEY (coach_id) REFERENCES coaches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18.3 coach_bookings
CREATE TABLE coach_bookings (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  booking_id          CHAR(36)      NULL,
  coach_id            CHAR(36)      NOT NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  start_at            TIMESTAMP     NULL,
  end_at              TIMESTAMP     NULL,
  amount              DECIMAL(12,2) NULL,
  status              VARCHAR(50)   NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_coach_bookings_org (organization_id),
  KEY idx_coach_bookings_booking (booking_id),
  KEY idx_coach_bookings_coach (coach_id),
  KEY idx_coach_bookings_customer (customer_profile_id),
  CONSTRAINT fk_coach_bookings_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_coach_bookings_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL,
  CONSTRAINT fk_coach_bookings_coach FOREIGN KEY (coach_id) REFERENCES coaches (id) ON DELETE CASCADE,
  CONSTRAINT fk_coach_bookings_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18.4 coach_reviews
CREATE TABLE coach_reviews (
  id                  CHAR(36)  NOT NULL,
  organization_id     CHAR(36)  NOT NULL,
  coach_id            CHAR(36)  NOT NULL,
  customer_profile_id CHAR(36)  NOT NULL,
  rating              INT       NULL,
  comment             TEXT      NULL,
  created_at          TIMESTAMP NULL,
  updated_at          TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_coach_reviews_org (organization_id),
  KEY idx_coach_reviews_coach (coach_id),
  KEY idx_coach_reviews_customer (customer_profile_id),
  CONSTRAINT fk_coach_reviews_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_coach_reviews_coach FOREIGN KEY (coach_id) REFERENCES coaches (id) ON DELETE CASCADE,
  CONSTRAINT fk_coach_reviews_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- Marketplace Module (Architecture section 19) -----

-- 19.1 product_categories (self-referencing parent_id)
CREATE TABLE product_categories (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  parent_id       CHAR(36)     NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_product_categories_org (organization_id),
  KEY idx_product_categories_parent (parent_id),
  CONSTRAINT fk_product_categories_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_categories_parent FOREIGN KEY (parent_id) REFERENCES product_categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19.2 products
CREATE TABLE products (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  product_category_id CHAR(36)      NULL,
  name                VARCHAR(255)  NOT NULL,
  description         TEXT          NULL,
  sku                 VARCHAR(100)  NULL,
  price               DECIMAL(12,2) NULL,
  status              VARCHAR(50)   NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_products_org (organization_id),
  KEY idx_products_category (product_category_id),
  KEY idx_products_sku (sku),
  CONSTRAINT fk_products_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (product_category_id) REFERENCES product_categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19.3 inventory
CREATE TABLE inventory (
  id              CHAR(36)  NOT NULL,
  organization_id CHAR(36)  NOT NULL,
  product_id      CHAR(36)  NOT NULL,
  branch_id       CHAR(36)  NULL,
  quantity        INT       NULL,
  updated_at      TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_inventory_org (organization_id),
  KEY idx_inventory_product (product_id),
  KEY idx_inventory_branch (branch_id),
  CONSTRAINT fk_inventory_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_branch FOREIGN KEY (branch_id) REFERENCES branches (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19.4 orders
CREATE TABLE orders (
  id                  CHAR(36)      NOT NULL,
  organization_id     CHAR(36)      NOT NULL,
  customer_profile_id CHAR(36)      NOT NULL,
  order_no            VARCHAR(100)  NOT NULL,
  subtotal            DECIMAL(12,2) NULL,
  discount            DECIMAL(12,2) NULL,
  total               DECIMAL(12,2) NULL,
  status              VARCHAR(50)   NULL,
  created_at          TIMESTAMP     NULL,
  updated_at          TIMESTAMP     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_no (order_no),
  KEY idx_orders_org (organization_id),
  KEY idx_orders_customer (customer_profile_id),
  CONSTRAINT fk_orders_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19.5 order_items
CREATE TABLE order_items (
  id              CHAR(36)      NOT NULL,
  organization_id CHAR(36)      NOT NULL,
  order_id        CHAR(36)      NOT NULL,
  product_id      CHAR(36)      NOT NULL,
  quantity        INT           NULL,
  unit_price      DECIMAL(12,2) NULL,
  total_price     DECIMAL(12,2) NULL,
  created_at      TIMESTAMP     NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_org (organization_id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- Dynamic Form Module (Architecture section 20) -----

-- 20.1 custom_fields
CREATE TABLE custom_fields (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  entity_type     VARCHAR(100) NULL,    -- enum: customer | booking | tournament | coach | team
  field_key       VARCHAR(100) NULL,
  field_label     VARCHAR(255) NULL,
  field_type      VARCHAR(50)  NULL,
  options         JSON         NULL,
  is_required     TINYINT(1)   NULL,
  sort_order      INT          NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_custom_fields_org (organization_id),
  KEY idx_custom_fields_org_entity (organization_id, entity_type),
  CONSTRAINT fk_custom_fields_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20.2 custom_field_values
CREATE TABLE custom_field_values (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  custom_field_id CHAR(36)     NOT NULL,
  entity_type     VARCHAR(100) NULL,
  entity_id       CHAR(36)     NULL,    -- note: polymorphic ref (no FK)
  value           JSON         NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_custom_field_values_org (organization_id),
  KEY idx_custom_field_values_field (custom_field_id),
  KEY idx_custom_field_values_entity (entity_type, entity_id),
  CONSTRAINT fk_custom_field_values_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_custom_field_values_field FOREIGN KEY (custom_field_id) REFERENCES custom_fields (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- API & Integration Domain (Architecture section 21) -----

-- 21.1 integrations
CREATE TABLE integrations (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  provider        VARCHAR(100) NULL,    -- e.g. line | google_calendar | omise | gb_prime_pay
  name            VARCHAR(255) NULL,
  config          JSON         NULL,
  status          VARCHAR(50)  NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_integrations_org (organization_id),
  CONSTRAINT fk_integrations_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21.2 api_keys
CREATE TABLE api_keys (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  name            VARCHAR(255) NULL,
  key_hash        TEXT         NULL,
  scopes          JSON         NULL,
  last_used_at    TIMESTAMP    NULL,
  expires_at      TIMESTAMP    NULL,
  status          VARCHAR(50)  NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_api_keys_org (organization_id),
  CONSTRAINT fk_api_keys_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21.3 webhooks
CREATE TABLE webhooks (
  id              CHAR(36)    NOT NULL,
  organization_id CHAR(36)    NOT NULL,
  url             TEXT        NULL,
  events          JSON        NULL,
  secret          TEXT        NULL,
  status          VARCHAR(50) NULL,
  created_at      TIMESTAMP   NULL,
  updated_at      TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_webhooks_org (organization_id),
  CONSTRAINT fk_webhooks_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21.4 webhook_logs
CREATE TABLE webhook_logs (
  id              CHAR(36)    NOT NULL,
  organization_id CHAR(36)    NOT NULL,
  webhook_id      CHAR(36)    NOT NULL,
  event_id        CHAR(36)    NULL,
  payload         JSON        NULL,
  response_status INT         NULL,
  response_body   TEXT        NULL,
  status          VARCHAR(50) NULL,
  attempt_count   INT         NULL,
  created_at      TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_webhook_logs_org (organization_id),
  KEY idx_webhook_logs_webhook (webhook_id),
  KEY idx_webhook_logs_event (event_id),
  CONSTRAINT fk_webhook_logs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_webhook_logs_webhook FOREIGN KEY (webhook_id) REFERENCES webhooks (id) ON DELETE CASCADE,
  CONSTRAINT fk_webhook_logs_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----- Export, PDPA & Data Retention Domain (Architecture section 22) -----

-- 22.1 export_jobs
CREATE TABLE export_jobs (
  id              CHAR(36)     NOT NULL,
  organization_id CHAR(36)     NOT NULL,
  requested_by    CHAR(36)     NULL,    -- note: doc shows FK -> users.id; nullable so system exports allowed
  export_type     VARCHAR(100) NULL,
  status          VARCHAR(50)  NULL,
  file_id         CHAR(36)     NULL,
  requested_at    TIMESTAMP    NULL,
  completed_at    TIMESTAMP    NULL,
  created_at      TIMESTAMP    NULL,
  updated_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_export_jobs_org (organization_id),
  KEY idx_export_jobs_requested_by (requested_by),
  KEY idx_export_jobs_file (file_id),
  CONSTRAINT fk_export_jobs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_export_jobs_requested_by FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_export_jobs_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22.2 customer_data_requests
CREATE TABLE customer_data_requests (
  id                  CHAR(36)    NOT NULL,
  organization_id     CHAR(36)    NOT NULL,
  customer_profile_id CHAR(36)    NOT NULL,
  request_type        VARCHAR(50) NULL,  -- enum: export | delete | anonymize | update
  status              VARCHAR(50) NULL,
  requested_at        TIMESTAMP   NULL,
  processed_at        TIMESTAMP   NULL,
  processed_by        CHAR(36)    NULL,
  note                TEXT        NULL,
  created_at          TIMESTAMP   NULL,
  updated_at          TIMESTAMP   NULL,
  PRIMARY KEY (id),
  KEY idx_customer_data_requests_org (organization_id),
  KEY idx_customer_data_requests_customer (customer_profile_id),
  KEY idx_customer_data_requests_processed_by (processed_by),
  CONSTRAINT fk_customer_data_requests_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_data_requests_customer FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_data_requests_processed_by FOREIGN KEY (processed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- End of schema
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 1;
