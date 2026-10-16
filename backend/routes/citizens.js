const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

// Utility to verify if parent user owns the child record
const verifyParentAccess = async (req, res, targetParentUserId) => {
  if (req.user.role === 'parent') {
    const [parent] = await pool.query('SELECT id FROM parents WHERE user_id = ?', [req.user.id]);
    const [targetParent] = await pool.query('SELECT id FROM parents WHERE user_id = ?', [targetParentUserId]);
    
    if (parent.length === 0 || targetParent.length === 0 || parent[0].id !== targetParent[0].id) {
      return false;
    }
  }
  return true;
};

// 1. Get Parents List (Admin & Health Personnel only)
router.get('/parents', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  try {
    const [parents] = await pool.query(`
      SELECT p.*, u.username, u.email, u.phone, u.status, b.name as barangay_name 
      FROM parents p
      JOIN users u ON p.user_id = u.id
      JOIN barangays b ON p.barangay_id = b.id
      ORDER BY p.last_name ASC
    `);
    res.json(parents);
  } catch (error) {
    console.error('Get parents error:', error);
    res.status(500).json({ message: 'Server error retrieving parents list' });
  }
});

// 1b. Get Single Parent Detail with Linked Children, Maternal Record & AI Recommendations
router.get('/parents/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [parents] = await pool.query(`
      SELECT p.*, b.name as barangay_name, u.username, u.email
      FROM parents p
      JOIN barangays b ON p.barangay_id = b.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]);

    if (parents.length === 0) {
      return res.status(404).json({ message: 'Parent record not found' });
    }

    const parent = parents[0];

    // Security check for parent user role
    if (req.user.role === 'parent' && parent.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You can only view your own family records.' });
    }

    // Get linked children
    const [children] = await pool.query(`
      SELECT c.*, b.name as barangay_name,
             (SELECT gm.nutrition_status FROM growth_monitoring gm WHERE gm.child_id = c.id ORDER BY gm.id DESC LIMIT 1) as latest_nutrition_status,
             (SELECT gm.wasting_status FROM growth_monitoring gm WHERE gm.child_id = c.id ORDER BY gm.id DESC LIMIT 1) as latest_wasting_status,
             (SELECT gm.stunting_status FROM growth_monitoring gm WHERE gm.child_id = c.id ORDER BY gm.id DESC LIMIT 1) as latest_stunting_status
      FROM children c
      JOIN barangays b ON c.barangay_id = b.id
      WHERE c.parent_id = ?
      ORDER BY c.birthdate DESC
    `, [id]);

    // Get linked pregnant mother record (if applicable)
    const [pregnantRecords] = await pool.query(
      'SELECT * FROM pregnant_women WHERE first_name = ? AND last_name = ?',
      [parent.first_name, parent.last_name]
    );

    const pregnantRecord = pregnantRecords.length > 0 ? pregnantRecords[0] : null;

    // AI Family Health Recommendations
    let ai_recommendation = `Family Health Guidance for ${parent.first_name} ${parent.last_name}: Maintain active routine health visits at the local Barangay Health Center. Ensure all under-5 children complete primary immunizations and attend quarterly Operation Timbang checkups.`;

    if (children.some(c => c.latest_nutrition_status?.includes('Wasting') || c.latest_wasting_status?.includes('Wasting'))) {
      ai_recommendation += ` ⚠️ Action Needed: 1 or more children in this household are flagged for Malnutrition/Wasting. Health worker has assigned Ready-to-Use Therapeutic Food (RUTF) sachets and micronutrient supplements.`;
    }

    if (pregnantRecord) {
      ai_recommendation += ` 🤰 Maternal Health Notice: Active pregnancy tracked (${pregnantRecord.risk_status} Risk). Ensure regular prenatal checkups and daily Iron/Folic Acid intake.`;
    }

    res.json({
      parent,
      children,
      pregnantRecord,
      ai_recommendation
    });
  } catch (error) {
    console.error('Get parent details error:', error);
    res.status(500).json({ message: 'Server error retrieving parent family details' });
  }
});

