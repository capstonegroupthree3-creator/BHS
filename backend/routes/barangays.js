const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

// 1. List all Barangays (Accessible to all authenticated users)
router.get('/', verifyToken, async (req, res) => {
  try {
    const [barangays] = await pool.query('SELECT * FROM barangays ORDER BY name ASC');
    res.json(barangays);
  } catch (error) {
    console.error('List barangays error:', error);
    res.status(500).json({ message: 'Server error retrieving barangays list' });
  }
});

// 2. Create Barangay (Admin only)
router.post('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { name, address, contact_number } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Barangay name is required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO barangays (name, address, contact_number) VALUES (?, ?, ?)',
      [name, address, contact_number]
    );

    await logAudit(req.user.id, 'BARANGAY_CREATE', `Created new barangay: ${name}`, req);

    res.status(201).json({
      id: result.insertId,
      name,
      address,
      contact_number
    });
  } catch (error) {
    console.error('Create barangay error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barangay with this name already exists' });
    }
    res.status(500).json({ message: 'Server error creating barangay' });
  }
});

// 3. Update Barangay (Admin only)
router.put('/:id', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, address, contact_number } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Barangay name is required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE barangays SET name = ?, address = ?, contact_number = ? WHERE id = ?',
      [name, address, contact_number, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Barangay not found' });
    }

    await logAudit(req.user.id, 'BARANGAY_UPDATE', `Updated barangay ID: ${id} to ${name}`, req);

    res.json({ id, name, address, contact_number });
  } catch (error) {
    console.error('Update barangay error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barangay name is already taken' });
    }
    res.status(500).json({ message: 'Server error updating barangay' });
  }
});

// 4. Delete Barangay (Admin only)
router.delete('/:id', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    // Check if any citizen is registered in this barangay
    const [children] = await pool.query('SELECT id FROM children WHERE barangay_id = ? LIMIT 1', [id]);
    const [parents] = await pool.query('SELECT id FROM parents WHERE barangay_id = ? LIMIT 1', [id]);
    const [pregnant] = await pool.query('SELECT id FROM pregnant_women WHERE barangay_id = ? LIMIT 1', [id]);

    if (children.length > 0 || parents.length > 0 || pregnant.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete barangay. It has registered residents (children, parents, or pregnant women).' 
      });
    }

    const [result] = await pool.query('DELETE FROM barangays WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Barangay not found' });
    }

    await logAudit(req.user.id, 'BARANGAY_DELETE', `Deleted barangay ID: ${id}`, req);

    res.json({ message: 'Barangay deleted successfully!' });
  } catch (error) {
    console.error('Delete barangay error:', error);
    res.status(500).json({ message: 'Server error deleting barangay' });
  }
});

module.exports = router;
