import React from 'react';
import { Sidebar } from './Sidebar';
import { Clock } from '@phosphor-icons/react';
import { clientStore } from '../../lib/clientStore';

export interface PortalLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
  userRole?: string;
  userName?: string;
  staffId?: string;
  department?: string;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  currentPath,
  onNavigate,
  children,
  userRole,
  userName,
  staffId,
  department,
}) => {
  const activeUser = clientStore.getActiveUser();
  const resolvedName =
    userName ||
    (activeUser ? `${activeUser.profile.firstName} ${activeUser.profile.lastName}` : 'Oluwaseun Bakare');
  const resolvedStaffId = staffId || activeUser?.profile.staffId || 'NX-1042';
  const resolvedRole = userRole || activeUser?.profile.designation || 'Employee';
  const resolvedDepartment = department || activeUser?.profile.department || 'Credit Risk & Underwriting';

  const currentTime = new Date().toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-row font-sans">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        mode="portal"
        userRole={resolvedRole}
        userName={resolvedName}
        staffId={resolvedStaffId}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Operational Bar */}
        <header className="h-16 px-6 sm:px-8 border-b border-rule bg-surface flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-semibold tracking-wider text-muted flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand" />
              <span>West Africa Time: {currentTime}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-ink">{resolvedName}</div>
              <div className="text-[10px] text-muted">
                {resolvedStaffId} &bull; {resolvedDepartment}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-accent-soft text-brand flex items-center justify-center font-bold text-xs">
              {resolvedName
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0])
                .join('')}
            </div>
          </div>
        </header>

        {/* Viewport */}
        <main className="p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6">{children}</main>
      </div>
    </div>
  );
};
