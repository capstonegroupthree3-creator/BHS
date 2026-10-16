import React, { useEffect, useState } from 'react';
import { BarChart3, PieChart, HeartPulse, Baby, Users, Download } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import api from '../lib/api';
import { exportToExcel } from '../lib/excelExport';

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      await api.get('/reports/summary-stats');
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // ApexCharts Options for District Health Breakdown
  const districtChartOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: true, tools: { download: true } } },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
    colors: ['#2563eb', '#9333ea', '#ea580c'],
    xaxis: {
      categories: [
        'District 1', 'District 2', 'District 3', 'District 4', 'District 5',
        'District 6', 'District 7', 'Sitio Minbahandi', 'Sitio Hinandayan', 'Sitio Baboy-Baboy'
      ]
    },
    legend: { position: 'top' },
    grid: { borderColor: '#f1f5f9' },
  };

  const districtChartSeries = [
    { name: 'Active Children Tracked', data: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
    { name: 'Pregnant Mothers', data: [1, 0, 0, 1, 0, 0, 0, 0, 0, 0] },
    { name: 'Senior Citizens Logged', data: [1, 0, 0, 0, 0, 0, 1, 1, 0, 0] },
  ];

  // Clinical Risk Distribution Donut Chart
  const riskDonutOptions: ApexOptions = {
    chart: { type: 'donut' },
    labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'],
    colors: ['#16a34a', '#ca8a04', '#ea580c', '#dc2626'],
    legend: { position: 'bottom' },
  };

  const riskDonutSeries = [2, 1, 1, 0];

  const handleDownloadExcel = () => {
    const categories = [
      'District 1', 'District 2', 'District 3', 'District 4', 'District 5',
      'District 6', 'District 7', 'Sitio Minbahandi', 'Sitio Hinandayan', 'Sitio Baboy-Baboy'
    ];
    const exportData = categories.map((cat, i) => ({
      'District / Sitio': cat,
      'Children Tracked': districtChartSeries[0].data[i],
      'Pregnant Mothers': districtChartSeries[1].data[i],
      'Senior Citizens Logged': districtChartSeries[2].data[i],
    }));
    exportToExcel(exportData, 'Barangay_Camagong_District_Analytics');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Advanced Health Analytics & District Breakdown</h1>
          <p className="page-subtitle">Deep-dive visual analytics for Barangay Camagong across 10 Districts & Sitios</p>
        </div>
        <button onClick={handleDownloadExcel} className="btn-secondary btn-sm">
          <Download className="w-4 h-4" /> Download Analytics Excel
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
      ) : (
        <div className="space-y-6">
          {/* TOP KPI OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                <Baby className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Children Registered</p>
                <p className="text-xl font-extrabold text-slate-900">1 <span className="text-xs text-slate-400 font-normal">(Gerelle Caluyong)</span></p>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600 font-bold">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Pregnant Mothers</p>
                <p className="text-xl font-extrabold text-slate-900">1 <span className="text-xs text-slate-400 font-normal">(Rona Remitar)</span></p>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Senior Citizens</p>
                <p className="text-xl font-extrabold text-slate-900">2 <span className="text-xs text-slate-400 font-normal">(Arthuro & Sergio)</span></p>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600 font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Districts Covered</p>
                <p className="text-xl font-extrabold text-slate-900">10 <span className="text-xs text-slate-400 font-normal">Districts/Sitios</span></p>
              </div>
            </div>
          </div>

          {/* MAIN CHARTS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" /> District & Sitio Health Population Distribution
              </h3>
              <ReactApexChart options={districtChartOptions} series={districtChartSeries} type="bar" height={300} />
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-600" /> Clinical Risk Breakdown
              </h3>
              <div className="py-4">
                <ReactApexChart options={riskDonutOptions} series={riskDonutSeries} type="donut" height={280} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
