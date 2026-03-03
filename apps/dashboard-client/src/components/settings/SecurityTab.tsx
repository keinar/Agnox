import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Shield, Key, CheckCircle2, Circle, Trash2, ChevronDown, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type LlmProvider = 'gemini' | 'openai' | 'anthropic';
type LlmModel = 'gemini-2.5-flash' | 'gpt-4o' | 'claude-3-5-sonnet';

interface IAiConfigState {
    defaultModel: LlmModel;
    byokConfigured: Record<LlmProvider, boolean>;
}

const MODEL_LABELS: Record<LlmModel, string> = {
    'gemini-2.5-flash':  'Gemini 2.5 Flash (Google)',
    'gpt-4o':            'GPT-4o (OpenAI)',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet (Anthropic)',
};

const PROVIDER_LABELS: Record<LlmProvider, string> = {
    gemini:    'Google Gemini',
    openai:    'OpenAI',
    anthropic: 'Anthropic',
};

const DEFAULT_CONFIG: IAiConfigState = {
    defaultModel: 'gemini-2.5-flash',
    byokConfigured: { gemini: false, openai: false, anthropic: false },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function SecurityTab() {
    const { user, token } = useAuth();
    const [config, setConfig] = useState<IAiConfigState>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [savingModel, setSavingModel] = useState(false);
    const [keyInputs, setKeyInputs] = useState<Record<LlmProvider, string>>({
        gemini: '', openai: '', anthropic: '',
    });
    const [savingKey, setSavingKey] = useState<LlmProvider | null>(null);
    const [removingKey, setRemovingKey] = useState<LlmProvider | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const isAdmin = user?.role === 'admin';

    useEffect(() => { fetchAiConfig(); }, []);

    function showMessage(type: 'success' | 'error', text: string) {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    }

    async function fetchAiConfig() {
        try {
            const res = await axios.get(`${API_URL}/api/organization/ai-config`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setConfig(res.data.data);
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to load AI configuration.' });
        } finally {
            setLoading(false);
        }
    }

    async function handleModelChange(model: LlmModel) {
        if (!isAdmin || savingModel) return;
        setSavingModel(true);
        try {
            const res = await axios.patch(
                `${API_URL}/api/organization/ai-config`,
                { defaultModel: model },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.data.success) {
                setConfig(res.data.data);
                showMessage('success', 'Default AI model updated.');
            }
        } catch (err: any) {
            showMessage('error', err.response?.data?.message || 'Failed to update model.');
        } finally {
            setSavingModel(false);
        }
    }

    async function handleSaveKey(provider: LlmProvider) {
        const apiKey = keyInputs[provider].trim();
        if (!apiKey || savingKey) return;
        setSavingKey(provider);
        try {
            const res = await axios.patch(
                `${API_URL}/api/organization/ai-config`,
                { byok: { provider, apiKey } },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.data.success) {
                setConfig(res.data.data);
                setKeyInputs(prev => ({ ...prev, [provider]: '' }));
                showMessage('success', `${PROVIDER_LABELS[provider]} API key saved.`);
            }
        } catch (err: any) {
            showMessage('error', err.response?.data?.message || `Failed to save ${PROVIDER_LABELS[provider]} key.`);
        } finally {
            setSavingKey(null);
        }
    }

    async function handleRemoveKey(provider: LlmProvider) {
        if (removingKey) return;
        setRemovingKey(provider);
        try {
            const res = await axios.patch(
                `${API_URL}/api/organization/ai-config`,
                { removeByok: provider },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.data.success) {
                setConfig(res.data.data);
                showMessage('success', `${PROVIDER_LABELS[provider]} API key removed.`);
            }
        } catch (err: any) {
            showMessage('error', err.response?.data?.message || `Failed to remove key.`);
        } finally {
            setRemovingKey(null);
        }
    }

    if (loading) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Loading AI configuration...</p>;
    }

    return (
        <div>
            {/* Feedback banner */}
            {message && (
                <div className={`mb-6 px-4 py-3 rounded-lg text-sm border ${
                    message.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                }`}>
                    {message.text}
                </div>
            )}

            {/* ── Default AI Model ─────────────────────────────────────────── */}
            <section className="mb-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    <Shield size={20} />
                    AI Model Configuration
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-2xl leading-relaxed">
                    Select the default AI model for all AI-powered features in your organization. You can
                    supply your own API key below, or the platform will use its default key.
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Default AI Model
                    </label>
                    {isAdmin ? (
                        <div className="relative inline-block w-full max-w-xs">
                            <select
                                value={config.defaultModel}
                                onChange={e => handleModelChange(e.target.value as LlmModel)}
                                disabled={savingModel}
                                className="w-full appearance-none px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-gh-border-dark bg-white dark:bg-gh-bg-dark text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark"
                            >
                                {(Object.keys(MODEL_LABELS) as LlmModel[]).map(m => (
                                    <option key={m} value={m}>{MODEL_LABELS[m]}</option>
                                ))}
                            </select>
                            <ChevronDown
                                size={16}
                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                            />
                        </div>
                    ) : (
                        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                            {MODEL_LABELS[config.defaultModel]}
                        </span>
                    )}
                </div>
            </section>

            {/* ── Bring Your Own Key ───────────────────────────────────────── */}
            <section className="mb-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    <Key size={20} />
                    Bring Your Own Key (BYOK)
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-2xl leading-relaxed">
                    Store your own API keys per provider. Keys are encrypted with AES-256-GCM and
                    never returned in plaintext. When a BYOK key is configured, it takes priority over
                    the platform default.
                </p>

                <div className="rounded-xl border border-slate-200 dark:border-gh-border-dark divide-y divide-slate-100 dark:divide-gh-border-dark overflow-hidden">
                    {(['gemini', 'openai', 'anthropic'] as LlmProvider[]).map(provider => {
                        const configured = config.byokConfigured[provider];
                        const isRemoving = removingKey === provider;
                        const isSaving   = savingKey   === provider;

                        return (
                            <div key={provider} className="flex flex-col gap-3 px-5 py-4 bg-white dark:bg-gh-bg-dark">
                                {/* Provider row header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        {configured ? (
                                            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                                        ) : (
                                            <Circle size={16} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                        )}
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                            {PROVIDER_LABELS[provider]}
                                        </span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                            configured
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                        }`}>
                                            {configured ? 'Configured' : 'Using Platform Default'}
                                        </span>
                                    </div>
                                    {isAdmin && configured && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveKey(provider)}
                                            disabled={isRemoving || !!savingKey}
                                            className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <Trash2 size={13} />
                                            {isRemoving ? 'Removing…' : 'Remove'}
                                        </button>
                                    )}
                                </div>

                                {/* Key input row (admin only) */}
                                {isAdmin && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="password"
                                            placeholder={configured ? 'Enter new key to replace existing' : 'Paste API key here'}
                                            value={keyInputs[provider]}
                                            onChange={e => setKeyInputs(prev => ({ ...prev, [provider]: e.target.value }))}
                                            disabled={isSaving || isRemoving}
                                            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-gh-border-dark bg-slate-50 dark:bg-gh-bg-dark text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSaveKey(provider)}
                                            disabled={!keyInputs[provider].trim() || isSaving || isRemoving}
                                            className="px-4 py-2 rounded-lg bg-gh-accent dark:bg-gh-accent-dark text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity whitespace-nowrap"
                                        >
                                            {isSaving ? 'Saving…' : 'Save Key'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Data Processing & Privacy ─────────────────────────────── */}
            <section>
                <div className="pt-6 border-t border-slate-200 dark:border-gh-border-dark">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                        <Info size={15} />
                        Data Processing & Privacy
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                        When AI features are active, test failure logs and relevant diagnostic information are
                        sent to the configured AI provider for processing. Data is analyzed in real-time and
                        is not stored by the provider beyond their standard usage policies.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        BYOK keys are encrypted with AES-256-GCM before being stored and are never
                        transmitted to the frontend. All data transmission uses TLS 1.3. See our{' '}
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
