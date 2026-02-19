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
      <div className="sticky top-0 z-50 flex items-center justify-between h-[72px] px-6 mb-6 bg-slate-900 border-b border-slate-800 rounded-xl shadow-sm shadow-black/20">
        {/* Left side - Logo and Organization */}
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-sm tracking-tight shadow-lg shadow-indigo-500/35">
            AAC
          </div>

          <div className="hidden md:block h-8 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent" />

          <div className="hidden md:flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold text-slate-200 leading-tight max-w-[200px] truncate">
              {user?.organizationName || 'Organization'}
            </h2>
            <span className="text-[11px] text-slate-500 uppercase font-semibold tracking-wide">
              Organization
            </span>
          </div>
        </div>

        {/* Right side - Desktop */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-200 hover:bg-slate-750 hover:text-slate-300 hover:border-slate-600"
          >
            <Settings size={18} />
            Settings
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-slate-800 ring-1 ring-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-base">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>

            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-200">
                {user?.name || 'User'}
              </span>
              <span className="text-xs text-slate-500">
                {user?.email || 'email@example.com'}
              </span>
            </div>
          </div>

          <span className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wide">
            {user?.role || 'user'}
          </span>

          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 text-[13px] text-slate-400 font-medium bg-slate-800 border border-slate-700 cursor-pointer px-4 h-[38px] rounded-lg whitespace-nowrap transition-all duration-200 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 hover:-translate-y-px hover:shadow-lg hover:shadow-rose-500/10"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="flex md:hidden items-center justify-center w-[42px] h-[42px] rounded-xl bg-slate-800 border border-slate-700 cursor-pointer text-slate-400 transition-all duration-200 hover:bg-slate-750 hover:text-slate-300"
          onClick={onToggleMobileMenu}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      <div
        className={`${
          mobileMenuOpen ? 'flex' : 'hidden'
        } md:hidden absolute top-20 left-5 right-5 bg-slate-900 border border-slate-800 rounded-b-xl shadow-xl shadow-black/30 p-5 flex-col gap-4 z-40 animate-slide-down`}
      >
        {/* Organization info & Role Badge */}
        <div className="py-2 border-b border-slate-800 mb-1">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold tracking-wide">
                Organization
              </span>
              <h3 className="mt-1 text-[17px] font-semibold text-slate-200">
                {user?.organizationName || 'Organization'}
              </h3>
            </div>
            <span className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wide">
              {user?.role || 'user'}
            </span>
          </div>
        </div>

        {/* User card */}
        <div className="flex items-center gap-3 p-3.5 bg-slate-800/50 rounded-xl border border-slate-700/50 shadow-sm">
          <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-slate-800 ring-1 ring-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-lg">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-slate-200">
              {user?.name || 'User'}
            </div>
            <div className="text-[13px] text-slate-500">
              {user?.email || 'email@example.com'}
            </div>
          </div>
        </div>

        {/* Settings Link */}
        <Link
          to="/settings"
          onClick={onToggleMobileMenu}
          className="flex items-center gap-3 p-3.5 text-[15px] font-semibold text-slate-200 no-underline bg-slate-800 border border-slate-700 rounded-xl transition-all duration-200 hover:bg-slate-750 hover:border-slate-600"
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
          className="flex items-center justify-center gap-2 text-sm text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 cursor-pointer p-3.5 rounded-xl transition-all duration-200 w-full hover:bg-rose-500/20 hover:-translate-y-px"
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </>
  );
}
