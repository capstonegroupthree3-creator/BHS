import React, { useEffect, useState } from 'react';
import { Search, Plus, Baby, Calendar, Sparkles, Activity, Edit3, X, CheckCircle2, ChevronRight, FileSpreadsheet, Trash2, Download } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import ExcelImportModal from '../components/ExcelImportModal';
import { exportToExcel } from '../lib/excelExport';

interface Child {
  id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  sex: string;
  parent_first_name: string;
  parent_last_name: string;
  barangay_name: string;
}

interface Parent {
  id: number;
  first_name: string;
  last_name: string;
  barangay_name: string;
}

interface Barangay {
  id: number;
  name: string;
}

interface GrowthRecord {
  id: number;
  visit_date: string;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  nutrition_status: string;
  stunting_status: string;
  wasting_status: string;
  micronutrient_deficiency_risk: string;
  recommendations: string;
}

const Children: React.FC = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected Child Drawer / Modal
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [growthHistory, setGrowthHistory] = useState<GrowthRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Forms
  const [form, setForm] = useState({
    first_name: '', last_name: '', birthdate: '', sex: 'M', parent_id: '', barangay_id: '',
  });

  const [growthForm, setGrowthForm] = useState({
    height_cm: 85.0,
    weight_kg: 12.0,
    visit_date: new Date().toISOString().split('T')[0],
  });

  const canManage = user?.role === 'admin' || user?.role === 'health_personnel';

  const fetchData = async () => {
    setLoading(true);
    try {
      const childRes = await api.get('/citizens/children');
      setChildren(childRes.data);
      if (canManage) {
        const [parentRes, barRes] = await Promise.all([
          api.get('/citizens/parents'),
          api.get('/barangays'),
        ]);
        setParents(parentRes.data);
        setBarangays(barRes.data);
      }
    } catch (err) {
      console.error('Children fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSelectChild = async (child: Child) => {
    setSelectedChild(child);
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/citizens/children/${child.id}/history`);
      setGrowthHistory(data.growthHistory);
    } catch (err) {
      console.error('Fetch child history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filtered = children.filter(c =>
    `${c.first_name} ${c.last_name} ${c.barangay_name} ${c.parent_first_name} ${c.parent_last_name}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const getAgeStr = (birthdate: string) => {
    const dob = new Date(birthdate);
    const now = new Date();
    const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    if (months < 1) return `< 1 mo`;
    if (months < 12) return `${months} mo`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return remMonths > 0 ? `${years}y ${remMonths}m` : `${years} yrs`;
  };

  const handleRegisterChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/citizens/children', form);
      setSuccessMsg('Child registered and vaccine schedule created!');
      setShowModal(false);
      setForm({ first_name: '', last_name: '', birthdate: '', sex: 'M', parent_id: '', barangay_id: '' });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGrowthMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/citizens/growth', {
        child_id: selectedChild.id,
        height_cm: growthForm.height_cm,
        weight_kg: growthForm.weight_kg,
        visit_date: growthForm.visit_date,
      });
      setSuccessMsg(data.message);
      setShowGrowthForm(false);
      handleSelectChild(selectedChild);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to record growth measurement');
    } finally {
      setSubmitting(false);
    }
  };

  // APEXCHARTS TIMBANG GRAPH OPTIONS
  const timbangChartOptions: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
    stroke: { width: 3, curve: 'smooth' },
    colors: ['#2563eb', '#16a34a', '#d946ef'],
    xaxis: {
      categories: growthHistory.map(g => new Date(g.visit_date).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })),
    },
    yaxis: [
      { title: { text: 'Weight (kg)' }, min: 0 },
      { opposite: true, title: { text: 'Height (cm)' } },
    ],
    grid: { borderColor: '#f1f5f9' },
    markers: { size: 5 },
  };

  const timbangChartSeries = [
    { name: 'Weight (kg)', data: growthHistory.map(g => Number(g.weight_kg)) },
    { name: 'Height (cm)', data: growthHistory.map(g => Number(g.height_cm)) },
    { name: 'BMI (kg/m²)', data: growthHistory.map(g => Number(g.bmi)) },
  ];

  const latestRecord = growthHistory.length > 0 ? growthHistory[growthHistory.length - 1] : null;

  const handleDeactivateChild = async (e: React.MouseEvent, childId: number, childName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to deactivate child record for ${childName}?`)) return;
    try {
      await api.delete(`/citizens/children/${childId}`);
      setSuccessMsg(`Child record for ${childName} deactivated successfully.`);
      fetchData();
      if (selectedChild?.id === childId) setSelectedChild(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to deactivate child record');
    }
  };

  const handleDownloadExcel = () => {
    const exportData = filtered.map(c => ({
      'Child ID': c.id,
      'First Name': c.first_name,
      'Last Name': c.last_name,
      'Date of Birth': c.birthdate,
      'Sex': c.sex === 'M' ? 'Male' : 'Female',
      'Parent Guardian': `${c.parent_first_name} ${c.parent_last_name}`,
      'District / Sitio': c.barangay_name,
    }));
    exportToExcel(exportData, 'Children_Records_Barangay_Camagong');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Children & Operation Timbang Growth Registry</h1>
          <p className="page-subtitle">Tap any child record below to view growth charts, Timbang history, and AI nutrition guidance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadExcel} className="btn-secondary">
            <Download className="w-4 h-4" /> Download Excel
          </button>
          {canManage && (
            <>
              <button onClick={() => setShowImportModal(true)} className="btn-success">
                <FileSpreadsheet className="w-4 h-4" /> Import Excel Data
              </button>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Register Child
              </button>
            </>
          )}
        </div>
      </div>

      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={fetchData}
      />

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="card card-body py-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search children..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 text-xs"
          />
        </div>
      </div>

      {/* TAPPABLE CHILDREN TABLE */}
      <div className="card">
        <div className="table-container">
          {loading ? (
            <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-7 h-7" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Baby className="empty-state-icon" />
              <p className="empty-state-title">No children found</p>
              <p className="empty-state-desc">
                {canManage ? 'Register a child using the button above.' : 'No records available.'}
              </p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Full Name (Tap to View Timbang Graph)</th>
                  <th>Age</th>
                  <th>Sex</th>
                  <th>Parent</th>
                  <th>District / Sitio</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((child, idx) => (
                  <tr
                    key={child.id}
                    onClick={() => handleSelectChild(child)}
                    className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                  >
                    <td className="text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                          child.sex === 'M' ? 'bg-blue-500' : 'bg-pink-500'
                        }`}>
                          {child.first_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-blue-700 hover:underline">{child.first_name} {child.last_name}</p>
                          <p className="text-[10px] text-slate-400">DOB: {new Date(child.birthdate).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs font-medium text-slate-700">{getAgeStr(child.birthdate)}</td>
                    <td>
                      <span className={`badge ${child.sex === 'M' ? 'badge-blue' : 'badge-purple'}`}>
                        {child.sex === 'M' ? 'Male' : 'Female'}
                      </span>
                    </td>
                    <td className="text-slate-600 text-xs">{child.parent_first_name} {child.parent_last_name}</td>
                    <td className="text-slate-500 text-xs">{child.barangay_name}</td>
                    <td className="text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 font-bold flex items-center gap-1 hover:underline">
                          View Graph <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        {canManage && (
                          <button
                            onClick={(e) => handleDeactivateChild(e, child.id, `${child.first_name} ${child.last_name}`)}
                            title="Deactivate Child Record"
                            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SELECTED CHILD TIMBANG PROGRESS & AI RECOMMENDATIONS MODAL / DRAWER */}
      {selectedChild && (
        <div className="modal-overlay" onClick={() => setSelectedChild(null)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                  <Baby className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold">{selectedChild.first_name} {selectedChild.last_name}</h2>
                  <p className="text-xs text-blue-200">
                    Age: {getAgeStr(selectedChild.birthdate)} · Parent: {selectedChild.parent_first_name} {selectedChild.parent_last_name} · {selectedChild.barangay_name}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedChild(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-body p-6 space-y-6">
              {loadingHistory ? (
                <div className="flex justify-center py-12"><span className="spinner text-blue-600 w-8 h-8" /></div>
              ) : (
                <div className="space-y-6">
                  {/* LATEST NUTRITION STATUS SUMMARY CARDS */}
                  {latestRecord && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-xs text-slate-500 font-bold uppercase">Weight-for-Height (Wasting)</p>
                        <p className={`text-base font-extrabold mt-0.5 ${
                          latestRecord.wasting_status.includes('Severe') ? 'text-red-600' :
                          latestRecord.wasting_status.includes('Wasting') ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {latestRecord.wasting_status}
                        </p>
                      </div>

                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                        <p className="text-xs text-slate-500 font-bold uppercase">Height-for-Age (Stunting)</p>
                        <p className={`text-base font-extrabold mt-0.5 ${
                          latestRecord.stunting_status.includes('Severe') ? 'text-red-600' :
                          latestRecord.stunting_status.includes('Stunted') ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {latestRecord.stunting_status}
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-500 font-bold uppercase">BMI Score</p>
                        <p className="text-xl font-black text-slate-900 mt-0.5">{latestRecord.bmi} <span className="text-xs text-slate-400 font-normal">kg/m²</span></p>
                      </div>
                    </div>
                  )}

                  {/* OPERATION TIMBANG GROWTH PROGRESS GRAPH */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-blue-600" /> Operation Timbang Growth Progress Graph
                      </h4>
                      {canManage && (
                        <button
                          onClick={() => setShowGrowthForm((v) => !v)}
                          className="btn-primary btn-sm text-xs py-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Record Timbang Visit
                        </button>
                      )}
                    </div>

                    {growthHistory.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No growth monitoring records logged yet for Operation Timbang.
                      </div>
                    ) : (
                      <ReactApexChart options={timbangChartOptions} series={timbangChartSeries} type="area" height={220} />
                    )}
                  </div>

                  {/* INLINE GROWTH MEASUREMENT RECORDING FORM FOR WORKERS */}
                  {showGrowthForm && canManage && (
                    <form onSubmit={handleAddGrowthMeasurement} className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-3">
                      <h5 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Edit3 className="w-4 h-4 text-blue-600" /> Record New Operation Timbang Measurement
                      </h5>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block">Height (cm)</label>
                          <input type="number" step="0.1" required className="form-input text-xs py-1" value={growthForm.height_cm} onChange={(e) => setGrowthForm({ ...growthForm, height_cm: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block">Weight (kg)</label>
                          <input type="number" step="0.1" required className="form-input text-xs py-1" value={growthForm.weight_kg} onChange={(e) => setGrowthForm({ ...growthForm, weight_kg: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block">Visit Date</label>
                          <input type="date" required className="form-input text-xs py-1" value={growthForm.visit_date} onChange={(e) => setGrowthForm({ ...growthForm, visit_date: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setShowGrowthForm(false)} className="btn-secondary text-xs py-1">Cancel</button>
                        <button type="submit" disabled={submitting} className="btn-primary text-xs py-1">
                          {submitting ? 'Saving...' : 'Save Measurement'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* AI NUTRITIONAL RECOMMENDATIONS & CLINICAL CARE PLAN */}
                  {latestRecord && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-amber-900">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" /> AI Growth & Nutritional Recommendations
                      </h4>
                      <p className="text-xs leading-relaxed">{latestRecord.recommendations}</p>
                      {latestRecord.micronutrient_deficiency_risk && (
                        <p className="text-[11px] text-amber-800 pt-1">
                          <strong>Micronutrient Deficiency Warning:</strong> {latestRecord.micronutrient_deficiency_risk}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setSelectedChild(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER CHILD MODAL */}
      {showModal && canManage && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Register New Child</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleRegisterChild}>
              <div className="modal-body grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input className="form-input" required value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input className="form-input" required value={form.last_name}
                    onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input type="date" className="form-input" required value={form.birthdate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm({ ...form, birthdate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sex *</label>
                  <select className="form-select" value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Parent / Guardian *</label>
                  <select className="form-select" required value={form.parent_id}
                    onChange={e => setForm({ ...form, parent_id: e.target.value })}>
                    <option value="">Select parent...</option>
                    {parents.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} – {p.barangay_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">District / Sitio *</label>
                  <select className="form-select" required value={form.barangay_id}
                    onChange={e => setForm({ ...form, barangay_id: e.target.value })}>
                    <option value="">Select District / Sitio...</option>
                    {barangays.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="alert alert-info text-xs">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>A personalized vaccination schedule will be automatically generated based on date of birth.</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <><span className="spinner" /> Saving...</> : 'Register Child'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Children;
