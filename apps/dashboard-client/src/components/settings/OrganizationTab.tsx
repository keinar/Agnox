import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  limits: {
    maxProjects: number;
    maxTestRuns: number;
    maxUsers: number;
    maxConcurrentRuns: number;
  };
  userCount: number;
  userLimit: number;
  aiAnalysisEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Shared class strings ───────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full max-w-sm px-3 py-1.5 text-[13px] border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
  'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition';

const INPUT_DISABLED_CLASS =
  'w-full max-w-sm px-3 py-1.5 text-[13px] border border-slate-200 dark:border-gh-border-dark rounded-lg ' +
  'bg-slate-100 dark:bg-gh-bg-subtle-dark text-slate-500 dark:text-slate-500 cursor-not-allowed';

// ── Component ──────────────────────────────────────────────────────────────────

export function OrganizationTab() {
  const { user, token } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchOrganization();
  }, []);

  async function fetchOrganization() {
    try {
      const response = await axios.get(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setOrganization(response.data.organization);
        setName(response.data.organization.name);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load organization details',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || name === organization?.name) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await axios.patch(
        `${API_URL}/api/organization`,
        { name: name.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.success) {
        setOrganization((prev) => (prev ? { ...prev, name: name.trim() } : null));
        setMessage({ type: 'success', text: 'Organization name updated successfully' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update organization name',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading organization details...</p>;
  }
  if (!organization) {
    return <p className="text-sm text-red-600 dark:text-red-400">Failed to load organization details.</p>;
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

  return (
    <div>
      {/* Feedback banner */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}>
          {message.text}
        </div>
      )}

      {/* ── Organization Details ──────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-4">Organization Details</h2>

        {/* Name */}
        <div className="mb-4">
          <label htmlFor="org-name" className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">
            Organization Name
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            className={`${isAdmin ? INPUT_CLASS : INPUT_DISABLED_CLASS} mr-2.5`}
          />
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name === organization.name}
              className="mt-2 px-4 py-1.5 text-[13px] font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 rounded-lg transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {/* Plan badge */}
        <div className="mb-4">
          <p className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">
            Current Plan
          </p>
          <span className="inline-block px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-blue-600 dark:bg-blue-500 text-white">
            {organization.plan}
          </span>
        </div>

        {/* Organization ID */}
        <div className="mb-4">
          <p className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">
            Organization ID
          </p>
          <code className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-gh-bg-dark px-2 py-1 rounded break-all">
            {organization.id}
          </code>
        </div>

        {/* Created */}
        <div className="mb-4">
          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-2">Created</p>
          <span className="text-[13px] text-slate-700 dark:text-slate-300">{formatDate(organization.createdAt)}</span>
        </div>
      </section>

      {/* ── Plan Limits ───────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-4">Plan Limits</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Test Runs / Month', value: organization.limits.maxTestRuns.toLocaleString() },
            { label: 'Team Members', value: organization.limits.maxUsers },
            { label: 'Concurrent Runs', value: organization.limits.maxConcurrentRuns },
            { label: 'Projects', value: organization.limits.maxProjects },
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 dark:bg-gh-bg-dark p-4 rounded-lg border border-slate-200 dark:border-gh-border-dark">
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">{item.label}</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{item.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
