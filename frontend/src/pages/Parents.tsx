import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, Search, Plus, Baby, HeartPulse, Sparkles, Phone, MapPin,
  Edit3, CheckCircle2, FileSpreadsheet, Trash2, Download,
  User, Heart, FileCheck, ShieldCheck, Eye, ClipboardList,
} from 'lucide-react';
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
  birthdate?: string;
  sex?: 'M' | 'F';
  health_information?: string;
  contact_number: string;
  address: string;
  barangay_name: string;
  children_count: number;
  username?: string;
  email?: string;
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

interface ConsentRecord {
  id: number;
  consent_type: string;
  consent_status: 'pending' | 'granted' | 'declined' | 'withdrawn' | 'expired';
  consent_date: string | null;
  remarks: string | null;
  minor_type: string;
}

interface ParentDetail {
  parent: ParentSummary;
  children: LinkedChild[];
  pregnantRecord: LinkedPregnant | null;
  ai_recommendation: string;
}

type ActiveTab = 'profile' | 'children' | 'health' | 'consent';

const BARANGAYS = [
  { id: 1, name: 'District 1' }, { id: 2, name: 'District 2' }, { id: 3, name: 'District 3' },
  { id: 4, name: 'District 4' }, { id: 5, name: 'District 5' }, { id: 6, name: 'District 6' },
  { id: 7, name: 'District 7' }, { id: 8, name: 'Sitio Minbahandi (District 8)' },
  { id: 9, name: 'Sitio Hinandayan (District 9)' }, { id: 10, name: 'Sitio Baboy-Baboy (District 10)' },
];

const consentStatusColor: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  granted: 'bg-green-50 text-green-700 border-green-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
  withdrawn: 'bg-orange-50 text-orange-700 border-orange-200',
  expired: 'bg-slate-50 text-slate-500 border-slate-200',
};

