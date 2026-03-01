import { useState } from 'react';
import { NavLink, Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Settings, BookOpen, X, ChevronLeft, ChevronRight, Info, ClipboardList, Layers,
  User, Building, Users, CreditCard, Shield, Activity, Play, Database, Link as LinkIcon,
  Clock, Sparkles, ArrowLeft,
} from 'lucide-react';
import logoLight from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';
import { useTheme } from '../context/ThemeContext';
import { APP_VERSION } from '../config/version';
import { ChangelogModal } from './ChangelogModal';
import { VersionDisplay } from './VersionDisplay';
import { useOrganizationFeatures } from '../hooks/useOrganizationFeatures';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard', href: null, disabled: false },
  { icon: ClipboardList,   label: 'Test Cases', to: '/test-cases', href: null, disabled: false },
  { icon: Layers,          label: 'Test Cycles', to: '/test-cycles', href: null, disabled: false },
  { icon: Settings,        label: 'Settings', to: '/settings', href: null, disabled: false },
  { icon: BookOpen,        label: 'Docs', to: null, href: 'http://docs.agnox.dev/', disabled: false },
] as const;

const ALL_SETTINGS_TABS = [
  { id: 'profile',       label: 'My Profile',     icon: User },
  { id: 'organization',  label: 'Organization',   icon: Building },
  { id: 'members',       label: 'Team Members',   icon: Users },
  { id: 'billing',       label: 'Billing & Plans', icon: CreditCard },
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'usage',         label: 'Usage',          icon: Activity },
  { id: 'run-settings',  label: 'Run Settings',   icon: Play },
  { id: 'env-vars',      label: 'Env Variables',  icon: Database },
  { id: 'integrations',  label: 'Integrations',   icon: LinkIcon },
  { id: 'schedules',     label: 'Schedules',      icon: Clock },
  { id: 'features',      label: 'Features',       icon: Sparkles },
] as const;

const ACTIVE_CLASS  = 'bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600 dark:bg-gh-bg-subtle-dark dark:text-gh-accent-dark dark:border-gh-accent-dark';
const DEFAULT_CLASS = 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-gh-text-dark dark:hover:bg-gh-bg-subtle-dark dark:hover:text-gh-text-dark';

