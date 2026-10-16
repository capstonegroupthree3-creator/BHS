-- Seed Data for Smart Barangay Health Management System
-- Target: Barangay Camagong (10 Districts / Sitios)
-- Password for all users: password123 (Bcrypt: $2b$10$y60pIenrGzP9Q/hYqN.yju1l2C1.Xg6.Hk/kL3xT7gG08o51v4vPq)

USE barangay_health_db;

-- 1. Insert Districts / Sitios of Barangay Camagong
INSERT INTO barangays (id, name, address, contact_number) VALUES
(1, 'District 1', 'Barangay Camagong Sector 1', '0917-100-0001'),
(2, 'District 2', 'Barangay Camagong Sector 2', '0917-100-0002'),
(3, 'District 3', 'Barangay Camagong Sector 3', '0917-100-0003'),
(4, 'District 4', 'Barangay Camagong Sector 4', '0917-100-0004'),
(5, 'District 5', 'Barangay Camagong Sector 5', '0917-100-0005'),
(6, 'District 6', 'Barangay Camagong Sector 6', '0917-100-0006'),
(7, 'District 7', 'Barangay Camagong Sector 7', '0917-100-0007'),
(8, 'Sitio Minbahandi (District 8)', 'Sitio Minbahandi Hillside Zone', '0917-100-0008'),
(9, 'Sitio Hinandayan (District 9)', 'Sitio Hinandayan Zone', '0917-100-0009'),
(10, 'Sitio Baboy-Baboy (District 10)', 'Sitio Baboy-Baboy Zone', '0917-100-0010');

-- 2. Insert Users (Admin, Health Workers, Parents)
INSERT INTO users (id, username, password_hash, role, email, phone, status) VALUES
(1, 'admin', '$2a$10$WADvzX1kbVl/sRo9GF84yuuEYvAjwUjqwoHN9XkUwqkRcv35ayClW', 'admin', 'admin@camagong.gov.ph', '0917-000-0001', 'active'),
(2, 'worker1', '$2a$10$WADvzX1kbVl/sRo9GF84yuuEYvAjwUjqwoHN9XkUwqkRcv35ayClW', 'health_personnel', 'worker1@camagong.gov.ph', '0917-000-0002', 'active'),
(3, 'worker2', '$2a$10$WADvzX1kbVl/sRo9GF84yuuEYvAjwUjqwoHN9XkUwqkRcv35ayClW', 'health_personnel', 'worker2@camagong.gov.ph', '0917-000-0003', 'active'),
(4, 'parent_caluyong', '$2a$10$WADvzX1kbVl/sRo9GF84yuuEYvAjwUjqwoHN9XkUwqkRcv35ayClW', 'parent', 'gemma.caluyong@gmail.com', '0918-333-4444', 'active'),
(5, 'parent_remitar', '$2a$10$WADvzX1kbVl/sRo9GF84yuuEYvAjwUjqwoHN9XkUwqkRcv35ayClW', 'parent', 'rona.remitar@gmail.com', '0918-555-6666', 'active');

-- 3. Insert Health Personnel Directory
INSERT INTO health_personnel (id, user_id, first_name, last_name, barangay_id, specialty, contact_number) VALUES
(1, 2, 'Elena', 'Dalisay', 1, 'Maternal & Child Health Specialist', '0917-000-0002'),
(2, 3, 'Roberto', 'Santos', 7, 'Barangay Health Officer', '0917-000-0003');

-- 4. Insert Parents / Guardians
INSERT INTO parents (id, user_id, first_name, last_name, address, barangay_id, contact_number) VALUES
(1, 4, 'Gemma', 'Caluyong', 'District 7 Main Zone', 7, '0918-333-4444'),
(2, 5, 'Rona', 'Remitar', 'District 1 Main Zone', 1, '0918-555-6666');

