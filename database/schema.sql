-- Smart Barangay Health Management System Database Schema
-- Compatible with MySQL 8.x +

CREATE DATABASE IF NOT EXISTS barangay_health_db;
USE barangay_health_db;

-- 1. Barangays Table
CREATE TABLE IF NOT EXISTS barangays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    address TEXT,
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'health_personnel', 'parent') NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    status ENUM('active', 'inactive', 'pending_approval') DEFAULT 'pending_approval',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Health Personnel Table
CREATE TABLE IF NOT EXISTS health_personnel (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    barangay_id INT,
    specialty VARCHAR(100),
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE SET NULL,
    INDEX idx_personnel_names (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Parents Table
CREATE TABLE IF NOT EXISTS parents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    address TEXT,
    barangay_id INT NOT NULL,
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE RESTRICT,
    INDEX idx_parents_names (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Children Table
CREATE TABLE IF NOT EXISTS children (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birthdate DATE NOT NULL,
    sex ENUM('M', 'F') NOT NULL,
    parent_id INT NOT NULL,
    barangay_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE RESTRICT,
    INDEX idx_children_names (last_name, first_name),
    INDEX idx_children_dob (birthdate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Growth Monitoring Table (BMI & Nutrition status)
CREATE TABLE IF NOT EXISTS growth_monitoring (
    id INT AUTO_INCREMENT PRIMARY KEY,
    child_id INT NOT NULL,
    visit_date DATE NOT NULL,
    height_cm DECIMAL(5, 2) NOT NULL,
    weight_kg DECIMAL(5, 2) NOT NULL,
    bmi DECIMAL(4, 2) NOT NULL,
    nutrition_status ENUM('Severe Wasting', 'Wasting', 'Normal', 'Overweight', 'Obese') NOT NULL,
    stunting_status ENUM('Normal', 'Stunted', 'Severe Stunting') DEFAULT 'Normal',
    wasting_status ENUM('Normal', 'Wasting', 'Severe Wasting', 'Overweight', 'Obese') DEFAULT 'Normal',
    micronutrient_deficiency_risk VARCHAR(255) DEFAULT 'Low Risk',
    recorded_by INT NOT NULL,
    recommendations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_growth_child (child_id),
    INDEX idx_growth_date (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Vaccines Table
CREATE TABLE IF NOT EXISTS vaccines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    target_age_months INT NOT NULL, -- Recommended age in months
    recommended_doses INT DEFAULT 1,
    schedule_interval_months INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Vaccination Records Table
CREATE TABLE IF NOT EXISTS vaccination_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    child_id INT NOT NULL,
    vaccine_id INT NOT NULL,
    dose_number INT NOT NULL,
    status ENUM('scheduled', 'completed', 'missed') DEFAULT 'scheduled',
    scheduled_date DATE NOT NULL,
    administered_date DATE NULL,
    administered_by INT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    FOREIGN KEY (vaccine_id) REFERENCES vaccines(id) ON DELETE RESTRICT,
    FOREIGN KEY (administered_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_child_vaccine_dose (child_id, vaccine_id, dose_number),
    INDEX idx_vac_status (status),
    INDEX idx_vac_scheduled (scheduled_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Pregnant Women Table
CREATE TABLE IF NOT EXISTS pregnant_women (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT NULL, -- If they have a parent user account
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    address TEXT,
    barangay_id INT NOT NULL,
    pregnancy_week_start INT NOT NULL DEFAULT 1, -- week count at registration
    conception_date DATE NOT NULL,
    expected_delivery_date DATE NOT NULL,
    risk_status ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Low',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE RESTRICT,
    INDEX idx_preg_risk (risk_status),
    INDEX idx_preg_names (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Prenatal Visits Table
CREATE TABLE IF NOT EXISTS prenatal_visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pregnant_woman_id INT NOT NULL,
    visit_date DATE NOT NULL,
    pregnancy_week INT NOT NULL,
    blood_pressure VARCHAR(20) NOT NULL,
    weight_kg DECIMAL(5, 2) NOT NULL,
    heart_rate INT NULL,
    risk_status ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Low',
    prescribed_medications TEXT,
    ai_care_plan TEXT,
    recommendations TEXT,
    notes TEXT,
    recorded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pregnant_woman_id) REFERENCES pregnant_women(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_visit_preg (pregnant_woman_id),
    INDEX idx_visit_date (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Health Programs / Community Events Table (AI Recommendations & Worker Approval Workflow)
CREATE TABLE IF NOT EXISTS health_programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('teenage_pregnancy', 'malnutrition', 'dengue', 'vaccination', 'maternal', 'general') NOT NULL,
    recommended_by_ai BOOLEAN DEFAULT TRUE,
    ai_rationale TEXT,
    target_audience VARCHAR(150),
    proposed_date DATE NOT NULL,
    location VARCHAR(200) DEFAULT 'Barangay Health Center',
    status ENUM('pending_approval', 'approved', 'rejected') DEFAULT 'pending_approval',
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_prog_status (status),
    INDEX idx_prog_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. AI Settings Table
CREATE TABLE IF NOT EXISTS ai_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Audit Logs Table (Data Privacy compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Target user
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('vaccination', 'prenatal', 'alert', 'general') DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Disease Cases Table (For Trend Analytics & AI prediction model training)
CREATE TABLE IF NOT EXISTS disease_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barangay_id INT NOT NULL,
    disease_name VARCHAR(100) NOT NULL,
    age_group VARCHAR(50) NOT NULL, -- '0-5', '6-12', '13-19', '20-39', '40+'
    case_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE RESTRICT,
    INDEX idx_disease_trend (disease_name, case_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Senior Citizens Table
CREATE TABLE IF NOT EXISTS senior_citizens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    birthdate DATE NOT NULL,
    address TEXT,
    barangay_id INT NOT NULL,
    contact_number VARCHAR(20),
    medical_conditions TEXT, -- e.g. Hypertension, Type 2 Diabetes, Osteoarthritis
    risk_level ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Low',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE RESTRICT,
    INDEX idx_senior_names (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Senior Medications Table
CREATE TABLE IF NOT EXISTS senior_medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    senior_id INT NOT NULL,
    medication_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    prescribed_by VARCHAR(100),
    status ENUM('active', 'discontinued') DEFAULT 'active',
    ai_precautions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (senior_id) REFERENCES senior_citizens(id) ON DELETE CASCADE,
    INDEX idx_senior_med (senior_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
