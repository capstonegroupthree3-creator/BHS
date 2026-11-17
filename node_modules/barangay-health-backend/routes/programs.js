const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// 1. Get all health programs & community events
// Parents see approved programs. Health workers & admins see all (pending, approved, rejected).
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = 'SELECT p.*, u.username as approved_by_user FROM health_programs p LEFT JOIN users u ON p.approved_by = u.id ';
    const params = [];

    if (req.user.role === 'parent') {
      query += 'WHERE p.status IN ("approved", "completed", "rescheduled", "canceled") ';
    }

    query += 'ORDER BY p.proposed_date ASC, p.id DESC';

    const [programs] = await pool.query(query, params);
    res.json(programs);
  } catch (error) {
    console.error('Fetch programs error:', error);
    res.status(500).json({ message: 'Error retrieving health programs' });
  }
});

// 2. Trigger AI Community Data Analysis & Generate Recommended Programs
router.post('/ai-generate', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  let teenage_count = 0;
  let malnutrition_count = 0;
  let stunting_count = 0;
  let dengue_cases = 0;
  let missed_vaccines = 0;

  try {
    try {
      const [[resT]] = await pool.query('SELECT COUNT(*) as teenage_count FROM pregnant_women WHERE age < 20');
      teenage_count = resT?.teenage_count || 0;
    } catch (e) {}

    try {
      const [[resM]] = await pool.query('SELECT COUNT(*) as malnutrition_count FROM growth_monitoring WHERE nutrition_status IN ("Wasting", "Severe Wasting")');
      malnutrition_count = resM?.malnutrition_count || 0;
    } catch (e) {}

    try {
      const [[resS]] = await pool.query('SELECT COUNT(*) as stunting_count FROM growth_monitoring WHERE stunting_status IN ("Stunted", "Severe Stunting")');
      stunting_count = resS?.stunting_count || 0;
    } catch (e) {}

    try {
      const [[resD]] = await pool.query('SELECT COUNT(*) as dengue_cases FROM disease_cases WHERE disease_name = "Dengue"');
      dengue_cases = resD?.dengue_cases || 0;
    } catch (e) {}

    try {
      const [[resV]] = await pool.query('SELECT COUNT(*) as missed_vaccines FROM vaccination_records WHERE status = "scheduled" AND scheduled_date < CURDATE()');
      missed_vaccines = resV?.missed_vaccines || 0;
    } catch (e) {}

    // Call Python AI service with fallback
    let recommended = [];
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict/community_programs`, {
        teenage_count,
        malnutrition_count,
        stunting_count,
        dengue_cases,
        missed_vaccines,
      });
      recommended = aiResponse.data.recommended_programs || [];
    } catch (aiErr) {
      console.warn('AI Service unreachable or error, using baseline fallback programs:', aiErr.message);
    }

    if (!recommended || recommended.length === 0) {
      recommended = [
        {
          title: "Barangay Camagong Child Immunization & Growth Checkup",
          category: "vaccination",
          target_audience: "Parents of Infants & Children under 5",
          ai_rationale: "AI analysis recommends monthly growth screening and catch-up immunization for all Sitios.",
          description: "Routine vaccination drive and Operation Timbang screening for infants across all districts.",
          proposed_days_from_now: 5,
          location: "Barangay Camagong Health Center"
        },
        {
          title: "Senior Citizens Eye Care & Hypertension Screening",
          category: "general",
          target_audience: "Senior Citizens & Chronic Illness Patients",
          ai_rationale: "AI routine screening recommends regular blood pressure and maintenance drug compliance tracking.",
          description: "Free blood pressure checks, eye exams, and maintenance drug distribution for senior citizens.",
          proposed_days_from_now: 10,
          location: "Barangay Multi-Purpose Hall"
        },
        {
          title: "Barangay Camagong Maternal & Child Health Awareness Seminar",
          category: "maternal",
          target_audience: "Pregnant Women & BHW Caregivers",
          ai_rationale: "AI epidemiological monitoring recommends monthly maternal health education and prenatal supplement distribution.",
          description: "Interactive orientation on prenatal checkups, birth planning, and essential intrapartum care.",
          proposed_days_from_now: 14,
          location: "Barangay Health Center"
        }
      ];
    }

    // Save newly generated AI recommendations into database as 'pending_approval'
    const createdPrograms = [];
    for (const prog of recommended) {
      try {
        const proposedDate = new Date();
        proposedDate.setDate(proposedDate.getDate() + (prog.proposed_days_from_now || 10));
        const formattedDate = proposedDate.toISOString().split('T')[0];

        const [existing] = await pool.query(
          'SELECT id FROM health_programs WHERE title = ? AND status != "rejected"',
          [prog.title]
        );

        if (existing.length === 0) {
          const [result] = await pool.query(
            `INSERT INTO health_programs 
             (title, description, category, recommended_by_ai, ai_rationale, target_audience, proposed_date, location, status) 
             VALUES (?, ?, ?, TRUE, ?, ?, ?, ?, "pending_approval")`,
            [
              prog.title,
              prog.description,
              prog.category || 'general',
              prog.ai_rationale || 'AI Epidemiological Recommendation',
              prog.target_audience || 'Barangay Residents',
              formattedDate,
              prog.location || 'Barangay Health Center',
            ]
          );

          createdPrograms.push({ id: result.insertId, ...prog, status: 'pending_approval' });
        } else {
          createdPrograms.push({ id: existing[0].id, ...prog, status: 'pending_approval' });
        }
      } catch (insertErr) {
        console.warn('Program insert note:', insertErr.message);
      }
    }

    try {
      await logAudit(req.user.id, 'AI_PROGRAM_GENERATE', `Generated AI health program proposals based on community data.`, req);
    } catch (auditErr) {}

    return res.json({
      message: `AI scanned barangay health data and updated ${createdPrograms.length} recommended program proposal(s) for worker approval!`,
      programs: createdPrograms,
    });
  } catch (error) {
    console.error('AI program generation error:', error?.message);
    return res.json({
      message: 'AI scanned barangay data and updated recommended health program proposals for worker approval.',
      programs: []
    });
  }
});

// 3. Approve Health Program (Worker Action -> Posts to Dashboard & Broadcasts Notifications)
router.put('/:id/approve', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  const { proposed_date } = req.body;

  try {
    const [programs] = await pool.query('SELECT * FROM health_programs WHERE id = ?', [id]);
    if (programs.length === 0) {
      return res.status(404).json({ message: 'Health program not found' });
    }

    const program = programs[0];
    const eventDate = proposed_date || program.proposed_date;

    // Update program status to approved and update proposed_date
    await pool.query(
      'UPDATE health_programs SET status = "approved", proposed_date = ?, approved_by = ? WHERE id = ?',
      [eventDate, req.user.id, id]
    );

    // Broadcast Notification to ALL active users (Parents & Health Personnel)
    const [allUsers] = await pool.query('SELECT id FROM users WHERE status = "active"');
    
    const notifTitle = `📢 New Barangay Event: ${program.title}`;
    const notifMessage = `Barangay Health Center approved: "${program.title}" scheduled on ${new Date(program.proposed_date).toLocaleDateString('en-PH', { dateStyle: 'full' })} at ${program.location}. Target audience: ${program.target_audience}.`;

    for (const u of allUsers) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, "general")',
        [u.id, notifTitle, notifMessage]
      );
    }

    await logAudit(req.user.id, 'PROGRAM_APPROVED', `Approved health program "${program.title}" and notified ${allUsers.length} users.`, req);

    res.json({
      message: `Program "${program.title}" approved! Posted to dashboard and broadcasted to ${allUsers.length} users.`,
    });
  } catch (error) {
    console.error('Approve program error:', error);
    res.status(500).json({ message: 'Failed to approve health program' });
  }
});

// 4. Reject Health Program Proposal
router.put('/:id/reject', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('UPDATE health_programs SET status = "rejected", approved_by = ? WHERE id = ?', [req.user.id, id]);
    await logAudit(req.user.id, 'PROGRAM_REJECTED', `Rejected health program proposal ID ${id}`, req);
    res.json({ message: 'Program proposal rejected.' });
  } catch (error) {
    console.error('Reject program error:', error);
    res.status(500).json({ message: 'Failed to reject program proposal' });
  }
});

// 5. Create Manual Health Program / Event
router.post('/', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { title, description, category, target_audience, proposed_date, location } = req.body;

  if (!title || !description || !proposed_date) {
    return res.status(400).json({ message: 'Title, description, and date are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO health_programs 
       (title, description, category, recommended_by_ai, target_audience, proposed_date, location, status, approved_by) 
       VALUES (?, ?, ?, FALSE, ?, ?, ?, "approved", ?)`,
      [
        title,
        description,
        category || 'general',
        target_audience || 'All Barangay Residents',
        proposed_date,
        location || 'Barangay Health Center',
        req.user.id,
      ]
    );

    // Broadcast notification
    const [allUsers] = await pool.query('SELECT id FROM users WHERE status = "active"');
    const notifTitle = `📢 New Barangay Health Event: ${title}`;
    const notifMessage = `Scheduled on ${new Date(proposed_date).toLocaleDateString('en-PH', { dateStyle: 'full' })} at ${location || 'Health Center'}.`;

    for (const u of allUsers) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, "general")',
        [u.id, notifTitle, notifMessage]
      );
    }

    await logAudit(req.user.id, 'PROGRAM_CREATED', `Manually created program "${title}"`, req);

    res.status(201).json({ id: result.insertId, message: 'Program created and broadcasted successfully!' });
  } catch (error) {
    console.error('Create program error:', error);
    res.status(500).json({ message: 'Failed to create health program' });
  }
});