// 1c. Update Parent Details (Admin & Health Personnel)
router.put('/parents/:id', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, contact_number, address, barangay_id } = req.body;

  try {
    await pool.query(
      `UPDATE parents SET first_name = ?, last_name = ?, contact_number = ?, address = ?, barangay_id = ? WHERE id = ?`,
      [first_name, last_name, contact_number || '', address || '', barangay_id, id]
    );

    await logAudit(req.user.id, 'PARENT_PROFILE_UPDATED', `Updated Parent record ID ${id} (${first_name} ${last_name})`, req);

    res.json({ message: `Parent record for ${first_name} ${last_name} updated successfully!` });
  } catch (error) {
    console.error('Update parent error:', error);
    res.status(500).json({ message: 'Server error updating parent details' });
  }
});

// 2. Register Parent (Admin & Health Personnel)
router.post('/parents', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { username, password, email, phone, first_name, last_name, address, barangay_id } = req.body;

  if (!username || !password || !first_name || !last_name || !barangay_id) {
    return res.status(400).json({ message: 'Missing required registration details' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create User account
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [userResult] = await connection.query(
      `INSERT INTO users (username, password_hash, role, email, phone, status) VALUES (?, ?, 'parent', ?, ?, 'active')`,
      [username, passwordHash, email, phone]
    );

    const userId = userResult.insertId;

    // 2. Create Parent profile
    const [parentResult] = await connection.query(
      `INSERT INTO parents (user_id, first_name, last_name, address, barangay_id, contact_number) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, first_name, last_name, address, barangay_id, phone]
    );

    await connection.commit();
    await logAudit(req.user.id, 'PARENT_REGISTER', `Registered parent: ${first_name} ${last_name} (User ID: ${userId})`, req);

    res.status(201).json({
      message: 'Parent registered successfully!',
      parentId: parentResult.insertId,
      userId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Register parent error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Username or Email already registered' });
    }
    res.status(500).json({ message: 'Server error registering parent' });
  } finally {
    connection.release();
  }
});

// 3. Get Children List (Filters based on role)
router.get('/children', verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT c.*, b.name as barangay_name, p.first_name as parent_first_name, p.last_name as parent_last_name
      FROM children c
      JOIN parents p ON c.parent_id = p.id
      JOIN barangays b ON c.barangay_id = b.id
    `;
    let params = [];

    if (req.user.role === 'parent') {
      // Restrict strictly to parent's children
      query += ` WHERE p.user_id = ? `;
      params.push(req.user.id);
    }

    query += ` ORDER BY c.last_name ASC, c.first_name ASC`;

    const [children] = await pool.query(query, params);
    res.json(children);
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ message: 'Server error retrieving children list' });
  }
});

// 3b. Get Child Growth Timeline & Timbang History (For parents & health workers)
router.get('/children/:id/history', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [children] = await pool.query(`
      SELECT c.*, b.name as barangay_name, p.first_name as parent_first_name, p.last_name as parent_last_name, p.user_id as parent_user_id
      FROM children c
      JOIN parents p ON c.parent_id = p.id
      JOIN barangays b ON c.barangay_id = b.id
      WHERE c.id = ?
    `, [id]);

    if (children.length === 0) {
      return res.status(404).json({ message: 'Child record not found' });
    }

    const child = children[0];

    // Security Check: If user is parent, ensure this child belongs to them
    if (req.user.role === 'parent' && child.parent_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: Access denied to other family records.' });
    }

    const [growthHistory] = await pool.query(
      'SELECT * FROM growth_monitoring WHERE child_id = ? ORDER BY visit_date ASC',
      [id]
    );

    const [vaccines] = await pool.query(`
      SELECT vr.*, v.name as vaccine_name, v.type as vaccine_type
      FROM vaccination_records vr
      JOIN vaccines v ON vr.vaccine_id = v.id
      WHERE vr.child_id = ?
      ORDER BY vr.scheduled_date ASC
    `, [id]);

    res.json({
      child,
      growthHistory,
      vaccines
    });
  } catch (error) {
    console.error('Get child growth history error:', error);
    res.status(500).json({ message: 'Server error retrieving child growth history' });
  }
});

