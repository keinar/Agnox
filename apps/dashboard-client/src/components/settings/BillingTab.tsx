import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { CreditCard, ExternalLink, CheckCircle, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function getAlertClass(type: string): string {
  switch (type) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300';
    case 'warning':
      return 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300';
    default:
      return 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300';
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
    case 'past_due':
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
  }
}

function StatusBadge({ status }: { status: string }) {
  const icon =
    status === 'active' ? <CheckCircle size={14} /> :
    status === 'past_due' ? <AlertCircle size={14} /> :
    <Clock size={14} />;
  const label =
    status === 'active' ? 'Active' :
    status === 'past_due' ? 'Past Due' : 'Canceled';

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${getStatusBadgeClass(status)}`}>
      {icon}
      {label}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

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
    } catch (err: any) {
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
    } catch {
      // Non-critical — silently ignore
    }
  }

  async function handleUpgrade(priceId: string) {
    if (!priceId) { setError('Invalid plan selected'); return; }
    setUpgrading(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_URL}/api/billing/checkout`,
        { priceId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.success && response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start upgrade process');
      setUpgrading(false);
    }
  }

  async function openCustomerPortal() {
    try {
      const response = await axios.post(
        `${API_URL}/api/billing/portal`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.success && response.data.portalUrl) {
        window.open(response.data.portalUrl, '_blank');
      } else {
        setError('Failed to open customer portal');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to open customer portal');
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading billing information...</p>;
  }

  if (error && !billing) {
    return (
      <div className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  const currentPlan = billing?.plan || 'free';
  const isFreePlan = currentPlan === 'free';
  const hasActiveSubscription = billing?.stripeSubscriptionId && billing?.status === 'active';

  return (
    <div>
      {/* Inline error (when billing is also partially loaded) */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Usage Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {alerts.map((alert) => (
            <div key={`${alert.resource}-${alert.type}`} className={`flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm leading-relaxed ${getAlertClass(alert.type)}`}>
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>{alert.resource}:</strong> {alert.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Current Subscription ──────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Current Subscription</h2>
        <div className="p-6 bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
            </h3>
            {billing && <StatusBadge status={billing.status} />}
          </div>

          {billing && (billing.currentPeriodStart || billing.lastPaymentDate) && (
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              {billing.currentPeriodStart && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Billing Period Start
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatDate(billing.currentPeriodStart)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Billing Period End
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatDate(billing.currentPeriodEnd)}
                    </span>
                  </div>
                </>
              )}
              {billing.lastPaymentDate && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Last Payment
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatDate(billing.lastPaymentDate)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Amount Paid
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(billing.lastPaymentAmount)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {hasActiveSubscription && (
            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={openCustomerPortal}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
              >
                <CreditCard size={16} />
                Manage Subscription
                <ExternalLink size={13} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Available Plans ───────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {isFreePlan ? 'Upgrade Your Plan' : 'Available Plans'}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const canUpgrade = plan.id !== 'free' && !isCurrent;

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                  isCurrent
                    ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500 dark:border-blue-600'
                    : 'bg-white dark:bg-gh-bg-subtle-dark border-slate-200 dark:border-gh-border-dark hover:border-blue-400 dark:hover:border-blue-700 hover:-translate-y-1 hover:shadow-lg'
                }`}
              >
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{plan.name}</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  ${plan.price}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">/month</span>
                </div>
                <ul className="mt-4 mb-5 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-default"
                  >
                    Current Plan
                  </button>
                ) : canUpgrade ? (
                  <button
                    onClick={() => plan.priceId && handleUpgrade(plan.priceId)}
                    disabled={upgrading || !plan.priceId}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {upgrading ? 'Processing...' : (
                      <>
                        <TrendingUp size={16} />
                        Upgrade to {plan.name}
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