-- 5. Insert Vaccine Catalog
INSERT INTO vaccines (id, name, type, target_age_months, recommended_doses, schedule_interval_months) VALUES
(1, 'BCG', 'Tuberculosis', 0, 1, 0),
(2, 'Hepatitis B', 'Hepatitis B', 0, 1, 0),
(3, 'Pentavalent', 'DPT-HepB-Hib', 1, 3, 1),
(4, 'OPV', 'Polio (Oral)', 1, 3, 1),
(5, 'IPV', 'Polio (Inactivated)', 3, 2, 5),
(6, 'PCV', 'Pneumococcal', 1, 3, 1),
(7, 'MMR', 'Measles, Mumps, Rubella', 9, 2, 3);

-- 6. Insert Child Record: Gerelle Caluyong (DOB: Feb 3, 2026, Mother: Gemma Caluyong, District 7)
INSERT INTO children (id, first_name, last_name, birthdate, sex, parent_id, barangay_id) VALUES
(1, 'Gerelle', 'Caluyong', '2026-02-03', 'M', 1, 7);

-- 7. Insert Growth Monitoring & Operation Timbang History for Gerelle Caluyong
INSERT INTO growth_monitoring (child_id, visit_date, height_cm, weight_kg, bmi, nutrition_status, stunting_status, wasting_status, micronutrient_deficiency_risk, recorded_by, recommendations) VALUES
(1, '2026-02-05', 50.0, 3.4, 13.60, 'Normal', 'Normal', 'Normal', 'Low Risk', 2, 'Newborn health checkup. Continue exclusive breastfeeding for the first 6 months.'),
(1, CURDATE(), 62.0, 6.8, 17.69, 'Normal', 'Normal', 'Normal', 'Low Risk', 2, 'Gerelle Caluyong is growing healthily! Weight and height are on track for age.');

-- 8. Insert Vaccination Records for Gerelle Caluyong
INSERT INTO vaccination_records (child_id, vaccine_id, dose_number, status, scheduled_date, administered_date, administered_by, remarks) VALUES
(1, 1, 1, 'completed', '2026-02-04', '2026-02-04', 2, 'BCG administered at birth'),
(1, 2, 1, 'completed', '2026-02-04', '2026-02-04', 2, 'Hepatitis B administered at birth'),
(1, 3, 1, 'completed', '2026-03-20', '2026-03-20', 2, 'Pentavalent Dose 1 completed'),
(1, 4, 1, 'completed', '2026-03-20', '2026-03-20', 2, 'OPV Dose 1 completed'),
(1, 6, 1, 'scheduled', DATE_ADD(CURDATE(), INTERVAL 14 DAY), NULL, NULL, 'PCV Dose 1 scheduled checkup');

-- 9. Insert Pregnant Woman: Rona Remitar (DOB: July 27, 2001 - 24 y.o., District 1)
INSERT INTO pregnant_women (id, parent_id, first_name, last_name, age, address, barangay_id, pregnancy_week_start, conception_date, expected_delivery_date, risk_status) VALUES
(1, 2, 'Rona', 'Remitar', 24, 'District 1 Main Zone', 1, 12, '2026-01-15', '2026-10-22', 'Low');

-- 10. Insert Prenatal Visit for Rona Remitar
INSERT INTO prenatal_visits (pregnant_woman_id, visit_date, pregnancy_week, blood_pressure, weight_kg, heart_rate, risk_status, prescribed_medications, ai_care_plan, recommendations, notes, recorded_by) VALUES
(1, '2026-03-10', 8, '115/75', 54.0, 78, 'Low', 'Folic Acid 400mcg daily, Ferrous Sulfate 60mg', 'Standard low-risk prenatal monitoring for Rona Remitar.', 'Take daily iron and folate supplements. Maintain healthy hydration.', 'Vitals stable. Fetal heartbeat normal.', 2),
(1, CURDATE(), 20, '118/76', 58.5, 80, 'Low', 'Ferrous Sulfate 60mg + Folic Acid 400mcg, Calcium 1000mg', 'Routine 2nd trimester checkup.', 'Prepare for mid-pregnancy ultrasound. Maintain balanced diet.', 'Normal pregnancy progression.', 2);

