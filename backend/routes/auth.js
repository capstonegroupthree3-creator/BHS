const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verifyToken, logAudit } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretbarangayhealthjwtkey123';

// 1. User Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Fetch user
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = users[0];

    // Check status
    if (user.status === 'pending_approval') {
      return res.status(403).json({
        message: 'Your account registration is pending Administrator approval. Please wait for an administrator to approve your request.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is currently deactivated. Contact Administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // Log failed attempt for security audit trail
      await logAudit(user.id, 'LOGIN_FAILED', 'Failed password attempt for user: ' + username, req);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    // Get specific profile details
    let profile = null;
    if (user.role === 'health_personnel') {
      const [personnel] = await pool.query('SELECT * FROM health_personnel WHERE user_id = ?', [user.id]);
      if (personnel.length > 0) profile = personnel[0];
    } else if (user.role === 'parent') {
      const [parents] = await pool.query('SELECT * FROM parents WHERE user_id = ?', [user.id]);
      if (parents.length > 0) profile = parents[0];
    }

    // Log successful audit
    await logAudit(user.id, 'LOGIN_SUCCESS', 'Successful login from IP', req);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        phone: user.phone
      },
      profile
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login process' });
  }
});

// 2. Get Current Authenticated User profile details
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, username, role, email, phone, status FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    let profile = null;

    if (user.role === 'health_personnel') {
      const [personnel] = await pool.query(
        'SELECT hp.*, b.name as barangay_name FROM health_personnel hp LEFT JOIN barangays b ON hp.barangay_id = b.id WHERE hp.user_id = ?', 
        [user.id]
      );
      if (personnel.length > 0) profile = personnel[0];
    } else if (user.role === 'parent') {
      const [parents] = await pool.query(
        'SELECT p.*, b.name as barangay_name FROM parents p LEFT JOIN barangays b ON p.barangay_id = b.id WHERE p.user_id = ?', 
        [user.id]
      );
      if (parents.length > 0) profile = parents[0];
    }

    res.json({ user, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error retrieving user details' });
  }
});

// 3. Change Password Route
router.post('/change-password', verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Both old and new passwords are required' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    await logAudit(req.user.id, 'PASSWORD_CHANGE', 'Successfully changed account password', req);

    res.json({ message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error while updating password' });
  }
});

// 4. Forgot Password Simulation (Required for full modules flow)
router.post('/forgot-password', async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({ message: 'Username and registered email are required' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE username = ? AND email = ?', [username, email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'No matching user found with details provided.' });
    }

    const user = users[0];
    
    // Simulate reset token generation and audit trail logging
    await logAudit(user.id, 'PASSWORD_RESET_REQUESTED', 'Requested password reset link via simulated email helper', req);
    
    res.json({ 
      message: 'Password reset link sent to your registered email (simulated). Check your inbox or contact health center admin.' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error processing password reset request' });
  }
});
// 5. Public User Registration Route (Pending Admin Approval)
router.post('/register', async (req, res) => {
  const { username, password, email, phone, role, first_name, last_name, address, barangay_id } = req.body;

  if (!username || !password || !first_name || !last_name || !barangay_id) {
    return res.status(400).json({ message: 'Username, password, name, and barangay selection are required.' });
  }

  const userRole = role === 'health_personnel' ? 'health_personnel' : 'parent';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check duplicate username or email
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ? AND email != "")',
      [username, email || '']
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Username or Email is already registered. Please choose another.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User record with pending_approval status
    const [userResult] = await connection.query(
      `INSERT INTO users (username, password_hash, role, email, phone, status) VALUES (?, ?, ?, ?, ?, 'pending_approval')`,
      [username, passwordHash, userRole, email || null, phone || null]
    );

    const userId = userResult.insertId;

    // Insert linked Profile record (parent or health_personnel)
    if (userRole === 'parent') {
      await connection.query(
        `INSERT INTO parents (user_id, first_name, last_name, address, barangay_id, contact_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, first_name, last_name, address || '', barangay_id, phone || '']
      );
    } else {
      await connection.query(
        `INSERT INTO health_personnel (user_id, first_name, last_name, barangay_id, specialty, contact_number) VALUES (?, ?, ?, ?, 'Barangay Health Worker', ?)`,
        [userId, first_name, last_name, barangay_id, phone || '']
      );
    }

    // Send broadcast notification to all Admin accounts
    const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
    const notifTitle = '📢 New User Registration Request';
    const notifMessage = `User "${username}" (${first_name} ${last_name} - ${userRole === 'parent' ? 'Parent' : 'Health Personnel'}) registered and is waiting for Admin Approval.`;

    for (const adm of admins) {
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'alert')`,
        [adm.id, notifTitle, notifMessage]
      );
    }

    await connection.commit();
    await logAudit(userId, 'PUBLIC_REGISTER_REQUESTED', `Registered new account (${username}) pending Admin approval.`, req);

    res.status(201).json({
      message: 'Registration request submitted successfully! Your account is pending Administrator approval.',
      userId
    });

  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error processing registration request' });
  } finally {
    connection.release();
  }
});

// 6. Public Barangays / Puroks Dropdown Options
router.get('/public-barangays', async (req, res) => {
  try {
    const [barangays] = await pool.query('SELECT id, name FROM barangays ORDER BY name ASC');
    res.json(barangays);
  } catch (error) {
    console.error('Get public barangays error:', error);
    res.status(500).json({ message: 'Error retrieving barangays' });
  }
});

// 7. Change User Password
router.put('/change-password', verifyToken, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    const user = users[0];

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password. Please try again.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(new_password, salt);

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.id]);
    await logAudit(req.user.id, 'PASSWORD_CHANGED', `User ${user.username} successfully changed their account password.`, req);

    res.json({ message: 'Password updated successfully! Please use your new password for future logins.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error updating account password.' });
  }
});

// 8. Update Account Profile Details
router.put('/profile', verifyToken, async (req, res) => {
  const { email, phone, first_name, last_name } = req.body;

  try {
    await pool.query(
      'UPDATE users SET email = ?, phone = ? WHERE id = ?',
      [email || null, phone || null, req.user.id]
    );

    if (req.user.role === 'parent') {
      await pool.query(
        'UPDATE parents SET contact_number = ? WHERE user_id = ?',
        [phone || '', req.user.id]
      );
    } else if (req.user.role === 'health_personnel') {
      await pool.query(
        'UPDATE health_personnel SET contact_number = ? WHERE user_id = ?',
        [phone || '', req.user.id]
      );
    }

    await logAudit(req.user.id, 'PROFILE_UPDATED', `User ${req.user.username} updated profile contact details.`, req);

    res.json({ message: 'Profile details updated successfully!' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile details.' });
  }
});

module.exports = router;
