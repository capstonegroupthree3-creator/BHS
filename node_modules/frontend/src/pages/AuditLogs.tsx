import React, { useEffect, useState } from 'react';
import { Shield, Clock } from 'lucide-react';
import api from '../lib/api';

interface AuditLog {
  id: number;
  username: string;
  role: string;
  action: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/audit');
        setLogs(res.data);
      } catch (err) {
        console.error('Audit log fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const actionColor = (action: string) => {
    if (action.includes('FAILED') || action.includes('DELETE')) return 'badge-red';
    if (action.includes('CREATE') || action.includes('REGISTER')) return 'badge-green';
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'badge-blue';
    if (action.includes('LOGIN')) return 'badge-purple';
    if (action.includes('EXPORT')) return 'badge-yellow';
    return 'badge-gray';
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Security audit trail compliant with RA 10173 (Data Privacy Act)</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
            RA 10173 Compliant
          </span>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-7 h-7" /></div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <Clock className="empty-state-icon" />
              <p className="empty-state-title">No audit logs yet</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'medium' })}
                    </td>
                    <td className="font-medium text-slate-700">{log.username ?? 'System'}</td>
                    <td>
                      {log.role && (
                        <span className="badge badge-blue text-xs">{log.role}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${actionColor(log.action)}`}>{log.action}</span>
                    </td>
                    <td className="text-xs text-slate-600 max-w-xs truncate">{log.details}</td>
                    <td className="font-mono text-xs text-slate-400">{log.ip_address ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
