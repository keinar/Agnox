import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { TrendingUp, Users, HardDrive, Calendar, AlertTriangle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface UsageData {
  currentPeriod: { startDate: string; endDate: string };
  testRuns: { used: number; limit: number; percentUsed: number };
  users: { active: number; limit: number };
  storage: { usedBytes: number; limitBytes: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getProgressBarClass(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 80) return 'bg-amber-500';
  return 'bg-gh-accent dark:bg-gh-accent-dark';
}

// ── Component ──────────────────────────────────────────────────────────────────

export function UsageTab() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchUsage(); }, []);

  async function fetchUsage() {
    try {
      const response = await axios.get(`${API_URL}/api/organization/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) { setUsage(response.data.usage); }
    } catch {
      setError('Failed to load usage statistics');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading usage statistics...</p>;
  }

  if (error || !usage) {
    return (
      <div className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
        {error || 'Failed to load usage statistics'}
      </div>
    );
  }

  const showUpgradePrompt = usage.testRuns.percentUsed > 80 || usage.users.active >= usage.users.limit;

  return (
    <div>
      {/* Billing period banner */}
      <div className="flex items-center gap-2.5 px-4 py-4 mb-8 bg-slate-50 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-lg">
        <Calendar size={16} className="flex-shrink-0 text-slate-500 dark:text-slate-400" />
        <span className="text-sm text-slate-600 dark:text-slate-300">
          <strong>Current billing period:</strong> {formatDate(usage.currentPeriod.startDate)} — {formatDate(usage.currentPeriod.endDate)}
        </span>
      </div>

      {/* Metric cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Test Runs */}
        <MetricCard
          icon={<TrendingUp size={16} />}
          title="Test Runs"
          value={`${usage.testRuns.used.toLocaleString()} / ${usage.testRuns.limit.toLocaleString()}`}
          subtext={`${usage.testRuns.percentUsed}% of monthly limit used`}
          percent={usage.testRuns.percentUsed}
        >
          {usage.testRuns.percentUsed >= 90 && (
            <AlertBanner type="danger">
              <strong>Limit almost reached!</strong> You've used {usage.testRuns.percentUsed}% of your test runs. Consider upgrading to avoid interruptions.
            </AlertBanner>
          )}
          {usage.testRuns.percentUsed >= 80 && usage.testRuns.percentUsed < 90 && (
            <AlertBanner type="warning">
              You're approaching your test run limit. Consider upgrading your plan for higher limits.
            </AlertBanner>
          )}
        </MetricCard>

        {/* Team Members */}
        <MetricCard
          icon={<Users size={16} />}
          title="Team Members"
          value={`${usage.users.active} / ${usage.users.limit}`}
          subtext="Active users in organization"
          percent={Math.round((usage.users.active / usage.users.limit) * 100)}
        >
          {usage.users.active >= usage.users.limit && (
            <AlertBanner type="danger">
              <strong>User limit reached!</strong> Upgrade your plan to invite more team members.
            </AlertBanner>
          )}
        </MetricCard>

        {/* Storage */}
        <MetricCard
          icon={<HardDrive size={16} />}
          title="Storage"
          value={formatBytes(usage.storage.usedBytes)}
          subtext={`of ${formatBytes(usage.storage.limitBytes)} limit`}
          percent={Math.round((usage.storage.usedBytes / usage.storage.limitBytes) * 100)}
        />
      </div>

      {/* Upgrade prompt */}
      {showUpgradePrompt && (
        <div className="p-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Need More?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Upgrade to the Team plan for higher limits, more concurrent runs, and priority support.
          </p>
          <button
            onClick={() => navigate('/settings?tab=billing')}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 rounded-lg transition-opacity cursor-pointer"
          >
            <TrendingUp size={16} />
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtext: string;
  percent: number;
  children?: React.ReactNode;
}

function MetricCard({ icon, title, value, subtext, percent, children }: MetricCardProps) {
  return (
    <div className="p-6 bg-white dark:bg-gh-bg-subtle-dark border border-slate-200 dark:border-gh-border-dark rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">
        {icon}
        {title}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 tabular-nums">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">{subtext}</div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getProgressBarClass(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {children}
    </div>
  );
}

interface AlertBannerProps {
  type: 'warning' | 'danger';
  children: React.ReactNode;
}

function AlertBanner({ type, children }: AlertBannerProps) {
  const cls =
    type === 'danger'
      ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
      : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300';

  return (
    <div className={`flex items-start gap-2.5 mt-4 px-3 py-3 rounded-lg text-sm leading-relaxed ${cls}`}>
      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
