import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOrganizationFeatures, IAiFeatureFlags } from '../../hooks/useOrganizationFeatures';
import { Info } from 'lucide-react';

// ── Toggle component ───────────────────────────────────────────────────────────

interface ToggleProps {
    enabled: boolean;
    onChange: (value: boolean) => void;
    disabled: boolean;
}

function Toggle({ enabled, onChange, disabled }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={disabled}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200
                ${enabled
                    ? 'bg-gh-accent dark:bg-gh-accent-dark'
                    : 'bg-slate-300 dark:bg-slate-600'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
                    ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
        </button>
    );
}

// ── Row component ──────────────────────────────────────────────────────────────

interface FeatureRowProps {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: (value: boolean) => void;
    disabled: boolean;
    isAdmin: boolean;
}

function FeatureRow({ label, description, enabled, onToggle, disabled, isAdmin }: FeatureRowProps) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-gh-border-dark last:border-b-0">
            <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            {isAdmin ? (
                <Toggle enabled={enabled} onChange={onToggle} disabled={disabled} />
            ) : (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    enabled
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                    {enabled ? 'Enabled' : 'Disabled'}
                </span>
            )}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FeaturesTab() {
    const { user } = useAuth();
    const { features, aiFeatures, isLoading, updateFeatures, isUpdating } = useOrganizationFeatures();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const isAdmin = user?.role === 'admin';

    async function handleToggle(key: 'testCasesEnabled' | 'testCyclesEnabled', value: boolean) {
        setMessage(null);
        try {
            await updateFeatures({ [key]: value });
            setMessage({ type: 'success', text: 'Feature flag updated successfully.' });
            setTimeout(() => setMessage(null), 3000);
        } catch {
            setMessage({ type: 'error', text: 'Failed to update feature flag. Please try again.' });
        }
    }

    async function handleAiToggle(key: keyof IAiFeatureFlags, value: boolean) {
        setMessage(null);
        try {
            await updateFeatures({ aiFeatures: { [key]: value } });
            setMessage({ type: 'success', text: 'AI feature flag updated successfully.' });
            setTimeout(() => setMessage(null), 3000);
        } catch {
            setMessage({ type: 'error', text: 'Failed to update AI feature flag. Please try again.' });
        }
    }

    if (isLoading) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Loading feature flags...</p>;
    }

    return (
        <div>
            {/* Feedback banner */}
            {message && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
                    message.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                }`}>
                    {message.text}
                </div>
            )}

            {/* ── Module Feature Flags ──────────────────────────────────── */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Feature Management
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {isAdmin
                        ? 'Toggle modules on or off for your organization. Changes take effect immediately for all users.'
                        : 'Shows which modules are currently enabled for your organization.'}
                </p>

                <div className="bg-slate-50 dark:bg-gh-bg-dark rounded-xl border border-slate-200 dark:border-gh-border-dark px-4">
                    <FeatureRow
                        label="Manual Test Repository"
                        description="Enables the Test Cases module for creating and managing manual test cases."
                        enabled={features.testCasesEnabled}
                        onToggle={(v) => handleToggle('testCasesEnabled', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                    <FeatureRow
                        label="Hybrid Test Cycles"
                        description="Enables the Test Cycles module for creating hybrid test cycles combining manual and automated tests."
                        enabled={features.testCyclesEnabled}
                        onToggle={(v) => handleToggle('testCyclesEnabled', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                </div>
            </section>

            {/* ── AI Feature Flags ─────────────────────────────────────── */}
            <section>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    AI Features
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {isAdmin
                        ? 'Control which AI-powered capabilities are active for your organization. Changes take effect immediately.'
                        : 'Shows which AI-powered capabilities are currently active for your organization.'}
                </p>

                {/* Opt-in callout */}
                <div className="flex items-start gap-2.5 mb-4 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm">
                    <Info size={16} className="flex-shrink-0 mt-0.5" />
                    <span>All AI features are opt-in and disabled by default. Enable individual capabilities as needed.</span>
                </div>

                <div className="bg-slate-50 dark:bg-gh-bg-dark rounded-xl border border-slate-200 dark:border-gh-border-dark px-4">
                    <FeatureRow
                        label="Root Cause Analysis"
                        description="Automatically analyzes failed test runs to provide AI-generated root cause insights and debugging suggestions."
                        enabled={aiFeatures.rootCauseAnalysis}
                        onToggle={(v) => handleAiToggle('rootCauseAnalysis', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                    <FeatureRow
                        label="Auto-Bug Generation"
                        description="Generates structured bug reports from failed executions, pre-filled with steps to reproduce, expected vs. actual behavior, and code patch suggestions."
                        enabled={aiFeatures.autoBugGeneration}
                        onToggle={(v) => handleAiToggle('autoBugGeneration', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                    <FeatureRow
                        label="Flakiness & Stability Detective"
                        description="Analyzes historical execution data to detect flaky tests, calculate stability scores, and surface root causes of intermittent failures."
                        enabled={aiFeatures.flakinessDetective}
                        onToggle={(v) => handleAiToggle('flakinessDetective', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                    <FeatureRow
                        label="Smart Test Optimizer"
                        description="Reviews your test cases and suggests improvements for coverage gaps, redundant assertions, and maintainability."
                        enabled={aiFeatures.testOptimizer}
                        onToggle={(v) => handleAiToggle('testOptimizer', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                    <FeatureRow
                        label="Smart PR Routing"
                        description="Automatically selects and triggers the most relevant test suite when a pull request is opened, based on changed files."
                        enabled={aiFeatures.prRouting}
                        onToggle={(v) => handleAiToggle('prRouting', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                    <FeatureRow
                        label="Quality Chatbot"
                        description="Conversational interface to query your test data using natural language. Supports charts and trend analysis."
                        enabled={aiFeatures.qualityChatbot}
                        onToggle={(v) => handleAiToggle('qualityChatbot', v)}
                        disabled={isUpdating}
                        isAdmin={isAdmin}
                    />
                </div>
            </section>
        </div>
    );
}
