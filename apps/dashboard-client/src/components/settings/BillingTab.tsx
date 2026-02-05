import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { CreditCard, ExternalLink, CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface BillingInfo {
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  cancelAtPeriodEnd: boolean;
}

interface UsageAlert {
  type: 'info' | 'warning' | 'critical';
  resource: string;
  message: string;
  percentUsed: number;
}

const styles = {
  section: {
    marginBottom: '32px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '16px',
  } as React.CSSProperties,
  card: {
    padding: '24px',
    background: '#ffffff',
    border: '2px solid #f3f4f6',
    borderRadius: '12px',
    marginBottom: '16px',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  planHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
    gap: '12px',
  } as React.CSSProperties,
  planTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  } as React.CSSProperties,
  planBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  statusActive: {
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
  } as React.CSSProperties,
  statusPastDue: {
    background: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fde68a',
  } as React.CSSProperties,
  statusCanceled: {
    background: '#f3f4f6',
    color: '#4b5563',
    border: '1px solid #d1d5db',
  } as React.CSSProperties,
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  } as React.CSSProperties,
  infoItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,
  infoLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  infoValue: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#1e293b',
  } as React.CSSProperties,
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    marginTop: '20px',
  } as React.CSSProperties,
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#4f46e5',
    background: '#f0f4ff',
    border: '2px solid #c7d2fe',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
  } as React.CSSProperties,
  alert: {
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    lineHeight: '1.6',
  } as React.CSSProperties,
  alertInfo: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1e40af',
  } as React.CSSProperties,
  alertWarning: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
  } as React.CSSProperties,
  alertCritical: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
  } as React.CSSProperties,
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  } as React.CSSProperties,
  planCard: {
    padding: '24px',
    background: '#ffffff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  } as React.CSSProperties,
  planCardCurrent: {
    border: '2px solid #667eea',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
  } as React.CSSProperties,
  planName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '8px',
  } as React.CSSProperties,
  planPrice: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '4px',
  } as React.CSSProperties,
  planPeriod: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '16px',
  } as React.CSSProperties,
  planFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    marginBottom: '20px',
  } as React.CSSProperties,
  planFeature: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#4b5563',
    marginBottom: '8px',
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
  loadingText: {
    color: '#6b7280',
    fontSize: '14px',
  } as React.CSSProperties,
};

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      '100 test runs/month',
      '3 team members',
      '1 concurrent run',
      'Community support',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 99,
    priceId: import.meta.env.VITE_STRIPE_TEAM_PRICE_ID,
    features: [
      '1,000 test runs/month',
      '20 team members',
      '5 concurrent runs',
      'Priority support',
      'Advanced analytics',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    priceId: import.meta.env.VITE_STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      'Unlimited test runs',
      'Unlimited team members',
      'Unlimited concurrent runs',
      '24/7 dedicated support',
      'Custom integrations',
      'SLA guarantee',
    ],
  },
];

