import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard', href: null,                                    disabled: false },
  { icon: Settings,        label: 'Settings',   to: '/settings',  href: null,                                    disabled: false },
  { icon: BookOpen,        label: 'Docs',        to: null,         href: 'http://docs.automation.keinar.com/', disabled: false },
] as const;

const ACTIVE_CLASS  = 'bg-indigo-50 text-indigo-600 border-r-2 border-indigo-600';
const DEFAULT_CLASS = 'text-slate-600 hover:bg-slate-50 hover:text-slate-900';

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('aac:sidebar-collapsed') === 'true',
  );

  const toggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('aac:sidebar-collapsed', String(next));
      return next;
    });
  };

  const logoBlock = (
    <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs tracking-tight shadow-lg shadow-indigo-500/25">
        AAC
      </div>
      {!isCollapsed && (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
            {user?.organizationName || 'Organization'}
          </p>
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">
            Organization
          </span>
        </div>
      )}
    </div>
  );

  const navLinks = (
    <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
      {NAV_ITEMS.map(({ icon: Icon, label, to, href, disabled }) => {
        if (disabled) {
          return (
            <div
              key={label}
              title={label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium opacity-50 cursor-not-allowed ${DEFAULT_CLASS}`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </div>
          );
        }

        if (href) {
          return (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              title={isCollapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${DEFAULT_CLASS}`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </a>
          );
        }

        return (
          <NavLink
            key={label}
            to={to!}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                isActive ? ACTIVE_CLASS : DEFAULT_CLASS
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>{label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  const collapseButton = (
    <div className="border-t border-slate-100 p-3">
      <button
        onClick={toggle}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex items-center justify-center w-full h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-150"
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </div>
  );

  // ── Desktop sidebar ───────────────────────────────────────────────────────
  const desktopSidebar = (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 flex-shrink-0 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {logoBlock}
      {navLinks}
      {collapseButton}
    </aside>
  );

  // ── Mobile overlay ────────────────────────────────────────────────────────
  const mobileOverlay = (
    <>
      {/* Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200 flex flex-col md:hidden transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs tracking-tight shadow-lg shadow-indigo-500/25">
              AAC
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                {user?.organizationName || 'Organization'}
              </p>
              <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">
                Organization
              </span>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(({ icon: Icon, label, to, href, disabled }) => {
            if (disabled) {
              return (
                <div
                  key={label}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium opacity-50 cursor-not-allowed ${DEFAULT_CLASS}`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span>{label}</span>
                </div>
              );
            }

            if (href) {
              return (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${DEFAULT_CLASS}`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span>{label}</span>
                </a>
              );
            }

            return (
              <NavLink
                key={label}
                to={to!}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                    isActive ? ACTIVE_CLASS : DEFAULT_CLASS
                  }`
                }
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );

  return (
    <>
      {desktopSidebar}
      {mobileOverlay}
    </>
  );
}
