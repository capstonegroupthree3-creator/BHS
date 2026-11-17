import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Plus, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';

interface GrowthRecord {
  id: number;
  child_id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  sex: string;
  visit_date: string;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  nutrition_status: string;
  who_classification: string;
  z_score: number;
  indicator_type: string;
  age_months: number;
  recommendations: string;
  recorded_by_name: string;
}

interface Child {
  id: number;
  first_name: string;
  last_name: string;
  birthdate: string;
  sex: string;
  barangay_name: string;
}

const statusColor: Record<string, string> = {
  'Severe Wasting': 'bg-red-100 text-red-800',
  'Wasting': 'bg-orange-100 text-orange-800',
  'Severe Thinness': 'bg-red-100 text-red-800',
  'Thinness': 'bg-orange-100 text-orange-800',
  'Obese': 'bg-purple-100 text-purple-800',
  'Overweight': 'bg-yellow-100 text-yellow-800',
  'Stunted': 'bg-blue-100 text-blue-800',
  'Severe Stunting': 'bg-blue-100 text-blue-900',
  'Underweight': 'bg-orange-100 text-orange-700',
  'Severely Underweight': 'bg-red-100 text-red-900',
  'Normal': 'bg-green-100 text-green-800',
};

const NutritionAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({
    child_id: '', visit_date: new Date().toISOString().split('T')[0],
    height_cm: '', weight_kg: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [childrenRes, summaryRes] = await Promise.all([
        api.get('/citizens/children'),
        api.get('/nutrition/summary'),
      ]);
      setChildren(childrenRes.data || []);
      setSummary(summaryRes.data || {});
    } catch (err) {
      console.error('Nutrition fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChildRecords = useCallback(async (childId: string) => {
    if (!childId) return;
    try {
      const res = await api.get(`/nutrition/child/${childId}`);
      setRecords(res.data || []);
    } catch (err) {
      console.error('Fetch child nutrition error:', err);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchChildRecords(selectedChild); }, [selectedChild, fetchChildRecords]);

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
    setForm(f => ({ ...f, child_id: childId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.child_id || !form.height_cm || !form.weight_kg) return;
    setAiLoading(true);
    try {
      // Calculate age in months from birthdate
      const child = children.find(c => String(c.id) === form.child_id);
      let ageMonths = 0;
      if (child) {
        const dob = new Date(child.birthdate);
        const today = new Date();
        ageMonths = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
      }
      const bmi = parseFloat((parseFloat(form.weight_kg) / ((parseFloat(form.height_cm) / 100) ** 2)).toFixed(2));

      // Try AI service for WHO Z-score
      let zScore = null;
      let whoClass = null;
      let indicatorType = ageMonths < 60 ? 'Weight-for-height' : 'BMI-for-age';
      try {
        const aiRes = await api.post('/ai/growth-assessment', {
          age_months: ageMonths,
          sex: child?.sex || 'M',
          height_cm: parseFloat(form.height_cm),
          weight_kg: parseFloat(form.weight_kg),
          bmi,
        });
        if (aiRes.data) {
          zScore = aiRes.data.z_score;
          whoClass = aiRes.data.classification;
          indicatorType = aiRes.data.indicator_type || indicatorType;
        }
      } catch {
        // AI fallback — basic classification
        whoClass = bmi < 18.5 ? 'Thinness' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
      }

      await api.post('/nutrition', {
        child_id: parseInt(form.child_id),
        visit_date: form.visit_date,
        height_cm: parseFloat(form.height_cm),
        weight_kg: parseFloat(form.weight_kg),
        bmi,
        z_score: zScore,
        who_classification: whoClass,
        indicator_type: indicatorType,
        age_months: ageMonths,
      });

      setShowForm(false);
      setForm(f => ({ ...f, height_cm: '', weight_kg: '' }));
      await fetchChildRecords(selectedChild);
      await fetchData();
    } catch (err) {
      console.error('Submit nutrition error:', err);
    } finally {
      setAiLoading(false);
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
            <Activity className="text-teal-600" size={26} />
            {t('nutrition.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">WHO Growth Standards — Children & Adolescents</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> {t('nutrition.newAssessment')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Normal', value: summary.normal, color: 'green' },
          { label: 'Wasting', value: summary.wasting, color: 'orange' },
          { label: 'Sv. Wasting', value: summary.severe_wasting, color: 'red' },
          { label: 'Thinness', value: summary.thinness, color: 'orange' },
          { label: 'Stunted', value: summary.stunted, color: 'blue' },
          { label: 'Overweight', value: summary.overweight, color: 'yellow' },
          { label: 'Obese', value: summary.obese, color: 'purple' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3 text-center`}>
            <div className={`text-2xl font-bold text-${color}-700`}>{value ?? 0}</div>
            <div className={`text-xs text-${color}-600 mt-0.5 font-medium`}>{label}</div>
          </div>
        ))}
      </div>

      {/* New Assessment Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('nutrition.newAssessment')}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('children.title')} *</label>
              <select
                value={form.child_id}
                onChange={e => handleChildSelect(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              >
                <option value="">-- {t('common.search')} --</option>
                {children.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({c.sex === 'M' ? t('common.male') : t('common.female')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')} *</label>
              <input type="date" value={form.visit_date}
                onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('nutrition.height')} *</label>
              <input type="number" step="0.1" min="30" max="220" placeholder="e.g. 112.5"
                value={form.height_cm}
                onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('nutrition.weight')} *</label>
              <input type="number" step="0.1" min="1" max="200" placeholder="e.g. 18.5"
                value={form.weight_kg}
                onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" required />
            </div>
            <div className="lg:col-span-4 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={aiLoading}
                className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 flex items-center gap-2">
                {aiLoading ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Processing...</> : <><CheckCircle size={15} /> {t('common.save')}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Child Selector for History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-teal-600" /> {t('nutrition.history')}
        </h2>
        <div className="mb-4">
          <select value={selectedChild} onChange={e => handleChildSelect(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">
            <option value="">-- Select a child to view history --</option>
            {children.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </div>

        {records.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">{t('common.noData')}</p>
        ) : (
          <div className="space-y-3">
            {records.map(r => (
              <div key={r.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">{r.visit_date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.who_classification || r.nutrition_status] || 'bg-gray-100 text-gray-700'}`}>
                      {r.who_classification || r.nutrition_status}
                    </span>
                    {(r.who_classification?.includes('Severe') || r.who_classification?.includes('Wasting')) && (
                      <AlertTriangle size={14} className="text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>BMI: <strong>{r.bmi}</strong></span>
                    {r.z_score !== null && <span>Z: <strong>{r.z_score}</strong></span>}
                    {expandedId === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {expandedId === r.id && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-xs text-slate-500 block">{t('nutrition.height')}</span><strong>{r.height_cm} cm</strong></div>
                    <div><span className="text-xs text-slate-500 block">{t('nutrition.weight')}</span><strong>{r.weight_kg} kg</strong></div>
                    <div><span className="text-xs text-slate-500 block">{t('nutrition.bmiForAge')}</span><strong>{r.z_score ?? '—'}</strong></div>
                    <div><span className="text-xs text-slate-500 block">{t('nutrition.ageMonths')}</span><strong>{r.age_months ?? '—'}</strong></div>
                    <div className="col-span-2 md:col-span-4">
                      <span className="text-xs text-slate-500 block mb-1">{t('nutrition.recommendations')}</span>
                      <p className="text-sm text-slate-700 bg-white rounded p-2 border border-slate-200">{r.recommendations || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NutritionAnalysis;
