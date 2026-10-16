import React, { useEffect, useState } from 'react';
import { HeartPulse, Sparkles, AlertTriangle, Pill, X, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import RiskBadge from './RiskBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  woman: {
    id: number;
    first_name: string;
    last_name: string;
    age: number;
    pregnancy_week_start: number;
    conception_date: string;
    risk_status: string;
    barangay_name: string;
  } | null;
}

interface CarePlan {
  trimester: string;
  risk_status: string;
  is_teenage_pregnancy: boolean;
  prescribed_medications: string[];
  dietary_plan: string;
  red_flags: string[];
  recommended_visit_frequency: string;
}

const MaternalCareModal: React.FC<Props> = ({ isOpen, onClose, woman }) => {
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && woman) {
      fetchCarePlan();
    }
  }, [isOpen, woman]);

  const fetchCarePlan = async () => {
    if (!woman) return;
    setLoading(true);
    try {
      const { data } = await api.post('/ai/maternal-care-plan', {
        age: woman.age,
        gestational_week: woman.pregnancy_week_start,
        risk_status: woman.risk_status,
      });
      setCarePlan(data);
    } catch (err) {
      console.error('Fetch maternal care plan error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !woman) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">{woman.first_name} {woman.last_name} — Maternal Care Plan</h2>
              <p className="text-xs text-purple-100">{woman.age} years old · {woman.barangay_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body p-6 space-y-5">
          <div className="flex items-center justify-between bg-purple-50 p-4 rounded-xl border border-purple-100">
            <div>
              <span className="text-xs text-purple-700 font-bold uppercase tracking-wider">Gestational Stage</span>
              <p className="text-lg font-bold text-purple-900 mt-0.5">{carePlan?.trimester ?? `Week ${woman.pregnancy_week_start}`}</p>
            </div>
            <RiskBadge status={woman.risk_status} />
          </div>

          {woman.age < 20 && (
            <div className="alert alert-warning">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">
                <strong>Adolescent Pregnancy Alert:</strong> Mother is under 20 years old. Specialized adolescent OB-GYN counseling and enhanced iron fortification prescribed.
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><span className="spinner text-purple-600 w-8 h-8" /></div>
          ) : carePlan ? (
            <div className="space-y-4">
              {/* Prescribed Medications */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-3">
                  <Pill className="w-4 h-4 text-purple-600" /> Prescribed Prenatal Medications & Supplements
                </h4>
                <ul className="space-y-2">
                  {carePlan.prescribed_medications.map((med, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      <span>{med}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Dietary & Hydration Guidelines */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> AI Dietary & Lifestyle Recommendations
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">{carePlan.dietary_plan}</p>
              </div>

              {/* Red Flag Emergency Signs */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" /> Red Flag Warning Symptoms (Report to Health Center Immediately)
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-red-900">
                  {carePlan.red_flags.map((flag, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                <span>Recommended Prenatal Checkup Frequency:</span>
                <span className="font-bold text-slate-800">{carePlan.recommended_visit_frequency}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default MaternalCareModal;
