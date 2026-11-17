import React, { useState } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, X } from 'lucide-react';
import api from '../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const ExcelImportModal: React.FC<Props> = ({ isOpen, onClose, onImportSuccess }) => {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setMsg('');
    setErr('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          setErr('Uploaded file is empty or missing headers.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          if (values.length === headers.length) {
            const rowObj: Record<string, string> = {};
            headers.forEach((h, index) => {
              rowObj[h] = values[index];
            });
            rows.push(rowObj);
          }
        }

        setParsedRows(rows);
      } catch (parseErr) {
        setErr('Failed to parse CSV/Excel text file. Ensure it is formatted as comma-separated values.');
      }
    };

    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) {
      setErr('No valid data rows loaded to import.');
      return;
    }

    setLoading(true);
    setMsg('');
    setErr('');

    try {
      const { data } = await api.post('/citizens/import-excel', { records: parsedRows });
      setMsg(data.message);
      onImportSuccess();
      setTimeout(() => {
        onClose();
        setParsedRows([]);
        setFileName('');
      }, 2500);
    } catch (importErr: any) {
      setErr(importErr?.response?.data?.message || 'Excel data import failed.');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = () => {
    const sample = [
      { first_name: 'Gabriel', last_name: 'Manalo', birthdate: '2023-04-12', sex: 'M', height_cm: '82.5', weight_kg: '11.8', purok: '1' },
      { first_name: 'Sofia', last_name: 'Mercado', birthdate: '2022-11-05', sex: 'F', height_cm: '89.0', weight_kg: '12.4', purok: '2' },
      { first_name: 'Mateo', last_name: 'Navarro', birthdate: '2024-01-20', sex: 'M', height_cm: '74.0', weight_kg: '9.2', purok: '3' },
    ];
    setParsedRows(sample);
    setFileName('sample_health_dataset.csv');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
            <h2 className="text-base font-bold">Import Excel / CSV Health Data</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="modal-body p-5 space-y-4">
          {msg && (
            <div className="alert alert-success text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{msg}</span>
            </div>
          )}

          {err && (
            <div className="alert alert-error text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* FILE UPLOAD DROPZONE */}
          <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl p-6 text-center space-y-2">
            <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
            <div>
              <p className="text-xs font-bold text-emerald-950">Select CSV or Excel Dataset (.csv, .xlsx)</p>
              <p className="text-[11px] text-emerald-700">Supported columns: first_name, last_name, birthdate, sex, height_cm, weight_kg, district</p>
            </div>
            <div className="pt-2 flex justify-center gap-2">
              <input type="file" accept=".csv, .txt, .xlsx" onChange={handleFileUpload} className="hidden" id="excel-file-input" />
              <label htmlFor="excel-file-input" className="btn-success btn-sm text-xs cursor-pointer py-1.5 px-3">
                Browse File
              </label>
              <button type="button" onClick={loadSampleData} className="btn-secondary btn-sm text-xs py-1.5 px-3">
                Load Sample Data
              </button>
            </div>
            {fileName && <p className="text-xs font-bold text-emerald-800 pt-1">Loaded: {fileName}</p>}
          </div>

          {/* PARSED DATA PREVIEW */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                <span>Parsed Data Preview ({parsedRows.length} Rows)</span>
                <span className="badge badge-green">Ready for Database Import</span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>First Name</th>
                      <th>Last Name</th>
                      <th>DOB</th>
                      <th>Sex</th>
                      <th>Height (cm)</th>
                      <th>Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td className="font-bold">{row.first_name || row['First Name']}</td>
                        <td>{row.last_name || row['Last Name']}</td>
                        <td>{row.birthdate || row['Date of Birth']}</td>
                        <td>{row.sex || row['Sex']}</td>
                        <td>{row.height_cm || row['Height (cm)']}</td>
                        <td>{row.weight_kg || row['Weight (kg)']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer p-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button type="button" onClick={handleImportSubmit} disabled={loading || parsedRows.length === 0} className="btn-success text-xs font-bold">
            {loading ? <><span className="spinner" /> Importing Data...</> : <><FileSpreadsheet className="w-4 h-4" /> Import {parsedRows.length} Records to MySQL</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
