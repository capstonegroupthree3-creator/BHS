-- =============================================================================
-- SBHMS (Smart Barangay Health Management System) - Database Migration v2
-- =============================================================================
-- File:        migration_v2.sql
-- Database:    barangay_health_db
-- Version:     2.0
-- Description: Phase 1 enhancement migration. Adds new columns to existing
--              tables and creates new tables for family health access control,
--              parental/guardian consent, and WHO growth indicator tracking.
--
-- SAFETY:      This script is safe to re-run:
--              - ALTER TABLE uses ADD COLUMN IF NOT EXISTS (MySQL 8+)
--              - New tables use CREATE TABLE IF NOT EXISTS
--              - No existing columns, tables, or data are dropped or modified.
--
-- Author:      SBHMS Enhancement Team
-- Date:        2026-11-09
-- =============================================================================

USE barangay_health_db;

-- =============================================================================
-- SECTION 1: ALTER EXISTING TABLES
-- Add new columns to existing tables (non-destructive, MySQL 8+ syntax)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.1  users table
--      + date_of_birth           : user's date of birth
--      + language_preference     : UI language (English or Cebuano)
-- ---------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS date_of_birth DATE NULL,
    ADD COLUMN IF NOT EXISTS language_preference ENUM('en','ceb') DEFAULT 'en';

-- ---------------------------------------------------------------------------
-- 1.2  children table
--      + bmi_z_score   : latest computed BMI-for-age z-score
--      + who_indicator : WHO classification label for the child's BMI status
-- ---------------------------------------------------------------------------
ALTER TABLE children
    ADD COLUMN IF NOT EXISTS bmi_z_score DECIMAL(5,2) NULL,
    ADD COLUMN IF NOT EXISTS who_indicator VARCHAR(100) NULL;

-- ---------------------------------------------------------------------------
-- 1.3  senior_citizens table
--      + sex                      : biological sex (M/F)
--      + emergency_contact_name   : name of emergency contact person
--      + emergency_contact_number : phone number of emergency contact
-- ---------------------------------------------------------------------------
ALTER TABLE senior_citizens
    ADD COLUMN IF NOT EXISTS sex ENUM('M','F') NULL,
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS emergency_contact_number VARCHAR(20) NULL;

-- ---------------------------------------------------------------------------
-- 1.4  growth_monitoring table
--      + z_score          : computed z-score for the recorded measurement
--      + who_classification: WHO nutritional status classification
--      + age_months       : child's age in months at time of measurement
--      + indicator_type   : e.g. 'BMI-for-age', 'Weight-for-height', etc.
-- ---------------------------------------------------------------------------
ALTER TABLE growth_monitoring
    ADD COLUMN IF NOT EXISTS z_score DECIMAL(5,2) NULL,
    ADD COLUMN IF NOT EXISTS who_classification VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS age_months INT NULL,
    ADD COLUMN IF NOT EXISTS indicator_type VARCHAR(50) NULL;


