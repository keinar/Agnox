import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Settings, BookOpen, X, ChevronLeft, ChevronRight } from 'lucide-react';
import logoLight from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard', href: null, disabled: false },
  { icon: Settings, label: 'Settings', to: '/settings', href: null, disabled: false },
  { icon: BookOpen, label: 'Docs', to: null, href: 'http://docs.automation.keinar.com/', disabled: false },
] as const;

const ACTIVE_CLASS = 'bg-blue-50 text-gh-accent border-r-2 border-gh-accent dark:bg-gh-bg-subtle-dark dark:text-gh-accent-dark dark:border-gh-accent-dark';
const DEFAULT_CLASS = 'text-slate-600 hover:bg-gh-bg-subtle hover:text-gh-text dark:text-gh-text-dark dark:hover:bg-gh-bg-subtle-dark dark:hover:text-gh-text-dark';

export function Sidebar({ isMobileOpen, onMobileClose, isCollapsed, onToggle }: SidebarProps) {
  const { theme } = useTheme();
  // Switch logo based on current theme: black logo for light backgrounds, white for dark
  const logo = theme === 'dark' ? logoDark : logoLight;

  // Logo header — always visible; shrinks to h-6 when collapsed instead of disappearing.
  // Collapse toggle sits on the right side (opposite the logo) when expanded.
  const logoBlock = (
    <div className="flex items-center justify-between px-3 py-4 border-b border-gh-border dark:border-gh-border-dark">
      <Link to="/dashboard" className="flex-shrink-0 min-w-0">
        <img
          src={logo}
          alt="Agnostic Automation Center"
          className={`w-auto object-contain transition-all duration-300 ${isCollapsed ? 'h-6' : 'h-10'
            }`}
        />
      </Link>

      {/* Collapse / expand toggle — always visible in the sidebar header */}
      <button
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-gh-bg-subtle dark:text-slate-500 dark:hover:text-gh-text-dark dark:hover:bg-gh-bg-subtle-dark transition-colors duration-150"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );

  // Label text — fades out smoothly as the sidebar collapses instead of snapping.
  const labelSpan = (text: string) => (
    <span
      className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'
        }`}
    >
      {text}
    </span>
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
              {labelSpan(label)}
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
              {labelSpan(label)}
            </a>
          );
        }

        return (
          <NavLink
            key={label}
            to={to!}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${isActive ? ACTIVE_CLASS : DEFAULT_CLASS
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {labelSpan(label)}
          </NavLink>
        );
      })}
    </nav>
  );

  // ── Desktop sidebar ───────────────────────────────────────────────────────
  const desktopSidebar = (
    <aside
      className={`hidden md:flex flex-col bg-gh-bg dark:bg-gh-bg-dark border-r border-gh-border dark:border-gh-border-dark transition-all duration-300 flex-shrink-0 ${isCollapsed ? 'w-16' : 'w-60'
        }`}
    >
      {logoBlock}
      {navLinks}
    </aside>
  );

  // ── Mobile overlay ────────────────────────────────────────────────────────
  const mobileOverlay = (
    <>
      {/* Backdrop */}
      {isMobileOpen && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 md:hidden cursor-default"
          onClick={onMobileClose}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onMobileClose(); }}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-gh-bg dark:bg-gh-bg-dark border-r border-gh-border dark:border-gh-border-dark flex flex-col md:hidden transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Mobile header with logo and close button */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gh-border dark:border-gh-border-dark">
          <Link to="/dashboard" onClick={onMobileClose} className="flex-shrink-0">
            <img
              src={logo}
              alt="Agnostic Automation Center"
              className="h-10 w-auto object-contain"
            />
          </Link>
          <button
            onClick={onMobileClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gh-bg-subtle dark:hover:bg-gh-bg-subtle-dark transition-colors duration-150"
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
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${isActive ? ACTIVE_CLASS : DEFAULT_CLASS
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
