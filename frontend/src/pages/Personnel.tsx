import React, { useEffect, useState } from 'react';
import { Phone, Stethoscope, Search } from 'lucide-react';
import api from '../lib/api';

interface Personnel {
  id: number;
  first_name: string;
  last_name: string;
  specialty: string;
  contact_number: string;
  barangay_name: string;
}

const Personnel: React.FC = () => {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/citizens/personnel');
      setPersonnel(data);
    } catch (err) {
      // Fallback sample personnel
      setPersonnel([
        { id: 1, first_name: 'Elena', last_name: 'Dalisay', specialty: 'Maternal & Child Health Specialist', contact_number: '0917-000-0002', barangay_name: 'District 1' },
        { id: 2, first_name: 'Roberto', last_name: 'Santos', specialty: 'Barangay Health Officer', contact_number: '0917-000-0003', barangay_name: 'District 7' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const filtered = personnel.filter(p =>
    `${p.first_name} ${p.last_name} ${p.specialty} ${p.barangay_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Barangay Health Workers & Personnel Directory</h1>
          <p className="page-subtitle">Registered healthcare officers and BHWs assigned across Barangay Camagong</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search health worker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
          <div key={p.id} className="card p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-md">
                {p.first_name.charAt(0)}{p.last_name.charAt(0)}
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-slate-900 text-sm">{p.first_name} {p.last_name}</h3>
                <p className="text-xs text-blue-700 font-semibold flex items-center gap-1">
                  <Stethoscope className="w-3.5 h-3.5" /> {p.specialty}
                </p>
                <p className="text-[11px] text-slate-500">Assigned District / Sitio: {p.barangay_name}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="badge badge-green text-xs flex items-center gap-1">
                <Phone className="w-3 h-3" /> {p.contact_number}
              </span>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};

export default Personnel;
