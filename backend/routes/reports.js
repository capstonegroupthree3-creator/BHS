const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorizeRoles, logAudit } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// 1. Compile summary telemetry statistics (Dashboard KPI cards & Charts data with filtering)
router.get('/summary-stats', verifyToken, async (req, res) => {
  const { barangay_id, start_date, end_date, risk_level } = req.query;

  try {
    let childWhere = ' WHERE 1=1';
    let pregWhere = ' WHERE 1=1';
    let disWhere = ' WHERE 1=1';
    const childParams = [];
    const pregParams = [];
    const disParams = [];

    if (barangay_id) {
      childWhere += ' AND c.barangay_id = ?';
      pregWhere += ' AND pw.barangay_id = ?';
      disWhere += ' AND barangay_id = ?';
      childParams.push(barangay_id);
      pregParams.push(barangay_id);
      disParams.push(barangay_id);
    }

    if (start_date && end_date) {
      pregWhere += ' AND pw.created_at BETWEEN ? AND ?';
      disWhere += ' AND case_date BETWEEN ? AND ?';
      pregParams.push(start_date, end_date);
      disParams.push(start_date, end_date);
    }

    if (risk_level) {
      pregWhere += ' AND pw.risk_status = ?';
      pregParams.push(risk_level);
    }

    // KPI Counts
    const [[{ total_children }]] = await pool.query(`SELECT COUNT(*) as total_children FROM children c ${childWhere}`, childParams);
    const [[{ total_pregnant }]] = await pool.query(`SELECT COUNT(*) as total_pregnant FROM pregnant_women pw ${pregWhere}`, pregParams);
    const [[{ total_vaccines }]] = await pool.query('SELECT COUNT(*) as total_vaccines FROM vaccines');
    
    // Fully Immunized Children count
    const [immunizedRows] = await pool.query(`
      SELECT COUNT(*) as count FROM children c
      ${childWhere} AND NOT EXISTS (
        SELECT 1 FROM vaccination_records vr
        WHERE vr.child_id = c.id AND vr.status IN ('scheduled', 'missed')
      )
    `, childParams);
    const fully_immunized = immunizedRows[0].count;

    const [[{ missed_vaccinations }]] = await pool.query("SELECT COUNT(*) as missed_vaccinations FROM vaccination_records WHERE status = 'missed'");
    const [[{ teenage_pregnancies }]] = await pool.query(`SELECT COUNT(*) as teenage_pregnancies FROM pregnant_women pw ${pregWhere} AND pw.age < 20`, pregParams);
    const [[{ high_risk_pregnancies }]] = await pool.query(`SELECT COUNT(*) as high_risk_pregnancies FROM pregnant_women pw ${pregWhere} AND pw.risk_status IN ('High', 'Critical')`, pregParams);
    
    // Malnourished cases
    const [malnutritionRows] = await pool.query(`
      SELECT COUNT(*) as count FROM growth_monitoring gm
      JOIN children c ON gm.child_id = c.id
      ${childWhere} AND gm.id IN (SELECT MAX(id) FROM growth_monitoring GROUP BY child_id)
      AND gm.nutrition_status IN ('Severe Wasting', 'Wasting')
    `, childParams);
    const malnutrition_cases = malnutritionRows[0].count;

    // Obese cases
    const [obeseRows] = await pool.query(`
      SELECT COUNT(*) as count FROM growth_monitoring gm
      JOIN children c ON gm.child_id = c.id
      ${childWhere} AND gm.id IN (SELECT MAX(id) FROM growth_monitoring GROUP BY child_id)
      AND gm.nutrition_status = 'Obese'
    `, childParams);
    const obesity_cases = obeseRows[0].count;

    // Risk distribution chart data
    const [riskDistribution] = await pool.query(`
      SELECT pw.risk_status, COUNT(*) as count 
      FROM pregnant_women pw
      ${pregWhere}
      GROUP BY pw.risk_status
    `, pregParams);

    // BMI distribution chart data
    const [bmiDistribution] = await pool.query(`
      SELECT gm.nutrition_status, COUNT(*) as count
      FROM growth_monitoring gm
      JOIN children c ON gm.child_id = c.id
      ${childWhere} AND gm.id IN (SELECT MAX(id) FROM growth_monitoring GROUP BY child_id)
      GROUP BY gm.nutrition_status
    `, childParams);

    // Vaccination coverage per vaccine chart data
    const [vaccineCoverage] = await pool.query(`
      SELECT v.name as vaccine_name,
             COUNT(CASE WHEN vr.status = 'completed' THEN 1 END) as completed_doses,
             COUNT(CASE WHEN vr.status = 'missed' THEN 1 END) as missed_doses,
             COUNT(*) as total_doses
      FROM vaccination_records vr
      JOIN vaccines v ON vr.vaccine_id = v.id
      GROUP BY v.id, v.name
    `);

    // Teenage Pregnancies per year chart data
    const [teenageTrends] = await pool.query(`
      SELECT YEAR(pw.created_at) as year, COUNT(*) as count
      FROM pregnant_women pw
      ${pregWhere} AND pw.age < 20
      GROUP BY YEAR(pw.created_at)
      ORDER BY year ASC
    `, pregParams);

    // Disease counts per month (for line charts)
    const [diseaseTrends] = await pool.query(`
      SELECT disease_name, DATE_FORMAT(case_date, '%b %Y') as month_label, COUNT(*) as cases
      FROM disease_cases
      ${disWhere}
      GROUP BY disease_name, DATE_FORMAT(case_date, '%b %Y'), YEAR(case_date), MONTH(case_date)
      ORDER BY YEAR(case_date) ASC, MONTH(case_date) ASC
    `, disParams);

    res.json({
      kpis: {
        total_children,
        total_pregnant,
        total_vaccines,
        fully_immunized,
        missed_vaccinations,
        teenage_pregnancies,
        high_risk_pregnancies,
        malnutrition_cases,
        obesity_cases
      },
      charts: {
        riskDistribution,
        bmiDistribution,
        vaccineCoverage,
        teenageTrends,
        diseaseTrends
      }
    });

  } catch (error) {
    console.error('Reports stats error:', error);
    res.status(500).json({ message: 'Server error compiling reports telemetry statistics' });
  }
});

