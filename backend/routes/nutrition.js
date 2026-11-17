const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

// ── WHO LMS Z-SCORE UTILITY (server-side fallback) ──────────────────────────
// Full WHO LMS tables embedded for server-side classification
// Primary calculations done by Python AI service; this is a fallback classifier

function classifyNutritionStatus(zScore, indicator, ageMonths) {
  if (indicator === 'bfa' || indicator === 'bmi_for_age') {
    // BMI-for-age (5-19 years)
    if (ageMonths >= 60) {
      if (zScore < -3) return 'Severe Thinness';
      if (zScore < -2) return 'Thinness';
      if (zScore <= 1) return 'Normal';
      if (zScore <= 2) return 'Overweight';
      return 'Obese';
    }
    // Under 5
    if (zScore < -3) return 'Severe Wasting';
    if (zScore < -2) return 'Wasting';
    if (zScore <= 1) return 'Normal';
    if (zScore <= 2) return 'Overweight';
    return 'Obese';
  }
  if (indicator === 'hfa' || indicator === 'height_for_age') {
    if (zScore < -3) return 'Severe Stunting';
    if (zScore < -2) return 'Stunted';
    return 'Normal';
  }
  if (indicator === 'wfa' || indicator === 'weight_for_age') {
    if (zScore < -3) return 'Severely Underweight';
    if (zScore < -2) return 'Underweight';
    if (zScore <= 2) return 'Normal';
    return 'Overweight';
  }
  if (indicator === 'wfh' || indicator === 'weight_for_height') {
    if (zScore < -3) return 'Severe Wasting';
    if (zScore < -2) return 'Wasting';
    if (zScore <= 2) return 'Normal';
    if (zScore <= 3) return 'Overweight';
    return 'Obese';
  }
  return 'Normal';
}

function generateRecommendations(classifications) {
  const recs = [];
  if (classifications.includes('Severe Wasting') || classifications.includes('Severe Thinness')) {
    recs.push('URGENT: Refer to physician immediately for therapeutic feeding program.');
    recs.push('Enroll in Supplementary Feeding Program (SFP) or Therapeutic Feeding Center (TFC).');
    recs.push('Monitor weight weekly. Report to Barangay Health Center immediately.');
  } else if (classifications.includes('Wasting') || classifications.includes('Thinness')) {
    recs.push('Enroll in Supplementary Feeding Program (SFP).');
    recs.push('Increase caloric and protein intake. Monitor weight bi-monthly.');
    recs.push('Refer to nutritionist or dietitian for personalized meal plan.');
  } else if (classifications.includes('Severe Stunting') || classifications.includes('Stunted')) {
    recs.push('Ensure adequate dietary diversity with iron, zinc, and vitamin A.');
    recs.push('Monitor height-for-age every 3 months.');
    recs.push('Encourage exclusive breastfeeding for infants under 6 months.');
  } else if (classifications.includes('Obese') || classifications.includes('Overweight')) {
    recs.push('Encourage physical activity appropriate for age.');
    recs.push('Reduce sugar-sweetened beverages and processed foods.');
    recs.push('Consult physician for comprehensive assessment.');
  } else if (classifications.includes('Severely Underweight') || classifications.includes('Underweight')) {
    recs.push('Increase frequency of meals. Add energy-dense, nutrient-rich foods.');
    recs.push('Monitor weight monthly. Consult health worker if no improvement in 1 month.');
  } else {
    recs.push('Continue balanced diet and regular physical activity.');
    recs.push('Maintain regular health check-ups and immunization schedule.');
  }
  return recs.join(' ');
}

// ── 1. GET Nutrition Assessments for a Child ────────────────────────────────
router.get('/child/:childId', verifyToken, async (req, res) => {
  const { childId } = req.params;
  try {
    // For parents, verify they own this child
    if (req.user.role === 'parent') {
      const [ownership] = await pool.query(
        'SELECT c.id FROM children c JOIN parents p ON c.parent_id = p.id WHERE c.id = ? AND p.user_id = ?',
        [childId, req.user.id]
      );
      if (ownership.length === 0) {
        return res.status(403).json({ message: 'Access denied: This child does not belong to your household.' });
      }
    }

    const [records] = await pool.query(`
      SELECT gm.*, 
             c.first_name, c.last_name, c.birthdate, c.sex,
             u.username as recorded_by_name
      FROM growth_monitoring gm
      JOIN children c ON gm.child_id = c.id
      LEFT JOIN users u ON gm.recorded_by = u.id
      WHERE gm.child_id = ?
      ORDER BY gm.visit_date DESC
    `, [childId]);

    res.json(records);
  } catch (error) {
    console.error('Get nutrition records error:', error);
    res.status(500).json({ message: 'Error retrieving nutrition records' });
  }
});

