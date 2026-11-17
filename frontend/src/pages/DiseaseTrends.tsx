import React, { useEffect, useState } from 'react';
import { RefreshCcw, AlertTriangle, Download, TrendingUp, Activity, DatabaseZap } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../lib/api';
import { exportToExcel } from '../lib/excelExport';

interface SeriesItem {
  name: string;
  data: number[];
}

interface CombinedTrendData {
  diseases: string[];
  categories: string[];
  series: SeriesItem[];
}

const DiseaseTrends: React.FC = () => {
  const [data, setData] = useState<CombinedTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const fetchTrends = async () => {
    setLoading(true);
    setDbError(false);
    try {
      const res = await api.get('/ai/combined-trends');
      if (res.data && Array.isArray(res.data.series)) {
        setData(res.data);
      } else {
        setData({ diseases: [], categories: [], series: [] });
      }
    } catch (err) {
      console.error('Disease trend fetch error:', err);
      setDbError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrends(); }, []);

  const hasData = data && data.series.length > 0;

  const chartOptions: ApexOptions = {
    chart: {
      type: 'line',
      toolbar: { show: true, tools: { download: true, zoom: true } },
      zoom: { enabled: true },
      fontFamily: 'Inter, sans-serif',
    },
    stroke: { width: 3, curve: 'smooth' },
    markers: { size: 4, hover: { size: 7 } },
    xaxis: {
      categories: data?.categories || [],
      labels: { rotate: -30, style: { fontSize: '11px', fontWeight: 500 } },
    },
    yaxis: {
      title: { text: 'Recorded / Projected Cases', style: { fontSize: '12px', fontWeight: 600 } },
      min: 0,
      forceNiceScale: true,
    },
    colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
    grid: { borderColor: '#f1f5f9' },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'center',
      fontSize: '12px',
      fontWeight: 600,
      markers: { size: 5 },
    },
    annotations: {
      xaxis: data?.categories[5] ? [
        {
          x: data.categories[5],
          borderColor: '#94a3b8',
          label: {
            text: 'AI 3-Month Predictive Forecast →',
            style: { background: '#1e293b', color: '#ffffff', fontSize: '10px', padding: { left: 4, right: 4, top: 4, bottom: 4 } },
          },
        },
      ] : [],
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (v: number) => `${v} case(s)` },
    },
    noData: {
      text: 'No disease cases recorded yet',
      align: 'center',
      verticalAlign: 'middle',
      style: { fontSize: '14px', color: '#94a3b8' },
    },
  };

  const handleDownloadExcel = () => {
    if (!data || !hasData) return;
    const exportRows: Record<string, string | number>[] = [];
    data.categories.forEach((cat, idx) => {
      const row: Record<string, string | number> = { 'Period / Month': cat };
      data.series.forEach(s => { row[s.name] = s.data[idx] ?? 0; });
      exportRows.push(row);
    });
    exportToExcel(exportRows, 'Barangay_Camagong_Combined_Disease_Trends');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Epidemiological Disease Trends & AI Forecasting</h1>
          <p className="page-subtitle">
            Unified multi-disease monitoring auto-detected from recorded disease cases & senior citizen registries
          </p>
        </div>
        <div className="flex gap-2">
          {hasData && (
            <button onClick={handleDownloadExcel} className="btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> Download Excel Report
            </button>
          )}
          <button onClick={fetchTrends} className="btn-secondary btn-sm">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh AI Analysis
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><span className="spinner text-blue-600 w-8 h-8" /></div>

      ) : dbError ? (
        /* DB offline / API error */
        <div className="card p-10 text-center space-y-3">
          <DatabaseZap className="w-12 h-12 mx-auto text-slate-300" />
          <p className="text-slate-700 font-semibold">Database Unavailable</p>
          <p className="text-xs text-slate-500">
            The backend server or MySQL database is not reachable. Please ensure XAMPP MySQL is running and the backend is started, then refresh.
          </p>
          <button onClick={fetchTrends} className="btn-secondary btn-sm mx-auto">
            <RefreshCcw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>

      ) : !hasData ? (
        /* Connected but no disease cases recorded yet */
        <div className="card p-10 text-center space-y-3">
          <TrendingUp className="w-12 h-12 mx-auto text-slate-300" />
          <p className="text-slate-700 font-semibold">No Disease Cases Recorded Yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            The chart will automatically populate once disease cases are logged under <strong>Senior Citizens</strong> or the <strong>Disease Cases</strong> registry.
            Once cases exist, the AI will generate a 3-month predictive forecast.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button onClick={fetchTrends} className="btn-secondary btn-sm">
              <RefreshCcw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

      ) : (
        /* Has data — render chart */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* COMBINED MULTI-LINE GRAPH */}
          <div className="card xl:col-span-3">
            <div className="card-header flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Barangay Camagong Multi-Disease Trend Overview</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracking {data.diseases.length} disease categor{data.diseases.length === 1 ? 'y' : 'ies'} · 6 months historical + 3-month AI forecast
                </p>
              </div>
              <span className="badge badge-blue">{data.diseases.length} Disease{data.diseases.length !== 1 ? 's' : ''} Tracked</span>
            </div>
            <div className="card-body pt-4">
              <ReactApexChart options={chartOptions} series={data.series} type="line" height={380} />
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-header bg-slate-900 text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Recorded Diseases</h4>
              </div>
              <div className="card-body p-3 divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {data.series.map((s) => {
                  const currentVal = s.data[5] ?? 0;
                  const forecastVal = s.data[s.data.length - 1] ?? 0;
                  const isRising = forecastVal > currentVal;
                  const isZero = s.data.slice(0, 6).every(v => v === 0);
                  return (
                    <div key={s.name} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{s.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {isZero
                            ? 'No recent cases recorded'
                            : <>Current: <strong>{currentVal}</strong> · Forecast: <strong>{forecastVal}</strong></>}
                        </p>
                      </div>
                      <span className={`badge text-[10px] ${isZero ? 'badge-blue' : isRising ? 'badge-amber' : 'badge-green'}`}>
                        {isZero ? '— No data' : isRising ? '↗ Rising' : '→ Stable'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="alert alert-warning text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                AI Health Advisory
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Only diseases with recorded cases in the database are shown. AI forecast is based on actual data — no fabricated projections are displayed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiseaseTrends;
