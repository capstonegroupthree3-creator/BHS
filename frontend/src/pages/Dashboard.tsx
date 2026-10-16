import React, { useEffect, useState } from 'react';
import {
  Baby, HeartPulse, Syringe, AlertTriangle, Users,
  Activity, TrendingUp, ShieldAlert, CheckCircle2,
  Zap, RefreshCcw, Calendar, Sparkles, MapPin,
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import ChildGrowthCalculatorModal from '../components/ChildGrowthCalculatorModal';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface KPIs {
  total_children: number;
  total_pregnant: number;
  total_vaccines: number;
  fully_immunized: number;
  missed_vaccinations: number;
  teenage_pregnancies: number;
  high_risk_pregnancies: number;
  malnutrition_cases: number;
  obesity_cases: number;
}

interface Program {
  id: number;
  title: string;
  description: string;
  category: string;
  proposed_date: string;
  location: string;
  status: string;
}

interface ChartData {
  riskDistribution: { risk_status: string; count: number }[];
  bmiDistribution: { nutrition_status: string; count: number }[];
  vaccineCoverage: { vaccine_name: string; completed_doses: number; missed_doses: number; total_doses: number }[];
  teenageTrends: { year: number; count: number }[];
  diseaseTrends: { disease_name: string; month_label: string; cases: number }[];
}

interface PriorityItem {
  id: number;
  name: string;
  type: string;
  priority_level: string;
  color: string;
  priority_score: number;
  nutrition_status?: string;
  risk_status?: string;
}

const riskColors: Record<string, string> = {
  Low: '#16a34a', Medium: '#ca8a04', High: '#ea580c', Critical: '#dc2626',
};

const bmiColors: Record<string, string> = {
  'Severe Wasting': '#dc2626',
  'Wasting': '#ea580c',
  'Normal': '#16a34a',
  'Overweight': '#ca8a04',
  'Obese': '#d946ef',
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [priority, setPriority] = useState<PriorityItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, priorityRes, progRes] = await Promise.all([
        api.get('/reports/summary-stats'),
        user?.role !== 'parent' ? api.get('/ai/priority-list') : Promise.resolve({ data: { ranked: [] } }),
        api.get('/programs'),
      ]);
      setKpis(statsRes.data.kpis);
      setCharts(statsRes.data.charts);
      setPriority(priorityRes.data.ranked?.slice(0, 5) ?? []);
      setPrograms(progRes.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Chart Options ──

  const riskPieOptions: ApexOptions = {
    chart: { type: 'donut', toolbar: { show: false }, animations: { enabled: true } },
    labels: charts?.riskDistribution.map(d => d.risk_status) ?? [],
    colors: charts?.riskDistribution.map(d => riskColors[d.risk_status] ?? '#94a3b8') ?? [],
    legend: { position: 'bottom', fontSize: '12px' },
    plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total' } } } } },
    dataLabels: { enabled: false },
    stroke: { width: 2 },
    tooltip: { y: { formatter: (v: number) => `${v} cases` } },
  };

  const bmiPieOptions: ApexOptions = {
    chart: { type: 'donut', toolbar: { show: false } },
    labels: charts?.bmiDistribution.map(d => d.nutrition_status) ?? [],
    colors: charts?.bmiDistribution.map(d => bmiColors[d.nutrition_status] ?? '#94a3b8') ?? [],
    legend: { position: 'bottom', fontSize: '12px' },
    plotOptions: { pie: { donut: { size: '65%' } } },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v} children` } },
  };

  // Disease trends line chart
  const dengueHistory = charts?.diseaseTrends
    .filter(d => d.disease_name === 'Dengue')
    .map(d => ({ x: d.month_label, y: d.cases })) ?? [];

  const measlesHistory = charts?.diseaseTrends
    .filter(d => d.disease_name === 'Measles')
    .map(d => ({ x: d.month_label, y: d.cases })) ?? [];

  // Get unique months across diseases
  const allMonths = Array.from(new Set([
    ...dengueHistory.map(d => d.x),
    ...measlesHistory.map(d => d.x),
  ]));

  const diseaseLineOptions: ApexOptions = {
    chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true } },
    stroke: { width: 2.5, curve: 'smooth' },
    markers: { size: 4, hover: { size: 7 } },
    xaxis: { categories: allMonths, labels: { rotate: -45, style: { fontSize: '10px' } } },
    yaxis: { title: { text: 'Cases' }, min: 0 },
    colors: ['#ef4444', '#f97316'],
    grid: { borderColor: '#f1f5f9' },
    legend: { position: 'top' },
    tooltip: { shared: true, intersect: false },
  };

  const diseaseSeries = [
    { name: 'Dengue', data: allMonths.map(m => dengueHistory.find(d => d.x === m)?.y ?? 0) },
    { name: 'Measles', data: allMonths.map(m => measlesHistory.find(d => d.x === m)?.y ?? 0) },
  ];

  // Vaccination coverage bar chart
  const vaccBarOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, stacked: false },
    plotOptions: { bar: { horizontal: false, borderRadius: 4, columnWidth: '55%' } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: charts?.vaccineCoverage.map(v => v.vaccine_name) ?? [],
      labels: { style: { fontSize: '11px' } },
    },
    yaxis: { title: { text: 'Doses' } },
    colors: ['#22c55e', '#ef4444'],
    legend: { position: 'top' },
    grid: { borderColor: '#f1f5f9' },
    tooltip: { shared: true, intersect: false },
  };

  const vaccBarSeries = [
    { name: 'Completed', data: charts?.vaccineCoverage.map(v => v.completed_doses) ?? [] },
    { name: 'Missed', data: charts?.vaccineCoverage.map(v => v.missed_doses) ?? [] },
  ];

  // Teenage pregnancy by year line
  const teenLineOptions: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, zoom: { enabled: false } },
    stroke: { width: 2.5, curve: 'smooth' },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0, stops: [0, 90, 100] } },
    xaxis: { categories: charts?.teenageTrends.map(t => t.year.toString()) ?? [] },
    yaxis: { min: 0, title: { text: 'Teen Pregnancies' } },
    colors: ['#a855f7'],
    grid: { borderColor: '#f1f5f9' },
    markers: { size: 5 },
  };

  const teenLineSeries = [{ name: 'Teenage Pregnancies', data: charts?.teenageTrends.map(t => t.count) ?? [] }];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <span className="spinner w-8 h-8 border-3 text-blue-600" />
          <p className="text-sm text-slate-500">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">
            Health analytics as of{' '}
            <span className="font-medium text-slate-700">
              {lastRefresh.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsGrowthModalOpen(true)} className="btn-primary btn-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Assess Child Growth & BMI
          </button>
          <button onClick={fetchData} className="btn-secondary btn-sm">
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ACTIVE BARANGAY HEALTH EVENTS BANNER */}
      {programs.filter(p => p.status === 'approved').length > 0 && (
        <div className="card bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-300" />
              <h3 className="text-sm font-bold tracking-wide">Approved Barangay Health Programs & Community Events</h3>
            </div>
            <span className="bg-white/10 backdrop-blur text-blue-200 text-xs px-2.5 py-0.5 rounded-full border border-white/20">
              {programs.filter(p => p.status === 'approved').length} Active
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {programs.filter(p => p.status === 'approved').slice(0, 2).map(prog => (
              <div key={prog.id} className="bg-white/10 backdrop-blur rounded-xl p-3.5 border border-white/15">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-blue-200 uppercase">{prog.category}</span>
                  <span className="text-xs text-blue-300 flex items-center gap-1 font-medium">
                    <Calendar className="w-3 h-3" />
                    {new Date(prog.proposed_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                  </span>
                </div>
                <p className="text-sm font-bold text-white mt-1">{prog.title}</p>
                <p className="text-xs text-blue-100/90 mt-0.5 line-clamp-1">{prog.description}</p>
                <p className="text-[11px] text-blue-300 mt-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {prog.location}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatCard title="Total Children" value={kpis?.total_children ?? 0} icon={Baby} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="Pregnant Women" value={kpis?.total_pregnant ?? 0} icon={HeartPulse} iconBg="bg-purple-100" iconColor="text-purple-600" />
        <StatCard title="Fully Immunized" value={kpis?.fully_immunized ?? 0} icon={CheckCircle2} iconBg="bg-green-100" iconColor="text-green-600" />
        <StatCard title="Missed Vaccines" value={kpis?.missed_vaccinations ?? 0} icon={Syringe} iconBg="bg-orange-100" iconColor="text-orange-500" trend="up" trendLabel="Needs attention" />
        <StatCard title="High-Risk Maternal" value={kpis?.high_risk_pregnancies ?? 0} icon={ShieldAlert} iconBg="bg-red-100" iconColor="text-red-600" trend="up" trendLabel="Require action" />
        <StatCard title="Teenage Pregnancies" value={kpis?.teenage_pregnancies ?? 0} icon={AlertTriangle} iconBg="bg-amber-100" iconColor="text-amber-600" />
        <StatCard title="Malnutrition Cases" value={kpis?.malnutrition_cases ?? 0} icon={Activity} iconBg="bg-rose-100" iconColor="text-rose-600" trend="up" trendLabel="Critical priority" />
        <StatCard title="Obesity Cases" value={kpis?.obesity_cases ?? 0} icon={TrendingUp} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
        <StatCard title="Registered Vaccines" value={kpis?.total_vaccines ?? 0} icon={Zap} iconBg="bg-teal-100" iconColor="text-teal-600" />
        {user?.role !== 'parent' && (
          <StatCard title="Total Personnel" value="2" icon={Users} iconBg="bg-slate-100" iconColor="text-slate-600" />
        )}
      </div>

      {/* CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Disease Trends Line Chart */}
        <div className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Disease Case Trends</h3>
              <p className="text-xs text-slate-500 mt-0.5">Monthly distribution of reported cases</p>
            </div>
            <span className="badge badge-blue">AI Tracked</span>
          </div>
          <div className="card-body pt-2">
            {allMonths.length > 0 ? (
              <ReactApexChart options={diseaseLineOptions} series={diseaseSeries} type="line" height={260} />
            ) : (
              <div className="empty-state h-48">
                <p className="empty-state-title">No disease case data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Risk Distribution Donut */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Maternal Risk Levels</h3>
              <p className="text-xs text-slate-500 mt-0.5">AI-classified pregnancy risk</p>
            </div>
          </div>
          <div className="card-body pt-2">
            {(charts?.riskDistribution?.length ?? 0) > 0 ? (
              <ReactApexChart
                options={riskPieOptions}
                series={charts?.riskDistribution.map(d => d.count) ?? []}
                type="donut"
                height={250}
              />
            ) : (
              <div className="empty-state h-48"><p className="empty-state-title">No risk data</p></div>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Vaccination Coverage Bar */}
        <div className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Vaccination Coverage</h3>
              <p className="text-xs text-slate-500 mt-0.5">Completed vs. missed doses per vaccine</p>
            </div>
          </div>
          <div className="card-body pt-2">
            {(charts?.vaccineCoverage?.length ?? 0) > 0 ? (
              <ReactApexChart options={vaccBarOptions} series={vaccBarSeries} type="bar" height={260} />
            ) : (
              <div className="empty-state h-48"><p className="empty-state-title">No vaccination data</p></div>
            )}
          </div>
        </div>

        {/* BMI Distribution Donut */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Child Nutrition Status</h3>
              <p className="text-xs text-slate-500 mt-0.5">BMI-based classification</p>
            </div>
          </div>
          <div className="card-body pt-2">
            {(charts?.bmiDistribution?.length ?? 0) > 0 ? (
              <ReactApexChart
                options={bmiPieOptions}
                series={charts?.bmiDistribution.map(d => d.count) ?? []}
                type="donut"
                height={250}
              />
            ) : (
              <div className="empty-state h-48"><p className="empty-state-title">No BMI data</p></div>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teenage Pregnancy Trend Area */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Teenage Pregnancies (by Year)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Annual cases for mothers under 20</p>
            </div>
          </div>
          <div className="card-body pt-2">
            {(charts?.teenageTrends?.length ?? 0) > 0 ? (
              <ReactApexChart options={teenLineOptions} series={teenLineSeries} type="area" height={220} />
            ) : (
              <div className="empty-state h-48"><p className="empty-state-title">No teenage pregnancy records</p></div>
            )}
          </div>
        </div>

        {/* AI Priority List */}
        {user?.role !== 'parent' && (
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="text-base font-semibold text-slate-800">AI Priority List</h3>
                <p className="text-xs text-slate-500 mt-0.5">Top 5 citizens requiring urgent attention</p>
              </div>
              <span className="badge badge-red">AI Ranked</span>
            </div>
            <div className="card-body p-0">
              {priority.length === 0 ? (
                <div className="empty-state py-8"><p className="empty-state-title">No high-priority cases</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {priority.map((item, idx) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                        idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-amber-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{item.type} · Score: {item.priority_score}</p>
                      </div>
                      <RiskBadge status={item.priority_level} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Child Growth & Multidimensional BMI Calculator Modal */}
      <ChildGrowthCalculatorModal
        isOpen={isGrowthModalOpen}
        onClose={() => setIsGrowthModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
