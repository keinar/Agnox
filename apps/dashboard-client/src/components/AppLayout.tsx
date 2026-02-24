import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { useAuth } from '../context/AuthContext';

export function AppLayout() {
  const { user, logout } = useAuth();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('aac:sidebar-collapsed') === 'true',
  );

  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('aac:sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gh-bg-subtle-dark overflow-hidden">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={closeMobile}
        isCollapsed={isCollapsed}
        onToggle={toggleCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          user={user}
          onLogout={logout}
          onMobileMenuToggle={openMobile}
          isCollapsed={isCollapsed}
          onToggle={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