// 2. Export Excel Report (Admin & Personnel only)
router.get('/export-excel', verifyToken, authorizeRoles('admin', 'health_personnel'), async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Barangay Health System';
    workbook.created = new Date();

    // --- SHEET 1: DASHBOARD TELEMETRY SUMMARY ---
    const summarySheet = workbook.addWorksheet('Summary KPIs');
    summarySheet.columns = [
      { header: 'Indicator Metrics', key: 'indicator', width: 40 },
      { header: 'Current Total Value', key: 'value', width: 25 }
    ];

    // Fetch summaries
    const [[{ total_children }]] = await pool.query('SELECT COUNT(*) as total_children FROM children');
    const [[{ total_pregnant }]] = await pool.query('SELECT COUNT(*) as total_pregnant FROM pregnant_women');
    const [[{ missed_vaccinations }]] = await pool.query("SELECT COUNT(*) as missed_vaccinations FROM vaccination_records WHERE status = 'missed'");
    const [[{ teenage_pregnancies }]] = await pool.query('SELECT COUNT(*) as teenage_pregnancies FROM pregnant_women WHERE age < 20');
    const [[{ high_risk_pregnancies }]] = await pool.query("SELECT COUNT(*) as high_risk_pregnancies FROM pregnant_women WHERE risk_status IN ('High', 'Critical')");

    summarySheet.addRows([
      { indicator: 'Total Children Registered', value: total_children },
      { indicator: 'Total Pregnant Mothers Enrolled', value: total_pregnant },
      { indicator: 'Total Overdue/Missed Vaccinations', value: missed_vaccinations },
      { indicator: 'Total Teenage Pregnancies (Age < 20)', value: teenage_pregnancies },
      { indicator: 'Total High/Critical Risk Maternal Cases', value: high_risk_pregnancies }
    ]);

    // Format Header Row
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };

    // --- SHEET 2: CHILD IMMUNIZATION CARD REGISTRY ---
    const childSheet = workbook.addWorksheet('Child Immunization');
    childSheet.columns = [
      { header: 'Child Name', key: 'child_name', width: 25 },
      { header: 'Sex', key: 'sex', width: 10 },
      { header: 'Age (DOB)', key: 'birthdate', width: 15 },
      { header: 'Vaccine', key: 'vaccine_name', width: 15 },
      { header: 'Dose #', key: 'dose_number', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Scheduled Date', key: 'scheduled_date', width: 15 },
      { header: 'Administered Date', key: 'administered_date', width: 15 }
    ];

    const [childDoses] = await pool.query(`
      SELECT CONCAT(c.first_name, ' ', c.last_name) as child_name, c.sex, c.birthdate,
             v.name as vaccine_name, vr.dose_number, vr.status, vr.scheduled_date, vr.administered_date
      FROM vaccination_records vr
      JOIN children c ON vr.child_id = c.id
      JOIN vaccines v ON vr.vaccine_id = v.id
      ORDER BY c.last_name ASC, vr.scheduled_date ASC
    `);

    childDoses.forEach(row => {
      childSheet.addRow({
        child_name: row.child_name,
        sex: row.sex,
        birthdate: row.birthdate.toISOString().slice(0,10),
        vaccine_name: row.vaccine_name,
        dose_number: row.dose_number,
        status: row.status.toUpperCase(),
        scheduled_date: row.scheduled_date.toISOString().slice(0,10),
        administered_date: row.administered_date ? row.administered_date.toISOString().slice(0,10) : 'N/A'
      });
    });

    childSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    childSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF107C41' } };

    // --- SHEET 3: PRENATAL VISIT REGISTRY ---
    const maternalSheet = workbook.addWorksheet('Maternal Prenatal');
    maternalSheet.columns = [
      { header: 'Mother Name', key: 'mother_name', width: 25 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Gestational Week', key: 'week', width: 20 },
      { header: 'Blood Pressure', key: 'bp', width: 15 },
      { header: 'Weight (kg)', key: 'weight', width: 15 },
      { header: 'Visit Date', key: 'visit_date', width: 15 },
      { header: 'AI Risk Level', key: 'risk_status', width: 15 }
    ];

    const [visits] = await pool.query(`
      SELECT CONCAT(pw.first_name, ' ', pw.last_name) as mother_name, pw.age,
             pv.pregnancy_week, pv.blood_pressure, pv.weight_kg, pv.visit_date, pv.risk_status
      FROM prenatal_visits pv
      JOIN pregnant_women pw ON pv.pregnant_woman_id = pw.id
      ORDER BY pw.last_name ASC, pv.visit_date DESC
    `);

    visits.forEach(row => {
      maternalSheet.addRow({
        mother_name: row.mother_name,
        age: row.age,
        week: `Week ${row.pregnancy_week}`,
        bp: row.blood_pressure,
        weight: row.weight_kg,
        visit_date: row.visit_date.toISOString().slice(0,10),
        risk_status: row.risk_status
      });
    });

    maternalSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    maternalSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800080' } };

    // Set Response Headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + `Barangay_Health_Report_${new Date().toISOString().slice(0,10)}.xlsx`
    );

    await logAudit(req.user.id, 'EXPORT_EXCEL', 'Exported comprehensive health system registry report to Excel', req);
    
    // Write and send
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Server error generating Excel file' });
  }
});

module.exports = router;
