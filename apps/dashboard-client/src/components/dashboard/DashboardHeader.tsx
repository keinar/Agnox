import { LogOut, Menu } from 'lucide-react';

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
}

export function DashboardHeader({ user, onLogout, onMobileMenuToggle }: DashboardHeaderProps) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between h-[72px] px-6 bg-white border-b border-slate-200 shadow-sm">
      {/* Mobile hamburger */}
      <button
        className="flex md:hidden items-center justify-center w-[42px] h-[42px] rounded-xl bg-white border border-slate-200 cursor-pointer text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700"
        onClick={onMobileMenuToggle}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      {/* Spacer on desktop (pushes right content to the right) */}
      <div className="hidden md:block flex-1" />

      {/* Right side — user info + logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-2 border-white ring-1 ring-indigo-500/20 text-indigo-600 flex items-center justify-center font-bold text-base shadow-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-900">
              {user?.name || 'User'}
            </span>
            <span className="text-xs text-slate-400">
              {user?.email || 'email@example.com'}
            </span>
          </div>
        </div>

        <span className="hidden sm:inline-block px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-200 tracking-wide">
          {user?.role || 'user'}
        </span>

        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 text-[13px] text-slate-500 font-medium bg-white border border-slate-200 cursor-pointer px-4 h-[38px] rounded-lg whitespace-nowrap transition-all duration-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 hover:-translate-y-px hover:shadow-sm"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </div>
  );
}
