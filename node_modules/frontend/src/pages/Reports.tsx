import React, { useEffect, useState } from 'react';
import { Download, FileText, RefreshCcw, BarChart3, Filter } from 'lucide-react';
import api from '../lib/api';

interface KPIs {
  total_children: number;
  total_pregnant: number;
  total_vaccines: number;
  fully_immunized: number;
  missed_vaccinations: number;
  teenage_pregnancies: number;
  high_risk_pregnancies: number;
  malnutrition_cases: number;
  obesity_cases: number;
}

interface Barangay {
  id: number;
  name: string;
}

const Reports: React.FC = () => {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [selectedBarangay, setSelectedBarangay] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [riskLevel, setRiskLevel] = useState<string>('');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedBarangay) params.barangay_id = selectedBarangay;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (riskLevel) params.risk_level = riskLevel;

      const [res, barRes] = await Promise.all([
        api.get('/reports/summary-stats', { params }),
        api.get('/barangays'),
      ]);

      setKpis(res.data.kpis);
      setBarangays(barRes.data);
    } catch (err) {
      console.error('Reports stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedBarangay, startDate, endDate, riskLevel]);

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/reports/export-excel', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Barangay_Health_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download Excel report. Make sure the backend server is running.');
    } finally {
      setDownloading(false);
    }
  };

  const printReport = () => window.print();

  const reportRows = kpis
    ? [
        { label: 'Total Children Registered', value: kpis.total_children, color: 'text-blue-600' },
        { label: 'Total Pregnant Mothers Enrolled', value: kpis.total_pregnant, color: 'text-purple-600' },
        { label: 'Fully Immunized Children', value: kpis.fully_immunized, color: 'text-green-600' },
        { label: 'Missed / Overdue Vaccinations', value: kpis.missed_vaccinations, color: 'text-orange-500' },
        { label: 'High / Critical Risk Pregnancies', value: kpis.high_risk_pregnancies, color: 'text-red-600' },
        { label: 'Teenage Pregnancies (Age < 20)', value: kpis.teenage_pregnancies, color: 'text-amber-600' },
        { label: 'Children with Malnutrition', value: kpis.malnutrition_cases, color: 'text-red-500' },
        { label: 'Children with Obesity', value: kpis.obesity_cases, color: 'text-indigo-600' },
      ]
    : [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Health System Reports & Filtering Center</h1>
          <p className="page-subtitle">Filter by barangay, date range, or risk level to generate customized analytics and Excel workbooks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchStats} disabled={loading} className="btn-secondary btn-sm">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={printReport} className="btn-secondary btn-sm">
            <FileText className="w-3.5 h-3.5" /> Print PDF
          </button>
          <button onClick={downloadExcel} disabled={downloading} className="btn-success btn-sm">
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'Downloading...' : 'Download Excel'}
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="card p-4 no-print space-y-3">
        <div className="flex items-center gap-2 font-bold text-xs text-slate-700">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Report Data Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">District Scope</label>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="form-select text-xs py-1.5"
            >
              <option value="">All Districts & Sitios</option>
              {barangays.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input text-xs py-1.5"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input text-xs py-1.5"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Risk Level</label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="form-select text-xs py-1.5"
            >
              <option value="">All Risk Levels</option>
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
              <option value="Critical">Critical Risk</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
      ) : (
        <>
          {/* Report Header (visible on print) */}
          <div className="card print-full">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Smart Barangay Health Management System</h2>
                  <p className="text-sm text-slate-500">
                    Generated: {new Date().toLocaleDateString('en-PH', { dateStyle: 'full' })} · Comprehensive Health Telemetry Report
                  </p>
                </div>
              </div>
            </div>

            <div className="card-body">
              <h3 className="text-base font-semibold text-slate-800 mb-4">Summary Indicators</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Indicator</th>
                      <th>Current Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row) => (
                      <tr key={row.label}>
                        <td className="font-medium text-slate-700">{row.label}</td>
                        <td>
                          <span className={`text-xl font-bold ${row.color}`}>{row.value}</span>
                        </td>
                        <td>
                          {row.value === 0 ? (
                            <span className="badge badge-green">✓ Clear</span>
                          ) : row.color.includes('red') || row.color.includes('orange') ? (
                            <span className="badge badge-red">⚠ Action Required</span>
                          ) : (
                            <span className="badge badge-blue">Monitored</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Report Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
            {reportRows.map((row) => (
              <div key={row.label} className="card p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{row.label}</p>
                <p className={`text-3xl font-bold mt-2 ${row.color}`}>{row.value}</p>
              </div>
            ))}
          </div>

          <div className="alert alert-info no-print">
            <FileText className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">
              <strong>Export Options:</strong> Click <strong>Print PDF</strong> to print this page as a formatted PDF, or use{' '}
              <strong>Download Excel</strong> for a multi-sheet workbook with full child immunization records and prenatal visit history.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
