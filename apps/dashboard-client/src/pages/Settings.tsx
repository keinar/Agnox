import { useAuth } from '../context/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { OrganizationTab } from '../components/settings/OrganizationTab';
import { MembersTab } from '../components/settings/MembersTab';
import { SecurityTab } from '../components/settings/SecurityTab';
import { UsageTab } from '../components/settings/UsageTab';
import { BillingTab } from '../components/settings/BillingTab';

const styles = {
  container: {
    padding: '16px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  } as React.CSSProperties,
  header: {
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  } as React.CSSProperties,
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
  } as React.CSSProperties,
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#1e293b',
    textDecoration: 'none',
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
    lineHeight: 1.2,
  } as React.CSSProperties,
  subtitle: {
    fontSize: '14px',
    color: '#cbd5e1',
    marginTop: '4px',
    margin: 0,
  } as React.CSSProperties,
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  } as React.CSSProperties,
  tabNav: {
    display: 'flex',
    borderBottom: '1px solid #f1f5f9',
    padding: '0 16px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    scrollbarWidth: 'none',
    gap: '24px',
  } as React.CSSProperties,
  tab: {
    padding: '16px 4px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#64748b',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '-1px',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  tabActive: {
    color: '#4f46e5',
    borderBottomColor: '#4f46e5',
  } as React.CSSProperties,
  content: {
    padding: '24px',
  } as React.CSSProperties,
};

type TabId = 'organization' | 'members' | 'billing' | 'security' | 'usage';

export function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const allTabs = [
    { id: 'organization' as const, label: 'Organization', component: OrganizationTab },
    { id: 'members' as const, label: 'Team Members', component: MembersTab },
    { id: 'billing' as const, label: 'Billing & Plans', component: BillingTab },
    { id: 'security' as const, label: 'Security', component: SecurityTab },
    { id: 'usage' as const, label: 'Usage', component: UsageTab },
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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTopRow}>
          <Link
            to="/dashboard"
            style={styles.backButton}
          >
            <ArrowLeft size={18} />
            Back
          </Link>
          <div style={{ flex: 1 }}>

          </div>
        </div>

        <div>
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>
            Manage your organization, team members, and preferences
          </p>
        </div>
      </div>

      {/* Settings Card */}
      <div style={styles.card}>
        {/* Tab Navigation */}
        <nav style={styles.tabNav} className="scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div style={styles.content}>
          <ActiveTabComponent />
        </div>
      </div>
    </div>
  );
}