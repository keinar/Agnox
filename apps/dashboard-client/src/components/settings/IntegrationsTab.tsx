import React from 'react';
import axios from 'axios';
import { Loader2, CheckCircle2, XCircle, ExternalLink, KeyRound, Globe, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface IJiraConfig {
    domain: string;
    email: string;
    isConfigured: boolean;
}

interface IFormState {
    domain: string;
    email: string;
    apiToken: string;
}

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

const getApiUrl = () =>
    window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? import.meta.env.VITE_API_URL
        : 'http://localhost:3000';

export function IntegrationsTab() {
    const { token } = useAuth();

    const [form, setForm] = React.useState<IFormState>({ domain: '', email: '', apiToken: '' });
    const [isConfigured, setIsConfigured] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [testing, setTesting] = React.useState(false);
    const [saveFeedback, setSaveFeedback] = React.useState<FeedbackState>(null);
    const [testFeedback, setTestFeedback] = React.useState<FeedbackState>(null);

    const authHeaders = React.useMemo(
        () => ({ Authorization: `Bearer ${token}` }),
        [token],
    );

    React.useEffect(() => {
        let cancelled = false;
        const API_URL = getApiUrl();

        const fetchConfig = async () => {
            try {
                const res = await axios.get<{ success: boolean; data?: IJiraConfig }>(
                    `${API_URL}/api/integrations/jira`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success && res.data.data) {
                    const cfg = res.data.data;
                    setForm({ domain: cfg.domain ?? '', email: cfg.email ?? '', apiToken: '' });
                    setIsConfigured(cfg.isConfigured ?? false);
                }
            } catch {
                // Not yet configured — silently ignore 404
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchConfig();
        return () => { cancelled = true; };
    }, [authHeaders]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSaveFeedback(null);
        const API_URL = getApiUrl();

        try {
            await axios.put(
                `${API_URL}/api/integrations/jira`,
                { domain: form.domain.trim(), email: form.email.trim(), token: form.apiToken },
                { headers: authHeaders },
            );
            setIsConfigured(true);
            setForm(prev => ({ ...prev, apiToken: '' }));
            setSaveFeedback({ type: 'success', message: 'Jira integration saved successfully.' });
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? 'Failed to save configuration.';
            setSaveFeedback({ type: 'error', message: msg });
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestFeedback(null);
        const API_URL = getApiUrl();

        try {
            const res = await axios.post<{ success: boolean; data?: { message?: string } }>(
                `${API_URL}/api/integrations/jira/test`,
                {},
                { headers: authHeaders },
            );
            const msg = res.data.data?.message ?? 'Connection successful!';
            setTestFeedback({ type: 'success', message: msg });
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? 'Connection test failed. Check your credentials.';
            setTestFeedback({ type: 'error', message: msg });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-indigo-500" />
                <span className="ml-3 text-sm text-slate-500">Loading integration settings...</span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            {/* Section heading */}
            <div className="mb-6">
                <h2 className="text-base font-semibold text-slate-900">Integrations</h2>
                <p className="mt-1 text-sm text-slate-500">
                    Connect external services to extend your automation workflow.
                </p>
            </div>

            {/* Jira Card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        {/* Jira-style icon badge */}
                        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35H17.5v1.61C17.5 10.36 19.46 12.3 21.85 12.3V2.85a.85.85 0 0 0-.85-.85H11.53ZM6.77 6.8a4.362 4.362 0 0 0 4.35 4.34h1.62v1.63a4.362 4.362 0 0 0 4.34 4.34V7.65a.85.85 0 0 0-.85-.85H6.77ZM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.62v1.62C7.97 20.03 9.94 22 12.32 22v-9.54a.85.85 0 0 0-.85-.85L2 11.6Z"/>
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">Jira</h3>
                            <p className="text-xs text-slate-400">Atlassian Jira Software</p>
                        </div>
                    </div>
                    {isConfigured && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} />
                            Connected
                        </span>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Connect your Jira workspace to create tickets directly from failed executions.
                        Your API token is encrypted with AES-256-GCM before storage.
                    </p>

                    {/* Domain */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-domain">
                            Jira Domain
                        </label>
                        <div className="relative">
                            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="jira-domain"
                                type="text"
                                required
                                placeholder="your-org.atlassian.net"
                                value={form.domain}
                                onChange={e => setForm(prev => ({ ...prev, domain: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Your Atlassian subdomain, e.g. <code className="bg-slate-100 px-1 rounded">acme.atlassian.net</code></p>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-email">
                            Account Email
                        </label>
                        <div className="relative">
                            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="jira-email"
                                type="email"
                                required
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">The email address associated with your Jira account.</p>
                    </div>

                    {/* API Token */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="jira-token">
                            API Token
                        </label>
                        <div className="relative">
                            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="jira-token"
                                type="password"
                                placeholder={isConfigured ? '••••••••  (leave blank to keep existing)' : 'Paste your API token'}
                                value={form.apiToken}
                                onChange={e => setForm(prev => ({ ...prev, apiToken: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                            Generate at{' '}
                            <a
                                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-0.5"
                            >
                                Atlassian account settings <ExternalLink size={10} />
                            </a>
                        </p>
                    </div>

                    {/* Save feedback */}
                    {saveFeedback && (
                        <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                            saveFeedback.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-700'
                        }`}>
                            {saveFeedback.type === 'success'
                                ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                                : <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                            }
                            <span>{saveFeedback.message}</span>
                        </div>
                    )}

                    {/* Test Connection feedback */}
                    {testFeedback && (
                        <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                            testFeedback.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-700'
                        }`}>
                            {testFeedback.type === 'success'
                                ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                                : <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                            }
                            <span>{testFeedback.message}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {saving ? 'Saving…' : 'Save Configuration'}
                        </button>

                        {isConfigured && (
                            <button
                                type="button"
                                disabled={testing}
                                onClick={handleTest}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                            >
                                {testing && <Loader2 size={14} className="animate-spin" />}
                                {testing ? 'Testing…' : 'Test Connection'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