-- 11. Insert Senior Citizens (Arthuro Luzasa - Hypertension BP, Sergio Mensidor - Eyesight Impairment)
INSERT INTO senior_citizens (id, first_name, last_name, age, birthdate, address, barangay_id, contact_number, medical_conditions, risk_level) VALUES
(1, 'Arthuro', 'Luzasa', 61, '1964-12-24', 'District 7', 7, '0917-888-0001', 'Hypertension (High Blood Pressure)', 'High'),
(2, 'Sergio', 'Mensidor', 66, '1960-05-15', 'Sitio Minbahandi (District 8)', 8, '0918-888-0002', 'Eyesight Impairment (Cataracts / Presbyopia)', 'Medium');

-- 12. Insert Senior Medications
INSERT INTO senior_medications (id, senior_id, medication_name, dosage, frequency, prescribed_by, status, ai_precautions) VALUES
(1, 1, 'Amlodipine Besylate', '5 mg', 'Once daily after breakfast', 'Dr. Manuel Roxas', 'active', 'Monitor blood pressure daily. Restrict sodium intake.'),
(2, 2, 'Latanoprost Ophthalmic Drops', '0.005%', '1 drop in affected eye once daily at bedtime', 'Dr. Teresa Aquino', 'active', 'Administer at bedtime. Avoid touching dropper tip to eye surface. Schedule regular eye exam.');

-- 13. Insert Citizen Disease Cases (For Disease Trends analytics)
INSERT INTO disease_cases (barangay_id, disease_name, age_group, case_date) VALUES
(7, 'Hypertension (BP)', '40+', '2026-01-15'),
(7, 'Hypertension (BP)', '40+', '2026-02-20'),
(7, 'Hypertension (BP)', '40+', CURDATE()),
(8, 'Eyesight / Cataracts', '40+', '2026-02-10'),
(8, 'Eyesight / Cataracts', '40+', CURDATE()),
(1, 'Upper Respiratory Infection', '0-5', '2026-03-01'),
(7, 'Dengue Fever', '0-5', '2026-03-15');

-- 14. Insert AI Threshold Settings
INSERT INTO ai_settings (setting_key, setting_value) VALUES
('teenage_pregnancy_age_threshold', '20'),
('obesity_bmi_threshold', '25.0'),
('wasting_bmi_threshold', '15.0'),
('severe_wasting_bmi_threshold', '13.5'),
('critical_bp_systolic_threshold', '140'),
('critical_bp_diastolic_threshold', '90');

-- 15. Insert Audit Logs
INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES
(1, 'DATABASE_SEED', 'Seeded database with Barangay Camagong records for Gerelle Caluyong, Rona Remitar, Arthuro Luzasa, and Sergio Mensidor.', '127.0.0.1');

-- 16. Insert Health Programs
INSERT INTO health_programs (id, title, description, category, recommended_by_ai, ai_rationale, target_audience, proposed_date, location, status, approved_by) VALUES
(1, 'Barangay Camagong Child Immunization & Growth Checkup', 'Routine vaccination drive and Operation Timbang screening for infants in District 7.', 'vaccination', TRUE, 'Scheduled immunization follow-up for registered infants.', 'Parents of Under-5 Children in District 7', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'District 7 Health Center', 'approved', 2),
(2, 'Senior Citizens Eye Care & Hypertension Screening', 'Free blood pressure checks, eye exams, and maintenance drug distribution for senior citizens.', 'general', TRUE, 'High prevalence of hypertension and eyesight conditions logged in District 7 and Sitio Minbahandi.', 'Senior Citizens of Barangay Camagong', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Barangay Camagong Main Hall (District 1)', 'approved', 2);