const Parents: React.FC = () => {
  const { user } = useAuth();
  const [parents, setParents] = useState<ParentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<ParentSummary | null>(null);
  const [detail, setDetail] = useState<ParentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);

  // Edit State
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', contact_number: '', address: '',
    barangay_id: 1, birthdate: '', sex: '', health_information: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [regForm, setRegForm] = useState({
    username: '', password: 'password123', email: '', phone: '',
    first_name: '', last_name: '', address: '', barangay_id: 1,
  });

  const isParent = user?.role === 'parent';
  const canManage = user?.role === 'admin' || user?.role === 'health_personnel';
  const isAdmin = user?.role === 'admin';

  const fetchParents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/citizens/parents');
      const list = Array.isArray(data) ? data : [data];
      setParents(list);
      // Auto-select for parent role (they only see themselves)
      if (isParent && list.length > 0) {
        handleSelectParent(list[0]);
      }
    } catch (err) {
      console.error('Fetch parents error:', err);
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useEffect(() => { fetchParents(); }, [fetchParents]);

  const fetchConsentRecords = async (parentId: number) => {
    try {
      const { data } = await api.get(`/consent?parent_id=${parentId}`);
      setConsentRecords(Array.isArray(data) ? data : []);
    } catch {
      setConsentRecords([]);
    }
  };

  const handleSelectParent = async (p: ParentSummary) => {
    setSelectedParent(p);
    setLoadingDetail(true);
    setActiveTab('profile');
    try {
      const { data } = await api.get(`/citizens/parents/${p.id}`);
      setDetail(data);
      setEditForm({
        first_name: data.parent.first_name,
        last_name: data.parent.last_name,
        contact_number: data.parent.contact_number || '',
        address: data.parent.address || '',
        barangay_id: data.parent.barangay_id || 1,
        birthdate: data.parent.birthdate ? data.parent.birthdate.slice(0, 10) : '',
        sex: data.parent.sex || '',
        health_information: data.parent.health_information || '',
      });
      fetchConsentRecords(p.id);
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
      alert(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteParent = async (e: React.MouseEvent, parentId: number, parentName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete parent record for ${parentName}? This will also delete their account.`)) return;
    try {
      await api.delete(`/citizens/parents/${parentId}`);
      setMsg(`Parent record for ${parentName} deleted.`);
      fetchParents();
      if (selectedParent?.id === parentId) { setSelectedParent(null); setDetail(null); }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete parent record');
    }
  };

  const filtered = parents.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(term) ||
      (p.barangay_name || '').toLowerCase().includes(term) ||
      (p.contact_number && p.contact_number.includes(term))
    );
  });

  const handleDownloadExcel = () => {
    const exportData = filtered.map(p => ({
      'Parent ID': p.id,
      'First Name': p.first_name,
      'Last Name': p.last_name,
      'Sex': p.sex === 'M' ? 'Male' : p.sex === 'F' ? 'Female' : 'N/A',
      'Birthdate': p.birthdate ? new Date(p.birthdate).toLocaleDateString('en-PH') : 'N/A',
      'District / Sitio': p.barangay_name,
      'Contact Phone': p.contact_number || 'N/A',
      'Address': p.address || 'N/A',
      'Children Count': p.children_count,
    }));
    exportToExcel(exportData, 'Parents_Guardians_Barangay_Camagong');
  };

  const TABS: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Personal Info', icon: User },
    { id: 'children', label: 'Children', icon: Baby },
    { id: 'health', label: 'Health Info', icon: Heart },
    { id: 'consent', label: 'Consent Records', icon: FileCheck },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isParent ? 'My Family Profile' : 'Parents & Guardians Registry'}
          </h1>
          <p className="page-subtitle">
            {isParent
              ? 'View your personal information, registered children, and consent records'
              : 'View registered family heads, linked children, maternal profiles, and AI household health recommendations'}
          </p>
        </div>
        {!isParent && (
          <div className="flex gap-2">
            <button onClick={handleDownloadExcel} className="btn-secondary">
              <Download className="w-4 h-4" /> Download Excel
            </button>
            {canManage && (
              <>
                <button onClick={() => setShowImportModal(true)} className="btn-success">
                  <FileSpreadsheet className="w-4 h-4" /> Import Excel
                </button>
                <button onClick={() => setShowRegisterModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4" /> Register Parent
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ExcelImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImportSuccess={fetchParents} />

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{msg}</p>
        </div>
      )}

      <div className={`grid gap-6 ${isParent ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>

        {/* LIST PANEL — hidden for parent role */}
        {!isParent && (
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, district, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input pl-9 py-2 text-xs"
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">Registered Parents & Household Heads</h3>
                <span className="badge badge-blue">{filtered.length} Households</span>
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
                        <th>Parent / Guardian</th>
                        <th>District / Sitio</th>
                        <th>Contact</th>
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
                            className={`hover:bg-blue-50/60 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                          >
                            <td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                                  {p.first_name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{p.first_name} {p.last_name}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {p.sex === 'M' ? '♂ Male' : p.sex === 'F' ? '♀ Female' : ''} · ID #{p.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="text-xs font-semibold text-slate-700">{p.barangay_name}</td>
                            <td className="text-xs text-slate-600 font-mono">{p.contact_number || 'N/A'}</td>
                            <td>
                              <span className="badge badge-purple text-xs flex items-center gap-1 w-max">
                                <Baby className="w-3 h-3" /> {p.children_count ?? 0} Linked
                              </span>
                            </td>
                            <td className="text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" /> View
                                </span>
                                {isAdmin && (
                                  <button
                                    onClick={(e) => handleDeleteParent(e, p.id, `${p.first_name} ${p.last_name}`)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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
          </div>
        )}

        {/* DETAIL PANEL */}
        <div className={isParent ? 'w-full' : ''}>
          {/* Parent role auto-loads, others need to click */}
          {!isParent && !selectedParent ? (
            <div className="card h-full flex items-center justify-center min-h-[300px]">
              <div className="text-center text-slate-400 text-xs px-6">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Select a parent from the list to view their profile, children, and consent records.
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="card flex justify-center items-center min-h-[200px]">
              <span className="spinner text-blue-600 w-6 h-6" />
            </div>
          ) : detail ? (
            <div className="card">
              {/* Profile Header */}
              <div className="card-header bg-gradient-to-r from-indigo-900 to-slate-900 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-lg">
                      {detail.parent.first_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{detail.parent.first_name} {detail.parent.last_name}</h3>
                      <p className="text-[10px] text-indigo-200">{detail.parent.barangay_name} · {detail.parent.sex === 'M' ? 'Male' : detail.parent.sex === 'F' ? 'Female' : 'N/A'}</p>
                    </div>
                  </div>
                  {/* Edit button: admin/health worker always; parent for own profile */}
                  {(canManage || isParent) && (
                    <button
                      onClick={() => setShowEdit(!showEdit)}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1 rounded-lg border border-white/20 flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> {showEdit ? 'Cancel' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-slate-200 flex">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.id === 'children' && (
                      <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                        {detail.children.length}
                      </span>
                    )}
                    {tab.id === 'consent' && consentRecords.length > 0 && (
                      <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                        {consentRecords.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="card-body p-4 space-y-4">

                {/* Inline Edit Form */}
                {showEdit && (
                  <form onSubmit={handleUpdateParent} className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2 text-xs">
                    <h5 className="font-bold text-slate-800 flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                    </h5>

                    {/* Admin / health workers can edit name & district */}
                    {canManage && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-600 font-semibold block">First Name</label>
                            <input className="form-input text-xs py-1" value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-600 font-semibold block">Last Name</label>
                            <input className="form-input text-xs py-1" value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-600 font-semibold block">Birthdate</label>
                            <input type="date" className="form-input text-xs py-1" value={editForm.birthdate} onChange={e => setEditForm({ ...editForm, birthdate: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-600 font-semibold block">Sex</label>
                            <select className="form-select text-xs py-1" value={editForm.sex} onChange={e => setEditForm({ ...editForm, sex: e.target.value })}>
                              <option value="">-- Select --</option>
                              <option value="M">Male</option>
                              <option value="F">Female</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-600 font-semibold block">District / Sitio</label>
                          <select className="form-select text-xs py-1" value={editForm.barangay_id} onChange={e => setEditForm({ ...editForm, barangay_id: Number(e.target.value) })}>
                            {BARANGAYS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                      </>
                    )}

                    {/* All roles can edit contact & address */}
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block">Contact Number</label>
                      <input className="form-input text-xs py-1" value={editForm.contact_number} onChange={e => setEditForm({ ...editForm, contact_number: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block">Home Address</label>
                      <input className="form-input text-xs py-1" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block">Health Information (optional)</label>
                      <textarea rows={3} className="form-input text-xs py-1 w-full resize-none" placeholder="Allergies, conditions, notes..." value={editForm.health_information} onChange={e => setEditForm({ ...editForm, health_information: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary py-1 text-[11px]">Cancel</button>
                      <button type="submit" disabled={submitting} className="btn-primary py-1 text-[11px]">
                        {submitting ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB: Personal Info */}
                {activeTab === 'profile' && (
                  <div className="space-y-3">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <p className="text-[10px] text-indigo-500 font-bold uppercase">Full Name</p>
                          <p className="font-semibold text-slate-900">{detail.parent.first_name} {detail.parent.last_name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-indigo-500 font-bold uppercase">Sex</p>
                          <p className="font-semibold text-slate-900">{detail.parent.sex === 'M' ? 'Male' : detail.parent.sex === 'F' ? 'Female' : 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-indigo-500 font-bold uppercase">Birthdate</p>
                          <p className="font-semibold text-slate-900">
                            {detail.parent.birthdate
                              ? new Date(detail.parent.birthdate).toLocaleDateString('en-PH', { dateStyle: 'long' })
                              : 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-indigo-500 font-bold uppercase">Username</p>
                          <p className="font-semibold text-slate-900">{detail.parent.username || 'N/A'}</p>
                        </div>
                      </div>
                      <hr className="border-indigo-100" />
                      <p className="text-xs text-indigo-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        <strong>{detail.parent.barangay_name}</strong>
                      </p>
                      <p className="text-xs text-indigo-800 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        {detail.parent.contact_number || 'No contact number'}
                      </p>
                      <p className="text-[11px] text-slate-500">📍 {detail.parent.address || 'No address provided'}</p>
                      {detail.parent.email && (
                        <p className="text-[11px] text-slate-500">✉️ {detail.parent.email}</p>
                      )}
                    </div>

                    {/* Pregnant record if any */}
                    {detail.pregnantRecord && (
                      <div className="bg-pink-50 border border-pink-200 p-3 rounded-xl space-y-1">
                        <h4 className="text-xs font-bold text-pink-900 flex items-center gap-1">
                          <HeartPulse className="w-4 h-4 text-pink-600" /> Active Pregnancy Record
                        </h4>
                        <p className="text-xs text-pink-800">
                          Age: <strong>{detail.pregnantRecord.age} yrs</strong> · Due: <strong>{new Date(detail.pregnantRecord.expected_due_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</strong>
                        </p>
                        <div className="pt-1"><RiskBadge status={detail.pregnantRecord.risk_status} size="sm" /></div>
                      </div>
                    )}

                    {/* AI Recommendations */}
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900">
                      <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600" /> AI Household Health Guidance
                      </h4>
                      <p className="text-xs leading-relaxed">{detail.ai_recommendation}</p>
                    </div>
                  </div>
                )}

                {/* TAB: Children */}
                {activeTab === 'children' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Baby className="w-4 h-4 text-blue-600" /> Registered Children ({detail.children.length})
                      </h4>
                      <span className="text-[10px] text-slate-400 italic">Parent can view only their own children's records</span>
                    </div>

                    {detail.children.length === 0 ? (
                      <div className="py-8 text-center">
                        <Baby className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs text-slate-400 italic">No children registered under this household yet.</p>
                      </div>
                    ) : (
                      detail.children.map((child) => (
                        <div key={child.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${child.sex === 'M' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                                {child.first_name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-900 text-xs">{child.first_name} {child.last_name}</span>
                            </div>
                            <span className={`badge text-[10px] ${child.sex === 'M' ? 'badge-blue' : 'badge-purple'}`}>
                              {child.sex === 'M' ? 'Male' : 'Female'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            📅 DOB: {new Date(child.birthdate).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                          </p>
                          {child.latest_nutrition_status && (
                            <p className="text-[11px] font-semibold text-purple-700">
                              🥗 Nutrition: {child.latest_nutrition_status}
                            </p>
                          )}
                          {child.latest_wasting_status && child.latest_wasting_status !== 'Normal' && (
                            <p className="text-[11px] font-semibold text-orange-600">⚠️ Wasting: {child.latest_wasting_status}</p>
                          )}
                          {child.latest_stunting_status && child.latest_stunting_status !== 'Normal' && (
                            <p className="text-[11px] font-semibold text-red-600">📏 Stunting: {child.latest_stunting_status}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB: Health Info */}
                {activeTab === 'health' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Heart className="w-4 h-4 text-red-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Personal Health Information</h4>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
                      {detail.parent.health_information
                        ? detail.parent.health_information
                        : <span className="italic text-slate-400">No health information has been provided yet. Click "Edit" to add your health notes (allergies, conditions, etc.)</span>}
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-700 flex gap-2">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0 text-blue-500 mt-0.5" />
                      <span>
                        Your health information is private and only shared with your assigned Barangay Health Worker. 
                        Administrators manage accounts but do not edit clinical entries.
                      </span>
                    </div>
                  </div>
                )}

                {/* TAB: Consent */}
                {activeTab === 'consent' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-purple-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Child Consent Records</h4>
                    </div>
                    {consentRecords.length === 0 ? (
                      <div className="py-8 text-center">
                        <FileCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs text-slate-400 italic">No consent records found for this household.</p>
                        {canManage && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Add consent records via the <strong>Consent Management</strong> module.
                          </p>
                        )}
                      </div>
                    ) : (
                      consentRecords.map(cr => {
                        const colorClass = consentStatusColor[cr.consent_status] || 'bg-slate-50 text-slate-500 border-slate-200';
                        return (
                          <div key={cr.id} className={`border rounded-xl p-3 text-xs space-y-1 ${colorClass}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold capitalize">{cr.consent_type.replace(/_/g, ' ')}</span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${colorClass}`}>
                                {cr.consent_status}
                              </span>
                            </div>
                            <p className="text-[11px] opacity-80">
                              Type: <strong className="capitalize">{cr.minor_type.replace(/_/g, ' ')}</strong>
                              {cr.consent_date && ` · Dated: ${new Date(cr.consent_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}`}
                            </p>
                            {cr.remarks && <p className="text-[11px] italic opacity-70">{cr.remarks}</p>}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* REGISTER PARENT MODAL */}
      {showRegisterModal && canManage && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Register Parent / Household Head</h2>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleRegisterParent}>
              <div className="modal-body space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className="form-input text-xs" required value={regForm.first_name} onChange={e => setRegForm({ ...regForm, first_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className="form-input text-xs" required value={regForm.last_name} onChange={e => setRegForm({ ...regForm, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input className="form-input text-xs" required value={regForm.username} onChange={e => setRegForm({ ...regForm, username: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input type="password" className="form-input text-xs" required value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input text-xs" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Contact Number</label>
                    <input className="form-input text-xs" placeholder="09xx-xxx-xxxx" value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">District / Sitio *</label>
                    <select className="form-select text-xs" value={regForm.barangay_id} onChange={e => setRegForm({ ...regForm, barangay_id: Number(e.target.value) })}>
                      {BARANGAYS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Home Address</label>
                  <input className="form-input text-xs" value={regForm.address} onChange={e => setRegForm({ ...regForm, address: e.target.value })} />
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
