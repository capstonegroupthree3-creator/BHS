import React, { useEffect, useState } from 'react';
import {
  Search, Plus, HeartPulse, Trash2, Download, Activity,
  Pill, Calendar, AlertTriangle, CheckCircle2, User,
  Stethoscope, Apple, BookOpen, X, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import RiskBadge from '../components/RiskBadge';
import { exportToExcel } from '../lib/excelExport';
import ExcelImportModal from '../components/ExcelImportModal';

interface PregnantWoman {
  id: number;
  first_name: string;
  last_name: string;
  age: number;
  address?: string;
  barangay_name: string;
  pregnancy_week_start: number;
  conception_date: string;
  expected_delivery_date: string;
  risk_status: string;
  created_at: string;
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

interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribed_date: string;
  prescribed_by: string;
  notes?: string;
}

const DEFAULT_MEDICATIONS: Record<number, MedicationItem[]> = {
  1: [
    { id: 'm1', name: 'Ferrous Sulfate + Folic Acid', dosage: '60mg / 400mcg', frequency: '1 tablet daily at bedtime', prescribed_date: '2026-01-15', prescribed_by: 'BHW Maria Santos', notes: 'Essential for preventing maternal anemia' },
    { id: 'm2', name: 'Calcium Carbonate', dosage: '500mg', frequency: '1 tablet twice daily after meals', prescribed_date: '2026-02-01', prescribed_by: 'Midwife Elena Cruz', notes: 'Take 2 hours apart from Iron supplements' },
    { id: 'm3', name: 'Maternal Prenatal Multivitamins', dosage: '1 capsule', frequency: 'Once daily after breakfast', prescribed_date: '2026-01-15', prescribed_by: 'Dr. Ramos', notes: 'Contains Iodine, Zinc, and Vitamin D' }
  ]
};

const PregnantWomen: React.FC = () => {
  const { user } = useAuth();
  const [women, setWomen] = useState<PregnantWoman[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedWoman, setSelectedWoman] = useState<PregnantWoman | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'meds' | 'medical' | 'menstrual' | 'past_preg' | 'historical' | 'lab' | 'nutrition' | 'education'>('graph');
  
  // Custom Medication Form State inside Drawer
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '', notes: '' });
  const [showAddMedForm, setShowAddMedForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', age: '', address: '',
    barangay_id: '', pregnancy_week_start: '1', conception_date: '', parent_id: '',
  });
  const [successMsg, setSuccessMsg] = useState('');

  const canRegister = user?.role === 'admin' || user?.role === 'health_personnel';
  const canAddMed = user?.role === 'admin' || user?.role === 'health_personnel' || user?.role === 'parent';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/citizens/pregnant');
      setWomen(res.data);
      if (canRegister) {
        const [parentRes, barRes] = await Promise.all([
          api.get('/citizens/parents'),
          api.get('/barangays'),
        ]);
        setParents(parentRes.data);
        setBarangays(barRes.data);
      }
    } catch (err) {
      console.error('Pregnant women fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Sync medications when selectedWoman changes
  useEffect(() => {
    if (selectedWoman) {
      const stored = localStorage.getItem(`pregnant_meds_${selectedWoman.id}`);
      if (stored) {
        try {
          setMedications(JSON.parse(stored));
        } catch {
          setMedications(DEFAULT_MEDICATIONS[selectedWoman.id] || DEFAULT_MEDICATIONS[1]);
        }
      } else {
        const defaults = DEFAULT_MEDICATIONS[selectedWoman.id] || [
          { id: 'm1', name: 'Ferrous Sulfate + Folic Acid', dosage: '60mg / 400mcg', frequency: '1 tablet daily at bedtime', prescribed_date: new Date().toISOString().split('T')[0], prescribed_by: 'BHW Maria Santos', notes: 'Essential for preventing maternal anemia' },
          { id: 'm2', name: 'Calcium Carbonate', dosage: '500mg', frequency: '1 tablet twice daily after meals', prescribed_date: new Date().toISOString().split('T')[0], prescribed_by: 'Midwife Elena Cruz', notes: 'Take 2 hours apart from Iron supplements' }
        ];
        setMedications(defaults);
        localStorage.setItem(`pregnant_meds_${selectedWoman.id}`, JSON.stringify(defaults));
      }
    }
  }, [selectedWoman]);

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name || !newMed.dosage || !selectedWoman) return;

    const item: MedicationItem = {
      id: `med_${Date.now()}`,
      name: newMed.name,
      dosage: newMed.dosage,
      frequency: newMed.frequency || 'Once daily',
      prescribed_date: new Date().toISOString().split('T')[0],
      prescribed_by: user?.username || 'Health Officer',
      notes: newMed.notes,
    };

    const updated = [item, ...medications];
    setMedications(updated);
    localStorage.setItem(`pregnant_meds_${selectedWoman.id}`, JSON.stringify(updated));
    setNewMed({ name: '', dosage: '', frequency: '', notes: '' });
    setShowAddMedForm(false);
  };

  const handleDeleteMedication = (medId: string) => {
    if (!selectedWoman) return;
    const updated = medications.filter(m => m.id !== medId);
    setMedications(updated);
    localStorage.setItem(`pregnant_meds_${selectedWoman.id}`, JSON.stringify(updated));
  };

  const filtered = women.filter(w =>
    `${w.first_name} ${w.last_name} ${w.barangay_name} ${w.risk_status}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const getCurrentWeek = (conceptionDate: string, weekStart: number) => {
    const conception = new Date(conceptionDate);
    const now = new Date();
    const diffWeeks = Math.floor((now.getTime() - conception.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return Math.min(40, weekStart + diffWeeks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/citizens/pregnant', {
        ...form,
        age: parseInt(form.age),
        pregnancy_week_start: parseInt(form.pregnancy_week_start),
        parent_id: form.parent_id || undefined,
      });
      setSuccessMsg('Pregnant mother profile registered successfully!');
      setShowModal(false);
      setForm({ first_name: '', last_name: '', age: '', address: '', barangay_id: '', pregnancy_week_start: '1', conception_date: '', parent_id: '' });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivatePregnant = async (e: React.MouseEvent, womanId: number, womanName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to deactivate pregnant mother record for ${womanName}?`)) return;
    try {
      await api.delete(`/citizens/pregnant/${womanId}`);
      setSuccessMsg(`Pregnant mother record for ${womanName} deactivated successfully.`);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to deactivate pregnant mother record');
    }
  };

  const handleDownloadExcel = () => {
    const exportData = filtered.map(w => ({
      'Record ID': w.id,
      'First Name': w.first_name,
      'Last Name': w.last_name,
      'Age': w.age,
      'Current Gestational Week': getCurrentWeek(w.conception_date, w.pregnancy_week_start),
      'Expected Delivery Date': w.expected_delivery_date,
      'District / Sitio': w.barangay_name,
      'AI Risk Status': w.risk_status,
    }));
    exportToExcel(exportData, 'Pregnant_Women_Records_Barangay_Camagong');
  };

  // ApexChart Options for Gestational Weight & BP Progress
  const currentWk = selectedWoman ? getCurrentWeek(selectedWoman.conception_date, selectedWoman.pregnancy_week_start) : 24;
  const chartWeeks = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40];
  
  const chartOptions: ApexOptions = {
    chart: { type: 'line', height: 260, toolbar: { show: false } },
    stroke: { width: [3, 2, 2], curve: 'smooth', dashArray: [0, 4, 4] },
    colors: ['#8b5cf6', '#10b981', '#ef4444'],
    labels: chartWeeks.map(w => `Wk ${w}`),
    xaxis: { title: { text: 'Gestational Age (Weeks)', style: { fontSize: '12px' } } },
    yaxis: [
      { title: { text: 'Maternal Weight Gain (kg)' }, min: 0, max: 18 },
      { opposite: true, title: { text: 'Systolic BP (mmHg)' }, min: 90, max: 160 }
    ],
    legend: { position: 'top' },
    tooltip: { shared: true, intersect: false }
  };

  const chartSeries = [
    { name: 'Recorded Weight Gain (kg)', type: 'column', data: [0.5, 1.2, 2.5, 4.0, 6.2, Math.min(12, 6.2 + (currentWk - 20) * 0.45), null, null, null, null].slice(0, 10) },
    { name: 'Target Normal Weight Curve', type: 'line', data: [0.5, 1.0, 2.0, 4.0, 6.0, 8.5, 11.0, 13.0, 14.5, 15.0] },
    { name: 'Systolic BP (mmHg)', type: 'line', data: [110, 112, 115, 118, 120, selectedWoman?.risk_status === 'High' ? 138 : 122, null, null, null, null].slice(0, 10) }
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pregnant Women Registry</h1>
          <p className="page-subtitle">Manage maternal profiles, prenatal care, medications & clinical records (Tap row to inspect)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadExcel} className="btn-secondary">
            <Download className="w-4 h-4" /> Download Excel
          </button>
          {canRegister && (
            <>
              <button onClick={() => setShowImportModal(true)} className="btn-success">
                <FileSpreadsheet className="w-4 h-4" /> Import Excel Data
              </button>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Register Mother
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
        <div className="alert alert-success"><span>✓</span><span>{successMsg}</span></div>
      )}

      <div className="card card-body py-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name, barangay, risk..."
            value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-7 h-7" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <HeartPulse className="empty-state-icon" />
              <p className="empty-state-title">No maternal records found</p>
              {canRegister && <p className="empty-state-desc">Register a pregnant mother using the button above.</p>}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mother Name</th>
                  <th>Age</th>
                  <th>Gestational Week</th>
                  <th>Expected Delivery</th>
                  <th>District / Sitio</th>
                  <th>AI Risk Level</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((woman, idx) => {
                  const currentWeek = getCurrentWeek(woman.conception_date, woman.pregnancy_week_start);
                  const isTeenage = woman.age < 20;
                  return (
                    <tr
                      key={woman.id}
                      onClick={() => setSelectedWoman(woman)}
                      className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                            {woman.first_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                              {woman.first_name} {woman.last_name}
                              <ChevronRight className="w-3.5 h-3.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                            {isTeenage && (
                              <span className="badge badge-orange text-[10px] py-0 px-1.5">Teenage Pregnancy</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-700 dark:text-slate-300 font-medium">{woman.age} yrs</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-700 dark:text-purple-400 text-sm">Week {currentWeek}</span>
                          <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-purple-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, (currentWeek / 40) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                        {new Date(woman.expected_delivery_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                      </td>
                      <td className="text-slate-500 text-xs">{woman.barangay_name}</td>
                      <td><RiskBadge status={woman.risk_status} /></td>
                      <td className="text-xs" onClick={e => e.stopPropagation()}>
                        {canRegister && (
                          <button
                            onClick={(e) => handleDeactivatePregnant(e, woman.id, `${woman.first_name} ${woman.last_name}`)}
                            title="Deactivate Maternal Record"
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Maternal Details Drawer / Modal */}
      {selectedWoman && (
        <div className="modal-overlay" onClick={() => setSelectedWoman(null)}>
          <div
            className="modal-content max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="modal-header bg-gradient-to-r from-purple-700 to-indigo-800 text-white p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-xl font-bold text-white shadow-inner">
                  {selectedWoman.first_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedWoman.first_name} {selectedWoman.last_name}</h2>
                    <RiskBadge status={selectedWoman.risk_status} />
                  </div>
                  <p className="text-xs text-purple-200 mt-0.5 flex items-center gap-3">
                    <span>Age: <strong>{selectedWoman.age} years</strong></span>
                    <span>•</span>
                    <span>District / Sitio: <strong>{selectedWoman.barangay_name}</strong></span>
                    <span>•</span>
                    <span>EDD: <strong>{new Date(selectedWoman.expected_delivery_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</strong></span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWoman(null)}
                className="text-purple-200 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clinical Navigation Tabs */}
            <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 flex gap-1 overflow-x-auto text-xs font-semibold py-2">
              <button
                onClick={() => setActiveTab('graph')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'graph' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Progress & Graph
              </button>
              <button
                onClick={() => setActiveTab('meds')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'meds' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Pill className="w-3.5 h-3.5" /> Medications ({medications.length})
              </button>
              <button
                onClick={() => setActiveTab('medical')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'medical' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Medical & Demographics
              </button>
              <button
                onClick={() => setActiveTab('menstrual')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'menstrual' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Menstrual History
              </button>
              <button
                onClick={() => setActiveTab('past_preg')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'past_preg' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5" /> Past Pregnancies
              </button>
              <button
                onClick={() => setActiveTab('historical')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'historical' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Historical Problems
              </button>
              <button
                onClick={() => setActiveTab('lab')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'lab' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" /> Lab & Screening
              </button>
              <button
                onClick={() => setActiveTab('nutrition')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'nutrition' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Apple className="w-3.5 h-3.5" /> Nutrition Edu
              </button>
              <button
                onClick={() => setActiveTab('education')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'education' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Birth Plan & Edu
              </button>
            </div>

            {/* Tab Body Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50 dark:bg-slate-900/50">
              
              {/* TAB 1: GRAPH & GESTATIONAL PROGRESS */}
              {activeTab === 'graph' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">Current Gestational Age</p>
                      <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
                        Week {getCurrentWeek(selectedWoman.conception_date, selectedWoman.pregnancy_week_start)} / 40
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Trimester: {getCurrentWeek(selectedWoman.conception_date, selectedWoman.pregnancy_week_start) <= 12 ? '1st Trimester' : getCurrentWeek(selectedWoman.conception_date, selectedWoman.pregnancy_week_start) <= 27 ? '2nd Trimester' : '3rd Trimester'}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">Expected Delivery Date (EDD)</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {new Date(selectedWoman.expected_delivery_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                        ~{Math.max(0, Math.ceil((new Date(selectedWoman.expected_delivery_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days remaining
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-xs text-slate-500 font-medium">AI Risk Status Assessment</p>
                      <div className="mt-1 flex items-center gap-2">
                        <RiskBadge status={selectedWoman.risk_status} />
                        {selectedWoman.age < 20 && <span className="text-xs font-semibold text-orange-600">Teenage (&lt;20)</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Routine BHW & Midwife Monitoring</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-600" />
                        Maternal Weight Gain & Systolic BP Trajectory
                      </h3>
                      <span className="text-xs text-slate-400">Target Range: +11.5 kg to 16.0 kg</span>
                    </div>
                    <ReactApexChart options={chartOptions} series={chartSeries} type="line" height={250} />
                  </div>
                </div>
              )}

              {/* TAB 2: MEDICATIONS TAKEN */}
              {activeTab === 'meds' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                        <Pill className="w-5 h-5 text-purple-600" />
                        Prescribed Maternal Medications & Supplements
                      </h3>
                      <p className="text-xs text-slate-500">Track and manage iron, folic acid, calcium, and micronutrient intake</p>
                    </div>
                    {canAddMed && (
                      <button
                        onClick={() => setShowAddMedForm(!showAddMedForm)}
                        className="btn-primary text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Medication
                      </button>
                    )}
                  </div>

                  {showAddMedForm && (
                    <form onSubmit={handleAddMedication} className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800 space-y-3">
                      <h4 className="font-bold text-xs text-purple-900 dark:text-purple-300">Add New Medication for {selectedWoman.first_name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="form-label text-xs">Medication Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Ferrous Sulfate"
                            className="form-input text-xs"
                            value={newMed.name}
                            onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="form-label text-xs">Dosage *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 60mg / 400mcg"
                            className="form-input text-xs"
                            value={newMed.dosage}
                            onChange={e => setNewMed({ ...newMed, dosage: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="form-label text-xs">Frequency / Schedule</label>
                          <input
                            type="text"
                            placeholder="e.g. 1 tablet daily at bedtime"
                            className="form-input text-xs"
                            value={newMed.frequency}
                            onChange={e => setNewMed({ ...newMed, frequency: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="form-label text-xs">Notes & Special Instructions</label>
                        <input
                          type="text"
                          placeholder="e.g. Take with orange juice or water; avoid milk/coffee"
                          className="form-input text-xs"
                          value={newMed.notes}
                          onChange={e => setNewMed({ ...newMed, notes: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setShowAddMedForm(false)} className="btn-secondary text-xs py-1">Cancel</button>
                        <button type="submit" className="btn-primary text-xs py-1">Save Medication</button>
                      </div>
                    </form>
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    {medications.length === 0 ? (
                      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl border text-slate-400 text-xs">
                        No medications recorded yet for this pregnant mother.
                      </div>
                    ) : (
                      medications.map(med => (
                        <div key={med.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{med.name}</span>
                              <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-semibold text-xs px-2 py-0.5 rounded-full">
                                {med.dosage}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              <strong>Schedule:</strong> {med.frequency}
                            </p>
                            {med.notes && (
                              <p className="text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-900 p-2 rounded-md mt-1 border border-slate-100 dark:border-slate-800">
                                💡 {med.notes}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400">
                              Prescribed on {med.prescribed_date} by {med.prescribed_by}
                            </p>
                          </div>
                          {canAddMed && (
                            <button
                              onClick={() => handleDeleteMedication(med.id)}
                              className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                              title="Delete Medication"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: MEDICAL HISTORY & DEMOGRAPHICS */}
              {activeTab === 'medical' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 border-b pb-2">
                    <User className="w-4 h-4 text-purple-600" />
                    Medical History & Maternal Demographics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Full Name:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedWoman.first_name} {selectedWoman.last_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Age:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedWoman.age} years old</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Blood Type & Rh:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">O Positive (O+)</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Barangay / Sitio:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedWoman.barangay_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">PhilHealth Category:</span>
                      <p className="font-semibold text-emerald-600 mt-0.5">Direct Contributor / Indigent</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Civil Status:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">Married / Living with Partner</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Pre-existing Medical Conditions:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">None reported (No chronic hypertension or diabetes)</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Drug Allergies:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">No Known Drug Allergies (NKDA)</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Emergency Contact Person:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">Spouse / Parent (Barangay Camagong)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: MENSTRUAL HISTORY */}
              {activeTab === 'menstrual' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 border-b pb-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Menstrual History & Gestational Calculations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg border">
                      <span className="text-slate-500 font-medium">Last Menstrual Period (LMP / Conception Date):</span>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400 mt-1">
                        {new Date(selectedWoman.conception_date).toLocaleDateString('en-PH', { dateStyle: 'full' })}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg border">
                      <span className="text-slate-500 font-medium">Naegele's Calculated EDD:</span>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                        {new Date(selectedWoman.expected_delivery_date).toLocaleDateString('en-PH', { dateStyle: 'full' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Menstrual Cycle Regularity:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">Regular 28-day cycle (4-5 days flow)</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Contraceptive History Prior to Pregnancy:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">None / Natural Family Planning</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PAST PREGNANCIES */}
              {activeTab === 'past_preg' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 border-b pb-2">
                    <HeartPulse className="w-4 h-4 text-purple-600" />
                    Obstetric History (Past Pregnancies)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-purple-50 dark:bg-purple-950/40 p-3 rounded-lg text-center border border-purple-200 dark:border-purple-800">
                      <span className="text-purple-600 font-medium">Gravida (Total)</span>
                      <p className="text-xl font-extrabold text-purple-900 dark:text-purple-200 mt-0.5">G1</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg text-center border border-emerald-200 dark:border-emerald-800">
                      <span className="text-emerald-600 font-medium">Para (Deliveries)</span>
                      <p className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-0.5">P0</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg text-center border border-blue-200 dark:border-blue-800">
                      <span className="text-blue-600 font-medium">Abortions</span>
                      <p className="text-xl font-extrabold text-blue-900 dark:text-blue-200 mt-0.5">0</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg text-center border border-amber-200 dark:border-amber-800">
                      <span className="text-amber-600 font-medium">Living Children</span>
                      <p className="text-xl font-extrabold text-amber-900 dark:text-amber-200 mt-0.5">0</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-2 pt-2">
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>Previous Delivery Complications:</strong> No prior caesarean section or postpartum hemorrhage.
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>Blood Transfusion History:</strong> None.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 6: HISTORICAL PROBLEMS */}
              {activeTab === 'historical' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 border-b pb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Historical Problems & Clinical Risk Assessment
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200">Teenage Pregnancy Risk Flag</p>
                        <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                          {selectedWoman.age < 20
                            ? `Mother is ${selectedWoman.age} years old (<20). Flagged for closer nutritional, emotional, and pelvic compliance checkups.`
                            : `Mother is ${selectedWoman.age} years old. Low maternal age risk.`}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Preeclampsia & Hypertension Screening:</p>
                      <p className="text-slate-600 dark:text-slate-400">Baseline Blood Pressure: 118/76 mmHg. No facial edema or persistent proteinuria observed during last checkup.</p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Gestational Diabetes Mellitus (GDM) Risk:</p>
                      <p className="text-slate-600 dark:text-slate-400">Fasting Blood Sugar normal (86 mg/dL). Scheduled for 75g OGTT screening at Week 24-28.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: LAB SCREENING & EDUCATION */}
              {activeTab === 'lab' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 border-b pb-2">
                    <Stethoscope className="w-4 h-4 text-purple-600" />
                    Laboratory Screening & Diagnostic Record
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Complete Blood Count (CBC) / Hemoglobin:</span>
                      <p className="text-emerald-600 font-semibold mt-1">11.8 g/dL (Normal - Minimal Anemia Risk)</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Blood Typing & Rh Factor:</span>
                      <p className="text-purple-600 font-semibold mt-1">Type O Positive (O+)</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Routine Urinalysis:</span>
                      <p className="text-emerald-600 font-semibold mt-1">Protein: Negative | Sugar: Negative</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200">HBsAg & Syphilis (VDRL/RPR) Test:</span>
                      <p className="text-emerald-600 font-semibold mt-1">Non-Reactive (Passed Screening)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: NUTRITION EDUCATION */}
              {activeTab === 'nutrition' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 border-b pb-2">
                    <Apple className="w-4 h-4 text-emerald-600" />
                    Maternal Nutrition Education & Dietary Plan
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-1">
                      <p className="font-bold text-emerald-900 dark:text-emerald-200">Daily Iron & Folic Acid Supplementation Guidelines:</p>
                      <p className="text-emerald-800 dark:text-emerald-300">Take 1 tablet of Ferrous Sulfate (60mg elemental iron) with 400mcg Folic Acid daily for at least 180 days during pregnancy to prevent low birth weight and neural tube defects.</p>
                    </div>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-lg border space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Caloric & Dietary Recommendations:</p>
                      <ul className="list-disc pl-4 text-slate-600 dark:text-slate-300 space-y-1">
                        <li>Increase energy intake by 300 kcal/day during the 2nd and 3rd trimesters.</li>
                        <li>Consume locally available nutrient-rich foods: green leafy vegetables (Malunggay, Kangkong), eggs, fish, and legumes.</li>
                        <li>Maintain adequate hydration (at least 8-10 glasses of clean water daily).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: CLIENT EDUCATION & BIRTH PLAN */}
              {activeTab === 'education' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 border-b pb-2">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    Barangay Birth Plan & Client Education
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800 space-y-2">
                      <p className="font-bold text-purple-900 dark:text-purple-200">Barangay Birth Plan Checklist:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-purple-800 dark:text-purple-300">
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> Birthing Facility: Municipal Health Center / Camagong RHU</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> Designated Birth Attendant: Licensed Midwife / Doctor</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> Standby Emergency Transport: Barangay Ambulance / Tricycle</div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600" /> Identified Blood Donors: 2 Relatives On Standby</div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800 space-y-1">
                      <p className="font-bold text-red-900 dark:text-red-200">🚨 Pregnancy Danger Signs (Seek Immediate Emergency Care):</p>
                      <p className="text-red-800 dark:text-red-300">Vaginal bleeding, severe headache with blurred vision, high fever, severe epigastric pain, watery vaginal discharge, or absence of fetal movement for &gt;12 hours.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer bg-slate-100 dark:bg-slate-800 p-4 flex justify-end">
              <button onClick={() => setSelectedWoman(null)} className="btn-secondary">Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {showModal && canRegister && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Register Pregnant Mother</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
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
                  <label className="form-label">Age *</label>
                  <input type="number" className="form-input" required min={12} max={60} value={form.age}
                    onChange={e => setForm({ ...form, age: e.target.value })} />
                  {parseInt(form.age) < 20 && form.age !== '' && (
                    <p className="form-error text-orange-500">⚠ Teenage pregnancy flagged (&lt;20)</p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Pregnancy Week at Registration *</label>
                  <input type="number" className="form-input" required min={1} max={40} value={form.pregnancy_week_start}
                    onChange={e => setForm({ ...form, pregnancy_week_start: e.target.value })} />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Conception / LMP Date *</label>
                  <input type="date" className="form-input" required value={form.conception_date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm({ ...form, conception_date: e.target.value })} />
                  <p className="text-xs text-slate-400 mt-1">Expected delivery = Conception date + 280 days (auto-calculated)</p>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">District / Sitio *</label>
                  <select className="form-select" required value={form.barangay_id}
                    onChange={e => setForm({ ...form, barangay_id: e.target.value })}>
                    <option value="">Select District / Sitio...</option>
                    {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Linked Parent Account (optional)</label>
                  <select className="form-select" value={form.parent_id}
                    onChange={e => setForm({ ...form, parent_id: e.target.value })}>
                    <option value="">None</option>
                    {parents.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <><span className="spinner" /> Saving...</> : 'Register Mother'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PregnantWomen;
