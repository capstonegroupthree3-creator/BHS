import React, { useEffect, useState } from 'react';
import { Users, Pill, Plus, CheckCircle2, Search, FileSpreadsheet, Trash2, Download } from 'lucide-react';
import api from '../lib/api';
import RiskBadge from '../components/RiskBadge';
import { useAuth } from '../context/AuthContext';
import ExcelImportModal from '../components/ExcelImportModal';
import { exportToExcel } from '../lib/excelExport';

interface Senior {
  id: number;
  first_name: string;
  last_name: string;
  age: number;
  birthdate: string;
  address: string;
  barangay_name: string;
  contact_number: string;
  medical_conditions: string;
  risk_level: string;
  active_medications_count: number;
}

interface Medication {
  id: number;
  senior_id: number;
  medication_name: string;
  dosage: string;
  frequency: string;
  prescribed_by: string;
  status: 'active' | 'discontinued';
  ai_precautions: string;
  created_at: string;
}

const Seniors: React.FC = () => {
  const { user } = useAuth();
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSenior, setSelectedSenior] = useState<Senior | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(false);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Register Form State
  const [regForm, setRegForm] = useState({
    first_name: '',
    last_name: '',
    age: 65,
    birthdate: '1961-01-01',
    address: '',
    barangay_id: 1,
    contact_number: '',
    medical_conditions: 'Hypertension',
    risk_level: 'Low',
  });

  // Prescribe Medication Form State
  const [medForm, setMedForm] = useState({
    medication_name: '',
    dosage: '',
    frequency: 'Once daily after breakfast',
    prescribed_by: '',
    ai_precautions: '',
  });

  const canManage = user?.role === 'admin' || user?.role === 'health_personnel';

  const fetchSeniors = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/seniors');
      setSeniors(data);
    } catch (err) {
      console.error('Fetch seniors error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeniors();
  }, []);

  const handleSelectSenior = async (s: Senior) => {
    setSelectedSenior(s);
    setLoadingMeds(true);
    try {
      const { data } = await api.get(`/seniors/${s.id}`);
      setMedications(data.medications);
    } catch (err) {
      console.error('Fetch senior medications error:', err);
    } finally {
      setLoadingMeds(false);
    }
  };

  const handleRegisterSenior = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/seniors', regForm);
      setMsg(data.message);
      setShowRegisterModal(false);
      fetchSeniors();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to register senior citizen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSenior) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/seniors/${selectedSenior.id}/medications`, medForm);
      setMsg(data.message);
      setShowMedModal(false);
      setMedForm({ medication_name: '', dosage: '', frequency: 'Once daily after breakfast', prescribed_by: '', ai_precautions: '' });
      handleSelectSenior(selectedSenior);
      fetchSeniors();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to prescribe medication');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMedStatus = async (medId: number, currentStatus: string) => {
    if (!selectedSenior) return;
    const newStatus = currentStatus === 'active' ? 'discontinued' : 'active';
    try {
      await api.put(`/seniors/medications/${medId}/status`, { status: newStatus });
      handleSelectSenior(selectedSenior);
      fetchSeniors();
    } catch (err) {
      alert('Failed to update medication status');
    }
  };

  const filteredSeniors = seniors.filter((s) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    return (
      fullName.includes(term) ||
      s.medical_conditions.toLowerCase().includes(term) ||
      s.barangay_name.toLowerCase().includes(term)
    );
  });

  const handleDeactivateSenior = async (e: React.MouseEvent, seniorId: number, seniorName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to deactivate senior citizen record for ${seniorName}?`)) return;
    try {
      await api.delete(`/seniors/${seniorId}`);
      setMsg(`Senior citizen record for ${seniorName} deactivated successfully.`);
      fetchSeniors();
      if (selectedSenior?.id === seniorId) {
        setSelectedSenior(null);
        setMedications([]);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to deactivate senior citizen record');
    }
  };

  const handleDownloadExcel = () => {
    const exportData = filteredSeniors.map(s => ({
      'Senior ID': s.id,
      'First Name': s.first_name,
      'Last Name': s.last_name,
      'Age': s.age,
      'Birthdate': s.birthdate,
      'District / Sitio': s.barangay_name,
      'Contact Phone': s.contact_number || 'N/A',
      'Medical Conditions': s.medical_conditions,
      'Risk Classification': s.risk_level,
      'Active Maintenance Meds': s.active_medications_count,
    }));
    exportToExcel(exportData, 'Senior_Citizens_Barangay_Camagong');
  };

  const handleDownloadSeniorMedsExcel = () => {
    if (!selectedSenior) return;
    const medExport = medications.map(m => ({
      'Senior ID': selectedSenior.id,
      'Senior Name': `${selectedSenior.first_name} ${selectedSenior.last_name}`,
      'Age': selectedSenior.age,
      'District / Sitio': selectedSenior.barangay_name,
      'Medication Name': m.medication_name,
      'Dosage': m.dosage,
      'Frequency': m.frequency,
      'Prescribed By': m.prescribed_by || 'RHU Doctor',
      'Status': m.status,
      'AI Precautions': m.ai_precautions || 'N/A'
    }));
    exportToExcel(medExport, `Prescribed_Maintenance_Drugs_${selectedSenior.first_name}_${selectedSenior.last_name}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Senior Citizens Health & Maintenance Medication Registry</h1>
          <p className="page-subtitle">Track elder health conditions, maintenance drug compliance, and AI safety precautions</p>
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
              <button onClick={() => setShowRegisterModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Register Senior Citizen
              </button>
            </>
          )}
        </div>
      </div>

      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={fetchSeniors}
      />

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{msg}</p>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="card p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by senior name, condition, or barangay..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 py-2 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: SENIOR CITIZENS LIST */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Senior Citizens Registry</h3>
            <span className="badge badge-blue">{filteredSeniors.length} Seniors Tracked</span>
          </div>

          <div className="card-body p-0">
            {loading ? (
              <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
            ) : filteredSeniors.length === 0 ? (
              <div className="empty-state py-12">
                <Users className="empty-state-icon" />
                <p className="empty-state-title">No senior citizens found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredSeniors.map((s) => {
                  const isSelected = selectedSenior?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSenior(s)}
                      className={`p-4 hover:bg-blue-50/50 cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{s.first_name} {s.last_name}</h4>
                          <span className="text-xs text-slate-500 font-medium">({s.age} yrs)</span>
                          <RiskBadge status={s.risk_level} size="sm" />
                        </div>
                        <p className="text-xs text-slate-600">
                          <strong>District / Sitio:</strong> {s.barangay_name} · <strong>Contact:</strong> {s.contact_number || 'N/A'}
                        </p>
                        <p className="text-xs text-purple-700 font-medium line-clamp-1">
                          🏥 <strong>Conditions:</strong> {s.medical_conditions}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0 flex items-center gap-3">
                        <span className="badge badge-purple text-xs flex items-center gap-1">
                          <Pill className="w-3 h-3" /> {s.active_medications_count} Active Meds
                        </span>
                        {canManage && (
                          <button
                            onClick={(e) => handleDeactivateSenior(e, s.id, `${s.first_name} ${s.last_name}`)}
                            title="Deactivate Senior Record"
                            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PRESCRIBED MAINTENANCE MEDICATIONS DETAILED DRAWER */}
        <div className="card">
          <div className="card-header bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-blue-300" />
              <div>
                <h3 className="text-sm font-bold">Prescribed Maintenance Drugs</h3>
                <p className="text-[10px] text-blue-200">AI precautions & daily dosage schedule</p>
              </div>
            </div>
            {selectedSenior && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSeniorMedsExcel}
                  title="Download Prescribed Maintenance Drugs Excel"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-emerald-500 shadow-sm"
                >
                  <Download className="w-3 h-3" /> Download Drugs
                </button>
                {canManage && (
                  <button
                    onClick={() => setShowMedModal(true)}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1 rounded-lg border border-white/20 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3 h-3" /> Add Med
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="card-body p-4">
            {!selectedSenior ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Select a senior citizen from the left panel to view their prescribed maintenance medications and AI precautions.
              </div>
            ) : loadingMeds ? (
              <div className="flex justify-center py-12"><span className="spinner text-blue-600 w-6 h-6" /></div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-blue-900">{selectedSenior.first_name} {selectedSenior.last_name}</p>
                  <p className="text-[11px] text-blue-700">{selectedSenior.age} years old · {selectedSenior.barangay_name}</p>
                  <p className="text-[11px] text-slate-600 mt-1">Medical Conditions: <strong>{selectedSenior.medical_conditions}</strong></p>
                </div>

                {medications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No maintenance medications recorded for this senior citizen yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medications.map((med) => (
                      <div
                        key={med.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-colors ${
                          med.status === 'active' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{med.medication_name}</h4>
                          <span className={`badge text-[10px] ${med.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                            {med.status}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700"><strong>Dosage:</strong> {med.dosage} · <strong>Frequency:</strong> {med.frequency}</p>
                        <p className="text-[11px] text-slate-500">Prescribed by: {med.prescribed_by}</p>

                        {med.ai_precautions && (
                          <div className="bg-amber-50 text-amber-900 p-2 rounded-lg border border-amber-200 text-[11px] mt-2">
                            <strong>🤖 AI Safety Precaution:</strong> {med.ai_precautions}
                          </div>
                        )}

                        {canManage && (
                          <div className="pt-1 text-right">
                            <button
                              onClick={() => handleToggleMedStatus(med.id, med.status)}
                              className="text-[10px] text-slate-500 hover:text-slate-800 underline"
                            >
                              {med.status === 'active' ? 'Mark Discontinued' : 'Mark Active'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* REGISTER SENIOR MODAL */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Register Senior Citizen</h2>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleRegisterSenior}>
              <div className="modal-body space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className="form-input text-xs" required value={regForm.first_name} onChange={(e) => setRegForm({ ...regForm, first_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className="form-input text-xs" required value={regForm.last_name} onChange={(e) => setRegForm({ ...regForm, last_name: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Age *</label>
                    <input type="number" min="60" max="110" className="form-input text-xs" required value={regForm.age} onChange={(e) => setRegForm({ ...regForm, age: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Birthdate *</label>
                    <input type="date" className="form-input text-xs" required value={regForm.birthdate} onChange={(e) => setRegForm({ ...regForm, birthdate: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">District / Sitio *</label>
                    <select
                      className="form-select text-xs"
                      value={regForm.barangay_id}
                      onChange={(e) => {
                        const bId = Number(e.target.value);
                        const distNames: Record<number, string> = {
                          1: "District 1 - Purok San Jose",
                          2: "District 2 - Purok Bagong Pag-asa",
                          3: "District 3 - Purok Talipapa",
                          4: "District 4 - Purok Central",
                          5: "District 5 - Purok Balingasa",
                          6: "District 6 - Purok Riverside",
                          7: "District 7 - Purok Hillside",
                          8: "District 8 - Sitio Minbahandi",
                          9: "District 9 - Sitio Hinandayan",
                          10: "District 10 - Sitio Baboy-Baboy"
                        };
                        const autoAddr = `${distNames[bId] || ''}, Barangay Camagong, Nasipit, Agusan Del Norte`;
                        setRegForm({ ...regForm, barangay_id: bId, address: autoAddr });
                      }}
                    >
                      <option value={1}>District 1 - Purok San Jose</option>
                      <option value={2}>District 2 - Purok Bagong Pag-asa</option>
                      <option value={3}>District 3 - Purok Talipapa</option>
                      <option value={4}>District 4 - Purok Central</option>
                      <option value={5}>District 5 - Purok Balingasa</option>
                      <option value={6}>District 6 - Purok Riverside</option>
                      <option value={7}>District 7 - Purok Hillside</option>
                      <option value={8}>District 8 - Sitio Minbahandi</option>
                      <option value={9}>District 9 - Sitio Hinandayan</option>
                      <option value={10}>District 10 - Sitio Baboy-Baboy</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Risk Classification (Auto Classified)</label>
                    <select className="form-select text-xs font-bold" value={regForm.risk_level} onChange={(e) => setRegForm({ ...regForm, risk_level: e.target.value })}>
                      <option value="Low">Low Risk</option>
                      <option value="Medium">Medium Risk</option>
                      <option value="High">High Risk</option>
                      <option value="Critical">Critical Risk</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Medical Conditions (Triggers Auto Risk)</label>
                  <input
                    className="form-input text-xs"
                    placeholder="e.g. Hypertension, Diabetes, Cataracts"
                    value={regForm.medical_conditions}
                    onChange={(e) => {
                      const conds = e.target.value;
                      const cLower = conds.toLowerCase();
                      let autoRiskLevel = 'Low';
                      if (regForm.age >= 80 || cLower.includes('stroke') || cLower.includes('heart failure') || cLower.includes('kidney')) autoRiskLevel = 'Critical';
                      else if (regForm.age >= 75 || (cLower.includes('hypertension') && cLower.includes('diabetes'))) autoRiskLevel = 'High';
                      else if (regForm.age >= 68 || cLower.includes('hypertension') || cLower.includes('diabetes') || cLower.includes('cataract')) autoRiskLevel = 'Medium';
                      setRegForm({ ...regForm, medical_conditions: conds, risk_level: autoRiskLevel });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <input className="form-input text-xs" placeholder="0917-xxx-xxxx" value={regForm.contact_number} onChange={(e) => setRegForm({ ...regForm, contact_number: e.target.value })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Home Address (Auto Generated)</label>
                  <input className="form-input text-xs" value={regForm.address} onChange={(e) => setRegForm({ ...regForm, address: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs">
                  {submitting ? <><span className="spinner" /> Saving...</> : 'Register Senior'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRESCRIBE MEDICATION MODAL */}
      {showMedModal && selectedSenior && (
        <div className="modal-overlay" onClick={() => setShowMedModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Prescribe Maintenance Drug: {selectedSenior.first_name} {selectedSenior.last_name}</h2>
              <button onClick={() => setShowMedModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddMedication}>
              <div className="modal-body space-y-3">
                <div className="form-group">
                  <label className="form-label">Medication Name *</label>
                  <input className="form-input text-xs" required placeholder="e.g. Amlodipine Besylate" value={medForm.medication_name} onChange={(e) => setMedForm({ ...medForm, medication_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Dosage *</label>
                    <input className="form-input text-xs" required placeholder="e.g. 5 mg" value={medForm.dosage} onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Frequency *</label>
                    <input className="form-input text-xs" required placeholder="e.g. Once daily after breakfast" value={medForm.frequency} onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Prescribed By Doctor / RHU</label>
                  <input className="form-input text-xs" placeholder="Dr. Manuel Roxas" value={medForm.prescribed_by} onChange={(e) => setMedForm({ ...medForm, prescribed_by: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">AI Precautions & Usage Advice</label>
                  <textarea className="form-input text-xs h-20" placeholder="Special administration or side effect warnings..." value={medForm.ai_precautions} onChange={(e) => setMedForm({ ...medForm, ai_precautions: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowMedModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs">
                  {submitting ? <><span className="spinner" /> Saving...</> : 'Save Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Seniors;
