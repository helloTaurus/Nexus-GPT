import React from 'react';
import { Sidebar } from './Sidebar';
import { ShieldCheck } from '@phosphor-icons/react';
import { clientStore } from '../../lib/clientStore';

export interface AdminLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
  userRole?: string;
  userName?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentPath,
  onNavigate,
  children,
  userRole,
  userName,
}) => {
  const activeUser = clientStore.getActiveUser();
  const useActiveAdmin = activeUser && (activeUser.role === 'ADMIN' || activeUser.role === 'MANAGER');
  const resolvedName =
    userName ||
    (useActiveAdmin
      ? `${activeUser.profile.firstName} ${activeUser.profile.lastName}`
      : 'Henrietta Okolo');
  const resolvedRole =
    userRole ||
    (useActiveAdmin ? activeUser.profile.designation || activeUser.role : 'HR & System Admin');
  const resolvedStaffId = useActiveAdmin ? activeUser.profile.staffId : 'NX-ADM-0001';
  const initials =
    resolvedName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2) || 'HO';

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-row font-sans">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        mode="admin"
        userRole={resolvedRole}
        userName={resolvedName}
        staffId={resolvedStaffId}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Executive Header */}
        <header className="h-16 px-6 sm:px-8 border-b border-rule bg-surface flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-accent-soft text-brand border border-brand/25 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>Institutional Governance &amp; Administration</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-ink">{resolvedName}</div>
              <div className="text-[10px] text-muted">{resolvedRole} &bull; Executive Chamber</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs">
              {initials}
            </div>
          </div>
        </header>

        {/* Viewport */}
        <main className="p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6">{children}</main>
      </div>
    </div>
  );
};
