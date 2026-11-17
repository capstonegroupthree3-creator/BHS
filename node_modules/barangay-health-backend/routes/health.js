const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');
const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// ----------------------------------------------------
// GROWTH MONITORING MODULE
// ----------------------------------------------------

// 1. Get growth history for a child
router.get('/growth/:childId', verifyToken, async (req, res) => {
  const { childId } = req.params;

  try {
    // Parent restriction check
    if (req.user.role === 'parent') {
      const [parentCheck] = await pool.query(
        'SELECT c.id FROM children c JOIN parents p ON c.parent_id = p.id WHERE c.id = ? AND p.user_id = ?',
        [childId, req.user.id]
      );
      if (parentCheck.length === 0) {
        return res.status(403).json({ message: 'Access Denied: Restrictive family routing' });
      }
    }

    const [logs] = await pool.query(
      `SELECT gm.*, u.username as recorded_by_user 
       FROM growth_monitoring gm 
       JOIN users u ON gm.recorded_by = u.id 
       WHERE gm.child_id = ? 
       ORDER BY gm.visit_date DESC`,
      [childId]
    );
    res.json(logs);
  } catch (error) {
    console.error('Get growth error:', error);
    res.status(500).json({ message: 'Server error retrieving growth records' });
  }
});

// 2. Add Growth Record & Predict status via AI
router.post('/growth', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { child_id, visit_date, height_cm, weight_kg } = req.body;

  if (!child_id || !visit_date || !height_cm || !weight_kg) {
    return res.status(400).json({ message: 'Missing growth record parameters' });
  }

  try {
    // 1. Fetch child age and sex for AI prediction
    const [children] = await pool.query('SELECT birthdate, sex FROM children WHERE id = ?', [child_id]);
    if (children.length === 0) {
      return res.status(404).json({ message: 'Child not found' });
    }

    const child = children[0];
    const dob = new Date(child.birthdate);
    const visit = new Date(visit_date);
    const ageMonths = Math.max(1, Math.round((visit - dob) / (1000 * 60 * 60 * 24 * 30.4)));

    // 2. Query AI Python microservice
    let bmi = weight_kg / ((height_cm / 100) ** 2);
    let nutrition_status = 'Normal';
    let recommendations = 'Normal growth. Maintain nutrition.';
    let isAiFallback = false;

    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict/nutrition`, {
        age_months: ageMonths,
        sex: child.sex,
        height_cm: parseFloat(height_cm),
        weight_kg: parseFloat(weight_kg)
      });
      
      bmi = aiResponse.data.bmi;
      nutrition_status = aiResponse.data.nutrition_status;
      recommendations = JSON.stringify(aiResponse.data.recommendations);
    } catch (aiErr) {
      console.warn('AI Service unreachable, falling back to local rule-based system:', aiErr.message);
      isAiFallback = true;
      
      // Fallback local expert rules
      if (bmi < 13.0) {
        nutrition_status = 'Severe Wasting';
        recommendations = JSON.stringify({
          action: "Immediate medical referral to Rural Health Unit (RHU).",
          diet: "Prescribe therapeutic food (RUTF).",
          monitoring: "Daily home checks."
        });
      } else if (bmi < 14.5) {
        nutrition_status = 'Wasting';
        recommendations = JSON.stringify({
          action: "Enroll in Supplementary Feeding Program.",
          diet: "High protein local diets.",
          monitoring: "Bi-weekly checks."
        });
      } else if (bmi > 22.0) {
        nutrition_status = 'Obese';
        recommendations = JSON.stringify({
          action: "Pediatric consult at RHU.",
          diet: "Structured calorie planning.",
          monitoring: "Bi-weekly checks."
        });
      } else if (bmi > 19.0) {
        nutrition_status = 'Overweight';
        recommendations = JSON.stringify({
          action: "Nutrition advice for parent.",
          diet: "Avoid sugars, increase activity.",
          monitoring: "Monthly checks."
        });
      } else {
        nutrition_status = 'Normal';
        recommendations = JSON.stringify({
          action: "Regular checkups.",
          diet: "Balanced diet.",
          monitoring: "Monthly checks."
        });
      }
    }

    // 3. Write to Database
    const [result] = await pool.query(
      `INSERT INTO growth_monitoring 
       (child_id, visit_date, height_cm, weight_kg, bmi, nutrition_status, recorded_by, recommendations) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [child_id, visit_date, height_cm, weight_kg, bmi, nutrition_status, req.user.id, recommendations]
    );

    await logAudit(req.user.id, 'GROWTH_ADD', `Added growth record child ID: ${child_id}. BMI: ${roundTo(bmi, 2)}, Status: ${nutrition_status}`, req);

    res.status(201).json({
      id: result.insertId,
      bmi: roundTo(bmi, 2),
      nutrition_status,
      recommendations: JSON.parse(recommendations),
      ai_calculated: !isAiFallback
    });

  } catch (error) {
    console.error('Add growth log error:', error);
    res.status(500).json({ message: 'Server error saving growth metrics' });
  }
});


