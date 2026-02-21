import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { X, Mail, Shield } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Organization {
  userCount: number;
  userLimit: number;
}

interface InviteModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// ── Shared class strings ───────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full pl-10 pr-3 py-3 text-sm border-2 border-slate-200 dark:border-gh-border-dark rounded-lg ' +
  'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
  'placeholder-slate-400 dark:placeholder-slate-500 ' +
  'focus:outline-none focus:border-gh-accent dark:focus:border-gh-accent-dark focus:ring-2 focus:ring-gh-accent/20 dark:focus:ring-gh-accent-dark/20 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition';

const SELECT_CLASS =
  'w-full pl-10 pr-3 py-3 text-sm border-2 border-slate-200 dark:border-gh-border-dark rounded-lg ' +
  'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
  'focus:outline-none focus:border-gh-accent dark:focus:border-gh-accent-dark focus:ring-2 focus:ring-gh-accent/20 dark:focus:ring-gh-accent-dark/20 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer';

// ── Component ──────────────────────────────────────────────────────────────────

export function InviteModal({ onClose, onSuccess }: InviteModalProps) {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'developer' | 'viewer' | 'admin'>('developer');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchOrganization(); }, []);

  async function fetchOrganization() {
    try {
      const response = await axios.get(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setOrganization({
          userCount: response.data.organization.userCount,
          userLimit: response.data.organization.userLimit,
        });
      }
    } catch (error: any) {
      setError('Failed to load organization details');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/invitations`,
        { email, role },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.success) { onSuccess(); }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  const canInvite = organization && organization.userCount < organization.userLimit;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/50"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        className="bg-white dark:bg-gh-bg-subtle-dark rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto border border-slate-200 dark:border-gh-border-dark"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-gh-border-dark">
          <h2 id="invite-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Invite Team Member</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-gh-bg-dark transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
            ) : (
              <>
                {/* Usage info */}
                {organization && (
                  <div className={`px-4 py-3 rounded-lg text-sm border ${
                    canInvite
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  }`}>
                    <strong>Team Members: {organization.userCount} / {organization.userLimit}</strong>
                    {!canInvite && (
                      <p className="mt-2">
                        You've reached your user limit. Upgrade your plan to invite more members.
                      </p>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="colleague@company.com"
                      required
                      disabled={!canInvite || submitting}
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <select
                      id="invite-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'developer' | 'viewer' | 'admin')}
                      className={SELECT_CLASS}
                      disabled={!canInvite || submitting}
                    >
                      <option value="developer">Developer — can run tests and view reports</option>
                      <option value="viewer">Viewer — read-only access</option>
                      <option value="admin">Admin — full access (use sparingly)</option>
                    </select>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {role === 'developer' && 'Can run tests, edit tests, and view all reports.'}
                    {role === 'viewer' && 'Can view test results and reports, but cannot run or edit tests.'}
                    {role === 'admin' && 'Full organization access including managing members, billing, and settings.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-gh-border-dark">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-lg hover:bg-slate-50 dark:hover:bg-gh-bg-subtle-dark disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canInvite || submitting || loading}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              {submitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
