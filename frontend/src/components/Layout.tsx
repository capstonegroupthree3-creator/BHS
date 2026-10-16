import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Baby, HeartPulse, Syringe,
  BarChart3, FileText, Settings, LogOut, Menu, X,
  ChevronRight, Shield, MapPin, Activity, UserCheck,
  AlertTriangle, Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import NotificationBell from './NotificationBell';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'health_personnel'] },
  { label: 'Health Programs', href: '/programs', icon: Calendar, roles: ['admin', 'health_personnel', 'parent'] },
  { label: 'Children', href: '/children', icon: Baby, roles: ['admin', 'health_personnel', 'parent'] },
  { label: 'Senior Citizens', href: '/seniors', icon: Users, roles: ['admin', 'health_personnel'] },
  { label: 'Pregnant Women', href: '/pregnant', icon: HeartPulse, roles: ['admin', 'health_personnel'] },
  { label: 'Vaccinations', href: '/vaccinations', icon: Syringe, roles: ['admin', 'health_personnel', 'parent'] },
  { label: 'Districts & Sitios', href: '/barangays', icon: MapPin, roles: ['admin'] },
  { label: 'User Accounts', href: '/users', icon: Shield, roles: ['admin'] },
  { label: 'Health Personnel', href: '/personnel', icon: UserCheck, roles: ['admin'] },
  { label: 'Parents / Guardians', href: '/parents', icon: Users, roles: ['admin', 'health_personnel'] },
  { label: 'AI Priority List', href: '/priority', icon: AlertTriangle, roles: ['admin', 'health_personnel'] },
  { label: 'Disease Trends', href: '/trends', icon: Activity, roles: ['admin', 'health_personnel'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['admin', 'health_personnel'] },
  { label: 'Reports', href: '/reports', icon: FileText, roles: ['admin', 'health_personnel'] },
  { label: 'Audit Logs', href: '/audit', icon: Shield, roles: ['admin'] },
  { label: 'AI Settings', href: '/settings', icon: Settings, roles: ['admin'] },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { t } = useThemeLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowedNav = navItems.filter((item) => user && item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = {
    admin: 'Administrator',
    health_personnel: 'Health Personnel',
    parent: 'Parent / Guardian',
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── MOBILE OVERLAY ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-sidebar-bg transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}
        style={{ backgroundColor: '#0f172a' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
          <img src="/camagong-logo.png" alt="Barangay Camagong Seal" className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-md" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-white leading-tight">SBHMS Camagong</p>
            <p className="text-xs text-slate-400 truncate">Barangay Camagong Portal</p>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Snippet */}
        <div className="px-4 py-3 mx-3 mt-3 bg-slate-800/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
              <p className="text-xs text-slate-400 truncate">{roleLabel[user?.role as keyof typeof roleLabel]}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {allowedNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <item.icon className="sidebar-link-icon" />
                <span className="flex-1 text-sm">{t(item.label)}</span>
                {isActive && <ChevronRight className="w-4 h-4 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-slate-700/50">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/30"
          >
            <LogOut className="sidebar-link-icon" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm transition-colors">
          <button
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-800 dark:text-white truncate">
              {t(allowedNav.find((n) => n.href === location.pathname)?.label ?? 'Smart Barangay Health System')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="hidden sm:block text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {roleLabel[user?.role as keyof typeof roleLabel]}
            </span>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

    </div>
  );
};

export default Layout;
