import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Shield, AlertCircle, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Component ──────────────────────────────────────────────────────────────────

export function SecurityTab() {
  const { user, token } = useAuth();
  const [aiAnalysisEnabled, setAiAnalysisEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { fetchOrganization(); }, []);

  async function fetchOrganization() {
    try {
      const response = await axios.get(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setAiAnalysisEnabled(response.data.organization.aiAnalysisEnabled);
      }
    } catch (error: any) {
      setError('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAiAnalysis() {
    if (!isAdmin || updating) return;
    const newValue = !aiAnalysisEnabled;
    setUpdating(true);
    setError(null);
    try {
      const response = await axios.patch(
        `${API_URL}/api/organization`,
        { aiAnalysisEnabled: newValue },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.success) { setAiAnalysisEnabled(newValue); }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update AI analysis setting');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading security settings...</p>;
  }

  return (
    <div>
      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── AI Analysis ───────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          <Shield size={20} />
          AI-Powered Test Analysis
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-2xl leading-relaxed">
          When enabled, test failures are automatically analyzed by Google's Gemini AI to provide intelligent
          insights, root cause analysis, and debugging suggestions.
        </p>

        {isAdmin ? (
          <>
            {/* Toggle row */}
            <div className="flex items-center gap-3 px-4 py-4 bg-slate-50 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-lg mb-4 flex-wrap">
              {/* Custom toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={aiAnalysisEnabled}
                onClick={handleToggleAiAnalysis}
                disabled={updating}
                className={`relative flex-shrink-0 w-12 h-7 rounded-full border-0 p-0 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:ring-offset-2 dark:focus:ring-offset-gh-bg-dark ${
                  aiAnalysisEnabled
                    ? 'bg-gh-accent dark:bg-gh-accent-dark'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full shadow transition-transform duration-200 ${
                    aiAnalysisEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none">
                {updating
                  ? 'Updating...'
                  : aiAnalysisEnabled
                    ? 'AI Analysis Enabled'
                    : 'AI Analysis Disabled'}
              </span>
            </div>

            {/* Status alert */}
            {aiAnalysisEnabled ? (
              <div className="flex items-start gap-3 px-4 py-4 rounded-lg text-sm leading-relaxed bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                <Info size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <strong>AI analysis is active.</strong> Failed and unstable test runs will be automatically
                  analyzed to help identify issues faster.
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-4 rounded-lg text-sm leading-relaxed bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <strong>AI analysis is currently disabled.</strong> Test failures will not receive AI-powered insights.
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-3 px-4 py-4 rounded-lg text-sm leading-relaxed bg-slate-50 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark text-slate-600 dark:text-slate-400">
            <Shield size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              AI Analysis is currently{' '}
              <strong>{aiAnalysisEnabled ? 'enabled' : 'disabled'}</strong> for your organization. Only
              administrators can change this setting.
            </div>
          </div>
        )}

        {/* Disclosure */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-gh-border-dark">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Data Processing & Privacy
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            When AI analysis is enabled, test failure logs and relevant diagnostic information are sent to Google's
            Gemini API for processing. The data is analyzed in real-time and is not stored by Google.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            All data transmission is encrypted using TLS 1.3. See our{' '}
            <a href="/privacy" className="text-gh-accent dark:text-gh-accent-dark hover:underline">
              Privacy Policy
            </a>{' '}
            for details.
          </p>
        </div>
      </section>
    </div>
  );
}