-- =============================================================================
-- SECTION 2: CREATE NEW TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.1  parent_guardian_consent
--      Tracks formal data-processing consent from parents/guardians for
--      minors (children and adolescent mothers) in the system.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parent_guardian_consent (
    consent_id                  INT AUTO_INCREMENT PRIMARY KEY,
    parent_guardian_id          INT NOT NULL,
    minor_id                    INT NOT NULL,
    minor_type                  ENUM('child', 'adolescent_mother') NOT NULL DEFAULT 'child',
    consent_type                VARCHAR(100) NOT NULL DEFAULT 'health_data_processing',
    consent_status              ENUM('pending', 'granted', 'declined', 'withdrawn', 'expired') DEFAULT 'pending',
    consent_date                DATE NULL,
    acknowledgment_reference    VARCHAR(100) NULL,
    verified_by                 INT NULL,
    verification_date           DATE NULL,
    remarks                     TEXT NULL,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (parent_guardian_id) REFERENCES parents(id)    ON DELETE CASCADE,
    FOREIGN KEY (verified_by)        REFERENCES users(id)       ON DELETE SET NULL,

    INDEX idx_consent_minor  (minor_id, minor_type),
    INDEX idx_consent_status (consent_status),
    INDEX idx_consent_parent (parent_guardian_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2.2  family_relationships
--      Links an adult (registered user) to a senior citizen record,
--      capturing the nature of the relationship and verification status.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_relationships (
    relationship_id     INT AUTO_INCREMENT PRIMARY KEY,
    adult_user_id       INT NOT NULL,
    parent_resident_id  INT NOT NULL,
    relationship_type   ENUM('mother','father','legal_guardian','authorized_representative') NOT NULL,
    verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
    verified_by         INT NULL,
    verification_date   DATE NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (adult_user_id)      REFERENCES users(id)           ON DELETE CASCADE,
    FOREIGN KEY (parent_resident_id) REFERENCES senior_citizens(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by)        REFERENCES users(id)           ON DELETE SET NULL,

    UNIQUE KEY uq_adult_parent  (adult_user_id, parent_resident_id),
    INDEX idx_rel_adult         (adult_user_id),
    INDEX idx_rel_parent        (parent_resident_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2.3  family_health_access
--      Controls whether an adult user is permitted to view and interact
--      with the health records of a linked senior citizen.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_health_access (
    access_id           INT AUTO_INCREMENT PRIMARY KEY,
    relationship_id     INT NOT NULL,
    parent_resident_id  INT NOT NULL,
    adult_user_id       INT NOT NULL,
    access_status       ENUM('pending','approved','declined','revoked') DEFAULT 'pending',
    authorization_date  TIMESTAMP NULL,
    expiration_date     DATE NULL,
    revoked_at          TIMESTAMP NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (relationship_id)    REFERENCES family_relationships(relationship_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_resident_id) REFERENCES senior_citizens(id)                  ON DELETE CASCADE,
    FOREIGN KEY (adult_user_id)      REFERENCES users(id)                             ON DELETE CASCADE,

    INDEX idx_fha_status (access_status),
    INDEX idx_fha_adult  (adult_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2.4  family_access_permissions
--      Granular, per-access-grant permission flags controlling exactly
--      which health data categories the adult user may access.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_access_permissions (
    permission_id   INT AUTO_INCREMENT PRIMARY KEY,
    access_id       INT NOT NULL,
    permission_type ENUM(
        'view_personal_info',
        'view_medical_history',
        'view_medications',
        'view_health_assessments',
        'view_nutrition_assessments',
        'view_immunization_records',
        'view_upcoming_schedules',
        'receive_health_notifications',
        'submit_info_updates'
    ) NOT NULL,
    is_allowed      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (access_id) REFERENCES family_health_access(access_id) ON DELETE CASCADE,

    UNIQUE KEY uq_access_permission (access_id, permission_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2.5  family_access_consent
--      Audit trail of consent decisions (grant / decline / revoke) made
--      by a senior citizen for each family health access request.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_access_consent (
    consent_id                  INT AUTO_INCREMENT PRIMARY KEY,
    access_id                   INT NOT NULL,
    authorized_by               VARCHAR(100) NOT NULL,
    consent_status              ENUM('granted','declined','revoked') NOT NULL,
    consent_date                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledgment_reference    VARCHAR(100) NULL,
    revoked_at                  TIMESTAMP NULL,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (access_id) REFERENCES family_health_access(access_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- SECTION 3: VERIFICATION
-- Confirm all expected tables exist after migration
-- =============================================================================
SELECT
    table_name                                      AS `Table`,
    CASE
        WHEN table_name IN (
            'parent_guardian_consent',
            'family_relationships',
            'family_health_access',
            'family_access_permissions',
            'family_access_consent'
        ) THEN 'NEW (v2)'
        ELSE 'PRE-EXISTING'
    END                                             AS `Status`,
    table_rows                                      AS `Approx Rows`,
    ROUND((data_length + index_length) / 1024, 2)  AS `Size (KB)`
FROM information_schema.tables
WHERE table_schema = 'barangay_health_db'
ORDER BY
    FIELD(table_name,
        'parent_guardian_consent',
        'family_relationships',
        'family_health_access',
        'family_access_permissions',
        'family_access_consent'
    ) DESC,
    table_name ASC;

-- =============================================================================
-- END OF MIGRATION v2
-- =============================================================================
