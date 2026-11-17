import React, { useEffect, useState } from 'react';
import { Syringe, Search, Plus, CheckCircle2, Clock, AlertTriangle, Baby, FileText, Mail, Printer } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface VaccineRecord {
  id: number;
  child_id: number;
  child_first_name: string;
  child_last_name: string;
  barangay_name: string;
  vaccine_name: string;
  vaccine_type: string;
  dose_number: number;
  status: 'completed' | 'scheduled' | 'missed';
  scheduled_date: string;
  administered_date?: string;
  remarks?: string;
}

interface Child {
  id: number;
  first_name: string;
  last_name: string;
  barangay_name: string;
}

interface Vaccine {
  id: number;
  name: string;
  type: string;
}

const Vaccinations: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<VaccineRecord[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'scheduled' | 'missed'>('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Letter State
  const [selectedLetterRecord, setSelectedLetterRecord] = useState<VaccineRecord | null>(null);
  const [sendingNotice, setSendingNotice] = useState(false);

  const [form, setForm] = useState({
    child_id: '',
    vaccine_id: '',
    dose_number: 1,
    status: 'completed',
    scheduled_date: new Date().toISOString().split('T')[0],
    administered_date: new Date().toISOString().split('T')[0],
    remarks: 'Routine dose administered',
  });

  const canManage = user?.role === 'admin' || user?.role === 'health_personnel';

  const handleSendNotice = async (recordId: number) => {
    setSendingNotice(true);
    try {
      const { data } = await api.post('/citizens/vaccinations/send-missed-notice', { recordId });
      alert(data.message);
      setMsg(data.message);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to send notice notification');
    } finally {
      setSendingNotice(false);
    }
  };

  const fetchVaccineData = async () => {
    setLoading(true);
    try {
      const recRes = await api.get('/citizens/vaccinations');
      setRecords(recRes.data || []);
    } catch (err) {
      console.error('Vaccinations fetch error:', err);
    }

    try {
      const childRes = await api.get('/citizens/children');
      setChildren(childRes.data || []);
    } catch (err) {
      console.error('Children fetch error:', err);
    }

    try {
      const vacRes = await api.get('/citizens/vaccines-catalog');
      setVaccines(vacRes.data || []);
    } catch (err) {
      console.error('Vaccines catalog fetch error:', err);
    }

    setLoading(false);
  };

  const handleOpenRecordModal = async () => {
    try {
      const { data } = await api.get('/citizens/children');
      if (Array.isArray(data) && data.length > 0) {
        setChildren(data);
      }
    } catch (err) {
      console.error('Error refreshing children dropdown list:', err);
    }
    setShowModal(true);
  };

  useEffect(() => {
    fetchVaccineData();
  }, []);

  const [useCustomVaccine, setUseCustomVaccine] = useState(false);
  const [customVaccineName, setCustomVaccineName] = useState('');
  const [customVaccineType, setCustomVaccineType] = useState('Immunization');

  // Edit record state
  const [editingRecord, setEditingRecord] = useState<VaccineRecord | null>(null);
  const [editStatus, setEditStatus] = useState<'completed' | 'scheduled' | 'missed'>('completed');
  const [editAdminDate, setEditAdminDate] = useState(new Date().toISOString().split('T')[0]);
  const [editRemarks, setEditRemarks] = useState('');

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSubmitting(true);
    try {
      const { data } = await api.put(`/citizens/vaccinations/${editingRecord.id}`, {
        status: editStatus,
        administered_date: editAdminDate,
        remarks: editRemarks,
      });
      setMsg(data.message);
      setEditingRecord(null);
      fetchVaccineData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update vaccine record status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdministerVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        vaccine_name: useCustomVaccine ? customVaccineName : undefined,
        vaccine_type: useCustomVaccine ? customVaccineType : undefined,
      };
      const { data } = await api.post('/citizens/vaccinations', payload);
      setMsg(data.message || 'Vaccination record saved successfully!');
      setShowModal(false);
      fetchVaccineData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save vaccination record');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (activeTab !== 'all' && r.status !== activeTab) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const childName = `${r.child_first_name} ${r.child_last_name}`.toLowerCase();
    return (
      childName.includes(term) ||
      r.vaccine_name.toLowerCase().includes(term) ||
      r.barangay_name.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-green flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'scheduled':
        return <span className="badge badge-blue flex items-center gap-1"><Clock className="w-3 h-3" /> Scheduled</span>;
      case 'missed':
        return <span className="badge badge-red flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Missed / Overdue</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Barangay Child Vaccination & Immunization Registry</h1>
          <p className="page-subtitle">Track completed doses, upcoming immunization schedules, and missed vaccines for Barangay Camagong children</p>
        </div>
        {canManage && (
          <button onClick={handleOpenRecordModal} className="btn-primary">
            <Plus className="w-4 h-4" /> Record / Administer Vaccine
          </button>
        )}
      </div>

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{msg}</p>
        </div>
      )}

      {/* FILTER TABS & SEARCH BAR */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Doses ({records.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'completed' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({records.filter(r => r.status === 'completed').length})
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'scheduled' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Scheduled ({records.filter(r => r.status === 'scheduled').length})
            </button>
            <button
              onClick={() => setActiveTab('missed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'missed' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Missed ({records.filter(r => r.status === 'missed').length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by child name, vaccine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* VACCINATION RECORDS TABLE */}
      <div className="card">
        <div className="card-body p-0 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state py-12">
              <Syringe className="empty-state-icon" />
              <p className="empty-state-title">No vaccination records found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Child Name</th>
                  <th>District / Sitio</th>
                  <th>Vaccine & Type</th>
                  <th>Dose #</th>
                  <th>Scheduled Date</th>
                  <th>Administered Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-slate-900 text-xs">{r.child_first_name} {r.child_last_name}</span>
                      </div>
                    </td>
                    <td className="text-xs font-medium text-slate-700">{r.barangay_name}</td>
                    <td>
                      <div>
                        <p className="font-bold text-blue-700 text-xs">{r.vaccine_name}</p>
                        <p className="text-[10px] text-slate-400">{r.vaccine_type}</p>
                      </div>
                    </td>
                    <td className="text-xs font-mono font-bold">Dose {r.dose_number}</td>
                    <td className="text-xs text-slate-600">
                      {new Date(r.scheduled_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </td>
                    <td className="text-xs text-slate-600">
                      {r.administered_date ? new Date(r.administered_date).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td>{getStatusBadge(r.status)}</td>
                    <td className="text-xs text-slate-500">{r.remarks || '—'}</td>
                    <td className="text-xs flex items-center gap-1.5">
                      {canManage && (
                        <>
                          <button
                            onClick={() => {
                              setEditingRecord(r);
                              setEditStatus(r.status);
                              setEditAdminDate(r.administered_date ? r.administered_date.split('T')[0] : new Date().toISOString().split('T')[0]);
                              setEditRemarks(r.remarks || '');
                            }}
                            className="btn-primary btn-sm text-[11px] py-1"
                          >
                            Edit / Mark Done
                          </button>
                          <button
                            onClick={() => setSelectedLetterRecord(r)}
                            title="Generate Official Missed Vaccine Notice Letter"
                            className="btn-secondary btn-sm text-[11px] py-1 flex items-center gap-1 text-red-700 hover:bg-red-50 border-red-200"
                          >
                            <FileText className="w-3 h-3 text-red-600" /> Letter Notice
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RECORD VACCINE MODAL */}
      {showModal && canManage && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Record Child Immunization Dose</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAdministerVaccine}>
              <div className="modal-body space-y-3">
                <div className="form-group">
                  <label className="form-label">Select Child *</label>
                  <select
                    required
                    value={form.child_id}
                    onChange={(e) => setForm({ ...form, child_id: e.target.value })}
                    className="form-select text-xs"
                  >
                    <option value="">Select a child...</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.barangay_name})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <div className="flex items-center justify-between mb-1">
                      <label className="form-label mb-0">Vaccine *</label>
                      <button
                        type="button"
                        onClick={() => setUseCustomVaccine(!useCustomVaccine)}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        {useCustomVaccine ? 'Select Catalog' : '+ Custom Vaccine'}
                      </button>
                    </div>

                    {!useCustomVaccine ? (
                      <select
                        required
                        value={form.vaccine_id}
                        onChange={(e) => setForm({ ...form, vaccine_id: e.target.value })}
                        className="form-select text-xs"
                      >
                        <option value="">Select vaccine...</option>
                        {vaccines.map((v) => (
                          <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          placeholder="Vaccine Name (e.g. Rotavirus)"
                          value={customVaccineName}
                          onChange={(e) => setCustomVaccineName(e.target.value)}
                          className="form-input text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Vaccine Type (e.g. Oral Vaccine)"
                          value={customVaccineType}
                          onChange={(e) => setCustomVaccineType(e.target.value)}
                          className="form-input text-xs mt-1"
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Dose Number *</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      required
                      value={form.dose_number}
                      onChange={(e) => setForm({ ...form, dose_number: Number(e.target.value) })}
                      className="form-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Dose Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="form-select text-xs"
                    >
                      <option value="completed">Completed / Administered</option>
                      <option value="scheduled">Scheduled / Upcoming</option>
                      <option value="missed">Missed / Overdue</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scheduled Date</label>
                    <input
                      type="date"
                      required
                      value={form.scheduled_date}
                      onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                      className="form-input text-xs"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Administered Date (if completed)</label>
                  <input
                    type="date"
                    value={form.administered_date}
                    onChange={(e) => setForm({ ...form, administered_date: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks / Batch Notes</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs">
                  {submitting ? <><span className="spinner" /> Saving...</> : 'Save Vaccine Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / MARK COMPLETED MODAL */}
      {editingRecord && canManage && (
        <div className="modal-overlay" onClick={() => setEditingRecord(null)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-base font-bold text-slate-900">Update Dose Status: {editingRecord.vaccine_name}</h2>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleUpdateStatus}>
              <div className="modal-body space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-slate-900">{editingRecord.child_first_name} {editingRecord.child_last_name}</p>
                  <p className="text-blue-700">{editingRecord.vaccine_name} (Dose {editingRecord.dose_number})</p>
                  <p className="text-slate-500">Scheduled: {new Date(editingRecord.scheduled_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</p>
                </div>

                <div className="form-group">
                  <label className="form-label">Update Status *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="form-select text-xs"
                  >
                    <option value="completed">Completed / Administered</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="missed">Missed / Overdue</option>
                  </select>
                </div>

                {editStatus === 'completed' && (
                  <div className="form-group">
                    <label className="form-label">Administered Date *</label>
                    <input
                      type="date"
                      required
                      value={editAdminDate}
                      onChange={(e) => setEditAdminDate(e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Remarks / Administration Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Dose 1 given at Health Center"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditingRecord(null)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs">
                  {submitting ? 'Saving...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MISSED IMMUNIZATION NOTICE LETTER MODAL */}
      {selectedLetterRecord && (
        <div className="modal-overlay" onClick={() => setSelectedLetterRecord(null)}>
          <div className="modal-content max-w-2xl bg-white text-slate-900 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                <h2 className="text-base font-bold text-slate-900">Official Missed Immunization Notice Letter</h2>
              </div>
              <button onClick={() => setSelectedLetterRecord(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="modal-body p-6 space-y-4" id="printable-letter">
              {/* HEADER WITH LOGO */}
              <div className="flex items-center justify-between border-b-2 border-blue-900 pb-4">
                <img src="/camagong-logo.png" alt="Barangay Camagong Seal" className="w-16 h-16 object-contain flex-shrink-0" />
                <div className="text-center font-sans">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Republic of the Philippines</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Province of Agusan Del Norte · Municipality of Nasipit</p>
                  <h3 className="text-sm font-black text-blue-950 uppercase tracking-wide mt-0.5">BARANGAY CAMAGONG HEALTH CENTER</h3>
                  <p className="text-[10px] text-slate-500 italic">Official Child Immunization & Preventive Health Care Office</p>
                </div>
                <div className="w-16 flex-shrink-0" />
              </div>

              <div className="text-right text-xs font-sans text-slate-600">
                Date: <strong>{new Date().toLocaleDateString('en-PH', { dateStyle: 'full' })}</strong>
              </div>

              <div className="text-xs font-sans space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p><strong>TO:</strong> Parent / Guardian of <span className="text-blue-900 font-bold">{selectedLetterRecord.child_first_name} {selectedLetterRecord.child_last_name}</span></p>
                <p><strong>ADDRESS:</strong> {selectedLetterRecord.barangay_name}, Barangay Camagong, Nasipit, Agusan Del Norte</p>
                <p><strong>SUBJECT:</strong> <span className="text-red-700 font-bold underline">URGENT NOTICE OF MISSED CHILD IMMUNIZATION SCHEDULE</span></p>
              </div>

              <div className="text-xs leading-relaxed space-y-3 font-sans text-slate-800">
                <p>Dear Parent / Guardian,</p>
                <p>
                  This official notice is issued by the Barangay Camagong Health Center to inform you that your child,{' '}
                  <strong className="text-blue-900">{selectedLetterRecord.child_first_name} {selectedLetterRecord.child_last_name}</strong>, missed their scheduled vaccination dose for{' '}
                  <strong className="text-red-700">{selectedLetterRecord.vaccine_name} (Dose #{selectedLetterRecord.dose_number})</strong> scheduled on{' '}
                  <strong>{new Date(selectedLetterRecord.scheduled_date).toLocaleDateString('en-PH', { dateStyle: 'full' })}</strong>.
                </p>
                <p>
                  Childhood immunizations are essential to protect infants and young children against serious, life-threatening vaccine-preventable diseases such as Measles, Polio, Diphtheria, Pertussis, and Hepatitis B.
                </p>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                  <p>📌 <strong>Action Requested:</strong> Please bring your child to the Barangay Camagong Health Center as soon as possible for catch-up administration of their missed dose.</p>
                  <p className="text-[11px] text-amber-800">Health Center Clinic Hours: <strong>Monday to Friday, 8:00 AM – 5:00 PM</strong>.</p>
                </div>
                <p>
                  If your child has already received this dose at a private clinic or hospital, please present the vaccination card to your assigned Barangay Health Worker (BHW) so we can update our central health registry.
                </p>
              </div>

              <div className="pt-6 font-sans text-xs flex justify-between items-end border-t border-slate-200 mt-6">
                <div>
                  <p className="text-[11px] text-slate-500">Prepared & Approved By:</p>
                  <p className="font-bold text-blue-950 mt-4 underline">BARANGAY CAMAGONG HEALTH OFFICE</p>
                  <p className="text-[10px] text-slate-500">Nasipit, Agusan Del Norte</p>
                </div>
                <div className="text-center border-t border-slate-400 px-6 pt-1">
                  <p className="text-[10px] text-slate-500">Official Stamp & Signature</p>
                </div>
              </div>
            </div>

            <div className="modal-footer flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={() => handleSendNotice(selectedLetterRecord.id)}
                disabled={sendingNotice}
                className="btn-success text-xs flex items-center gap-1.5"
              >
                <Mail className="w-4 h-4" />
                {sendingNotice ? 'Sending Notice...' : 'Send In-App Notification to Parent'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF Letter
                </button>
                <button type="button" onClick={() => setSelectedLetterRecord(null)} className="btn-secondary text-xs">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vaccinations;
