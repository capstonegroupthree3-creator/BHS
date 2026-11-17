import React, { useEffect, useState } from 'react';
import { Users as UsersIcon, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react';
import api from '../lib/api';

interface UserAccount {
  id: number;
  username: string;
  role: 'admin' | 'health_personnel' | 'parent';
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive' | 'pending_approval';
  created_at: string;
  first_name: string;
  last_name: string;
  barangay_name: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'inactive' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const { data } = await api.put(`/users/${id}/approve`);
      setMsg(data.message);
      fetchUsers();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to approve user');
    }
  };

  const handleReject = async (id: number) => {
    try {
      const { data } = await api.put(`/users/${id}/reject`);
      setMsg(data.message);
      fetchUsers();
    } catch (err) {
      alert('Failed to reject user');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const { data } = await api.put(`/users/${id}/status`, { status: newStatus });
      setMsg(data.message);
      fetchUsers();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const pendingList = users.filter((u) => u.status === 'pending_approval');
  const activeList = users.filter((u) => u.status === 'active');
  const inactiveList = users.filter((u) => u.status === 'inactive');

  const filteredUsers = users.filter((u) => {
    if (activeTab === 'pending' && u.status !== 'pending_approval') return false;
    if (activeTab === 'active' && u.status !== 'active') return false;
    if (activeTab === 'inactive' && u.status !== 'inactive') return false;

    if (search.trim()) {
      const term = search.toLowerCase();
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      return (
        u.username.toLowerCase().includes(term) ||
        fullName.includes(term) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        u.barangay_name.toLowerCase().includes(term)
      );
    }

    return true;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="badge badge-purple">Administrator</span>;
      case 'health_personnel':
        return <span className="badge badge-blue">Health Personnel</span>;
      case 'parent':
        return <span className="badge badge-green">Parent / Guardian</span>;
      default:
        return <span className="badge badge-gray">{role}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-green">Active</span>;
      case 'pending_approval':
        return <span className="badge badge-yellow flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" /> Pending Approval</span>;
      case 'inactive':
        return <span className="badge badge-red">Deactivated</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Account Management & Approval Center</h1>
          <p className="page-subtitle">Review public user registrations, approve accounts, and manage system permissions</p>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{msg}</p>
        </div>
      )}

      {/* PENDING APPROVAL ALERT BANNER */}
      {pendingList.length > 0 && (
        <div className="card bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Pending Registration Approvals Required</h3>
                <p className="text-xs text-amber-100">
                  {pendingList.length} new user account(s) are waiting for Administrator verification before they can log in.
                </p>
              </div>
            </div>
            <button onClick={() => setActiveTab('pending')} className="btn-secondary text-slate-900 font-bold text-xs py-2 px-4 bg-white">
              Review Pending Requests ({pendingList.length})
            </button>
          </div>
        </div>
      )}

      {/* TAB FILTERS & SEARCH BAR */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'pending' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending Approval
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px]">{pendingList.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'active' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeList.length})
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'inactive' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Deactivated ({inactiveList.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Users ({users.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* USER ACCOUNTS TABLE */}
      <div className="card">
        <div className="card-body p-0 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16"><span className="spinner text-blue-600 w-8 h-8" /></div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state py-12">
              <UsersIcon className="empty-state-icon" />
              <p className="empty-state-title">No user accounts found</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  <th>Role</th>
                  <th>District / Sitio</th>
                  <th>Contact Info</th>
                  <th>Registration Date</th>
                  <th>Status</th>
                  <th>Admin Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                      </div>
                    </td>
                    <td>{getRoleBadge(u.role)}</td>
                    <td className="text-xs text-slate-700 font-medium">{u.barangay_name}</td>
                    <td className="text-xs text-slate-600">
                      <div>{u.email || 'No email'}</div>
                      <div className="text-slate-400">{u.phone || 'No phone'}</div>
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </td>
                    <td>{getStatusBadge(u.status)}</td>
                    <td>
                      {u.status === 'pending_approval' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApprove(u.id)}
                            className="btn-success btn-sm text-xs py-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(u.id)}
                            className="btn-danger btn-sm text-xs py-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`btn-sm text-xs py-1 ${u.status === 'active' ? 'btn-secondary text-red-600' : 'btn-primary'}`}
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
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

export default Users;
