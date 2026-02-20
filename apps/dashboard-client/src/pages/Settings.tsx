import { lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ProfileTab } from '../components/settings/ProfileTab';
import { OrganizationTab } from '../components/settings/OrganizationTab';
import { MembersTab } from '../components/settings/MembersTab';
import { SecurityTab } from '../components/settings/SecurityTab';
import { UsageTab } from '../components/settings/UsageTab';
import { RunSettingsTab } from '../components/settings/RunSettingsTab';
import { IntegrationsTab } from '../components/settings/IntegrationsTab';

// Lazy load BillingTab (largest component - 615 lines) to reduce initial bundle
const BillingTab = lazy(() => import('../components/settings/BillingTab').then(m => ({ default: m.BillingTab })));

type TabId = 'profile' | 'organization' | 'members' | 'billing' | 'security' | 'usage' | 'run-settings' | 'integrations';

export function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const allTabs = [
    { id: 'profile' as const, label: 'My Profile', component: ProfileTab },
    { id: 'organization' as const, label: 'Organization', component: OrganizationTab },
    { id: 'members' as const, label: 'Team Members', component: MembersTab },
    { id: 'billing' as const, label: 'Billing & Plans', component: BillingTab },
    { id: 'security' as const, label: 'Security', component: SecurityTab },
    { id: 'usage' as const, label: 'Usage', component: UsageTab },
    { id: 'run-settings' as const, label: 'Run Settings', component: RunSettingsTab },
    { id: 'integrations' as const, label: 'Integrations', component: IntegrationsTab },
  ];

  // Filter billing tab for non-admins to prevent 403 errors
  const tabs = user?.role === 'admin'
    ? allTabs
    : allTabs.filter(t => t.id !== 'billing');

  // Get active tab from URL, validate, and default to 'organization'
  const tabParam = searchParams.get('tab') as TabId | null;
  const validTabIds = tabs.map(t => t.id);
  const activeTab: TabId = tabParam && validTabIds.includes(tabParam) ? tabParam : 'organization';

  const handleTabChange = (tabId: TabId) => {
    setSearchParams({ tab: tabId });
  };

  const ActiveTabComponent = tabs.find(t => t.id === activeTab)?.component || OrganizationTab;

  return (
    <div className="p-4 max-w-[1200px] mx-auto font-sans">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gh-text dark:text-gh-text-dark leading-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your organization, team members, and preferences
        </p>
      </div>

      {/* Settings Card */}
      <div className="bg-white dark:bg-gh-bg-subtle-dark rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-gh-border-dark">
        {/* Tab Navigation */}
        <nav className="flex border-b border-slate-200 dark:border-gh-border-dark px-4 overflow-x-auto gap-6 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 px-1 text-sm font-semibold whitespace-nowrap cursor-pointer border-b-2 -mb-px transition-all duration-200 ${
                activeTab === tab.id
                  ? 'text-gh-accent dark:text-gh-accent-dark border-gh-accent dark:border-gh-accent-dark'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-gh-border-dark'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="p-6">
          <Suspense fallback={
            <div className="py-5 text-sm text-slate-400 dark:text-slate-500">Loading...</div>
          }>
            <ActiveTabComponent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