// ----------------------------------------------------
// VACCINATION MODULE
// ----------------------------------------------------

// 3. Get Vaccination Card for a child
router.get('/vaccines/child/:childId', verifyToken, async (req, res) => {
  const { childId } = req.params;

  try {
    // Parent restriction check
    if (req.user.role === 'parent') {
      const [parentCheck] = await pool.query(
        'SELECT c.id FROM children c JOIN parents p ON c.parent_id = p.id WHERE c.id = ? AND p.user_id = ?',
        [childId, req.user.id]
      );
      if (parentCheck.length === 0) {
        return res.status(403).json({ message: 'Access Denied: Restrictive family routing' });
      }
    }

    const [records] = await pool.query(
      `SELECT vr.*, v.name as vaccine_name, v.type as vaccine_type, v.target_age_months, u.username as administered_by_user 
       FROM vaccination_records vr
       JOIN vaccines v ON vr.vaccine_id = v.id
       LEFT JOIN users u ON vr.administered_by = u.id
       WHERE vr.child_id = ?
       ORDER BY vr.scheduled_date ASC`,
      [childId]
    );
    res.json(records);
  } catch (error) {
    console.error('Get vaccine card error:', error);
    res.status(500).json({ message: 'Server error retrieving immunization records' });
  }
});

// 4. Log Vaccine Dose Administration (Complete vaccination)
router.put('/vaccines/record/:recordId', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { recordId } = req.params;
  const { administered_date, remarks } = req.body;

  if (!administered_date) {
    return res.status(400).json({ message: 'Administered date is required' });
  }

  try {
    // 1. Update vaccination record
    const [result] = await pool.query(
      `UPDATE vaccination_records 
       SET status = 'completed', administered_date = ?, administered_by = ?, remarks = ? 
       WHERE id = ?`,
      [administered_date, req.user.id, remarks || null, recordId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Vaccination record not found' });
    }

    // Get details for logging audit
    const [details] = await pool.query(
      `SELECT vr.child_id, c.first_name, c.last_name, v.name as vaccine_name, vr.dose_number
       FROM vaccination_records vr
       JOIN children c ON vr.child_id = c.id
       JOIN vaccines v ON vr.vaccine_id = v.id
       WHERE vr.id = ?`,
       [recordId]
    );

    if (details.length > 0) {
      const d = details[0];
      await logAudit(
        req.user.id, 
        'VACCINE_ADMINISTERED', 
        `Administered ${d.vaccine_name} Dose ${d.dose_number} to child ${d.first_name} ${d.last_name} (Child ID: ${d.child_id})`, 
        req
      );
    }

    res.json({ message: 'Vaccination dose marked completed successfully!' });

  } catch (error) {
    console.error('Update vaccine record error:', error);
    res.status(500).json({ message: 'Server error logging vaccination' });
  }
});


// ----------------------------------------------------
// PRENATAL MODULE
// ----------------------------------------------------

// 5. Get Prenatal Visits history for a mother
router.get('/prenatal/:pregnantId', verifyToken, async (req, res) => {
  const { pregnantId } = req.params;

  try {
    // Parent restriction check
    if (req.user.role === 'parent') {
      const [parentCheck] = await pool.query(
        'SELECT pw.id FROM pregnant_women pw JOIN parents p ON pw.parent_id = p.id WHERE pw.id = ? AND p.user_id = ?',
        [pregnantId, req.user.id]
      );
      if (parentCheck.length === 0) {
        return res.status(403).json({ message: 'Access Denied: Restrictive family routing' });
      }
    }

    const [visits] = await pool.query(
      `SELECT pv.*, u.username as recorded_by_user 
       FROM prenatal_visits pv 
       JOIN users u ON pv.recorded_by = u.id 
       WHERE pv.pregnant_woman_id = ? 
       ORDER BY pv.visit_date DESC`,
      [pregnantId]
    );
    res.json(visits);
  } catch (error) {
    console.error('Get prenatal visits error:', error);
    res.status(500).json({ message: 'Server error retrieving prenatal checkups list' });
  }
});

