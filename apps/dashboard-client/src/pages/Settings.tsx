import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { OrganizationTab } from '../components/settings/OrganizationTab';
import { MembersTab } from '../components/settings/MembersTab';
import { SecurityTab } from '../components/settings/SecurityTab';
import { UsageTab } from '../components/settings/UsageTab';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  } as React.CSSProperties,
  header: {
    marginBottom: '32px',
  } as React.CSSProperties,
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 8px 0',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0,
  } as React.CSSProperties,
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  } as React.CSSProperties,
  tabNav: {
    display: 'flex',
    borderBottom: '2px solid #f3f4f6',
    padding: '0 24px',
    gap: '8px',
  } as React.CSSProperties,
  tab: {
    padding: '16px 20px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#6b7280',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative' as const,
    marginBottom: '-2px',
  } as React.CSSProperties,
  tabActive: {
    color: '#667eea',
    borderBottomColor: '#667eea',
  } as React.CSSProperties,
  tabContent: {
    padding: '32px 24px',
  } as React.CSSProperties,
};

export function Settings() {
  const [activeTab, setActiveTab] = useState<'organization' | 'members' | 'security' | 'usage'>('organization');
  const { user } = useAuth();

  const tabs = [
    { id: 'organization' as const, label: 'Organization', component: OrganizationTab },
    { id: 'members' as const, label: 'Team Members', component: MembersTab },
    { id: 'security' as const, label: 'Security & Privacy', component: SecurityTab },
    { id: 'usage' as const, label: 'Usage & Limits', component: UsageTab },
  ];

  const ActiveTabComponent = tabs.find(t => t.id === activeTab)?.component || OrganizationTab;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>
          Manage your organization, team members, and preferences
        </p>
      </div>

      {/* Settings Card */}
      <div style={styles.card}>
        {/* Tab Navigation */}
        <nav style={styles.tabNav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
              onMouseOver={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = '#334155';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = '#6b7280';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div style={styles.tabContent}>
          <ActiveTabComponent />
        </div>
      </div>
    </div>
  );
}