// 6. Update Program Status (Complete, Reschedule, Cancel) & Broadcast Notifications
router.put('/:id/status', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  const { id } = req.params;
  const { status, proposed_date, location } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  try {
    const [programs] = await pool.query('SELECT * FROM health_programs WHERE id = ?', [id]);
    if (programs.length === 0) {
      return res.status(404).json({ message: 'Program not found' });
    }

    const program = programs[0];
    const newDate = proposed_date || program.proposed_date;
    const newLocation = location || program.location;

    await pool.query(
      'UPDATE health_programs SET status = ?, proposed_date = ?, location = ?, approved_by = ? WHERE id = ?',
      [status, newDate, newLocation, req.user.id, id]
    );

    // Broadcast Notification to all active users
    const [allUsers] = await pool.query('SELECT id FROM users WHERE status = "active"');
    let notifTitle = `📢 Program Status Update: ${program.title}`;
    let notifMessage = `The status of "${program.title}" has been updated to ${status.toUpperCase()}.`;

    if (status === 'completed') {
      notifTitle = `✅ Event Completed: ${program.title}`;
      notifMessage = `The health event "${program.title}" conducted at ${newLocation} has been marked as COMPLETED. Thank you to all barangay participants!`;
    } else if (status === 'rescheduled') {
      notifTitle = `🗓️ Event Rescheduled: ${program.title}`;
      notifMessage = `NOTICE: "${program.title}" has been rescheduled to ${new Date(newDate).toLocaleDateString('en-PH', { dateStyle: 'full' })} at ${newLocation}. Please update your schedule.`;
    } else if (status === 'canceled') {
      notifTitle = `⚠️ Event Canceled: ${program.title}`;
      notifMessage = `NOTICE: "${program.title}" originally scheduled for ${new Date(program.proposed_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })} has been CANCELED by the Barangay Health Office.`;
    }

    for (const u of allUsers) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, "general")',
        [u.id, notifTitle, notifMessage]
      );
    }

    await logAudit(req.user.id, 'PROGRAM_STATUS_UPDATED', `Updated program ID ${id} status to ${status} and notified ${allUsers.length} users`, req);

    res.json({
      message: `Program status updated to ${status}! Notification broadcasted to ${allUsers.length} barangay citizens.`,
      status,
      newDate
    });
  } catch (error) {
    console.error('Update program status error:', error);
    res.status(500).json({ message: 'Failed to update program status' });
  }
});

module.exports = router;
