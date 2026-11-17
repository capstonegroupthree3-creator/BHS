import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Plus, CheckCircle, XCircle, Clock, Shield, User, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface FamilyRelationship {
  relationship_id: number;
  adult_user_id: number;
  parent_resident_id: number;
  relationship_type: string;
  verification_status: string;
  verified_by_name: string | null;
  parent_first_name: string;
  parent_last_name: string;
  parent_age: number;
  parent_sex: string;
  parent_address: string;
  parent_contact: string;
  medical_conditions: string;
  risk_level: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  access_status: string;
  access_id: number;
}

interface AccessRequest {
  access_id: number;
  relationship_id: number;
  relationship_type: string;
  verification_status: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_age: number;
  risk_level: string;
  adult_username: string;
  adult_phone: string;
  access_status: string;
  authorization_date: string | null;
}

const riskColor: Record<string, string> = {
  Low: 'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

const FamilyHealth: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [myRelationships, setMyRelationships] = useState<FamilyRelationship[]>([]);
  const [allRequests, setAllRequests] = useState<AccessRequest[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [_activeTab] = useState<'my' | 'requests'>('my');
  const [form, setForm] = useState({ parent_resident_id: '', relationship_type: 'father' });
  const [submitError, setSubmitError] = useState('');

  const isStaff = ['admin', 'health_personnel'].includes(user?.role || '');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (isStaff) {
        const [reqRes, sumRes] = await Promise.all([
          api.get('/family/requests'),
          api.get('/family/summary'),
        ]);
        setAllRequests(reqRes.data || []);
        setSummary(sumRes.data || {});
      } else {
        const myRes = await api.get('/family/my');
        setMyRelationships(myRes.data || []);
      }
    } catch (err) {
      console.error('Family health fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    try {
      await api.post('/family/request', {
        parent_resident_id: parseInt(form.parent_resident_id),
        relationship_type: form.relationship_type,
      });
      setShowForm(false);
      setForm({ parent_resident_id: '', relationship_type: 'father' });
      fetchData();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || t('common.error'));
    }
  };

  const handleUpdateAccess = async (accessId: number, status: string) => {
    try {
      await api.patch(`/family/access/${accessId}/status`, { access_status: status });
      fetchData();
    } catch (err) {
      console.error('Update access error:', err);
    }
  };

  const handleVerifyRelationship = async (relId: number, status: string) => {
    try {
      await api.patch(`/family/relationships/${relId}/verify`, { verification_status: status });
      fetchData();
    } catch (err) {
      console.error('Verify relationship error:', err);
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
            <Heart className="text-teal-600" size={26} />
            {t('family.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isStaff ? 'Manage family health access requests' : t('family.ageRequirement')}
          </p>
        </div>
        {!isStaff && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> {t('family.requestAccess')}
          </button>
        )}
      </div>

      {/* Staff Summary Cards */}
      {isStaff && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'total', label: t('common.total'), color: 'slate' },
            { key: 'pending', label: 'Pending', color: 'yellow' },
            { key: 'approved', label: t('common.approved'), color: 'green' },
            { key: 'revoked', label: 'Revoked', color: 'red' },
          ].map(({ key, label, color }) => (
            <div key={key} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4 text-center`}>
              <div className={`text-3xl font-bold text-${color}-700`}>{summary[key] ?? 0}</div>
              <div className={`text-sm text-${color}-600 mt-1 font-medium`}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Parent Request Form */}
      {!isStaff && showForm && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">{t('family.requestAccess')}</h2>
          <p className="text-xs text-slate-500 mb-4">{t('family.parentConsent')}</p>
          {submitError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle size={15} /> {submitError}
            </div>
          )}
          <form onSubmit={handleRequestAccess} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Senior Citizen ID *</label>
              <input type="number" value={form.parent_resident_id}
                onChange={e => setForm(f => ({ ...f, parent_resident_id: e.target.value }))}
                placeholder="Enter your parent's Senior Citizen ID"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" required />
              <p className="text-xs text-slate-400 mt-1">Ask the health center for your parent's registered ID.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('family.relationship')} *</label>
              <select value={form.relationship_type} onChange={e => setForm(f => ({ ...f, relationship_type: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">
                <option value="father">{t('family.father')}</option>
                <option value="mother">{t('family.mother')}</option>
                <option value="legal_guardian">{t('family.legalGuardian')}</option>
                <option value="authorized_representative">{t('family.authorizedRep')}</option>
              </select>
            </div>
            <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <Shield size={14} className="inline mr-1" />
              Your request will require verification by a Barangay Health Worker and explicit consent from your parent before access is granted.
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setSubmitError(''); }}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
              <button type="submit"
                className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium">{t('common.submit')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Parent View: My Relationships */}
      {!isStaff && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">{t('family.myParents')}</h2>
          {myRelationships.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <Heart size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No family health records yet.</p>
              <p className="text-sm text-slate-400 mt-1">Click "Request Family Access" to link a senior parent.</p>
            </div>
          ) : myRelationships.map(rel => (
            <div key={rel.relationship_id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <User size={20} className="text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{rel.parent_first_name} {rel.parent_last_name}</h3>
                    <p className="text-xs text-slate-500">Age: {rel.parent_age} · {rel.relationship_type.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskColor[rel.risk_level] || 'bg-gray-100 text-gray-600'}`}>
                    {rel.risk_level} Risk
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    rel.access_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                    rel.access_status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {rel.access_status === 'approved' ? <><CheckCircle size={10} className="inline" /> Approved</> :
                     rel.access_status === 'pending' ? <><Clock size={10} className="inline" /> Pending</> :
                     <><XCircle size={10} className="inline" /> {rel.access_status}</>}
                  </span>
                </div>
              </div>
              {rel.access_status === 'approved' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm border-t border-slate-100 pt-4">
                  {rel.medical_conditions && (
                    <div className="col-span-2 md:col-span-3">
                      <span className="text-xs text-slate-500">Medical Conditions: </span>
                      <span className="text-slate-700">{rel.medical_conditions}</span>
                    </div>
                  )}
                  {rel.emergency_contact_name && (
                    <div>
                      <span className="text-xs text-slate-500 block">Emergency Contact</span>
                      <span className="text-slate-700 font-medium">{rel.emergency_contact_name}</span>
                    </div>
                  )}
                </div>
              )}
              {rel.access_status === 'pending' && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                  <Clock size={12} className="inline mr-1" /> Awaiting verification by health worker and consent from your parent.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Staff View: Access Requests */}
      {isStaff && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">{t('family.accessRequests')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Adult User', 'Senior Parent', 'Relationship', 'Verification', 'Access Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allRequests.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('common.noData')}</td></tr>
                ) : allRequests.map(r => (
                  <tr key={r.access_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.adult_username}</div>
                      <div className="text-xs text-slate-500">{r.adult_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.parent_first_name} {r.parent_last_name}</div>
                      <div className="text-xs text-slate-500">Age: {r.parent_age}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${riskColor[r.risk_level] || 'bg-gray-100 text-gray-600'}`}>{r.risk_level}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{r.relationship_type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                        r.verification_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{r.verification_status}</span>
                      {r.verification_status === 'pending' && (
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => handleVerifyRelationship(r.relationship_id, 'verified')}
                            className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">Verify</button>
                          <button onClick={() => handleVerifyRelationship(r.relationship_id, 'rejected')}
                            className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Reject</button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        r.access_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                        r.access_status === 'declined' ? 'bg-red-50 text-red-700 border-red-200' :
                        r.access_status === 'revoked' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>{r.access_status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.access_status === 'pending' && r.verification_status === 'verified' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleUpdateAccess(r.access_id, 'approved')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">{t('common.approved')}</button>
                          <button onClick={() => handleUpdateAccess(r.access_id, 'declined')}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">Decline</button>
                        </div>
                      )}
                      {r.access_status === 'approved' && (
                        <button onClick={() => handleUpdateAccess(r.access_id, 'revoked')}
                          className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200">{t('family.revokeAccess')}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyHealth;