export function Sidebar({ isMobileOpen, onMobileClose, isCollapsed, onToggle }: SidebarProps) {
  const { theme } = useTheme();
  const [showChangelog, setShowChangelog] = useState(false);
  const { features } = useOrganizationFeatures();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isSettings = location.pathname.startsWith('/settings');
  const activeTab   = searchParams.get('tab') ?? 'organization';

  const visibleNavItems = NAV_ITEMS.filter(({ to }) => {
    if (to === '/test-cases'  && !features.testCasesEnabled)  return false;
    if (to === '/test-cycles' && !features.testCyclesEnabled) return false;
    return true;
  });

  const settingsTabs = ALL_SETTINGS_TABS.filter(({ id }) => {
    if ((id === 'billing' || id === 'features') && user?.role !== 'admin') return false;
    return true;
  });

  const logo = theme === 'dark' ? logoDark : logoLight;

  // ── Shared helpers ────────────────────────────────────────────────────────

  /** Label that fades / shrinks when the desktop sidebar collapses. */
  const labelSpan = (text: string) => (
    <span
      className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
        isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'
      }`}
    >
      {text}
    </span>
  );

  // ── Logo header ───────────────────────────────────────────────────────────
  const logoBlock = (
    <div className="flex items-center justify-between px-3 py-4 border-b border-slate-300 dark:border-gh-border-dark">
      <Link to="/dashboard" className="flex-shrink-0 min-w-0">
        <img
          src={logo}
          alt="Agnox"
          className={`w-auto object-contain transition-all duration-300 ${isCollapsed ? 'h-6' : 'h-10'}`}
        />
      </Link>
      <button
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-gh-bg-subtle dark:text-slate-500 dark:hover:text-gh-text-dark dark:hover:bg-gh-bg-subtle-dark transition-colors duration-150"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );

  // ── Desktop: left panel (main nav) ────────────────────────────────────────
  const desktopMainNav = (
    <nav className="w-1/2 overflow-y-auto px-2 py-4 flex flex-col gap-1">
      {visibleNavItems.map(({ icon: Icon, label, to, href, disabled }) => {
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
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${isActive ? ACTIVE_CLASS : DEFAULT_CLASS}`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {labelSpan(label)}
          </NavLink>
        );
      })}
    </nav>
  );

  // ── Desktop: right panel (settings sub-menu) ─────────────────────────────
  const desktopSettingsNav = (
    <nav className="w-1/2 overflow-y-auto px-2 py-4 flex flex-col gap-1">
      {/* Back to main menu */}
      <Link
        to="/dashboard"
        title={isCollapsed ? 'Back to Main Menu' : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${DEFAULT_CLASS}`}
      >
        <ArrowLeft size={18} className="flex-shrink-0" />
        {labelSpan('Back to Main Menu')}
      </Link>

      {/* Divider */}
      <div className="mx-3 my-1 border-t border-slate-200 dark:border-gh-border-dark" />

      {/* Settings tabs */}
      {settingsTabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setSearchParams({ tab: id })}
          title={isCollapsed ? label : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
            activeTab === id ? ACTIVE_CLASS : DEFAULT_CLASS
          }`}
        >
          <Icon size={18} className="flex-shrink-0" />
          {labelSpan(label)}
        </button>
      ))}
    </nav>
  );

  // ── Desktop: sliding viewport ─────────────────────────────────────────────
  // The double-width slider sits behind an overflow-hidden viewport.
  // Translating by -50% of its own width (= -100% of viewport width) reveals
  // the right panel when the user is inside /settings.
  const desktopSlidingNav = (
    <div className="overflow-hidden relative flex-1">
      <div
        className={`absolute top-0 left-0 bottom-0 w-[200%] flex transition-transform duration-300 ease-in-out ${
          isSettings ? '-translate-x-1/2' : 'translate-x-0'
        }`}
      >
        {desktopMainNav}
        {desktopSettingsNav}
      </div>
    </div>
  );

  // ── Version footer ────────────────────────────────────────────────────────
  const versionFooter = (
    <div className="px-3 py-3 border-t border-slate-300 dark:border-gh-border-dark flex items-center justify-center">
      {isCollapsed ? (
        <button
          onClick={() => setShowChangelog(true)}
          title={`Version ${APP_VERSION} — What's New`}
          aria-label="Open changelog"
          className="flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <Info size={14} />
        </button>
      ) : (
        <button
          onClick={() => setShowChangelog(true)}
          aria-label="Open changelog"
          className="hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
        >
          <VersionDisplay />
        </button>
      )}
    </div>
  );

  // ── Desktop sidebar ───────────────────────────────────────────────────────
  const desktopSidebar = (
    <aside
      className={`hidden md:flex flex-col bg-white shadow-sm dark:shadow-none dark:bg-gh-bg-dark border-r border-slate-300 dark:border-gh-border-dark transition-all duration-300 flex-shrink-0 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {logoBlock}
      {desktopSlidingNav}
      {versionFooter}
    </aside>
  );

  // ── Mobile: left panel (main nav) ─────────────────────────────────────────
  const mobileMainNav = (
    <nav className="w-1/2 overflow-y-auto px-2 py-4 flex flex-col gap-1">
      {visibleNavItems.map(({ icon: Icon, label, to, href, disabled }) => {
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
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${isActive ? ACTIVE_CLASS : DEFAULT_CLASS}`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  // ── Mobile: right panel (settings sub-menu) ───────────────────────────────
  const mobileSettingsNav = (
    <nav className="w-1/2 overflow-y-auto px-2 py-4 flex flex-col gap-1">
      <Link
        to="/dashboard"
        onClick={onMobileClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${DEFAULT_CLASS}`}
      >
        <ArrowLeft size={18} className="flex-shrink-0" />
        <span>Back to Main Menu</span>
      </Link>

      <div className="mx-3 my-1 border-t border-slate-200 dark:border-gh-border-dark" />

      {settingsTabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setSearchParams({ tab: id })}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
            activeTab === id ? ACTIVE_CLASS : DEFAULT_CLASS
          }`}
        >
          <Icon size={18} className="flex-shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );

  // ── Mobile: sliding viewport ──────────────────────────────────────────────
  const mobileSlidingNav = (
    <div className="overflow-hidden relative flex-1">
      <div
        className={`absolute top-0 left-0 bottom-0 w-[200%] flex transition-transform duration-300 ease-in-out ${
          isSettings ? '-translate-x-1/2' : 'translate-x-0'
        }`}
      >
        {mobileMainNav}
        {mobileSettingsNav}
      </div>
    </div>
  );

  // ── Mobile overlay ────────────────────────────────────────────────────────
  const mobileOverlay = (
    <>
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

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white shadow-lg dark:shadow-none dark:bg-gh-bg-dark border-r border-slate-300 dark:border-gh-border-dark flex flex-col md:hidden transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-300 dark:border-gh-border-dark">
          <Link to="/dashboard" onClick={onMobileClose} className="flex-shrink-0">
            <img src={logo} alt="Agnox" className="h-10 w-auto object-contain" />
          </Link>
          <button
            onClick={onMobileClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gh-bg-subtle dark:hover:bg-gh-bg-subtle-dark transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>

        {mobileSlidingNav}

        <div className="px-4 py-3 border-t border-slate-300 dark:border-gh-border-dark">
          <button
            onClick={() => { onMobileClose(); setShowChangelog(true); }}
            aria-label="Open changelog"
            className="hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors"
          >
            <VersionDisplay />
          </button>
        </div>
      </aside>
    </>
  );

  return (
    <>
      {desktopSidebar}
      {mobileOverlay}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </>
  );
}