// 6. Record Prenatal Visit & Assess Risk via AI
router.post('/prenatal', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { pregnant_woman_id, visit_date, pregnancy_week, blood_pressure, weight_kg, heart_rate, notes } = req.body;

  if (!pregnant_woman_id || !visit_date || !pregnancy_week || !blood_pressure || !weight_kg) {
    return res.status(400).json({ message: 'Missing prenatal visit parameters' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch mother age and registration details
    const [mothers] = await connection.query('SELECT age, weight_kg as base_weight FROM pregnant_women WHERE id = ?', [pregnant_woman_id]);
    if (mothers.length === 0) {
      return res.status(404).json({ message: 'Pregnant woman profile not found' });
    }
    
    const mother = mothers[0];
    const baseWeight = parseFloat(mother.base_weight || weight_kg);
    const weightGain = Math.max(0, parseFloat(weight_kg) - baseWeight);

    // Parse blood pressure
    const bpParts = blood_pressure.split('/');
    const systolic = parseInt(bpParts[0]) || 120;
    const diastolic = parseInt(bpParts[1]) || 80;

    // 2. Call AI service for pregnancy risk prediction
    let risk_status = 'Low';
    let recommendations = 'Vitals normal. Continue standard care.';
    let isAiFallback = false;

    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict/pregnancy_risk`, {
        age: mother.age,
        week: parseInt(pregnancy_week),
        systolic_bp: systolic,
        diastolic_bp: diastolic,
        weight_gain: weightGain,
        diabetes: notes && notes.toLowerCase().includes('diabetes') ? 1 : 0,
        hypertension: notes && notes.toLowerCase().includes('hypertension') ? 1 : 0
      });
      
      risk_status = aiResponse.data.risk_status;
      recommendations = JSON.stringify(aiResponse.data.recommendations);
    } catch (aiErr) {
      console.warn('AI Service pregnancy prediction unreachable, falling back to local rule-based system:', aiErr.message);
      isAiFallback = true;
      
      // Fallback clinical safety expert rules
      if (systolic >= 140 || diastolic >= 90) {
        risk_status = 'Critical';
        recommendations = JSON.stringify({
          visit_schedule: "Immediate clinical admission / urgent care.",
          clinical_actions: "Antihypertensive administration, bedrest.",
          referral_path: "IMMEDIATE REFERRAL to Municipal Hospital."
        });
      } else if (mother.age < 20) {
        risk_status = 'High';
        recommendations = JSON.stringify({
          visit_schedule: "Weekly checkups.",
          clinical_actions: "High risk teenage pregnancy monitoring.",
          referral_path: "Refer to obstetrician at Rural Health Unit (RHU)."
        });
      } else if (systolic >= 130 || diastolic >= 85 || mother.age > 35) {
        risk_status = 'Medium';
        recommendations = JSON.stringify({
          visit_schedule: "Bi-weekly checkups.",
          clinical_actions: "Regular BP monitoring, low-salt diet.",
          referral_path: "Midwife at local RHU."
        });
      } else {
        risk_status = 'Low';
        recommendations = JSON.stringify({
          visit_schedule: "Routine monthly checkups.",
          clinical_actions: "Standard vitamins.",
          referral_path: "Barangay Health Center."
        });
      }
    }

    // 3. Write Prenatal Visit
    await connection.query(
      `INSERT INTO prenatal_visits 
       (pregnant_woman_id, visit_date, pregnancy_week, blood_pressure, weight_kg, heart_rate, risk_status, recommendations, notes, recorded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pregnant_woman_id, visit_date, pregnancy_week, blood_pressure, weight_kg, heart_rate || null, risk_status, recommendations, notes || null, req.user.id]
    );

    // 4. Update the overall risk status of the pregnant woman profile
    await connection.query(
      `UPDATE pregnant_women SET risk_status = ? WHERE id = ?`,
      [risk_status, pregnant_woman_id]
    );

    // 5. If linked to parent account, trigger in-app notification alert
    const [profile] = await connection.query('SELECT parent_id, first_name, last_name FROM pregnant_women WHERE id = ?', [pregnant_woman_id]);
    if (profile.length > 0 && profile[0].parent_id) {
      const [parentObj] = await connection.query('SELECT user_id FROM parents WHERE id = ?', [profile[0].parent_id]);
      if (parentObj.length > 0) {
        const notifTitle = risk_status === 'Critical' || risk_status === 'High' ? 'Prenatal Health Risk Alert' : 'Prenatal Visit Logged';
        const notifMsg = `Prenatal visit logged for ${profile[0].first_name} ${profile[0].last_name} at Week ${pregnancy_week}. Current Risk Status: ${risk_status}. Recommendations: ${JSON.parse(recommendations).visit_schedule}`;
        
        await connection.query(
          `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'prenatal')`,
          [parentObj[0].user_id, notifTitle, notifMsg]
        );
      }
    }

    await connection.commit();
    await logAudit(req.user.id, 'PRENATAL_VISIT_ADD', `Logged prenatal checkup for mother ID: ${pregnant_woman_id}. Week: ${pregnancy_week}, BP: ${blood_pressure}, Risk: ${risk_status}`, req);

    res.status(201).json({
      message: 'Prenatal visit recorded and maternal risk status updated!',
      risk_status,
      recommendations: JSON.parse(recommendations),
      ai_calculated: !isAiFallback
    });

  } catch (error) {
    await connection.rollback();
    console.error('Add prenatal visit error:', error);
    res.status(500).json({ message: 'Server error saving prenatal checkup details' });
  } finally {
    connection.release();
  }
});

// Helper math rounder
function roundTo(num, decimals) {
  return parseFloat(num.toFixed(decimals));
}

module.exports = router;
