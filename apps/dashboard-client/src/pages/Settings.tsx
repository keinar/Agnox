import { lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { ProfileTab } from '../components/settings/ProfileTab';
import { OrganizationTab } from '../components/settings/OrganizationTab';
import { MembersTab } from '../components/settings/MembersTab';
import { SecurityTab } from '../components/settings/SecurityTab';
import { UsageTab } from '../components/settings/UsageTab';
import { RunSettingsTab } from '../components/settings/RunSettingsTab';
import { EnvironmentVariablesTab } from '../components/settings/EnvironmentVariablesTab';
import { IntegrationsTab } from '../components/settings/IntegrationsTab';
import { SchedulesList } from '../components/settings/SchedulesList';
import { FeaturesTab } from '../components/settings/FeaturesTab';

// Lazy load BillingTab (largest component - 615 lines) to reduce initial bundle
const BillingTab = lazy(() => import('../components/settings/BillingTab').then(m => ({ default: m.BillingTab })));

type TabId = 'profile' | 'organization' | 'members' | 'billing' | 'security' | 'usage' | 'run-settings' | 'env-vars' | 'integrations' | 'schedules' | 'features';

export function Settings() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const allTabs = [
    { id: 'profile'       as const, label: 'My Profile',     component: ProfileTab },
    { id: 'organization'  as const, label: 'Organization',   component: OrganizationTab },
    { id: 'members'       as const, label: 'Team Members',   component: MembersTab },
    { id: 'billing'       as const, label: 'Billing & Plans', component: BillingTab },
    { id: 'security'      as const, label: 'Security',       component: SecurityTab },
    { id: 'usage'         as const, label: 'Usage',          component: UsageTab },
    { id: 'run-settings'  as const, label: 'Run Settings',   component: RunSettingsTab },
    { id: 'env-vars'      as const, label: 'Env Variables',  component: EnvironmentVariablesTab },
    { id: 'integrations'  as const, label: 'Integrations',   component: IntegrationsTab },
    { id: 'schedules'     as const, label: 'Schedules',      component: SchedulesList },
    { id: 'features'      as const, label: 'Features',       component: FeaturesTab },
  ];

  // Filter admin-only tabs for non-admins to prevent 403 errors
  const tabs = user?.role === 'admin'
    ? allTabs
    : allTabs.filter(t => t.id !== 'billing' && t.id !== 'features');

  // Get active tab from URL, validate, and default to 'organization'
  const tabParam = searchParams.get('tab') as TabId | null;
  const validTabIds = tabs.map(t => t.id);
  const activeTab: TabId = tabParam && validTabIds.includes(tabParam) ? tabParam : 'organization';

  const activeTabLabel    = tabs.find(t => t.id === activeTab)?.label ?? 'Settings';
  const ActiveTabComponent = tabs.find(t => t.id === activeTab)?.component || OrganizationTab;

  return (
    <div className="p-4 max-w-[1200px] mx-auto font-sans">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gh-text dark:text-gh-text-dark leading-tight">
          Settings / {activeTabLabel}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your organization, team members, and preferences
        </p>
      </div>

      {/* Tab Content — full width, driven by sidebar navigation */}
      <Suspense fallback={
        <div className="py-5 text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      }>
        <ActiveTabComponent />
      </Suspense>
    </div>
  );
}
