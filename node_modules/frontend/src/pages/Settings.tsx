import React, { useState } from 'react';
import { KeyRound, UserCheck, CheckCircle2, AlertCircle, Save, Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const { user } = useAuth();
  
  // Password State
  const [passForm, setPassForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');

  // Profile State
  const [profileForm, setProfileForm] = useState({
    email: user?.email || '',
    phone: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    setPassErr('');

    if (passForm.new_password !== passForm.confirm_password) {
      setPassErr('New password and confirmation password do not match.');
      return;
    }

    if (passForm.new_password.length < 6) {
      setPassErr('New password must be at least 6 characters long.');
      return;
    }

    setPassLoading(true);
    try {
      const { data } = await api.put('/auth/change-password', {
        current_password: passForm.current_password,
        new_password: passForm.new_password,
      });
      setPassMsg(data.message);
      setPassForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setPassErr(err?.response?.data?.message || 'Failed to update password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileLoading(true);
    try {
      const { data } = await api.put('/auth/profile', profileForm);
      setProfileMsg(data.message);
    } catch (err: any) {
      alert('Failed to update profile details');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Settings & Security Center</h1>
          <p className="page-subtitle">Manage your account profile, change your login password, and configure system preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT CARD: USER SUMMARY CARD */}
        <div className="card p-6 flex flex-col items-center text-center space-y-3">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">@{user?.username}</h3>
            <span className="badge badge-blue text-xs capitalize">{user?.role?.replace('_', ' ')}</span>
          </div>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 w-full">
            Registered Health Center User · Active Account
          </p>
        </div>

        {/* RIGHT CARDS: CHANGE PASSWORD & PROFILE FORMS */}
        <div className="md:col-span-2 space-y-6">
          {/* CHANGE PASSWORD CARD */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
                <p className="text-xs text-slate-500">Update your security password regularly to protect your account</p>
              </div>
            </div>

            {passMsg && (
              <div className="alert alert-success text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{passMsg}</span>
              </div>
            )}

            {passErr && (
              <div className="alert alert-error text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passErr}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Current Password *</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    placeholder="Enter your current password"
                    value={passForm.current_password}
                    onChange={(e) => setPassForm({ ...passForm, current_password: e.target.value })}
                    className="form-input pr-10 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={passForm.new_password}
                      onChange={(e) => setPassForm({ ...passForm, new_password: e.target.value })}
                      className="form-input pr-10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-type new password"
                    value={passForm.confirm_password}
                    onChange={(e) => setPassForm({ ...passForm, confirm_password: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={passLoading} className="btn-primary text-xs">
                  {passLoading ? <><span className="spinner" /> Updating Password...</> : <><KeyRound className="w-4 h-4" /> Update Password</>}
                </button>
              </div>
            </form>
          </div>

          {/* UPDATE PROFILE DETAILS CARD */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Profile & Contact Information</h3>
                <p className="text-xs text-slate-500">Update your contact email and phone number for system notifications</p>
              </div>
            </div>

            {profileMsg && (
              <div className="alert alert-success text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{profileMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input type="text" disabled value={user?.username || ''} className="form-input text-xs bg-slate-100 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">System Role</label>
                  <input type="text" disabled value={user?.role?.toUpperCase() || ''} className="form-input text-xs bg-slate-100 cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone Number</label>
                  <input
                    type="text"
                    placeholder="0917-xxx-xxxx"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={profileLoading} className="btn-secondary text-xs">
                  {profileLoading ? <><span className="spinner" /> Saving...</> : <><Save className="w-4 h-4" /> Save Profile</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