// 4. Register Child (Admin & Health Personnel)
router.post('/children', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { first_name, last_name, birthdate, sex, parent_id, barangay_id } = req.body;

  if (!first_name || !last_name || !birthdate || !sex || !parent_id || !barangay_id) {
    return res.status(400).json({ message: 'Missing required child registration details' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert child
    const [result] = await connection.query(
      `INSERT INTO children (first_name, last_name, birthdate, sex, parent_id, barangay_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, birthdate, sex, parent_id, barangay_id]
    );

    const childId = result.insertId;

    // 2. Automatically generate immunization schedules based on birthdate!
    const [vaccines] = await connection.query('SELECT * FROM vaccines');
    
    const scheduleRecords = [];
    for (const v of vaccines) {
      // BCG, HepB - at birth (scheduled_date = birthdate)
      // Pentavalent 1, 2, 3 - birthdate + 6 weeks, 10 weeks, 14 weeks
      // OPV 1, 2, 3 - birthdate + 6, 10, 14 weeks
      // IPV 1, 2 - birthdate + 14 weeks, 9 months
      // PCV 1, 2, 3 - birthdate + 6, 10, 14 weeks
      // MMR 1, 2 - birthdate + 9 months, 12 months
      // Vitamin A - birthdate + 6 months, 12 months, 18 months, etc.

      if (v.name === 'BCG' || v.name === 'Hepatitis B') {
        scheduleRecords.push([childId, v.id, 1, 'scheduled', birthdate]);
      } else if (v.name === 'Pentavalent' || v.name === 'OPV' || v.name === 'PCV') {
        const weeks = [6, 10, 14];
        for (let d = 1; d <= 3; d++) {
          const schedDate = new Date(birthdate);
          schedDate.setDate(schedDate.getDate() + (weeks[d - 1] * 7));
          scheduleRecords.push([childId, v.id, d, 'scheduled', schedDate]);
        }
      } else if (v.name === 'IPV') {
        // IPV 1 at 14 weeks, IPV 2 at 9 months
        const date1 = new Date(birthdate);
        date1.setDate(date1.getDate() + (14 * 7));
        const date2 = new Date(birthdate);
        date2.setMonth(date2.getMonth() + 9);
        scheduleRecords.push([childId, v.id, 1, 'scheduled', date1]);
        scheduleRecords.push([childId, v.id, 2, 'scheduled', date2]);
      } else if (v.name === 'MMR') {
        const date1 = new Date(birthdate);
        date1.setMonth(date1.getMonth() + 9);
        const date2 = new Date(birthdate);
        date2.setMonth(date2.getMonth() + 12);
        scheduleRecords.push([childId, v.id, 1, 'scheduled', date1]);
        scheduleRecords.push([childId, v.id, 2, 'scheduled', date2]);
      } else if (v.name === 'Vitamin A') {
        // Supp every 6 months starting at 6 months up to 5 years (10 doses)
        for (let d = 1; d <= 10; d++) {
          const schedDate = new Date(birthdate);
          schedDate.setMonth(schedDate.getMonth() + (d * 6));
          scheduleRecords.push([childId, v.id, d, 'scheduled', schedDate]);
        }
      }
    }

    if (scheduleRecords.length > 0) {
      await connection.query(
        `INSERT INTO vaccination_records (child_id, vaccine_id, dose_number, status, scheduled_date) VALUES ?`,
        [scheduleRecords]
      );
    }

    // 3. Automatically add a notification to the parent
    const [parentObj] = await connection.query('SELECT user_id FROM parents WHERE id = ?', [parent_id]);
    if (parentObj.length > 0) {
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'vaccination')`,
        [
          parentObj[0].user_id,
          'Child Registered & Immunization Scheduled',
          `Your child ${first_name} ${last_name} has been successfully registered. A personalized immunization schedule has been generated.`,
        ]
      );
    }

    await connection.commit();
    await logAudit(req.user.id, 'CHILD_REGISTER', `Registered child: ${first_name} ${last_name} (ID: ${childId})`, req);

    res.status(201).json({
      message: 'Child registered successfully and vaccine schedules created!',
      childId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Register child error:', error);
    res.status(500).json({ message: 'Server error registering child' });
  } finally {
    connection.release();
  }
});

// 5. Get Pregnant Women List (Filters based on role)
router.get('/pregnant', verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT pw.*, b.name as barangay_name, p.user_id as parent_user_id
      FROM pregnant_women pw
      JOIN barangays b ON pw.barangay_id = b.id
      LEFT JOIN parents p ON pw.parent_id = p.id
    `;
    let params = [];

    if (req.user.role === 'parent') {
      // Parent can only see their own pregnancy profile
      query += ` WHERE p.user_id = ? `;
      params.push(req.user.id);
    }

    query += ` ORDER BY pw.last_name ASC, pw.first_name ASC`;

    const [pregnant] = await pool.query(query, params);
    res.json(pregnant);
  } catch (error) {
    console.error('Get pregnant women error:', error);
    res.status(500).json({ message: 'Server error retrieving pregnant list' });
  }
});

// 6. Register Pregnant Woman (Admin & Health Personnel)
router.post('/pregnant', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { first_name, last_name, age, address, barangay_id, pregnancy_week_start, conception_date, parent_id } = req.body;

  if (!first_name || !last_name || !age || !barangay_id || !pregnancy_week_start || !conception_date) {
    return res.status(400).json({ message: 'Missing required maternal registration details' });
  }

  try {
    // Expected delivery date is conception date + 280 days
    const conception = new Date(conception_date);
    const edd = new Date(conception.getTime() + (280 * 24 * 60 * 60 * 1000));
    const edd_formatted = edd.toISOString().slice(0, 10);

    // Initial Risk Assessment (Teenage Pregnancy rules check)
    let initial_risk = 'Low';
    if (parseInt(age) < 20) {
      initial_risk = 'High'; // Teenage pregnancy automatic flag
    }

    const [result] = await pool.query(
      `INSERT INTO pregnant_women 
      (parent_id, first_name, last_name, age, address, barangay_id, pregnancy_week_start, conception_date, expected_delivery_date, risk_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [parent_id || null, first_name, last_name, age, address, barangay_id, pregnancy_week_start, conception_date, edd_formatted, initial_risk]
    );

    const pregnantId = result.insertId;

    // Log notification if linked to parent account
    if (parent_id) {
      const [parentObj] = await pool.query('SELECT user_id FROM parents WHERE id = ?', [parent_id]);
      if (parentObj.length > 0) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'prenatal')`,
          [
            parentObj[0].user_id,
            'Prenatal Care Tracking Registered',
            `Prenatal profile created for ${first_name} ${last_name}. Expected Delivery Date: ${edd_formatted}. Risk Category: ${initial_risk}.`,
          ]
        );
      }
    }

    await logAudit(req.user.id, 'PREGNANT_REGISTER', `Registered pregnant mother: ${first_name} ${last_name} (ID: ${pregnantId})`, req);

    res.status(201).json({
      message: 'Pregnant woman profile registered successfully!',
      pregnantId,
      expected_delivery_date: edd_formatted,
      risk_status: initial_risk
    });

  } catch (error) {
    console.error('Register pregnant error:', error);
    res.status(500).json({ message: 'Server error registering pregnant mother' });
  }
});

// 7. Update Child Growth & BMI Record (Health Personnel & Admin)
router.post('/growth', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { child_id, height_cm, weight_kg, visit_date, recommendations } = req.body;

  if (!child_id || !height_cm || !weight_kg) {
    return res.status(400).json({ message: 'Child ID, Height (cm), and Weight (kg) are required.' });
  }

  try {
    // Get child info to compute age in months
    const [children] = await pool.query('SELECT birthdate, first_name, last_name FROM children WHERE id = ?', [child_id]);
    if (children.length === 0) {
      return res.status(404).json({ message: 'Child not found.' });
    }

    const child = children[0];
    const birthDate = new Date(child.birthdate);
    const today = new Date();
    const ageMonths = Math.max(1, Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));

    // Calculate BMI = kg / (m^2)
    const heightM = height_cm / 100.0;
    const bmi = parseFloat((weight_kg / (heightM * heightM)).toFixed(2));

    // Classify Nutrition & Wasting
    let nutrition_status = 'Normal';
    let wasting_status = 'Normal';

    if (bmi < 12.5) {
      nutrition_status = 'Severe Wasting';
      wasting_status = 'Severe Wasting';
    } else if (bmi < 14.0) {
      nutrition_status = 'Wasting';
      wasting_status = 'Wasting';
    } else if (bmi > 18.5) {
      nutrition_status = 'Obese';
      wasting_status = 'Obese';
    } else if (bmi > 17.0) {
      nutrition_status = 'Overweight';
      wasting_status = 'Overweight';
    }

    // Classify Stunting based on Height vs Age
    let stunting_status = 'Normal';
    const expectedHeight = 50 + (ageMonths * 1.25);
    if (height_cm < expectedHeight - 12) {
      stunting_status = 'Severe Stunting';
    } else if (height_cm < expectedHeight - 6) {
      stunting_status = 'Stunted';
    }

    // Micronutrient Deficiency Risk
    let microRisk = 'Low Risk';
    if (nutrition_status.includes('Wasting') || stunting_status.includes('Stunt')) {
      microRisk = 'High Risk: Iron Deficiency Anemia & Vitamin A Deficiency';
    }

    const recsText = recommendations || (
      nutrition_status.includes('Wasting') 
        ? 'Enroll in Barangay Supplemental Feeding Program. Administer RUTF sachets & Vitamin A.' 
        : 'Growth on track. Continue monthly Operation Timbang.'
    );

    const recordDate = visit_date || new Date().toISOString().slice(0, 10);

    const [result] = await pool.query(
      `INSERT INTO growth_monitoring 
      (child_id, visit_date, height_cm, weight_kg, bmi, nutrition_status, stunting_status, wasting_status, micronutrient_deficiency_risk, recorded_by, recommendations) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [child_id, recordDate, height_cm, weight_kg, bmi, nutrition_status, stunting_status, wasting_status, microRisk, req.user.id, recsText]
    );

    await logAudit(req.user.id, 'GROWTH_RECORD_ADDED', `Updated growth monitoring for ${child.first_name} ${child.last_name}: Height ${height_cm}cm, Weight ${weight_kg}kg, BMI ${bmi} (${nutrition_status})`, req);

    res.status(201).json({
      message: `Growth record updated successfully for ${child.first_name} ${child.last_name}!`,
      growth_id: result.insertId,
      bmi,
      nutrition_status,
      stunting_status,
      wasting_status,
      micronutrient_deficiency_risk: microRisk,
      recommendations: recsText
    });
  } catch (error) {
    console.error('Update growth error:', error);
    res.status(500).json({ message: 'Failed to record growth measurement' });
  }
});

