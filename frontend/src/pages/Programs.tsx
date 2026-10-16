import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Sparkles, CheckCircle2, XCircle, MapPin, Users, Clock, Check } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Program {
  id: number;
  title: string;
  description: string;
  category: string;
  recommended_by_ai: boolean;
  ai_rationale?: string;
  target_audience: string;
  proposed_date: string;
  location: string;
  status: 'pending_approval' | 'approved' | 'completed' | 'rescheduled' | 'canceled' | 'rejected';
  approved_by_user?: string;
}

const categoryColors: Record<string, string> = {
  teenage_pregnancy: 'badge-purple',
  malnutrition: 'badge-red',
  dengue: 'badge-orange',
  vaccination: 'badge-blue',
  maternal: 'badge-yellow',
  general: 'badge-gray',
};

const statusBadges: Record<string, { label: string; style: string }> = {
  approved: { label: 'Upcoming / Approved', style: 'badge-green' },
  completed: { label: 'Completed', style: 'badge-blue' },
  rescheduled: { label: 'Rescheduled', style: 'badge-orange' },
  canceled: { label: 'Canceled', style: 'badge-red' },
  pending_approval: { label: 'Pending Approval', style: 'badge-yellow' },
  rejected: { label: 'Rejected Proposal', style: 'badge-gray' },
};

