import React from 'react';
import {
  House,
  User,
  CalendarCheck,
  Receipt,
  Star,
  UsersThree,
  ShieldCheck,
  CheckCircle,
  FileText,
  SignOut,
  ArrowLeft,
  Moon,
  Sun,
  DiamondsFour,
} from '@phosphor-icons/react';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';

export interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  mode: 'portal' | 'admin';
  userRole?: string;
  userName?: string;
  staffId?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  mode,
  userRole = 'Employee',
  userName = 'David Alabi',
  staffId = 'NX-EMP-0142',
}) => {
  const { theme, toggleTheme } = useTheme();

  const portalNav = [
    { label: 'Staff Dashboard', path: '/portal/dashboard', icon: House },
    { label: 'My Profile', path: '/portal/profile', icon: User },
    { label: 'Leave & Attendance', path: '/portal/leave', icon: CalendarCheck },
    { label: 'Expense Reimbursement', path: '/portal/expenses', icon: Receipt },
    { label: 'Performance Appraisal', path: '/portal/appraisals', icon: Star },
  ];

  const adminNav = [
    { label: 'Executive Dashboard', path: '/admin/dashboard', icon: DiamondsFour },
    { label: 'Workforce Directory', path: '/admin/employees', icon: UsersThree },
    { label: 'Leave Approvals Queue', path: '/admin/leave-approvals', icon: CheckCircle },
    { label: 'Expense Reimbursements', path: '/admin/expense-approvals', icon: Receipt },
    { label: 'Appraisal Calibration', path: '/admin/appraisals', icon: Star },
    { label: 'DevSecOps Audit Logs', path: '/admin/audit-logs', icon: ShieldCheck },
  ];

  const navItems = mode === 'admin' ? adminNav : portalNav;

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-rule h-screen sticky top-0 flex flex-col justify-between select-none font-sans">
      <div>
        {/* Brand & Mode Tag */}
        <div className="p-6 border-b border-rule flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-[7px] bg-action text-on-action flex items-center justify-center font-bold font-display text-base">
              N
            </div>
            <div>
              <div className="font-display font-semibold text-ink text-sm leading-tight">
                Nexus Finance
              </div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-brand">
                {mode === 'admin' ? 'HRMS Admin Console' : 'Staff Self-Service'}
              </div>
            </div>
          </button>
        </div>

        {/* User Snapshot Card */}
        <div className="p-4 mx-3 my-3 rounded-[12px] bg-subtle border border-rule">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-soft text-brand border border-brand/25 flex items-center justify-center font-semibold text-sm">
              {userName
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="overflow-hidden">
              <div className="font-semibold text-xs text-ink truncate">{userName}</div>
              <div className="text-[11px] text-muted truncate">{staffId}</div>
              <span className="inline-block text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-accent-soft text-brand mt-1">
                {userRole}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[7px] text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-action text-on-action shadow-sm'
                    : 'text-muted hover:text-ink hover:bg-subtle'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" weight={isActive ? 'fill' : 'regular'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls & Mode Switcher */}
      <div className="p-4 border-t border-rule space-y-2">
        {mode === 'portal' ? (
          <button
            onClick={() => onNavigate('/admin/dashboard')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-[7px] bg-subtle hover:bg-accent-soft text-brand text-xs font-semibold border border-rule transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Switch to Admin View</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('/portal/dashboard')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-[7px] bg-subtle hover:bg-accent-soft text-brand text-xs font-semibold border border-rule transition-colors cursor-pointer"
          >
            <House className="w-4 h-4" />
            <span>Switch to Staff Portal</span>
          </button>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onNavigate('/')}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[7px] text-xs text-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Site</span>
          </button>

          <button
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-[7px] text-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={async () => {
              await api.auth.logout().catch(() => undefined);
              onNavigate('/auth/login');
            }}
            title="Log out"
            aria-label="Log out"
            className="p-2 rounded-[7px] text-muted hover:text-danger hover:bg-danger-soft/30 transition-colors cursor-pointer"
          >
            <SignOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
