import React from 'react';
import axios from 'axios';
import { Loader2, CheckCircle2, XCircle, ExternalLink, KeyRound, Globe, Mail, Webhook } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Github, Gitlab as GitlabIcon } from 'lucide-react'; // Using Gitlab from lucide-react if available, else another icon
// Note: lucide-react might not have azure, we will use a generic icon or custom SVG for Azure.

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

// Shared input class — consistent across all fields in this tab
const INPUT_CLASS =
    'w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-gh-accent dark:focus:border-gh-accent-dark transition';

export function IntegrationsTab() {
    const { user, token } = useAuth();

    // ── Jira state ────────────────────────────────────────────────────────────
    const [form, setForm] = React.useState<IFormState>({ domain: '', email: '', apiToken: '' });
    const [isConfigured, setIsConfigured] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [testing, setTesting] = React.useState(false);
    const [saveFeedback, setSaveFeedback] = React.useState<FeedbackState>(null);
    const [testFeedback, setTestFeedback] = React.useState<FeedbackState>(null);

    // ── Slack state ───────────────────────────────────────────────────────────
    const isAdmin = user?.role === 'admin';
    const [slackUrl, setSlackUrl] = React.useState('');
    const [slackOriginalUrl, setSlackOriginalUrl] = React.useState('');
    const [slackNotificationEvents, setSlackNotificationEvents] = React.useState<string[]>(['FAILED', 'ERROR', 'UNSTABLE']);
    const [slackLoading, setSlackLoading] = React.useState(true);
    const [slackSaving, setSlackSaving] = React.useState(false);
    const [slackFeedback, setSlackFeedback] = React.useState<FeedbackState>(null);

    // ── CI Integrations state ─────────────────────────────────────────────────
    const [ciState, setCiState] = React.useState({
        github: { token: '', enabled: false, saving: false, feedback: null as FeedbackState },
        gitlab: { token: '', enabled: false, saving: false, feedback: null as FeedbackState },
        azure: { token: '', enabled: false, saving: false, feedback: null as FeedbackState },
    });

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

    // ── Slack fetch ───────────────────────────────────────────────────────────
    React.useEffect(() => {
        let cancelled = false;
        const API_URL = getApiUrl();

        const fetchOrg = async (): Promise<void> => {
            try {
                const res = await axios.get<{ success: boolean; organization: any }>(
                    `${API_URL}/api/organization`,
                    { headers: authHeaders },
                );
                if (!cancelled && res.data.success) {
                    const org = res.data.organization;
                    const url = org.slackWebhookUrl ?? '';
                    setSlackUrl(url);
                    setSlackOriginalUrl(url);
                    setSlackNotificationEvents(org.slackNotificationEvents ?? ['FAILED', 'ERROR', 'UNSTABLE']);

                    const integrations = org.integrations || {};
                    setCiState(prev => ({
                        ...prev,
                        github: { ...prev.github, enabled: integrations.github?.enabled || false },
                        gitlab: { ...prev.gitlab, enabled: integrations.gitlab?.enabled || false },
                        azure: { ...prev.azure, enabled: integrations.azure?.enabled || false },
                    }));
                }
            } catch {
                // Non-critical — silently ignore
            } finally {
                if (!cancelled) setSlackLoading(false);
            }
        };

        fetchOrg();
        return () => { cancelled = true; };
    }, [authHeaders]);

    const handleSlackSave = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setSlackSaving(true);
        setSlackFeedback(null);
        const API_URL = getApiUrl();

        try {
            const payload = {
                slackWebhookUrl: slackUrl.trim() || null,
                slackNotificationEvents
            };
            const res = await axios.patch<{ success: boolean }>(
                `${API_URL}/api/organization`,
                payload,
                { headers: authHeaders },
            );
            if (res.data.success) {
                setSlackOriginalUrl(slackUrl.trim());
                setSlackFeedback({ type: 'success', message: 'Slack webhook saved successfully.' });
                setTimeout(() => setSlackFeedback(null), 3000);
            }
        } catch (err: any) {
            setSlackFeedback({
                type: 'error',
                message: err?.response?.data?.message ?? 'Failed to save Slack webhook.',
            });
        } finally {
            setSlackSaving(false);
        }
    };

    const handleCiSave = async (e: React.FormEvent, provider: 'github' | 'gitlab' | 'azure') => {
        e.preventDefault();
        const tokenVal = ciState[provider].token.trim();
        if (!tokenVal) return;

        setCiState(prev => ({
            ...prev,
            [provider]: { ...prev[provider], saving: true, feedback: null }
        }));

        const API_URL = getApiUrl();
        try {
            const res = await axios.patch(
                `${API_URL}/api/organization/integrations/${provider}`,
                { token: tokenVal, enabled: true },
                { headers: authHeaders }
            );
            if (res.data.success) {
                setCiState(prev => ({
                    ...prev,
                    [provider]: { token: '', enabled: true, saving: false, feedback: { type: 'success', message: `${provider} token saved successfully.` } }
                }));
                setTimeout(() => {
                    setCiState(prev => ({
                        ...prev,
                        [provider]: { ...prev[provider], feedback: null }
                    }));
                }, 3000);
            }
        } catch (err: any) {
            setCiState(prev => ({
                ...prev,
                [provider]: { ...prev[provider], saving: false, feedback: { type: 'error', message: err?.response?.data?.error ?? `Failed to save ${provider} token.` } }
            }));
        }
    };

    const handleCiTokenChange = (provider: 'github' | 'gitlab' | 'azure', value: string) => {
        setCiState(prev => ({
            ...prev,
            [provider]: { ...prev[provider], token: value }
        }));
    };

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
                <Loader2 size={24} className="animate-spin text-blue-500 dark:text-blue-400" />
                <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading integration settings...</span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            {/* Section heading */}
            <div className="mb-6">
                <h2 className="text-base font-semibold text-slate-900 dark:text-gh-text-dark">Integrations</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Connect external services to extend your automation workflow.
                </p>
            </div>

            {/* Jira Card */}
            <div className="rounded-xl border border-slate-300 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gh-border-dark">
                    <div className="flex items-center gap-3">
                        {/* Jira-style icon badge */}
                        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35H17.5v1.61C17.5 10.36 19.46 12.3 21.85 12.3V2.85a.85.85 0 0 0-.85-.85H11.53ZM6.77 6.8a4.362 4.362 0 0 0 4.35 4.34h1.62v1.63a4.362 4.362 0 0 0 4.34 4.34V7.65a.85.85 0 0 0-.85-.85H6.77ZM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.62v1.62C7.97 20.03 9.94 22 12.32 22v-9.54a.85.85 0 0 0-.85-.85L2 11.6Z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-gh-text-dark">Jira</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Atlassian Jira Software</p>
                        </div>
                    </div>
                    {isConfigured && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={12} />
                            Connected
                        </span>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Connect your Jira workspace to create tickets directly from failed executions.
                        Your API token is encrypted with AES-256-GCM before storage.
                    </p>

                    {/* Domain */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="jira-domain">
                            Jira Domain
                        </label>
                        <div className="relative">
                            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                id="jira-domain"
                                type="text"
                                required
                                placeholder="your-org.atlassian.net"
                                value={form.domain}
                                onChange={e => setForm(prev => ({ ...prev, domain: e.target.value }))}
                                className={INPUT_CLASS}
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            Your Atlassian subdomain, e.g.{' '}
                            <code className="bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-1 rounded">acme.atlassian.net</code>
                        </p>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="jira-email">
                            Account Email
                        </label>
                        <div className="relative">
                            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                id="jira-email"
                                type="email"
                                required
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                                className={INPUT_CLASS}
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">The email address associated with your Jira account.</p>
                    </div>

                    {/* API Token */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="jira-token">
                            API Token
                        </label>
                        <div className="relative">
                            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                id="jira-token"
                                type="password"
                                placeholder={isConfigured ? '••••••••  (leave blank to keep existing)' : 'Paste your API token'}
                                value={form.apiToken}
                                onChange={e => setForm(prev => ({ ...prev, apiToken: e.target.value }))}
                                className={INPUT_CLASS}
                            />
                        </div>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            Generate at{' '}
                            <a
                                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-0.5"
                            >
                                Atlassian account settings <ExternalLink size={10} />
                            </a>
                        </p>
                    </div>

                    {/* Save feedback */}
                    {saveFeedback && (
                        <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${saveFeedback.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
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
                        <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${testFeedback.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
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
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gh-bg-dark"
                        >
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {saving ? 'Saving…' : 'Save Configuration'}
                        </button>

                        {isConfigured && (
                            <button
                                type="button"
                                disabled={testing}
                                onClick={handleTest}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-gh-bg-subtle-dark border border-slate-300 dark:border-gh-border-dark rounded-lg hover:bg-slate-50 dark:hover:bg-gh-bg-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-gh-bg-dark"
                            >
                                {testing && <Loader2 size={14} className="animate-spin" />}
                                {testing ? 'Testing…' : 'Test Connection'}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* ── Slack Card ────────────────────────────────────────────────── */}
            <div className="mt-6 rounded-xl border border-slate-300 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gh-border-dark">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#4A154B] flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-gh-text-dark">Slack</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Incoming Webhook Notifications</p>
                        </div>
                    </div>
                    {slackOriginalUrl && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={12} />
                            Connected
                        </span>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSlackSave} className="px-5 py-5 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Receive a Slack message with a deep link to the Investigation Hub whenever a test
                        execution finishes. Leave empty to disable notifications.
                    </p>

                    {slackLoading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-slate-400" />
                            <span className="text-sm text-slate-400">Loading...</span>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label
                                    htmlFor="slack-webhook-url"
                                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5"
                                >
                                    <Webhook size={12} />
                                    Webhook URL
                                </label>
                                <div className="relative">
                                    <Webhook size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                    <input
                                        id="slack-webhook-url"
                                        type="url"
                                        value={slackUrl}
                                        onChange={(e) => setSlackUrl(e.target.value)}
                                        disabled={!isAdmin}
                                        placeholder="https://hooks.slack.com/services/..."
                                        className={isAdmin ? INPUT_CLASS : INPUT_CLASS + ' opacity-60 cursor-not-allowed'}
                                    />
                                </div>
                                {!isAdmin && (
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        Only organization admins can modify notification settings.
                                    </p>
                                )}
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    Notify on Events
                                </label>
                                <div className="space-y-2">
                                    {['PASSED', 'FAILED', 'ERROR', 'UNSTABLE'].map(status => (
                                        <label key={status} className={`flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 ${!isAdmin && 'opacity-60 cursor-not-allowed'}`}>
                                            <input
                                                type="checkbox"
                                                checked={slackNotificationEvents.includes(status)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSlackNotificationEvents(prev => [...prev, status]);
                                                    } else {
                                                        setSlackNotificationEvents(prev => prev.filter(s => s !== status));
                                                    }
                                                }}
                                                disabled={!isAdmin}
                                                className="w-4 h-4 text-[#4A154B] border-slate-300 dark:border-gh-border-dark rounded focus:ring-[#4A154B] disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                            {status}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {slackFeedback && (
                                <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${slackFeedback.type === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
                                    }`}>
                                    {slackFeedback.type === 'success'
                                        ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                                        : <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                                    }
                                    <span>{slackFeedback.message}</span>
                                </div>
                            )}

                            {isAdmin && (
                                <div className="pt-1">
                                    <button
                                        type="submit"
                                        disabled={slackSaving}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#4A154B] hover:bg-[#611f69] rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[#4A154B] focus:ring-offset-2 dark:focus:ring-offset-gh-bg-dark"
                                    >
                                        {slackSaving && <Loader2 size={14} className="animate-spin" />}
                                        {slackSaving ? 'Saving…' : 'Save Webhook'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </form>
            </div>

            {/* ── CI Providers ────────────────────────────────────────────────── */}
            {(['github', 'gitlab', 'azure'] as const).map(provider => {
                const config = ciState[provider];
                const labels = {
                    github: { title: 'GitHub', desc: 'Pull Request integration', icon: <Github size={20} className="text-white" /> },
                    gitlab: { title: 'GitLab', desc: 'Merge Request integration', icon: <GitlabIcon size={20} className="text-white" /> },
                    azure: {
                        title: 'Azure DevOps',
                        desc: 'Pull Request integration',
                        icon: (
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                                <path d="M16.5 2 L22 5 L22 19 L16.5 22 L11 19 L11 14 L16.5 17 L19 15.5 L19 8.5 L16.5 7 L11 10 L11 5 L16.5 2 Z M7.5 7 L2 10 L2 14 L7.5 17 L10 15.5 L10 8.5 L7.5 7 Z" />
                            </svg>
                        )
                    }
                };
                const bgColors = {
                    github: 'bg-black dark:bg-slate-800',
                    gitlab: 'bg-[#FC6D26]',
                    azure: 'bg-[#0078D7]'
                };
                return (
                    <div key={provider} className="mt-6 rounded-xl border border-slate-300 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gh-border-dark">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${bgColors[provider]} flex items-center justify-center flex-shrink-0`}>
                                    {labels[provider].icon}
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-gh-text-dark">{labels[provider].title}</h3>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">{labels[provider].desc}</p>
                                </div>
                            </div>
                            {config.enabled && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 size={12} />
                                    Connected
                                </span>
                            )}
                        </div>

                        <form onSubmit={(e) => handleCiSave(e, provider)} className="px-5 py-5 space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Connect your {labels[provider].title} organization to automatically post AI Analysis reports as comments on {provider === 'gitlab' ? 'Merge Requests' : 'Pull Requests'}.
                            </p>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                    Personal Access Token (PAT)
                                </label>
                                <div className="relative">
                                    <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                    <input
                                        type="password"
                                        placeholder={config.enabled ? '••••••••••••••••  (leave blank to keep existing)' : 'Paste your API token'}
                                        value={config.token}
                                        onChange={e => handleCiTokenChange(provider, e.target.value)}
                                        className={INPUT_CLASS}
                                    />
                                </div>
                            </div>

                            {config.feedback && (
                                <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${config.feedback.type === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
                                    }`}>
                                    {config.feedback.type === 'success'
                                        ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                                        : <XCircle size={15} className="flex-shrink-0 mt-0.5" />
                                    }
                                    <span>{config.feedback.message}</span>
                                </div>
                            )}

                            <div className="pt-1">
                                <button
                                    type="submit"
                                    disabled={config.saving || !config.token.trim()}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gh-bg-dark"
                                >
                                    {config.saving && <Loader2 size={14} className="animate-spin" />}
                                    {config.saving ? 'Saving…' : 'Save Token'}
                                </button>
                            </div>
                        </form>
                    </div>
                );
            })}
        </div>
    );
}
