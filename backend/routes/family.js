const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

// Age validation helper
function calculateAge(dob) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── 1. GET My Family Relationships (adult user) ───────────────────────────
router.get('/my', verifyToken, authorizeRoles('parent'), async (req, res) => {
  try {
    const [userRow] = await pool.query('SELECT date_of_birth FROM users WHERE id = ?', [req.user.id]);
    if (userRow.length === 0) return res.status(404).json({ message: 'User not found' });

    if (userRow[0].date_of_birth) {
      const age = calculateAge(userRow[0].date_of_birth);
      if (age < 18) {
        return res.status(403).json({ message: 'You must be at least 18 years old to access family health records.' });
      }
    }

    const [relationships] = await pool.query(`
      SELECT fr.*,
             sc.first_name as parent_first_name, sc.last_name as parent_last_name,
             sc.age as parent_age, sc.sex as parent_sex,
             sc.address as parent_address, sc.contact_number as parent_contact,
             sc.medical_conditions, sc.risk_level,
             sc.emergency_contact_name, sc.emergency_contact_number,
             fha.access_status, fha.access_id, fha.authorization_date,
             u_ver.username as verified_by_name
      FROM family_relationships fr
      JOIN senior_citizens sc ON fr.parent_resident_id = sc.id
      LEFT JOIN family_health_access fha ON fha.relationship_id = fr.relationship_id
      LEFT JOIN users u_ver ON fr.verified_by = u_ver.id
      WHERE fr.adult_user_id = ?
      ORDER BY fr.created_at DESC
    `, [req.user.id]);

    res.json(relationships);
  } catch (error) {
    console.error('Get my family error:', error);
    res.status(500).json({ message: 'Error retrieving family records' });
  }
});

// ── 2. POST Request Family Access (adult child → senior parent) ───────────
router.post('/request', verifyToken, authorizeRoles('parent'), async (req, res) => {
  const { parent_resident_id, relationship_type } = req.body;

  if (!parent_resident_id || !relationship_type) {
    return res.status(400).json({ message: 'parent_resident_id and relationship_type are required.' });
  }

  const validRelationships = ['mother', 'father', 'legal_guardian', 'authorized_representative'];
  if (!validRelationships.includes(relationship_type)) {
    return res.status(400).json({ message: `relationship_type must be one of: ${validRelationships.join(', ')}` });
  }

  try {
    // Backend age verification
    const [userRow] = await pool.query('SELECT date_of_birth FROM users WHERE id = ?', [req.user.id]);
    if (userRow[0]?.date_of_birth) {
      const age = calculateAge(userRow[0].date_of_birth);
      if (age < 18) {
        return res.status(403).json({ message: 'You must be at least 18 years old to request family health access.' });
      }
    }

    // Verify senior exists
    const [senior] = await pool.query('SELECT id FROM senior_citizens WHERE id = ?', [parent_resident_id]);
    if (senior.length === 0) {
      return res.status(404).json({ message: 'Senior citizen record not found.' });
    }

    // Prevent duplicate
    const [existing] = await pool.query(`
      SELECT relationship_id FROM family_relationships
      WHERE adult_user_id = ? AND parent_resident_id = ?
    `, [req.user.id, parent_resident_id]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'A relationship request for this senior already exists.' });
    }

    // Create relationship
    const [relResult] = await pool.query(`
      INSERT INTO family_relationships (adult_user_id, parent_resident_id, relationship_type, verification_status)
      VALUES (?, ?, ?, 'pending')
    `, [req.user.id, parent_resident_id, relationship_type]);

    // Create access request
    const [accessResult] = await pool.query(`
      INSERT INTO family_health_access (relationship_id, parent_resident_id, adult_user_id, access_status)
      VALUES (?, ?, ?, 'pending')
    `, [relResult.insertId, parent_resident_id, req.user.id]);

    // Insert default permissions (all false until approved)
    const permissions = [
      'view_personal_info', 'view_medical_history', 'view_medications',
      'view_health_assessments', 'view_nutrition_assessments',
      'view_immunization_records', 'view_upcoming_schedules',
      'receive_health_notifications', 'submit_info_updates'
    ];
    const permValues = permissions.map(p => [accessResult.insertId, p, false]);
    await pool.query(
      'INSERT INTO family_access_permissions (access_id, permission_type, is_allowed) VALUES ?',
      [permValues]
    );

    await logAudit(req.user.id, 'REQUEST_FAMILY_ACCESS',
      `Family access requested for Senior ID ${parent_resident_id}, relationship: ${relationship_type}`, req);

    res.status(201).json({
      message: 'Family access request submitted. Awaiting verification and parent consent.',
      relationship_id: relResult.insertId,
      access_id: accessResult.insertId
    });
  } catch (error) {
    console.error('Request family access error:', error);
    res.status(500).json({ message: 'Error submitting family access request' });
  }
});

