import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck, Plus, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ConsentRecord {
  id: number;
  parent_guardian_id: number;
  parent_name: string;
  minor_id: number;
  minor_type: 'child' | 'adolescent_mother';
  consent_type: string;
  consent_status: 'pending' | 'granted' | 'declined' | 'withdrawn' | 'expired';
  consent_date: string | null;
  verified_by_name: string | null;
  verification_date: string | null;
  remarks: string | null;
  created_at: string;
}

interface Parent {
  id: number;
  first_name: string;
  last_name: string;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending:   { icon: Clock,        color: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'Pending' },
  granted:   { icon: CheckCircle,  color: 'text-green-600 bg-green-50 border-green-200',   label: 'Granted' },
  declined:  { icon: XCircle,      color: 'text-red-600 bg-red-50 border-red-200',         label: 'Declined' },
  withdrawn: { icon: AlertTriangle,color: 'text-orange-600 bg-orange-50 border-orange-200',label: 'Withdrawn' },
  expired:   { icon: Clock,        color: 'text-slate-500 bg-slate-50 border-slate-200',   label: 'Expired' },
};

const ConsentManagement: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ parent_guardian_id: '', minor_id: '', minor_type: 'child', consent_type: 'health_data_processing', remarks: '' });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [recRes, sumRes, parRes] = await Promise.all([
        api.get('/consent' + (filterStatus ? `?status=${filterStatus}` : '')),
        api.get('/consent/summary'),
        api.get('/parents'),
      ]);
      setRecords(recRes.data || []);
      setSummary(sumRes.data || {});
      setParents(parRes.data || []);
    } catch (err) {
      console.error('Consent fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await api.patch(`/consent/${id}/status`, { consent_status: status });
      fetchAll();
    } catch (err) {
      console.error('Update consent error:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/consent', {
        parent_guardian_id: parseInt(form.parent_guardian_id),
        minor_id: parseInt(form.minor_id),
        minor_type: form.minor_type,
        consent_type: form.consent_type,
        remarks: form.remarks || null,
      });
      setShowForm(false);
      setForm({ parent_guardian_id: '', minor_id: '', minor_type: 'child', consent_type: 'health_data_processing', remarks: '' });
      fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.message || t('common.error'));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileCheck className="text-teal-600" size={26} />
            {t('consent.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Individual consent per minor — RA 10173 Compliant</p>
        </div>
        {['admin', 'health_personnel'].includes(user?.role || '') && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> {t('consent.addConsent')}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'total', label: t('common.total'), color: 'slate' },
          { key: 'pending', label: t('consent.pending'), color: 'yellow' },
          { key: 'granted', label: t('consent.granted'), color: 'green' },
          { key: 'declined', label: t('consent.declined'), color: 'red' },
        ].map(({ key, label, color }) => (
          <div key={key} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4 text-center`}>
            <div className={`text-3xl font-bold text-${color}-700`}>{summary[key] ?? 0}</div>
            <div className={`text-sm text-${color}-600 mt-1 font-medium`}>{label}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('consent.addConsent')}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('consent.parentGuardian')} *</label>
              <select value={form.parent_guardian_id} onChange={e => setForm(f => ({ ...f, parent_guardian_id: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" required>
                <option value="">-- Select --</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Minor ID *</label>
              <input type="number" value={form.minor_id} onChange={e => setForm(f => ({ ...f, minor_id: e.target.value }))}
                placeholder="Enter child/pregnant women ID"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('consent.minorType')} *</label>
              <select value={form.minor_type} onChange={e => setForm(f => ({ ...f, minor_type: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">
                <option value="child">{t('consent.child')}</option>
                <option value="adolescent_mother">{t('consent.adolescentMother')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('consent.consentType')}</label>
              <input type="text" value={form.consent_type} onChange={e => setForm(f => ({ ...f, consent_type: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('consent.remarks')}</label>
              <textarea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
              <button type="submit"
                className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium">{t('common.save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'granted', 'declined', 'withdrawn'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${filterStatus === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Parent/Guardian', 'Minor ID', 'Type', 'Consent Type', 'Status', 'Date', 'Verified By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">{t('common.noData')}</td></tr>
              ) : records.map(r => {
                const cfg = statusConfig[r.consent_status] || statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.parent_name}</td>
                    <td className="px-4 py-3 text-slate-600">ID: {r.minor_id}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                        {r.minor_type === 'child' ? t('consent.child') : t('consent.adolescentMother')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.consent_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                        <Icon size={12} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.consent_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{r.verified_by_name || '—'}</td>
                    <td className="px-4 py-3">
                      {['admin', 'health_personnel'].includes(user?.role || '') && r.consent_status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleStatusUpdate(r.id, 'granted')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors">{t('consent.grantConsent')}</button>
                          <button onClick={() => handleStatusUpdate(r.id, 'declined')}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">{t('consent.declineConsent')}</button>
                        </div>
                      )}
                      {r.consent_status === 'granted' && (
                        <button onClick={() => handleStatusUpdate(r.id, 'withdrawn')}
                          className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors">{t('consent.withdrawConsent')}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ConsentManagement;
