import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import api from '../lib/api';
import RiskBadge from '../components/RiskBadge';

interface PriorityItem {
  id: number;
  name: string;
  type: string;
  priority_score: number;
  priority_level: string;
  color: string;
  nutrition_status?: string;
  missed_vaccines?: number;
  risk_status?: string;
  age?: number;
}

const priorityBgColors: Record<string, string> = {
  Critical: 'bg-red-50 border-red-200',
  High: 'bg-orange-50 border-orange-200',
  Medium: 'bg-amber-50 border-amber-200',
  Low: 'bg-green-50 border-green-200',
};

const PriorityList: React.FC = () => {
  const [ranked, setRanked] = useState<PriorityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiCalculated, setAiCalculated] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/priority-list');
      setRanked(res.data.ranked);
      setAiCalculated(res.data.ai_calculated);
    } catch (err) {
      console.error('Priority list fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const criticalCount = ranked.filter(r => r.priority_level === 'Critical').length;
  const highCount = ranked.filter(r => r.priority_level === 'High').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Priority List</h1>
          <p className="page-subtitle">Automatically ranked citizens requiring immediate health intervention</p>
        </div>
        <button onClick={fetchData} className="btn-secondary btn-sm">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary banners */}
      {criticalCount > 0 && (
        <div className="alert alert-error">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{criticalCount} Critical Case{criticalCount !== 1 ? 's' : ''} Detected</p>
            <p className="text-sm">These citizens require immediate medical referral. Do not delay intervention.</p>
          </div>
        </div>
      )}

      {highCount > 0 && criticalCount === 0 && (
        <div className="alert alert-warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{highCount} High-priority case{highCount !== 1 ? 's' : ''} detected. Schedule home visits or referrals.</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {aiCalculated ? (
          <span className="badge badge-blue">AI Python Service</span>
        ) : (
          <span className="badge badge-gray">Local Fallback Algorithm</span>
        )}
        <span className="text-xs text-slate-500">{ranked.length} total citizens evaluated</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><span className="spinner text-blue-600 w-8 h-8" /></div>
      ) : ranked.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle className="empty-state-icon text-slate-300" />
          <p className="empty-state-title">No citizens in the priority list</p>
          <p className="empty-state-desc">Register citizens and record health data to enable AI ranking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((item, idx) => (
            <div
              key={`${item.type}-${item.id}`}
              className={`card border flex items-center gap-4 px-5 py-4 ${priorityBgColors[item.priority_level] ?? ''}`}
            >
              {/* Rank Badge */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                item.priority_level === 'Critical' ? 'bg-red-500' :
                item.priority_level === 'High' ? 'bg-orange-500' :
                item.priority_level === 'Medium' ? 'bg-amber-500' :
                'bg-green-500'
              }`}>
                #{idx + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <span className={`badge ${item.type === 'child' ? 'badge-blue' : 'badge-purple'}`}>
                    {item.type === 'child' ? 'Child' : 'Pregnant Mother'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 mt-1">
                  {item.type === 'child' && (
                    <>
                      {item.nutrition_status && (
                        <span className="text-xs text-slate-600">
                          Nutrition: <span className="font-medium">{item.nutrition_status}</span>
                        </span>
                      )}
                      {item.missed_vaccines !== undefined && (
                        <span className="text-xs text-slate-600">
                          Missed Vaccines: <span className={`font-medium ${item.missed_vaccines > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {item.missed_vaccines}
                          </span>
                        </span>
                      )}
                    </>
                  )}
                  {item.type === 'pregnant' && (
                    <>
                      {item.risk_status && (
                        <span className="text-xs text-slate-600">
                          Risk: <span className="font-medium">{item.risk_status}</span>
                        </span>
                      )}
                      {item.age && item.age < 20 && (
                        <span className="badge badge-orange">Teenage Pregnancy</span>
                      )}
                      {item.age && item.age > 35 && (
                        <span className="badge badge-yellow">Advanced Maternal Age</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="text-center flex-shrink-0">
                <p className="text-2xl font-bold text-slate-700">{item.priority_score}</p>
                <p className="text-xs text-slate-500">Score</p>
              </div>

              {/* Risk Badge */}
              <RiskBadge status={item.priority_level} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PriorityList;
