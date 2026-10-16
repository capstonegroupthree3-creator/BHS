import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface Barangay {
  id: number;
  name: string;
}

const formatAutoAddress = (districtName: string) => {
  if (!districtName) return '';
  if (districtName.includes('Barangay Camagong')) return districtName;
  return `${districtName}, Barangay Camagong, Nasipit, Agusan Del Norte`;
};

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState('');

  const [barangays, setBarangays] = useState<Barangay[]>([]);

  // Registration Form State
  const [regForm, setRegForm] = useState({
    role: 'parent',
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    barangay_id: 1,
  });

  const { register: registerLogin, handleSubmit: handleSubmitLogin, formState: { errors: loginErrors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    fetchBarangays();
  }, []);

  const fetchBarangays = async () => {
    try {
      const { data } = await api.get('/auth/public-barangays');
      setBarangays(data);
      if (data.length > 0) {
        const first = data[0];
        const autoAddr = formatAutoAddress(first.name);
        setRegForm((prev) => ({ ...prev, barangay_id: first.id, address: autoAddr }));
      }
    } catch (err) {
      console.error('Fetch public barangays error:', err);
    }
  };

  const onLoginSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setServerError('');
    try {
      await login(data.username, data.password);
      navigate('/');
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const onRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerError('');
    setRegSuccess('');

    try {
      const { data } = await api.post('/auth/register', regForm);
      setRegSuccess(data.message);
      const firstB = barangays[0];
      const defaultAddr = firstB ? formatAutoAddress(firstB.name) : '';
      setRegForm({
        role: 'parent',
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: defaultAddr,
        barangay_id: firstB?.id || 1,
      });
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Registration failed. Please check form details.');
    } finally {
      setLoading(false);
    }
  };

  const defaultCredentials = [
    { role: 'Administrator', username: 'admin', password: 'password123' },
    { role: 'Health Worker', username: 'worker1', password: 'password123' },
    { role: 'Parent (Gemma Caluyong)', username: 'parent_caluyong', password: 'password123' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-900">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full border-4 border-white" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full border-2 border-white" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src="/camagong-logo.png" alt="Barangay Camagong Seal" className="w-12 h-12 object-contain flex-shrink-0 drop-shadow-md" />
            <div>
              <p className="text-white font-bold text-lg leading-tight">SBHMS Camagong</p>
              <p className="text-blue-300 text-xs">Barangay Camagong Health Management System</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Barangay Camagong<br />
            <span className="text-blue-300">Health Management</span><br />
            System
          </h1>
          <p className="text-blue-200 text-base leading-relaxed max-w-sm">
            AI-Powered Health Assessment & Decision Support. All public registrations require Administrator approval for data privacy and security.
          </p>

          <div className="flex flex-wrap gap-2 mt-6">
            {['Prenatal Care', 'Child Growth & BMI', 'Admin Approval Workflow', 'Disease Trends'].map((tag) => (
              <span key={tag} className="px-3 py-1 bg-white/10 backdrop-blur text-white text-xs rounded-full border border-white/20">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-blue-400 text-xs">
            Compliant with the Philippine Data Privacy Act of 2012 (RA 10173)
          </p>
        </div>
      </div>

      {/* Right Panel - Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          {/* Mobile Logo */}
          <div className="flex items-center gap-3 mb-6 lg:hidden">
            <img src="/camagong-logo.png" alt="Barangay Camagong Seal" className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-md" />
            <div>
              <p className="text-slate-900 font-bold">SBHMS</p>
              <p className="text-slate-500 text-xs">Smart Barangay Health System</p>
            </div>
          </div>

          {/* Tab Selection Bar */}
          <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setActiveTab('login'); setServerError(''); setRegSuccess(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'login' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setActiveTab('register'); setServerError(''); setRegSuccess(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'register' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register Account
            </button>
          </div>

          {serverError && (
            <div className="alert alert-error mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{serverError}</p>
            </div>
          )}

          {regSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-900 p-4 rounded-xl mb-5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-green-800">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Registration Request Submitted!
              </div>
              <p className="text-xs leading-relaxed text-green-800">
                Your account request has been recorded. It is currently <strong className="bg-green-200 px-1 rounded">Pending Administrator Approval</strong>. Once an Admin activates your account, you will be able to log in.
              </p>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
              <p className="text-slate-500 text-sm mt-1 mb-6">Sign in to your barangay health account</p>

              <form onSubmit={handleSubmitLogin(onLoginSubmit)} className="space-y-4">
                <div className="form-group">
                  <label className="form-label" htmlFor="username">Username</label>
                  <input
                    {...registerLogin('username')}
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    className={`form-input ${loginErrors.username ? 'form-input-error' : ''}`}
                    autoComplete="username"
                  />
                  {loginErrors.username && <p className="form-error">{loginErrors.username.message}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password">Password</label>
                  <div className="relative">
                    <input
                      {...registerLogin('password')}
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className={`form-input pr-10 ${loginErrors.password ? 'form-input-error' : ''}`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginErrors.password && <p className="form-error">{loginErrors.password.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center py-3"
                >
                  {loading ? <><span className="spinner" /> Signing in...</> : <><LogIn className="w-4 h-4" /> Sign in</>}
                </button>
              </form>

              {/* Demo Credentials */}
              <div className="mt-8">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Demo Accounts</p>
                <div className="space-y-2">
                  {defaultCredentials.map((cred) => (
                    <div key={cred.username} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{cred.role}</p>
                        <p className="text-xs text-slate-500">
                          <span className="font-mono">{cred.username}</span> / <span className="font-mono">{cred.password}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: PUBLIC REGISTRATION FORM (REQUIRES ADMIN APPROVAL) */
            <>
              <h2 className="text-2xl font-bold text-slate-900">Register Account</h2>
              <p className="text-slate-500 text-xs mt-1 mb-5">
                Register as a Parent or Health Personnel. <span className="text-blue-700 font-semibold">Requires Admin Approval</span> before activation.
              </p>

              <form onSubmit={onRegisterSubmit} className="space-y-3">
                <div className="form-group">
                  <label className="form-label">Account Role *</label>
                  <select
                    value={regForm.role}
                    onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                    className="form-select text-xs"
                  >
                    <option value="parent">Parent / Guardian</option>
                    <option value="health_personnel">Barangay Health Personnel</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      className="form-input text-xs"
                      required
                      placeholder="First Name"
                      value={regForm.first_name}
                      onChange={(e) => setRegForm({ ...regForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      className="form-input text-xs"
                      required
                      placeholder="Last Name"
                      value={regForm.last_name}
                      onChange={(e) => setRegForm({ ...regForm, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-input text-xs"
                      required
                      placeholder="Username"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input text-xs"
                      required
                      placeholder="Password"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input text-xs"
                      placeholder="email@example.com"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Number</label>
                    <input
                      type="text"
                      className="form-input text-xs"
                      placeholder="0917-xxx-xxxx"
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">District / Sitio *</label>
                  <select
                    value={regForm.barangay_id}
                    onChange={(e) => {
                      const bId = Number(e.target.value);
                      const selectedB = barangays.find((b) => b.id === bId);
                      const autoAddr = selectedB ? formatAutoAddress(selectedB.name) : '';
                      setRegForm({ ...regForm, barangay_id: bId, address: autoAddr });
                    }}
                    className="form-select text-xs"
                  >
                    {barangays.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Home Address (Auto Generated)</label>
                  <input
                    type="text"
                    className="form-input text-xs"
                    placeholder="Auto generated district address"
                    value={regForm.address}
                    onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-center gap-2 text-[11px] text-amber-900">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  Notice: All new registrations require Administrator verification before login.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center py-2.5 text-xs font-bold mt-2"
                >
                  {loading ? <><span className="spinner" /> Submitting Request...</> : <><UserPlus className="w-4 h-4" /> Submit Registration</>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