// 8. Update Child Details (Health Personnel & Admin)
router.put('/children/:id', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, birthdate, sex, barangay_id } = req.body;

  try {
    await pool.query(
      'UPDATE children SET first_name = ?, last_name = ?, birthdate = ?, sex = ?, barangay_id = COALESCE(?, barangay_id) WHERE id = ?',
      [first_name, last_name, birthdate, sex, barangay_id || null, id]
    );

    await logAudit(req.user.id, 'CHILD_DETAILS_UPDATED', `Updated child profile ID ${id}: ${first_name} ${last_name}`, req);

    res.json({ message: `Child details for ${first_name} ${last_name} updated successfully!` });
  } catch (error) {
    console.error('Update child error:', error);
    res.status(500).json({ message: 'Failed to update child details' });
  }
});

// 9. Batch Excel / CSV Data Import (Admin & Health Personnel)
router.post('/import-excel', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: 'No records provided for import. Please upload a valid Excel or CSV file.' });
  }

  let importedCount = 0;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const row of records) {
      const firstName = row.first_name || row['First Name'] || row['first_name'];
      const lastName = row.last_name || row['Last Name'] || row['last_name'];
      const birthdate = row.birthdate || row['Date of Birth'] || row['birthdate'] || '2023-01-01';
      const sex = (row.sex || row['Sex'] || row['Gender'] || 'M').toString().toUpperCase().startsWith('F') ? 'F' : 'M';
      const barangayId = Number(row.barangay_id || row['Purok'] || row['Barangay ID'] || 1);

      if (firstName && lastName) {
        // Insert child record
        const [result] = await connection.query(
          `INSERT INTO children (first_name, last_name, birthdate, sex, parent_id, barangay_id) VALUES (?, ?, ?, ?, 1, ?)`,
          [firstName, lastName, birthdate, sex, barangayId]
        );
        const childId = result.insertId;

        // If height and weight provided, insert growth monitoring
        const heightCm = Number(row.height_cm || row['Height (cm)'] || row['height'] || 80);
        const weightKg = Number(row.weight_kg || row['Weight (kg)'] || row['weight'] || 11);
        if (heightCm > 0 && weightKg > 0) {
          const heightM = heightCm / 100.0;
          const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(2));
          const recorderId = (req.user && req.user.id) ? req.user.id : 1;

          await connection.query(
            `INSERT INTO growth_monitoring (child_id, visit_date, height_cm, weight_kg, bmi, nutrition_status, stunting_status, wasting_status, recorded_by, recommendations)
             VALUES (?, CURDATE(), ?, ?, ?, 'Normal', 'Normal', 'Normal', ?, 'Batch imported via Excel data tool.')`,
            [childId, heightCm, weightKg, bmi, recorderId]
          );
        }
        importedCount++;
      }
    }

    await connection.commit();
    await logAudit(req.user.id, 'EXCEL_DATA_IMPORTED', `Imported ${importedCount} citizen records via Excel data tool.`, req);

    res.json({
      message: `Successfully imported ${importedCount} citizen records into database from Excel dataset!`,
      importedCount
    });
  } catch (error) {
    await connection.rollback();
    console.error('Batch import error:', error);
    res.status(500).json({ message: 'Error processing Excel batch data import.' });
  } finally {
    connection.release();
  }
});

