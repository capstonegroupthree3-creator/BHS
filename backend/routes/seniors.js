const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

// 1. Get All Senior Citizens (With active medications count)
router.get('/', verifyToken, async (req, res) => {
  const { barangay_id, risk_level } = req.query;

  try {
    let query = `
      SELECT sc.*, b.name as barangay_name,
             (SELECT COUNT(*) FROM senior_medications sm WHERE sm.senior_id = sc.id AND sm.status = 'active') as active_medications_count
      FROM senior_citizens sc
      LEFT JOIN barangays b ON sc.barangay_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (barangay_id) {
      query += ' AND sc.barangay_id = ?';
      params.push(barangay_id);
    }

    if (risk_level) {
      query += ' AND sc.risk_level = ?';
      params.push(risk_level);
    }

    query += ' ORDER BY FIELD(sc.risk_level, "Critical", "High", "Medium", "Low"), sc.last_name ASC';

    const [seniors] = await pool.query(query, params);
    res.json(seniors);
  } catch (error) {
    console.error('Get seniors error:', error);
    res.status(500).json({ message: 'Error retrieving senior citizens list' });
  }
});

// 2. Get Senior Details & Maintenance Medications History
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [seniors] = await pool.query(`
      SELECT sc.*, b.name as barangay_name 
      FROM senior_citizens sc
      LEFT JOIN barangays b ON sc.barangay_id = b.id
      WHERE sc.id = ?
    `, [id]);

    if (seniors.length === 0) {
      return res.status(404).json({ message: 'Senior citizen record not found' });
    }

    const senior = seniors[0];

    const [medications] = await pool.query(
      'SELECT * FROM senior_medications WHERE senior_id = ? ORDER BY status ASC, id DESC',
      [id]
    );

    res.json({
      senior,
      medications
    });
  } catch (error) {
    console.error('Get senior details error:', error);
    res.status(500).json({ message: 'Error retrieving senior citizen details' });
  }
});

// 3. Register Senior Citizen (Admin & Health Personnel)
router.post('/', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { first_name, last_name, age, birthdate, address, barangay_id, contact_number, medical_conditions, risk_level } = req.body;

  if (!first_name || !last_name || !age || !birthdate || !barangay_id) {
    return res.status(400).json({ message: 'First name, last name, age, birthdate, and barangay are required.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO senior_citizens (first_name, last_name, age, birthdate, address, barangay_id, contact_number, medical_conditions, risk_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, age, birthdate, address || '', barangay_id, contact_number || '', medical_conditions || '', risk_level || 'Low']
    );

    const seniorId = result.insertId;
    await logAudit(req.user.id, 'SENIOR_CITIZEN_REGISTERED', `Registered Senior Citizen: ${first_name} ${last_name} (ID: ${seniorId})`, req);

    res.status(201).json({
      message: `Senior Citizen profile for ${first_name} ${last_name} registered successfully!`,
      seniorId
    });
  } catch (error) {
    console.error('Register senior error:', error);
    res.status(500).json({ message: 'Server error registering senior citizen' });
  }
});

// 4. Prescribe Maintenance Medication to Senior
router.post('/:id/medications', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  const { medication_name, dosage, frequency, prescribed_by, ai_precautions } = req.body;

  if (!medication_name || !dosage || !frequency) {
    return res.status(400).json({ message: 'Medication name, dosage, and frequency are required.' });
  }

  try {
    const [seniors] = await pool.query('SELECT first_name, last_name FROM senior_citizens WHERE id = ?', [id]);
    if (seniors.length === 0) {
      return res.status(404).json({ message: 'Senior citizen not found' });
    }

    const senior = seniors[0];
    const defaultPrecautions = ai_precautions || `Take ${medication_name} strictly as prescribed. Monitor vitals and consult doctor if side effects occur.`;

    const [result] = await pool.query(
      `INSERT INTO senior_medications (senior_id, medication_name, dosage, frequency, prescribed_by, status, ai_precautions)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [id, medication_name, dosage, frequency, prescribed_by || req.user.username, defaultPrecautions]
    );

    await logAudit(req.user.id, 'SENIOR_MEDICATION_ADDED', `Prescribed ${medication_name} ${dosage} for ${senior.first_name} ${senior.last_name}`, req);

    res.status(201).json({
      message: `Prescribed ${medication_name} for ${senior.first_name} ${senior.last_name} successfully!`,
      medication_id: result.insertId
    });
  } catch (error) {
    console.error('Add senior medication error:', error);
    res.status(500).json({ message: 'Server error prescribing senior medication' });
  }
});

// 5. Toggle Senior Medication Status (Active / Discontinued)
router.put('/medications/:medId/status', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { medId } = req.params;
  const { status } = req.body;

  if (!['active', 'discontinued'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be active or discontinued.' });
  }

  try {
    await pool.query('UPDATE senior_medications SET status = ? WHERE id = ?', [status, medId]);
    await logAudit(req.user.id, 'SENIOR_MEDICATION_STATUS_UPDATED', `Updated senior medication ID ${medId} status to ${status}`, req);

    res.json({ message: `Medication status updated to ${status}.` });
  } catch (error) {
    console.error('Update medication status error:', error);
    res.status(500).json({ message: 'Server error updating medication status' });
  }
});

// 6. Delete Senior Citizen Record (Admin & Health Personnel)
router.delete('/:id', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  try {
    const [seniors] = await pool.query('SELECT first_name, last_name FROM senior_citizens WHERE id = ?', [id]);
    if (seniors.length === 0) {
      return res.status(404).json({ message: 'Senior citizen record not found' });
    }
    const senior = seniors[0];
    await pool.query('DELETE FROM senior_citizens WHERE id = ?', [id]);
    await logAudit(req.user.id, 'SENIOR_DELETED', `Deleted Senior Citizen ID ${id} (${senior.first_name} ${senior.last_name})`, req);
    res.json({ message: `Senior Citizen record for ${senior.first_name} ${senior.last_name} deleted successfully.` });
  } catch (error) {
    console.error('Delete senior error:', error);
    res.status(500).json({ message: 'Failed to delete senior citizen record' });
  }
});

module.exports = router;