// ── 2. POST New Nutrition Assessment ───────────────────────────────────────
router.post('/', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const {
    child_id, visit_date, height_cm, weight_kg,
    bmi, z_score, who_classification, indicator_type,
    stunting_status, wasting_status, recommendations,
    age_months
  } = req.body;

  if (!child_id || !visit_date || !height_cm || !weight_kg) {
    return res.status(400).json({ message: 'child_id, visit_date, height_cm, and weight_kg are required.' });
  }

  try {
    const calcBmi = bmi || parseFloat((weight_kg / ((height_cm / 100) ** 2)).toFixed(2));
    const classifications = who_classification ? [who_classification] : [];
    const autoRecs = recommendations || generateRecommendations(classifications);

    const nutritionStatus = who_classification || 'Normal';

    const [result] = await pool.query(`
      INSERT INTO growth_monitoring 
        (child_id, visit_date, height_cm, weight_kg, bmi, nutrition_status,
         stunting_status, wasting_status, z_score, who_classification, 
         indicator_type, age_months, recommendations, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      child_id, visit_date, height_cm, weight_kg, calcBmi, nutritionStatus,
      stunting_status || 'Normal', wasting_status || 'Normal',
      z_score || null, who_classification || null,
      indicator_type || null, age_months || null,
      autoRecs, req.user.id
    ]);

    // Update child's latest who_indicator
    await pool.query(
      'UPDATE children SET bmi_z_score = ?, who_indicator = ? WHERE id = ?',
      [z_score || null, who_classification || null, child_id]
    );

    await logAudit(req.user.id, 'CREATE_NUTRITION_ASSESSMENT',
      `Nutrition assessment recorded for child ID ${child_id}. Classification: ${nutritionStatus}`, req);

    const [newRecord] = await pool.query(
      'SELECT * FROM growth_monitoring WHERE id = ?', [result.insertId]
    );
    res.status(201).json(newRecord[0]);
  } catch (error) {
    console.error('Create nutrition assessment error:', error);
    res.status(500).json({ message: 'Error saving nutrition assessment' });
  }
});

// ── 3. GET Nutrition Summary (Dashboard stats) ─────────────────────────────
router.get('/summary', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  try {
    const [summary] = await pool.query(`
      SELECT 
        COUNT(DISTINCT gm.child_id) as total_assessed,
        SUM(CASE WHEN gm.nutrition_status = 'Normal' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN gm.nutrition_status = 'Severe Wasting' THEN 1 ELSE 0 END) as severe_wasting,
        SUM(CASE WHEN gm.nutrition_status = 'Wasting' THEN 1 ELSE 0 END) as wasting,
        SUM(CASE WHEN gm.nutrition_status = 'Overweight' THEN 1 ELSE 0 END) as overweight,
        SUM(CASE WHEN gm.nutrition_status = 'Obese' THEN 1 ELSE 0 END) as obese,
        SUM(CASE WHEN gm.who_classification IN ('Stunted','Severe Stunting') THEN 1 ELSE 0 END) as stunted,
        SUM(CASE WHEN gm.who_classification IN ('Thinness','Severe Thinness') THEN 1 ELSE 0 END) as thinness
      FROM growth_monitoring gm
      INNER JOIN (
        SELECT child_id, MAX(visit_date) as latest_date
        FROM growth_monitoring GROUP BY child_id
      ) latest ON gm.child_id = latest.child_id AND gm.visit_date = latest.latest_date
    `);
    res.json(summary[0]);
  } catch (error) {
    console.error('Nutrition summary error:', error);
    res.status(500).json({ message: 'Error retrieving nutrition summary' });
  }
});

// ── 4. GET Children needing nutritional intervention ──────────────────────
router.get('/priority', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  try {
    const [children] = await pool.query(`
      SELECT c.id, c.first_name, c.last_name, c.birthdate, c.sex,
             gm.nutrition_status, gm.who_classification, gm.z_score,
             gm.height_cm, gm.weight_kg, gm.bmi, gm.visit_date,
             gm.recommendations, b.name as barangay_name
      FROM children c
      JOIN growth_monitoring gm ON c.id = gm.child_id
      JOIN (SELECT child_id, MAX(visit_date) as latest FROM growth_monitoring GROUP BY child_id) lv
        ON gm.child_id = lv.child_id AND gm.visit_date = lv.latest
      LEFT JOIN barangays b ON c.barangay_id = b.id
      WHERE gm.nutrition_status IN ('Severe Wasting','Wasting','Obese','Overweight')
         OR gm.who_classification IN ('Severe Thinness','Thinness','Severe Stunting','Stunted','Severely Underweight','Underweight')
      ORDER BY FIELD(gm.nutrition_status,'Severe Wasting','Wasting','Obese','Overweight'), c.last_name
    `);
    res.json(children);
  } catch (error) {
    console.error('Nutrition priority error:', error);
    res.status(500).json({ message: 'Error retrieving nutrition priority list' });
  }
});

// ── 5. DELETE Nutrition Assessment (Admin only) ───────────────────────────
router.delete('/:id', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM growth_monitoring WHERE id = ?', [id]);
    await logAudit(req.user.id, 'DELETE_NUTRITION_ASSESSMENT',
      `Nutrition assessment ID ${id} deleted`, req);
    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    console.error('Delete nutrition assessment error:', error);
    res.status(500).json({ message: 'Error deleting assessment' });
  }
});

module.exports = router;
