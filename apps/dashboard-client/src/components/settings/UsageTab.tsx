import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { TrendingUp, Users, HardDrive, Calendar, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface UsageData {
  currentPeriod: {
    startDate: string;
    endDate: string;
  };
  testRuns: {
    used: number;
    limit: number;
    percentUsed: number;
  };
  users: {
    active: number;
    limit: number;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
  };
}

const styles = {
  billingPeriod: {
    padding: '16px 20px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginBottom: '32px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  } as React.CSSProperties,
  billingText: {
    fontSize: '14px',
    color: '#6b7280',
  } as React.CSSProperties,
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '32px',
  } as React.CSSProperties,
  metricCard: {
    padding: '24px',
    background: '#ffffff',
    border: '2px solid #f3f4f6',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  } as React.CSSProperties,
  metricTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  metricValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '12px',
  } as React.CSSProperties,
  metricSubtext: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '12px',
  } as React.CSSProperties,
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#f3f4f6',
    borderRadius: '4px',
    overflow: 'hidden',
    position: 'relative' as const,
  } as React.CSSProperties,
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  } as React.CSSProperties,
  progressNormal: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  } as React.CSSProperties,
  progressWarning: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  } as React.CSSProperties,
  progressDanger: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  } as React.CSSProperties,
  alert: {
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginTop: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    lineHeight: '1.6',
  } as React.CSSProperties,
  alertWarning: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
  } as React.CSSProperties,
  alertDanger: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
  } as React.CSSProperties,
  upgradeSection: {
    padding: '24px',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  upgradeTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '8px',
  } as React.CSSProperties,
  upgradeText: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '16px',
  } as React.CSSProperties,
  upgradeButton: {
    padding: '12px 32px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  errorMessage: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,
};

export function UsageTab() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  async function fetchUsage() {
    try {
      const response = await axios.get(`${API_URL}/api/organization/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setUsage(response.data.usage);
      }
    } catch (error: any) {
      console.error('Failed to fetch usage:', error);
      setError('Failed to load usage statistics');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return styles.progressDanger;
    if (percent >= 80) return styles.progressWarning;
    return styles.progressNormal;
  };

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading usage statistics...</div>;
  }

  if (error || !usage) {
    return <div style={styles.errorMessage}>{error || 'Failed to load usage statistics'}</div>;
  }

  const showUpgradePrompt =
    usage.testRuns.percentUsed > 80 || usage.users.active >= usage.users.limit;

  return (
    <div>
      {/* Billing Period */}
      <div style={styles.billingPeriod}>
        <Calendar size={18} color="#6b7280" />
        <span style={styles.billingText}>
          <strong>Current billing period:</strong> {formatDate(usage.currentPeriod.startDate)} -{' '}
          {formatDate(usage.currentPeriod.endDate)}
        </span>
      </div>

      {/* Metrics Grid */}
      <div style={styles.metricsGrid}>
        {/* Test Runs */}
        <div
          style={styles.metricCard}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#c7d2fe';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#f3f4f6';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={styles.metricHeader}>
            <div style={styles.metricTitle}>
              <TrendingUp size={18} />
              Test Runs
            </div>
          </div>
          <div style={styles.metricValue}>
            {usage.testRuns.used.toLocaleString()} / {usage.testRuns.limit.toLocaleString()}
          </div>
          <div style={styles.metricSubtext}>
            {usage.testRuns.percentUsed}% of monthly limit used
          </div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                ...getProgressColor(usage.testRuns.percentUsed),
                width: `${Math.min(usage.testRuns.percentUsed, 100)}%`,
              }}
            />
          </div>
          {usage.testRuns.percentUsed >= 90 && (
            <div style={{ ...styles.alert, ...styles.alertDanger }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Limit almost reached!</strong> You've used {usage.testRuns.percentUsed}% of your test
                runs. Consider upgrading to avoid interruptions.
              </div>
            </div>
          )}
          {usage.testRuns.percentUsed >= 80 && usage.testRuns.percentUsed < 90 && (
            <div style={{ ...styles.alert, ...styles.alertWarning }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                You're approaching your test run limit. Consider upgrading your plan for higher limits.
              </div>
            </div>
          )}
        </div>

        {/* Team Members */}
        <div
          style={styles.metricCard}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#c7d2fe';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#f3f4f6';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={styles.metricHeader}>
            <div style={styles.metricTitle}>
              <Users size={18} />
              Team Members
            </div>
          </div>
          <div style={styles.metricValue}>
            {usage.users.active} / {usage.users.limit}
          </div>
          <div style={styles.metricSubtext}>Active users in organization</div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                ...getProgressColor((usage.users.active / usage.users.limit) * 100),
                width: `${Math.min((usage.users.active / usage.users.limit) * 100, 100)}%`,
              }}
            />
          </div>
          {usage.users.active >= usage.users.limit && (
            <div style={{ ...styles.alert, ...styles.alertDanger }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>User limit reached!</strong> Upgrade your plan to invite more team members.
              </div>
            </div>
          )}
        </div>

        {/* Storage */}
        <div
          style={styles.metricCard}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#c7d2fe';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#f3f4f6';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={styles.metricHeader}>
            <div style={styles.metricTitle}>
              <HardDrive size={18} />
              Storage
            </div>
          </div>
          <div style={styles.metricValue}>
            {formatBytes(usage.storage.usedBytes)}
          </div>
          <div style={styles.metricSubtext}>
            of {formatBytes(usage.storage.limitBytes)} limit
          </div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                ...getProgressColor((usage.storage.usedBytes / usage.storage.limitBytes) * 100),
                width: `${Math.min((usage.storage.usedBytes / usage.storage.limitBytes) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Upgrade Prompt */}
      {showUpgradePrompt && (
        <div style={styles.upgradeSection}>
          <h3 style={styles.upgradeTitle}>Need More?</h3>
          <p style={styles.upgradeText}>
            Upgrade to the Team plan for higher limits, more concurrent runs, and priority support.
          </p>
          <button
            style={styles.upgradeButton}
            onClick={() => {
              navigate('/settings?tab=billing');
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <TrendingUp size={18} />
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  );
}
