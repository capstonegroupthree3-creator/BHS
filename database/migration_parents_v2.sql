-- Migration: Add birthdate, sex, health_information to parents table
-- Run once against barangay_health_db

USE barangay_health_db;

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS birthdate DATE DEFAULT NULL AFTER last_name,
  ADD COLUMN IF NOT EXISTS sex ENUM('M','F') DEFAULT NULL AFTER birthdate,
  ADD COLUMN IF NOT EXISTS health_information TEXT DEFAULT NULL AFTER sex;

-- Update existing seed parents with birthdate/sex (optional demo values)
UPDATE parents SET birthdate = '1990-05-14', sex = 'F', health_information = 'No known allergies. Generally healthy. Last checkup: 2025.' WHERE id = 1;
UPDATE parents SET birthdate = '2001-07-27', sex = 'F', health_information = 'Currently pregnant. Iron supplement intake monitored.' WHERE id = 2;

-- Seed initial consent records for Gemma Caluyong (parent_id=1, child_id=1) and Rona Remitar (parent_id=2)
INSERT IGNORE INTO parent_guardian_consent (id, parent_id, child_id, consent_type, consent_status, consent_date, expiry_date, notes) VALUES
(1, 1, 1, 'Health Data Access', 'granted', '2026-02-05', '2027-02-05', 'Parent consented to health data recording for Gerelle Caluyong.'),
(2, 1, 1, 'Vaccination Records', 'granted', '2026-02-05', '2027-02-05', 'Parent consented to vaccination records being shared with health workers.'),
(3, 2, NULL, 'Prenatal Data Access', 'granted', '2026-01-16', '2026-12-31', 'Patient (Rona Remitar) consented to prenatal monitoring data access.');