// 10. Delete Parent Record (Admin & Health Personnel)
router.delete('/parents/:id', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  try {
    const [parents] = await pool.query('SELECT user_id, first_name, last_name FROM parents WHERE id = ?', [id]);
    if (parents.length === 0) {
      return res.status(404).json({ message: 'Parent record not found' });
    }
    const parent = parents[0];
    await pool.query('DELETE FROM parents WHERE id = ?', [id]);
    if (parent.user_id) {
      await pool.query('DELETE FROM users WHERE id = ?', [parent.user_id]);
    }
    await logAudit(req.user.id, 'PARENT_DELETED', `Deleted Parent record ID ${id} (${parent.first_name} ${parent.last_name})`, req);
    res.json({ message: `Parent record for ${parent.first_name} ${parent.last_name} deleted successfully.` });
  } catch (error) {
    console.error('Delete parent error:', error);
    res.status(500).json({ message: 'Failed to delete parent record' });
  }
});

// 11. Delete Child Record (Admin & Health Personnel)
router.delete('/children/:id', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  try {
    const [children] = await pool.query('SELECT first_name, last_name FROM children WHERE id = ?', [id]);
    if (children.length === 0) {
      return res.status(404).json({ message: 'Child record not found' });
    }
    const child = children[0];
    await pool.query('DELETE FROM children WHERE id = ?', [id]);
    await logAudit(req.user.id, 'CHILD_DELETED', `Deleted child record ID ${id} (${child.first_name} ${child.last_name})`, req);
    res.json({ message: `Child record for ${child.first_name} ${child.last_name} deleted successfully.` });
  } catch (error) {
    console.error('Delete child error:', error);
    res.status(500).json({ message: 'Failed to delete child record' });
  }
});

