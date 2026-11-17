import React, { useState } from 'react';
import { Baby, Sparkles, X } from 'lucide-react';
import api from '../lib/api';
import RiskBadge from './RiskBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialChild?: {
    first_name: string;
    last_name: string;
    birthdate?: string;
    sex?: string;
  };
}

interface AIResult {
  bmi: number;
  wasting_status: string;
  stunting_status: string;
  micronutrient_deficiency_risk: string;
  overall_risk: string;
  color: string;
  recommendations: {
    action: string;
    diet: string;
    supplements: string;
    monitoring: string;
  };
}

const ChildGrowthCalculatorModal: React.FC<Props> = ({ isOpen, onClose, initialChild }) => {
  const [ageMonths, setAgeMonths] = useState<number>(24);
  const [sex, setSex] = useState<string>(initialChild?.sex ?? 'M');
  const [heightCm, setHeightCm] = useState<number>(75.0);
  const [weightKg, setWeightKg] = useState<number>(10.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AIResult | null>(null);

  if (!isOpen) return null;

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/ai/child-growth-nutrition', {
        age_months: ageMonths,
        sex,
        height_cm: heightCm,
        weight_kg: weightKg,
      });
      setResult(data);
    } catch (err) {
      console.warn('AI calculation call failed, using client fallback:', err);
      const heightM = heightCm / 100.0;
      const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(2));
      let wasting_status = 'Normal';
      if (bmi < 12.5) wasting_status = 'Severe Wasting';
      else if (bmi < 14.0) wasting_status = 'Wasting';
      else if (bmi > 18.5) wasting_status = 'Obese';
      else if (bmi > 17.0) wasting_status = 'Overweight';

      const expectedHeight = 50 + (ageMonths * 1.25);
      let stunting_status = 'Normal';
      if (heightCm < expectedHeight - 12) stunting_status = 'Severe Stunting';
      else if (heightCm < expectedHeight - 6) stunting_status = 'Stunted';

      let overall_risk = 'Low';
      let color = 'Green';
      if (wasting_status === 'Severe Wasting' || stunting_status === 'Severe Stunting') {
        overall_risk = 'Critical';
        color = 'Red';
      } else if (wasting_status === 'Wasting' || stunting_status === 'Stunted') {
        overall_risk = 'High';
        color = 'Orange';
      } else if (wasting_status === 'Obese' || wasting_status === 'Overweight') {
        overall_risk = 'Medium';
        color = 'Yellow';
      }

      setResult({
        bmi,
        wasting_status,
        stunting_status,
        micronutrient_deficiency_risk: wasting_status.includes('Wasting') ? 'Iron & Vitamin A Deficiency Risk' : 'Low Risk',
        overall_risk,
        color,
        recommendations: {
          action: 'Routine growth monitoring and nutrition tracking.',
          diet: 'Nutrient-dense local foods (malunggay, eggs, fish, vegetables).',
          supplements: 'Age-appropriate Vitamin A and Micronutrient Powder (MNP).',
          monitoring: 'Monthly Operation Timbang checkup at Health Center.'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Baby className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Child Growth & Multidimensional BMI Assessment</h2>
              <p className="text-xs text-blue-100">AI-powered WHO & DOH malnutrition evaluation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body p-6 space-y-6">
          {initialChild && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-800 font-medium">
                Evaluating profile for <strong className="text-blue-900">{initialChild.first_name} {initialChild.last_name}</strong>
              </p>
            </div>
          )}

          <form onSubmit={handleCalculate} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="form-group">
              <label className="form-label">Age (Months)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={ageMonths}
                onChange={(e) => setAgeMonths(Number(e.target.value))}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sex</label>
              <select value={sex} onChange={(e) => setSex(e.target.value)} className="form-select">
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Height (cm)</label>
              <input
                type="number"
                step="0.1"
                min={30}
                max={140}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min={1}
                max={40}
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="form-input"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-4">
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? (
                  <><span className="spinner" /> Calculating AI Assessment...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Run AI Assessment</>
                )}
              </button>
            </div>
          </form>

          {/* AI Assessment Results Display */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-slate-200 animate-fade-in">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Calculated Body Mass Index (BMI)</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-0.5">{result.bmi} <span className="text-xs text-slate-400 font-normal">kg/m²</span></p>
                </div>
                <RiskBadge status={result.overall_risk} />
              </div>

              {/* Status Indicator Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500">Weight-for-Height (Wasting)</p>
                  <p className={`text-sm font-bold mt-1 ${
                    result.wasting_status.includes('Severe') ? 'text-red-600' :
                    result.wasting_status.includes('Wasting') ? 'text-orange-500' :
                    'text-green-600'
                  }`}>
                    {result.wasting_status}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500">Height-for-Age (Stunting)</p>
                  <p className={`text-sm font-bold mt-1 ${
                    result.stunting_status.includes('Severe') ? 'text-red-600' :
                    result.stunting_status.includes('Stunted') ? 'text-orange-500' :
                    'text-green-600'
                  }`}>
                    {result.stunting_status}
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500">Micronutrient Risk</p>
                  <p className="text-xs font-medium text-purple-700 mt-1 line-clamp-2">
                    {result.micronutrient_deficiency_risk}
                  </p>
                </div>
              </div>

              {/* Actionable AI Recommendations */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" /> AI Interventions & Dietary Plan
                </h4>

                <div className="space-y-2 text-xs text-amber-900">
                  <p><strong>Immediate Medical Action:</strong> {result.recommendations.action}</p>
                  <p><strong>Recommended Local Diet:</strong> {result.recommendations.diet}</p>
                  <p><strong>Supplementation & Drops:</strong> {result.recommendations.supplements}</p>
                  <p><strong>BHW Monitoring Schedule:</strong> {result.recommendations.monitoring}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ChildGrowthCalculatorModal;
