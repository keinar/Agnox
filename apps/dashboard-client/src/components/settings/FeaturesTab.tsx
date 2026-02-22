import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOrganizationFeatures } from '../../hooks/useOrganizationFeatures';

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
    const { features, isLoading, updateFeatures, isUpdating } = useOrganizationFeatures();
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

            {/* Section */}
            <section>
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
        </div>
    );
}