// 12. Delete Pregnant Woman Record (Admin & Health Personnel)
router.delete('/pregnant/:id', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  try {
    const [pregnant] = await pool.query('SELECT first_name, last_name FROM pregnant_women WHERE id = ?', [id]);
    if (pregnant.length === 0) {
      return res.status(404).json({ message: 'Pregnant woman record not found' });
    }
    const woman = pregnant[0];
    await pool.query('DELETE FROM pregnant_women WHERE id = ?', [id]);
    await logAudit(req.user.id, 'PREGNANT_DELETED', `Deleted pregnant woman record ID ${id} (${woman.first_name} ${woman.last_name})`, req);
    res.json({ message: `Pregnant woman record for ${woman.first_name} ${woman.last_name} deleted successfully.` });
  } catch (error) {
    console.error('Delete pregnant woman error:', error);
    res.status(500).json({ message: 'Failed to delete pregnant woman record' });
  }
});

// 13. GET All Vaccination Records across Children
router.get('/vaccinations', verifyToken, async (req, res) => {
  try {
    // Auto mark scheduled doses prior to CURDATE() as missed
    await pool.query("UPDATE vaccination_records SET status = 'missed' WHERE status = 'scheduled' AND scheduled_date < CURDATE()");

    let query = `
      SELECT vr.*, c.first_name as child_first_name, c.last_name as child_last_name, b.name as barangay_name,
             v.name as vaccine_name, v.type as vaccine_type
      FROM vaccination_records vr
      JOIN children c ON vr.child_id = c.id
      JOIN barangays b ON c.barangay_id = b.id
      JOIN vaccines v ON vr.vaccine_id = v.id
    `;
    let params = [];
    if (req.user.role === 'parent') {
      query += ` JOIN parents p ON c.parent_id = p.id WHERE p.user_id = ? `;
      params.push(req.user.id);
    }
    query += ` ORDER BY vr.scheduled_date DESC `;
    const [records] = await pool.query(query, params);
    res.json(records);
  } catch (error) {
    console.error('Get all vaccinations error:', error);
    res.status(500).json({ message: 'Server error retrieving vaccination records' });
  }
});

