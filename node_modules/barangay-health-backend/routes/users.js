const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

// 1. Get All System Users (Admin Only)
router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.username, u.role, u.email, u.phone, u.status, u.created_at,
             COALESCE(p.first_name, hp.first_name, 'Admin') as first_name,
             COALESCE(p.last_name, hp.last_name, 'User') as last_name,
             COALESCE(b1.name, b2.name, 'System Wide') as barangay_name
      FROM users u
      LEFT JOIN parents p ON u.id = p.user_id
      LEFT JOIN barangays b1 ON p.barangay_id = b1.id
      LEFT JOIN health_personnel hp ON u.id = hp.user_id
      LEFT JOIN barangays b2 ON hp.barangay_id = b2.id
      ORDER BY FIELD(u.status, 'pending_approval', 'active', 'inactive'), u.created_at DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Error retrieving system users' });
  }
});

// 2. Approve Pending User Account (Admin Only)
router.put('/:id/approve', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const targetUser = users[0];

    // Set status to active
    await pool.query("UPDATE users SET status = 'active' WHERE id = ?", [id]);

    // Send notification to the newly approved user
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'general')`,
      [
        id,
        '🎉 Account Approved!',
        'Your registration request has been approved by the Administrator. You now have full access to the Smart Barangay Health System.',
      ]
    );

    await logAudit(req.user.id, 'USER_ACCOUNT_APPROVED', `Approved user account: ${targetUser.username} (Role: ${targetUser.role})`, req);

    res.json({
      message: `User account "${targetUser.username}" has been successfully approved and activated!`,
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ message: 'Failed to approve user account' });
  }
});

// 3. Reject Pending User Registration Request (Admin Only)
router.put('/:id/reject', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const targetUser = users[0];

    // Set status to inactive
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = ?", [id]);
    await logAudit(req.user.id, 'USER_ACCOUNT_REJECTED', `Rejected registration request for user: ${targetUser.username}`, req);

    res.json({ message: `Registration request for "${targetUser.username}" rejected.` });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ message: 'Failed to reject user registration' });
  }
});

// 4. Toggle User Status (Active / Inactive) (Admin Only)
router.put('/:id/status', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value. Must be active or inactive.' });
  }

  try {
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    await logAudit(req.user.id, 'USER_STATUS_TOGGLED', `Changed user ID ${id} status to ${status}`, req);
    res.json({ message: `User account status updated to ${status}.` });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
});

module.exports = router;
