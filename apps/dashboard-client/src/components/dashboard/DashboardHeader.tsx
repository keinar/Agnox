import { LogOut, Menu, X, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface User {
  name?: string;
  email?: string;
  organizationName?: string;
  role?: string;
}

interface DashboardHeaderProps {
  user: User | null;
  onLogout: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export function DashboardHeader({
  user,
  onLogout,
  mobileMenuOpen,
  onToggleMobileMenu
}: DashboardHeaderProps) {
  return (
    <>
      {/* Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between h-[72px] px-6 mb-6 bg-white border-b border-slate-200 rounded-xl shadow-sm">
        {/* Left side - Logo and Organization */}
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-sm tracking-tight shadow-lg shadow-indigo-500/25">
            AAC
          </div>

          <div className="hidden md:block h-8 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent" />

          <div className="hidden md:flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold text-slate-900 leading-tight max-w-[200px] truncate">
              {user?.organizationName || 'Organization'}
            </h2>
            <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wide">
              Organization
            </span>
          </div>
        </div>

        {/* Right side - Desktop */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
          >
            <Settings size={18} />
            Settings
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-2 border-white ring-1 ring-indigo-500/20 text-indigo-600 flex items-center justify-center font-bold text-base shadow-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>

            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-900">
                {user?.name || 'User'}
              </span>
              <span className="text-xs text-slate-400">
                {user?.email || 'email@example.com'}
              </span>
            </div>
          </div>

          <span className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-200 tracking-wide">
            {user?.role || 'user'}
          </span>

          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 text-[13px] text-slate-500 font-medium bg-white border border-slate-200 cursor-pointer px-4 h-[38px] rounded-lg whitespace-nowrap transition-all duration-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 hover:-translate-y-px hover:shadow-sm"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex md:hidden items-center justify-center w-[42px] h-[42px] rounded-xl bg-white border border-slate-200 cursor-pointer text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-700"
          onClick={onToggleMobileMenu}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      <div
        className={`${
          mobileMenuOpen ? 'flex' : 'hidden'
        } md:hidden absolute top-20 left-5 right-5 bg-white border border-slate-200 rounded-b-xl shadow-xl p-5 flex-col gap-4 z-40 animate-slide-down`}
      >
        {/* Organization info & Role Badge */}
        <div className="py-2 border-b border-slate-100 mb-1">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wide">
                Organization
              </span>
              <h3 className="mt-1 text-[17px] font-semibold text-slate-900">
                {user?.organizationName || 'Organization'}
              </h3>
            </div>
            <span className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-200 tracking-wide">
              {user?.role || 'user'}
            </span>
          </div>
        </div>

        {/* User card */}
        <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-2 border-white ring-1 ring-indigo-500/20 text-indigo-600 flex items-center justify-center font-bold text-lg">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-slate-900">
              {user?.name || 'User'}
            </div>
            <div className="text-[13px] text-slate-400">
              {user?.email || 'email@example.com'}
            </div>
          </div>
        </div>

        {/* Settings Link */}
        <Link
          to="/settings"
          onClick={onToggleMobileMenu}
          className="flex items-center gap-3 p-3.5 text-[15px] font-semibold text-slate-700 no-underline bg-white border border-slate-200 rounded-xl transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
        >
          <Settings size={18} />
          <span>Settings</span>
        </Link>

        {/* Logout button */}
        <button
          onClick={() => {
            onToggleMobileMenu();
            onLogout();
          }}
          className="flex items-center justify-center gap-2 text-sm text-rose-600 font-semibold bg-rose-50 border border-rose-200 cursor-pointer p-3.5 rounded-xl transition-all duration-200 w-full hover:bg-rose-100 hover:-translate-y-px"
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </>
  );
}