// 14. GET Vaccines Catalog
router.get('/vaccines-catalog', verifyToken, async (req, res) => {
  try {
    const [vaccines] = await pool.query('SELECT * FROM vaccines ORDER BY name ASC');
    res.json(vaccines);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vaccines catalog' });
  }
});

// 15. POST Record / Administer Vaccine Dose (Supports custom vaccine input & child selection)
router.post('/vaccinations', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { child_id, vaccine_id, vaccine_name, vaccine_type, dose_number, status, scheduled_date, administered_date, remarks } = req.body;

  if (!child_id) {
    return res.status(400).json({ message: 'Child ID is required' });
  }

  try {
    let targetVaccineId = vaccine_id;
    if (!targetVaccineId && vaccine_name) {
      const [existing] = await pool.query('SELECT id FROM vaccines WHERE name = ?', [vaccine_name]);
      if (existing.length > 0) {
        targetVaccineId = existing[0].id;
      } else {
        const [inserted] = await pool.query(
          'INSERT INTO vaccines (name, type, target_age_months, recommended_doses) VALUES (?, ?, 0, 1)',
          [vaccine_name, vaccine_type || 'Custom Vaccine']
        );
        targetVaccineId = inserted.insertId;
      }
    }

    if (!targetVaccineId) {
      return res.status(400).json({ message: 'Vaccine selection or vaccine name is required' });
    }

    const recStatus = status || 'completed';
    const recAdminDate = recStatus === 'completed' ? (administered_date || new Date().toISOString().slice(0, 10)) : null;

    const [result] = await pool.query(
      `INSERT INTO vaccination_records (child_id, vaccine_id, dose_number, status, scheduled_date, administered_date, administered_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), administered_date = VALUES(administered_date), administered_by = VALUES(administered_by), remarks = VALUES(remarks)`,
      [child_id, targetVaccineId, dose_number || 1, recStatus, scheduled_date || new Date().toISOString().slice(0, 10), recAdminDate, req.user.id, remarks || '']
    );

    await logAudit(req.user.id, 'VACCINATION_RECORDED', `Logged vaccine dose for child ID ${child_id} (Status: ${recStatus})`, req);
    res.status(201).json({ message: 'Vaccination record saved successfully!', recordId: result.insertId });
  } catch (error) {
    console.error('Record vaccination error:', error);
    res.status(500).json({ message: 'Server error saving vaccination record' });
  }
});

