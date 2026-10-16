import React, { useEffect, useState } from 'react';
import { Users, Search, Plus, Baby, HeartPulse, Sparkles, Phone, MapPin, Edit3, CheckCircle2, ChevronRight, FileSpreadsheet, Trash2, Download } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import RiskBadge from '../components/RiskBadge';
import ExcelImportModal from '../components/ExcelImportModal';
import { exportToExcel } from '../lib/excelExport';

interface ParentSummary {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  contact_number: string;
  address: string;
  barangay_name: string;
  children_count: number;
}

interface LinkedChild {
  id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  sex: string;
  latest_nutrition_status?: string;
  latest_wasting_status?: string;
  latest_stunting_status?: string;
}

interface LinkedPregnant {
  id: number;
  age: number;
  expected_due_date: string;
  risk_status: string;
}

interface ParentDetail {
  parent: ParentSummary & { username: string; email: string };
  children: LinkedChild[];
  pregnantRecord: LinkedPregnant | null;
  ai_recommendation: string;
}

const Parents: React.FC = () => {
  const { user } = useAuth();
  const [parents, setParents] = useState<ParentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<ParentSummary | null>(null);
  const [detail, setDetail] = useState<ParentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit State
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', contact_number: '', address: '', barangay_id: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [regForm, setRegForm] = useState({ username: '', password: 'password123', email: '', phone: '', first_name: '', last_name: '', address: '', barangay_id: 1 });

  const canManage = user?.role === 'admin' || user?.role === 'health_personnel';

  const fetchParents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/citizens/parents');
      setParents(data);
    } catch (err) {
      console.error('Fetch parents error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, []);

  const handleSelectParent = async (p: ParentSummary) => {
    setSelectedParent(p);
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/citizens/parents/${p.id}`);
      setDetail(data);
      setEditForm({
        first_name: p.first_name,
        last_name: p.last_name,
        contact_number: p.contact_number || '',
        address: p.address || '',
        barangay_id: 1,
      });
    } catch (err) {
      console.error('Fetch parent detail error:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRegisterParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/citizens/parents', regForm);
      setMsg(data.message);
      setShowRegisterModal(false);
      fetchParents();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to register parent account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParent) return;
    setSubmitting(true);
    try {
      const { data } = await api.put(`/citizens/parents/${selectedParent.id}`, editForm);
      setMsg(data.message);
      setShowEdit(false);
      handleSelectParent(selectedParent);
      fetchParents();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update parent details');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = parents.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    return (
      fullName.includes(term) ||
      p.barangay_name.toLowerCase().includes(term) ||
      (p.contact_number && p.contact_number.includes(term))
    );
  });

  const handleDeleteParent = async (e: React.MouseEvent, parentId: number, parentName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete parent record for ${parentName}? This will also delete their account.`)) return;
    try {
      await api.delete(`/citizens/parents/${parentId}`);
      setMsg(`Parent record for ${parentName} deleted successfully.`);
      fetchParents();
      if (selectedParent?.id === parentId) {
        setSelectedParent(null);
        setDetail(null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete parent record');
    }
  };

  const handleDownloadExcel = () => {
    const exportData = filtered.map(p => ({
      'Parent ID': p.id,
      'First Name': p.first_name,
      'Last Name': p.last_name,
      'District / Sitio': p.barangay_name,
      'Contact Phone': p.contact_number || 'N/A',
      'Address': p.address || 'N/A',
      'Linked Children Count': p.children_count,
    }));
    exportToExcel(exportData, 'Parents_Guardians_Barangay_Camagong');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Parents & Guardians Registry</h1>
          <p className="page-subtitle">View registered family heads, linked children, maternal profiles, and AI household health recommendations</p>
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
                <Plus className="w-4 h-4" /> Register Parent / Guardian
              </button>
            </>
          )}
        </div>
      </div>

      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={fetchParents}
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
            placeholder="Search by parent name, purok, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 py-2 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PARENTS TABLE (2 COLUMNS) */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Registered Parents & Household Heads</h3>
            <span className="badge badge-blue">{filtered.length} Households Tracked</span>
          </div>

          <div className="card-body p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state py-12">
                <Users className="empty-state-icon" />
                <p className="empty-state-title">No parent accounts found</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Parent / Guardian Name</th>
                    <th>District / Sitio</th>
                    <th>Contact Phone</th>
                    <th>Address</th>
                    <th>Children</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isSelected = selectedParent?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleSelectParent(p)}
                        className={`hover:bg-blue-50/60 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                              {p.first_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{p.first_name} {p.last_name}</p>
                              <p className="text-[10px] text-slate-400">ID #{p.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-xs font-semibold text-slate-700">{p.barangay_name}</td>
                        <td className="text-xs text-slate-600 font-mono">{p.contact_number || 'N/A'}</td>
                        <td className="text-xs text-slate-500 max-w-[150px] truncate">{p.address || 'N/A'}</td>
                        <td>
                          <span className="badge badge-purple text-xs flex items-center gap-1 w-max">
                            <Baby className="w-3 h-3" /> {p.children_count} Linked
                          </span>
                        </td>
                        <td className="text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-blue-600 font-bold hover:underline">
                              View Family <ChevronRight className="w-3.5 h-3.5 inline" />
                            </span>
                            {canManage && (
                              <button
                                onClick={(e) => handleDeleteParent(e, p.id, `${p.first_name} ${p.last_name}`)}
                                title="Delete Parent Record"
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* LINKED FAMILY DETAILS & AI RECOMMENDATIONS DRAWER (1 COLUMN) */}
        <div className="card">
          <div className="card-header bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-300" />
              <div>
                <h3 className="text-sm font-bold">Household & Family Health</h3>
                <p className="text-[10px] text-indigo-200">Linked children & AI household guidance</p>
              </div>
            </div>
            {selectedParent && canManage && (
              <button
                onClick={() => setShowEdit(!showEdit)}
                className="bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1 rounded-lg border border-white/20 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>

          <div className="card-body p-4 space-y-4">
            {!selectedParent ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Select a parent from the left table to inspect linked children, maternal profiles, and AI household health recommendations.
              </div>
            ) : loadingDetail ? (
              <div className="flex justify-center py-12"><span className="spinner text-blue-600 w-6 h-6" /></div>
            ) : detail ? (
              <div className="space-y-4">
                {/* PARENT PROFILE SUMMARY */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 space-y-1">
                  <h4 className="font-bold text-indigo-950 text-sm">{detail.parent.first_name} {detail.parent.last_name}</h4>
                  <p className="text-xs text-indigo-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Purok / Barangay: <strong>{detail.parent.barangay_name}</strong>
                  </p>
                  <p className="text-xs text-indigo-800 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-indigo-600" /> Contact: {detail.parent.contact_number || 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-500 pt-1">Address: {detail.parent.address || 'N/A'}</p>
                </div>

                {/* EDIT FORM INLINE */}
                {showEdit && canManage && (
                  <form onSubmit={handleUpdateParent} className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2 text-xs">
                    <h5 className="font-bold text-slate-800">Edit Parent Details</h5>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block">Contact Number</label>
                      <input className="form-input text-xs py-1" value={editForm.contact_number} onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block">Home Address</label>
                      <input className="form-input text-xs py-1" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary py-1 text-[11px]">Cancel</button>
                      <button type="submit" disabled={submitting} className="btn-primary py-1 text-[11px]">{submitting ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                  </form>
                )}

                {/* LINKED CHILDREN SECTION */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Baby className="w-4 h-4 text-blue-600" /> Registered Children ({detail.children.length})
                  </h4>

                  {detail.children.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No children registered under this household yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.children.map((child) => (
                        <div key={child.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{child.first_name} {child.last_name}</span>
                            <span className={`badge ${child.sex === 'M' ? 'badge-blue' : 'badge-purple'} text-[10px]`}>
                              {child.sex === 'M' ? 'Male' : 'Female'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            DOB: {new Date(child.birthdate).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                          </p>
                          {child.latest_nutrition_status && (
                            <p className="text-[11px] font-semibold text-purple-700">
                              Nutrition Status: {child.latest_nutrition_status}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* LINKED MATERNAL PREGNANCY SECTION */}
                {detail.pregnantRecord && (
                  <div className="bg-pink-50 border border-pink-200 p-3 rounded-xl space-y-1">
                    <h4 className="text-xs font-bold text-pink-900 flex items-center gap-1">
                      <HeartPulse className="w-4 h-4 text-pink-600" /> Active Pregnancy Record
                    </h4>
                    <p className="text-xs text-pink-800">
                      Age: <strong>{detail.pregnantRecord.age} yrs</strong> · Due Date: <strong>{new Date(detail.pregnantRecord.expected_due_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</strong>
                    </p>
                    <div className="pt-1">
                      <RiskBadge status={detail.pregnantRecord.risk_status} size="sm" />
                    </div>
                  </div>
                )}

                {/* AI HOUSEHOLD RECOMMENDATIONS */}
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-1 text-amber-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-900">
                    <Sparkles className="w-4 h-4 text-amber-600" /> AI Household Health Recommendations
                  </h4>
                  <p className="text-xs leading-relaxed">{detail.ai_recommendation}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* REGISTER PARENT MODAL */}
      {showRegisterModal && canManage && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Register Parent / Household Head</h2>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleRegisterParent}>
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
                    <label className="form-label">Username *</label>
                    <input className="form-input text-xs" required value={regForm.username} onChange={(e) => setRegForm({ ...regForm, username: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input type="password" className="form-input text-xs" required value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Contact Number</label>
                    <input className="form-input text-xs" placeholder="0917-xxx-xxxx" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">District / Sitio *</label>
                    <select className="form-select text-xs" value={regForm.barangay_id} onChange={(e) => setRegForm({ ...regForm, barangay_id: Number(e.target.value) })}>
                      <option value={1}>Purok 1 - San Jose</option>
                      <option value={2}>Purok 2 - Bagong Pag-asa</option>
                      <option value={3}>Purok 3 - Talipapa</option>
                      <option value={4}>Purok 4 - Central</option>
                      <option value={5}>Purok 5 - Balingasa</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Home Address</label>
                  <input className="form-input text-xs" value={regForm.address} onChange={(e) => setRegForm({ ...regForm, address: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs">
                  {submitting ? <><span className="spinner" /> Saving...</> : 'Register Parent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Parents;