// ── 3. GET All Family Access Requests (admin/health worker) ───────────────
router.get('/requests', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT fha.*, fr.relationship_type, fr.verification_status,
             sc.first_name as parent_first_name, sc.last_name as parent_last_name,
             sc.age as parent_age, sc.risk_level,
             u.username as adult_username, u.phone as adult_phone,
             u_ver.username as verified_by_name
      FROM family_health_access fha
      JOIN family_relationships fr ON fha.relationship_id = fr.relationship_id
      JOIN senior_citizens sc ON fha.parent_resident_id = sc.id
      JOIN users u ON fha.adult_user_id = u.id
      LEFT JOIN users u_ver ON fr.verified_by = u_ver.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND fha.access_status = ?'; params.push(status); }
    query += ' ORDER BY fha.created_at DESC';
    const [requests] = await pool.query(query, params);
    res.json(requests);
  } catch (error) {
    console.error('Get family requests error:', error);
    res.status(500).json({ message: 'Error retrieving family access requests' });
  }
});

// ── 4. PATCH Verify Relationship (health worker/admin) ────────────────────
router.patch('/relationships/:id/verify', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  const { verification_status } = req.body;
  if (!['verified', 'rejected'].includes(verification_status)) {
    return res.status(400).json({ message: 'verification_status must be verified or rejected' });
  }
  try {
    await pool.query(`
      UPDATE family_relationships SET verification_status = ?, verified_by = ?, verification_date = CURDATE()
      WHERE relationship_id = ?
    `, [verification_status, req.user.id, id]);

    await logAudit(req.user.id, 'VERIFY_FAMILY_RELATIONSHIP',
      `Family relationship ID ${id} ${verification_status}`, req);

    res.json({ message: `Relationship ${verification_status} successfully.` });
  } catch (error) {
    console.error('Verify relationship error:', error);
    res.status(500).json({ message: 'Error verifying relationship' });
  }
});

// ── 5. PATCH Update Access Status (admin/health worker) ───────────────────
router.patch('/access/:accessId/status', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { accessId } = req.params;
  const { access_status, permissions } = req.body;
  const validStatuses = ['pending', 'approved', 'declined', 'revoked'];
  if (!validStatuses.includes(access_status)) {
    return res.status(400).json({ message: `access_status must be one of: ${validStatuses.join(', ')}` });
  }
  try {
    const updateData = { access_status };
    if (access_status === 'approved') updateData.authorization_date = new Date();
    if (access_status === 'revoked') updateData.revoked_at = new Date();

    await pool.query('UPDATE family_health_access SET ? WHERE access_id = ?', [updateData, accessId]);

    // Update permissions if provided
    if (permissions && access_status === 'approved') {
      for (const [perm, allowed] of Object.entries(permissions)) {
        await pool.query(`
          UPDATE family_access_permissions SET is_allowed = ?
          WHERE access_id = ? AND permission_type = ?
        `, [allowed ? 1 : 0, accessId, perm]);
      }
      // Record consent
      await pool.query(`
        INSERT INTO family_access_consent (access_id, authorized_by, consent_status, consent_date)
        VALUES (?, ?, 'granted', NOW())
      `, [accessId, req.user.username || 'Health Worker']);
    }

    await logAudit(req.user.id, 'UPDATE_FAMILY_ACCESS',
      `Family access ID ${accessId} status set to ${access_status}`, req);

    res.json({ message: `Access ${access_status} successfully.` });
  } catch (error) {
    console.error('Update access status error:', error);
    res.status(500).json({ message: 'Error updating access status' });
  }
});

// ── 6. GET Senior health data (for approved family member) ────────────────
router.get('/senior/:seniorId', verifyToken, async (req, res) => {
  const { seniorId } = req.params;
  try {
    // Admin/health_personnel can always view
    if (!['admin', 'health_personnel'].includes(req.user.role)) {
      const [access] = await pool.query(`
        SELECT fha.access_status, fap.permission_type, fap.is_allowed
        FROM family_health_access fha
        JOIN family_access_permissions fap ON fha.access_id = fap.access_id
        WHERE fha.adult_user_id = ? AND fha.parent_resident_id = ?
          AND fha.access_status = 'approved'
      `, [req.user.id, seniorId]);

      if (access.length === 0) {
        return res.status(403).json({ message: 'Access denied. No approved family access for this senior.' });
      }
    }

    const [senior] = await pool.query(`
      SELECT sc.*, b.name as barangay_name
      FROM senior_citizens sc
      LEFT JOIN barangays b ON sc.barangay_id = b.id
      WHERE sc.id = ?
    `, [seniorId]);

    if (senior.length === 0) return res.status(404).json({ message: 'Senior citizen not found' });

    const [medications] = await pool.query(
      'SELECT * FROM senior_medications WHERE senior_id = ? AND status = "active"', [seniorId]
    );

    res.json({ senior: senior[0], medications });
  } catch (error) {
    console.error('Get senior for family error:', error);
    res.status(500).json({ message: 'Error retrieving senior health data' });
  }
});

// ── 7. GET Family Access Summary (Dashboard) ─────────────────────────────
router.get('/summary', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  try {
    const [summary] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN access_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN access_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN access_status = 'declined' THEN 1 ELSE 0 END) as declined,
        SUM(CASE WHEN access_status = 'revoked' THEN 1 ELSE 0 END) as revoked
      FROM family_health_access
    `);
    res.json(summary[0]);
  } catch (error) {
    console.error('Family access summary error:', error);
    res.status(500).json({ message: 'Error retrieving family access summary' });
  }
});

module.exports = router;
