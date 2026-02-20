import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { useAuth } from '../context/AuthContext';

export function AppLayout() {
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const openMobile  = useCallback(() => setIsMobileOpen(true),  []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar isMobileOpen={isMobileOpen} onMobileClose={closeMobile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          user={user}
          onLogout={logout}
          onMobileMenuToggle={openMobile}
        />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