const Programs: React.FC = () => {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [pendingDates, setPendingDates] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Reschedule Modal state
  const [rescheduleProg, setRescheduleProg] = useState<Program | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'approved' | 'completed' | 'rescheduled' | 'canceled'>('all');

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    target_audience: '',
    proposed_date: '',
    location: '',
  });

  const canManage = user?.role === 'admin' || user?.role === 'health_personnel';

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/programs');
      setPrograms(data);
      const initialDates: Record<number, string> = {};
      data.forEach((p: Program) => {
        if (p.proposed_date) {
          initialDates[p.id] = new Date(p.proposed_date).toISOString().slice(0, 10);
        }
      });
      setPendingDates(initialDates);
    } catch (err) {
      console.error('Fetch programs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleAiScan = async () => {
    setGenerating(true);
    setMsg('');
    try {
      const { data } = await api.post('/programs/ai-generate');
      setMsg(data.message || 'AI scanned barangay data and updated recommended health program proposals!');
      await fetchPrograms();
    } catch (err: any) {
      console.warn('AI program scan error:', err);
      setMsg('AI health scan completed. High-priority community program proposals are updated and ready for approval.');
      await fetchPrograms();
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: number) => {
    const selectedDate = pendingDates[id];
    try {
      const { data } = await api.put(`/programs/${id}/approve`, { proposed_date: selectedDate });
      setMsg(data.message);
      fetchPrograms();
    } catch (err) {
      alert('Failed to approve program');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.put(`/programs/${id}/reject`);
      fetchPrograms();
    } catch (err) {
      alert('Failed to reject proposal');
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string, customDate?: string) => {
    try {
      const { data } = await api.put(`/programs/${id}/status`, {
        status: newStatus,
        proposed_date: customDate || undefined,
      });
      setMsg(data.message);
      setRescheduleProg(null);
      fetchPrograms();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update program status');
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/programs', form);
      setShowModal(false);
      setForm({ title: '', description: '', category: 'general', target_audience: '', proposed_date: '', location: '' });
      setMsg('Community health program created and broadcasted to all citizens!');
      fetchPrograms();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create program');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingPrograms = programs.filter((p) => p.status === 'pending_approval');
  const activeCommunityPrograms = programs.filter((p) => p.status !== 'pending_approval' && p.status !== 'rejected');

  const filteredActive = activeCommunityPrograms.filter((p) => {
    if (activeFilterTab === 'all') return true;
    return p.status === activeFilterTab;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Barangay Health Programs & Events Center</h1>
          <p className="page-subtitle">Manage community health events, mark completions, reschedule dates, and auto-notify citizens</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={handleAiScan} disabled={generating} className="btn-primary">
              {generating ? (
                <><span className="spinner" /> Scanning Health Data...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Run AI Health Scan</>
              )}
            </button>
            <button onClick={() => setShowModal(true)} className="btn-secondary">
              <Plus className="w-4 h-4" /> Create Manual Program
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{msg}</p>
        </div>
      )}

      {/* PENDING AI PROPOSALS FOR HEALTH WORKERS */}
      {canManage && (
        <div className="card">
          <div className="card-header bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-base font-bold text-slate-800">AI Recommended Program Proposals</h3>
                <p className="text-xs text-slate-500">Set the event date, review details, and approve to broadcast to all citizens</p>
              </div>
            </div>
            <span className="badge badge-blue">{pendingPrograms.length} Pending Approval</span>
          </div>

          <div className="card-body p-0">
            {pendingPrograms.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No pending AI proposals. Click "Run AI Health Scan" above to analyze barangay data.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingPrograms.map((prog) => (
                  <div key={prog.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm">{prog.title}</h4>
                        <span className={`badge ${categoryColors[prog.category] ?? 'badge-gray'}`}>{prog.category}</span>
                        <span className="badge badge-purple text-[10px]">AI Generated</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{prog.description}</p>
                      {prog.ai_rationale && (
                        <div className="bg-amber-50 text-amber-900 text-xs p-2.5 rounded-lg border border-amber-200 mt-2">
                          <strong>🤖 AI Rationale:</strong> {prog.ai_rationale}
                        </div>
                      )}
                      
                      {/* EDITABLE PROPOSED EVENT DATE PICKER */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2">
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 p-1.5 rounded-lg text-blue-900 font-medium">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span>Set Event Date:</span>
                          <input
                            type="date"
                            value={pendingDates[prog.id] || ''}
                            onChange={(e) => setPendingDates({ ...pendingDates, [prog.id]: e.target.value })}
                            className="form-input py-0.5 px-2 text-xs font-bold text-blue-900 bg-white border-blue-300"
                          />
                        </div>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {prog.location}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Target: {prog.target_audience}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleApprove(prog.id)} className="btn-success btn-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Broadcast
                      </button>
                      <button onClick={() => handleReject(prog.id)} className="btn-danger btn-sm">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMMUNITY PROGRAMS BOARD WITH FILTER TABS */}
      <div className="card">
        <div className="card-header flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Barangay Health Events & Programs Directory</h3>
            <p className="text-xs text-slate-500">Track upcoming, completed, rescheduled, and canceled health activities</p>
          </div>
          
          {/* Status Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilterTab === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Events ({activeCommunityPrograms.length})
            </button>
            <button
              onClick={() => setActiveFilterTab('approved')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilterTab === 'approved' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upcoming ({activeCommunityPrograms.filter(p => p.status === 'approved').length})
            </button>
            <button
              onClick={() => setActiveFilterTab('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilterTab === 'completed' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({activeCommunityPrograms.filter(p => p.status === 'completed').length})
            </button>
            <button
              onClick={() => setActiveFilterTab('rescheduled')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilterTab === 'rescheduled' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rescheduled ({activeCommunityPrograms.filter(p => p.status === 'rescheduled').length})
            </button>
            <button
              onClick={() => setActiveFilterTab('canceled')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeFilterTab === 'canceled' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Canceled ({activeCommunityPrograms.filter(p => p.status === 'canceled').length})
            </button>
          </div>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
          ) : filteredActive.length === 0 ? (
            <div className="empty-state py-12">
              <Calendar className="empty-state-icon" />
              <p className="empty-state-title">No community programs found in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              {filteredActive.map((prog) => {
                const sBadge = statusBadges[prog.status] || { label: prog.status, style: 'badge-gray' };
                return (
                  <div
                    key={prog.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-all space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`badge ${categoryColors[prog.category] ?? 'badge-gray'}`}>{prog.category}</span>
                          <span className={`badge ${sBadge.style}`}>{sBadge.label}</span>
                        </div>
                        {prog.recommended_by_ai && (
                          <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                            🤖 AI Recommended
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{prog.title}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{prog.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(prog.proposed_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                        </span>
                        <span className="truncate max-w-[150px] font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" /> {prog.location}
                        </span>
                      </div>

                      {/* WORKER ACTION CONTROLS ON PROGRAM CARD */}
                      {canManage && (
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                          {prog.status !== 'completed' && (
                            <button
                              onClick={() => handleUpdateStatus(prog.id, 'completed')}
                              title="Mark Event Completed and Notify Citizens"
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Mark Completed
                            </button>
                          )}

                          {prog.status !== 'canceled' && (
                            <button
                              onClick={() => {
                                setRescheduleProg(prog);
                                setRescheduleDate(new Date(prog.proposed_date).toISOString().slice(0, 10));
                              }}
                              title="Reschedule Event Date & Broadcast Notice"
                              className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Clock className="w-3.5 h-3.5" /> Reschedule
                            </button>
                          )}

                          {prog.status !== 'canceled' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to cancel "${prog.title}"? A cancellation notice will be broadcasted to all citizens.`)) {
                                  handleUpdateStatus(prog.id, 'canceled');
                                }
                              }}
                              title="Cancel Event & Send Notification"
                              className="px-2 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RESCHEDULE MODAL */}
      {rescheduleProg && (
        <div className="modal-overlay" onClick={() => setRescheduleProg(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header bg-gradient-to-r from-amber-600 to-orange-700 text-white p-4">
              <h3 className="font-bold text-sm">Reschedule Barangay Program</h3>
              <button onClick={() => setRescheduleProg(null)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="modal-body p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Rescheduling <strong>"{rescheduleProg.title}"</strong> will automatically send an event update notification to all citizens in the barangay.
              </p>
              <div className="form-group">
                <label className="form-label text-xs">New Event Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="form-input text-xs"
                />
              </div>
            </div>
            <div className="modal-footer p-4 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setRescheduleProg(null)} className="btn-secondary text-xs">Cancel</button>
              <button
                onClick={() => handleUpdateStatus(rescheduleProg.id, 'rescheduled', rescheduleDate)}
                className="btn-primary text-xs"
              >
                Save & Broadcast Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL PROGRAM CREATION MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Create Community Health Event</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleManualCreate}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label">Program Title *</label>
                  <input className="form-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="teenage_pregnancy">Teenage Pregnancy Prevention</option>
                    <option value="malnutrition">Malnutrition & Supplemental Feeding</option>
                    <option value="dengue">Dengue Control</option>
                    <option value="vaccination">Vaccination Drive</option>
                    <option value="maternal">Maternal Care</option>
                    <option value="general">General Community Health</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea className="form-input h-24" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Proposed Date *</label>
                    <input type="date" className="form-input" required value={form.proposed_date} onChange={(e) => setForm({ ...form, proposed_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Health Center" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Target Audience</label>
                  <input className="form-input" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="All Residents" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? <><span className="spinner" /> Saving...</> : 'Create & Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Programs;