// 16. PUT Update Vaccination Record Status (Mark Completed / Scheduled / Missed)
router.put('/vaccinations/:id', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  const { status, administered_date, remarks } = req.body;

  try {
    const adminDate = status === 'completed' ? (administered_date || new Date().toISOString().slice(0, 10)) : null;
    await pool.query(
      `UPDATE vaccination_records SET status = ?, administered_date = ?, administered_by = ?, remarks = COALESCE(?, remarks) WHERE id = ?`,
      [status, adminDate, req.user.id, remarks || null, id]
    );

    await logAudit(req.user.id, 'VACCINE_STATUS_UPDATED', `Updated vaccination record ID ${id} status to ${status}`, req);
    res.json({ message: `Vaccination record marked as ${status} successfully!` });
  } catch (error) {
    console.error('Update vaccination error:', error);
    res.status(500).json({ message: 'Failed to update vaccination record status' });
  }
});

// 17. POST Send Missed Immunization Official Notice Letter to Parent
router.post('/vaccinations/send-missed-notice', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { recordId, customMessage } = req.body;
  try {
    const [records] = await pool.query(`
      SELECT vr.*, c.first_name as child_first_name, c.last_name as child_last_name,
             p.user_id as parent_user_id, p.first_name as parent_first_name, p.last_name as parent_last_name,
             v.name as vaccine_name
      FROM vaccination_records vr
      JOIN children c ON vr.child_id = c.id
      JOIN parents p ON c.parent_id = p.id
      JOIN vaccines v ON vr.vaccine_id = v.id
      WHERE vr.id = ?
    `, [recordId]);

    if (records.length === 0) {
      return res.status(404).json({ message: 'Vaccination record not found' });
    }

    const rec = records[0];
    const notifTitle = `⚠️ MISSED VACCINATION NOTICE: ${rec.child_first_name} ${rec.child_last_name}`;
    const notifMsg = customMessage || `Official Notice from Barangay Camagong Health Center: Your child ${rec.child_first_name} missed the scheduled ${rec.vaccine_name} dose on ${new Date(rec.scheduled_date).toLocaleDateString('en-PH', { dateStyle: 'full' })}. Please visit the health center as soon as possible for catch-up immunization.`;

    if (rec.parent_user_id) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, "urgent")',
        [rec.parent_user_id, notifTitle, notifMsg]
      );
    }

    await logAudit(req.user.id, 'MISSED_VACCINE_NOTICE_SENT', `Sent missed immunization notice to parent of child ID ${rec.child_id}`, req);

    res.json({ message: `Missed immunization notice successfully sent to ${rec.parent_first_name} ${rec.parent_last_name}!` });
  } catch (error) {
    console.error('Send missed vaccine notice error:', error);
    res.status(500).json({ message: 'Failed to send missed vaccine notice' });
  }
});

module.exports = router;