export function BillingTab() {
  const { token } = useAuth();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingInfo();
    fetchUsageAlerts();
  }, []);

  async function fetchBillingInfo() {
    try {
      const response = await axios.get(`${API_URL}/api/billing/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setBilling(response.data.subscription);
      }
    } catch (error: any) {
      console.error('Failed to fetch billing info:', error);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsageAlerts() {
    try {
      const response = await axios.get(`${API_URL}/api/organization/usage/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setAlerts(response.data.alerts);
      }
    } catch (error: any) {
      console.error('Failed to fetch usage alerts:', error);
    }
  }

  async function handleUpgrade(priceId: string) {
    if (!priceId) {
      setError('Invalid plan selected');
      return;
    }

    setUpgrading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/billing/checkout`,
        { priceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Failed to upgrade:', error);
      setError(error.response?.data?.message || 'Failed to start upgrade process');
      setUpgrading(false);
    }
  }

  async function openCustomerPortal() {
    try {
      const response = await axios.post(
        `${API_URL}/api/billing/portal`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.portalUrl) {
        window.open(response.data.portalUrl, '_blank');
      } else {
        setError('Failed to open customer portal');
      }
    } catch (error: any) {
      console.error('Failed to open portal:', error);
      setError(error.response?.data?.message || 'Failed to open customer portal');
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { style: React.CSSProperties; icon: JSX.Element; text: string }> = {
      active: {
        style: styles.statusActive,
        icon: <CheckCircle size={14} />,
        text: 'Active',
      },
      past_due: {
        style: styles.statusPastDue,
        icon: <AlertCircle size={14} />,
        text: 'Past Due',
      },
      canceled: {
        style: styles.statusCanceled,
        icon: <Clock size={14} />,
        text: 'Canceled',
      },
    };

    const statusInfo = statusMap[status] || statusMap.canceled;
    return (
      <div style={{ ...styles.planBadge, ...statusInfo.style }}>
        {statusInfo.icon}
        {statusInfo.text}
      </div>
    );
  };

  const getAlertStyle = (type: string) => {
    switch (type) {
      case 'critical':
        return styles.alertCritical;
      case 'warning':
        return styles.alertWarning;
      default:
        return styles.alertInfo;
    }
  };

  if (loading) {
    return <div style={styles.loadingText}>Loading billing information...</div>;
  }

  if (error && !billing) {
    return <div style={styles.errorMessage}>{error}</div>;
  }

  const currentPlan = billing?.plan || 'free';
  const isFreePlan = currentPlan === 'free';
  const hasActiveSubscription = billing?.stripeSubscriptionId && billing?.status === 'active';

  return (
    <div>
      {/* Error Message */}
      {error && <div style={styles.errorMessage}>{error}</div>}

      {/* Usage Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {alerts.map((alert, index) => (
            <div key={index} style={{ ...styles.alert, ...getAlertStyle(alert.type) }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>{alert.resource}:</strong> {alert.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Subscription */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Current Subscription</h2>
        <div
          style={styles.card}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#c7d2fe';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#f3f4f6';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={styles.planHeader}>
            <h3 style={styles.planTitle}>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan</h3>
            {billing && getStatusBadge(billing.status)}
          </div>

          <div style={styles.infoGrid}>
            {billing?.currentPeriodStart && (
              <>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Billing Period Start</span>
                  <span style={styles.infoValue}>{formatDate(billing.currentPeriodStart)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Billing Period End</span>
                  <span style={styles.infoValue}>{formatDate(billing.currentPeriodEnd)}</span>
                </div>
              </>
            )}
            {billing?.lastPaymentDate && (
              <>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Last Payment</span>
                  <span style={styles.infoValue}>{formatDate(billing.lastPaymentDate)}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Amount Paid</span>
                  <span style={styles.infoValue}>{formatCurrency(billing.lastPaymentAmount)}</span>
                </div>
              </>
            )}
          </div>

          <div style={styles.buttonGroup}>
            {hasActiveSubscription && (
              <button
                style={styles.secondaryButton}
                onClick={openCustomerPortal}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.2)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <CreditCard size={18} />
                Manage Subscription
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Available Plans */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>
          {isFreePlan ? 'Upgrade Your Plan' : 'Available Plans'}
        </h2>
        <div style={styles.plansGrid}>
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const canUpgrade = plan.id !== 'free' && !isCurrent;

            return (
              <div
                key={plan.id}
                style={{
                  ...styles.planCard,
                  ...(isCurrent ? styles.planCardCurrent : {}),
                }}
                onMouseOver={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.2)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <div style={styles.planName}>{plan.name}</div>
                <div style={styles.planPrice}>
                  ${plan.price}
                  <span style={styles.planPeriod}>/month</span>
                </div>
                <ul style={styles.planFeatures}>
                  {plan.features.map((feature, index) => (
                    <li key={index} style={styles.planFeature}>
                      <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button
                    style={{
                      ...styles.secondaryButton,
                      width: '100%',
                      justifyContent: 'center',
                      cursor: 'default',
                    }}
                    disabled
                  >
                    Current Plan
                  </button>
                ) : canUpgrade ? (
                  <button
                    style={{
                      ...styles.primaryButton,
                      width: '100%',
                      justifyContent: 'center',
                      opacity: upgrading ? 0.6 : 1,
                    }}
                    onClick={() => plan.priceId && handleUpgrade(plan.priceId)}
                    disabled={upgrading || !plan.priceId}
                    onMouseOver={(e) => {
                      if (!upgrading) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.3)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {upgrading ? 'Processing...' : (
                      <>
                        <TrendingUp size={18} />
                        Upgrade to {plan.name}
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
