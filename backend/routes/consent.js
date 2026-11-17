const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

// ── 1. GET All Consent Records ─────────────────────────────────────────────
router.get('/', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { status, minor_type } = req.query;
  try {
    let query = `
      SELECT pgc.*,
             CONCAT(p.first_name, ' ', p.last_name) as parent_name,
             u_verified.username as verified_by_name
      FROM parent_guardian_consent pgc
      JOIN parents p ON pgc.parent_guardian_id = p.id
      LEFT JOIN users u_verified ON pgc.verified_by = u_verified.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND pgc.consent_status = ?'; params.push(status); }
    if (minor_type) { query += ' AND pgc.minor_type = ?'; params.push(minor_type); }
    query += ' ORDER BY pgc.created_at DESC';
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (error) {
    console.error('Get consent records error:', error);
    res.status(500).json({ message: 'Error retrieving consent records' });
  }
});

// ── 2. GET Consent for a specific minor ───────────────────────────────────
router.get('/minor/:minorId/:minorType', verifyToken, async (req, res) => {
  const { minorId, minorType } = req.params;
  try {
    const [records] = await pool.query(`
      SELECT pgc.*,
             CONCAT(p.first_name, ' ', p.last_name) as parent_name
      FROM parent_guardian_consent pgc
      JOIN parents p ON pgc.parent_guardian_id = p.id
      WHERE pgc.minor_id = ? AND pgc.minor_type = ?
      ORDER BY pgc.created_at DESC
    `, [minorId, minorType]);
    res.json(records);
  } catch (error) {
    console.error('Get consent for minor error:', error);
    res.status(500).json({ message: 'Error retrieving consent record' });
  }
});

// ── 3. GET Consent Records for logged-in Parent ───────────────────────────
router.get('/my', verifyToken, authorizeRoles('parent'), async (req, res) => {
  try {
    const [parent] = await pool.query('SELECT id FROM parents WHERE user_id = ?', [req.user.id]);
    if (parent.length === 0) return res.status(404).json({ message: 'Parent profile not found' });

    const [records] = await pool.query(`
      SELECT pgc.*, u.username as verified_by_name
      FROM parent_guardian_consent pgc
      LEFT JOIN users u ON pgc.verified_by = u.id
      WHERE pgc.parent_guardian_id = ?
      ORDER BY pgc.created_at DESC
    `, [parent[0].id]);
    res.json(records);
  } catch (error) {
    console.error('Get my consent records error:', error);
    res.status(500).json({ message: 'Error retrieving your consent records' });
  }
});

// ── 4. POST Create Consent Record ─────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  const { parent_guardian_id, minor_id, minor_type, consent_type, remarks } = req.body;

  if (!parent_guardian_id || !minor_id || !minor_type) {
    return res.status(400).json({ message: 'parent_guardian_id, minor_id, and minor_type are required.' });
  }

  try {
    // Prevent duplicate active consent
    const [existing] = await pool.query(`
      SELECT id FROM parent_guardian_consent
      WHERE parent_guardian_id = ? AND minor_id = ? AND minor_type = ?
        AND consent_status IN ('pending','granted')
    `, [parent_guardian_id, minor_id, minor_type]);

    if (existing.length > 0) {
      return res.status(409).json({ message: 'An active consent record already exists for this minor.' });
    }

    const [result] = await pool.query(`
      INSERT INTO parent_guardian_consent
        (parent_guardian_id, minor_id, minor_type, consent_type, consent_status, remarks)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, [parent_guardian_id, minor_id, minor_type, consent_type || 'health_data_processing', remarks || null]);

    await logAudit(req.user.id, 'CREATE_CONSENT',
      `Consent record created for minor ID ${minor_id} (${minor_type})`, req);

    const [newRecord] = await pool.query('SELECT * FROM parent_guardian_consent WHERE id = ?', [result.insertId]);
    res.status(201).json(newRecord[0]);
  } catch (error) {
    console.error('Create consent error:', error);
    res.status(500).json({ message: 'Error creating consent record' });
  }
});

// ── 5. PATCH Update Consent Status ────────────────────────────────────────
router.patch('/:id/status', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { consent_status, remarks, consent_date } = req.body;

  const validStatuses = ['pending', 'granted', 'declined', 'withdrawn', 'expired'];
  if (!validStatuses.includes(consent_status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const updateFields = { consent_status, remarks: remarks || null };
    if (consent_status === 'granted') {
      updateFields.consent_date = consent_date || new Date().toISOString().split('T')[0];
      if (['admin', 'health_personnel'].includes(req.user.role)) {
        updateFields.verified_by = req.user.id;
        updateFields.verification_date = new Date().toISOString().split('T')[0];
      }
    }

    await pool.query('UPDATE parent_guardian_consent SET ? WHERE id = ?', [updateFields, id]);

    await logAudit(req.user.id, 'UPDATE_CONSENT_STATUS',
      `Consent ID ${id} status changed to ${consent_status}`, req);

    const [updated] = await pool.query('SELECT * FROM parent_guardian_consent WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update consent status error:', error);
    res.status(500).json({ message: 'Error updating consent status' });
  }
});

// ── 6. GET Consent Summary (Dashboard) ───────────────────────────────────
router.get('/summary', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  try {
    const [summary] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN consent_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN consent_status = 'granted' THEN 1 ELSE 0 END) as granted,
        SUM(CASE WHEN consent_status = 'declined' THEN 1 ELSE 0 END) as declined,
        SUM(CASE WHEN consent_status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn
      FROM parent_guardian_consent
    `);
    res.json(summary[0]);
  } catch (error) {
    console.error('Consent summary error:', error);
    res.status(500).json({ message: 'Error retrieving consent summary' });
  }
});

module.exports = router;
