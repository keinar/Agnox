import { LogOut, Menu, PanelLeft, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface User {
  name?: string;
  email?: string;
  organizationName?: string;
  role?: string;
}

interface DashboardHeaderProps {
  user: User | null;
  onLogout: () => void;
  onMobileMenuToggle: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function DashboardHeader({
  user,
  onLogout,
  onMobileMenuToggle,
  isCollapsed,
  onToggle,
}: DashboardHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between h-[72px] px-6 bg-white dark:bg-gh-bg-dark border-b border-slate-200 dark:border-gh-border-dark shadow-sm">
      {/* Mobile hamburger — visible on mobile only */}
      <button
        className="flex md:hidden items-center justify-center w-[42px] h-[42px] rounded-xl bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark cursor-pointer text-slate-500 dark:text-slate-400 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark hover:text-slate-700 dark:hover:text-gh-text-dark"
        onClick={onMobileMenuToggle}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      {/* Desktop collapse toggle — visible on desktop only */}
      <button
        className="hidden md:flex items-center justify-center w-[42px] h-[42px] rounded-xl bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark cursor-pointer text-slate-500 dark:text-slate-400 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark hover:text-slate-700 dark:hover:text-gh-text-dark"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <PanelLeft size={20} />
      </button>

      {/* Spacer — pushes right content to the right */}
      <div className="flex-1" />

      {/* Right side — theme toggle + user info + logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 border-2 border-white dark:border-gh-border-dark ring-1 ring-blue-200 dark:ring-blue-800 text-gh-accent dark:text-gh-accent-dark flex items-center justify-center font-bold text-base shadow-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-900 dark:text-gh-text-dark">
              {user?.name || 'User'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {user?.email || 'email@example.com'}
            </span>
          </div>
        </div>

        <span className="hidden sm:inline-block px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 tracking-wide">
          {user?.role || 'user'}
        </span>

        {/* Theme toggle — Moon icon in light mode, Sun icon in dark mode */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-[38px] h-[38px] rounded-lg bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark text-slate-500 dark:text-slate-400 cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark hover:text-slate-700 dark:hover:text-gh-text-dark"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark cursor-pointer px-4 h-[38px] rounded-lg whitespace-nowrap transition-all duration-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-800 hover:text-rose-600 dark:hover:text-rose-400 hover:-translate-y-px hover:shadow-sm"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

    </div>
  );
}
