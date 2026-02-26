/**
 * Environment Variables Tab
 *
 * Manages per-project environment variables that are injected into Docker
 * containers at test execution time (e.g. BASE_URL, E2E_EMAIL, E2E_PASSWORD).
 *
 * - Non-secret values are stored and displayed as plaintext.
 * - Secret values are encrypted at rest; the API always returns "********".
 * - The table never reveals a secret's plaintext — users must set a new value
 *   to update an existing secret.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Shared class strings (matches RunSettingsTab style) ────────────────────────

const INPUT_CLASS =
    'w-full px-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition';

const SELECT_CLASS =
    'w-full px-3 py-2 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition cursor-pointer';

const BTN_PRIMARY =
    'px-4 py-2 text-sm font-medium rounded-lg bg-gh-accent dark:bg-gh-accent-dark text-white ' +
    'hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed';

const BTN_DANGER =
    'px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 ' +
    'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50';

const BTN_GHOST =
    'px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-gh-border-dark ' +
    'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition';

// ── Types ──────────────────────────────────────────────────────────────────────

interface IProject {
    id: string;
    name: string;
    slug: string;
}

interface IEnvVar {
    id: string;
    key: string;
    value: string;
    isSecret: boolean;
    createdAt: string;
    updatedAt: string;
}

const EMPTY_FORM = { key: '', value: '', isSecret: false };

// ── Component ──────────────────────────────────────────────────────────────────

export function EnvironmentVariablesTab() {
    const { token } = useAuth();

    const [projects, setProjects] = useState<IProject[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [envVars, setEnvVars] = useState<IEnvVar[]>([]);

    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [isLoadingVars, setIsLoadingVars] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const authHeaders = { Authorization: `Bearer ${token}` };

    // ── Load projects ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!token) return;
        setIsLoadingProjects(true);
        axios
            .get(`${API_URL}/api/projects`, { headers: authHeaders })
            .then(res => {
                const list: IProject[] = res.data.projects || [];
                setProjects(list);
                if (list.length > 0) setSelectedProjectId(list[0].id);
            })
            .catch(() => setError('Failed to load projects'))
            .finally(() => setIsLoadingProjects(false));
    }, [token]);

    // ── Load env vars for selected project ────────────────────────────────────
    const loadEnvVars = useCallback(() => {
        if (!selectedProjectId || !token) return;
        setIsLoadingVars(true);
        setError(null);
        axios
            .get(`${API_URL}/api/projects/${selectedProjectId}/env`, { headers: authHeaders })
            .then(res => setEnvVars(res.data.data || []))
            .catch(() => setError('Failed to load environment variables'))
            .finally(() => setIsLoadingVars(false));
    }, [selectedProjectId, token]);

    useEffect(() => {
        loadEnvVars();
    }, [loadEnvVars]);

    // ── Helpers ────────────────────────────────────────────────────────────────
    function showSuccess(msg: string) {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    }

    function resetForm() {
        setForm(EMPTY_FORM);
        setEditingId(null);
    }

    function startEdit(v: IEnvVar) {
        setEditingId(v.id);
        // Never pre-fill secret values — user must type a new one to update
        setForm({ key: v.key, value: v.isSecret ? '' : v.value, isSecret: v.isSecret });
    }

    // ── Submit (create or update) ──────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedProjectId) return;

        const trimmedKey = form.key.trim();
        const trimmedValue = form.value.trim();

        if (!trimmedKey) { setError('Key is required'); return; }
        if (!trimmedValue && !editingId) { setError('Value is required'); return; }
        // When editing a secret and value is empty, we keep the existing secret
        if (!trimmedValue && editingId) {
            const existing = envVars.find(v => v.id === editingId);
            if (!existing?.isSecret) { setError('Value is required'); return; }
        }

        setError(null);
        setIsSaving(true);

        try {
            if (editingId) {
                const payload: Record<string, unknown> = { key: trimmedKey, isSecret: form.isSecret };
                // Only include value if user typed something (avoids overwriting secret with empty string)
                if (trimmedValue) payload.value = trimmedValue;

                await axios.put(
                    `${API_URL}/api/projects/${selectedProjectId}/env/${editingId}`,
                    payload,
                    { headers: authHeaders },
                );
                showSuccess('Variable updated');
            } else {
                await axios.post(
                    `${API_URL}/api/projects/${selectedProjectId}/env`,
                    { key: trimmedKey, value: trimmedValue, isSecret: form.isSecret },
                    { headers: authHeaders },
                );
                showSuccess('Variable added');
            }
            resetForm();
            loadEnvVars();
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to save variable');
        } finally {
            setIsSaving(false);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    async function handleDelete(varId: string) {
        if (!selectedProjectId) return;
        setDeletingId(varId);
        setError(null);
        try {
            await axios.delete(
                `${API_URL}/api/projects/${selectedProjectId}/env/${varId}`,
                { headers: authHeaders },
            );
            showSuccess('Variable deleted');
            loadEnvVars();
            if (editingId === varId) resetForm();
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Failed to delete variable');
        } finally {
            setDeletingId(null);
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-gh-text dark:text-gh-text-dark">
                    Environment Variables
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Variables are injected into your Docker test containers at run time.
                    Mark a variable as <strong>Secret</strong> to encrypt it at rest — its
                    value will never be displayed here again.
                </p>
            </div>

            {/* Project selector */}
            <div className="max-w-sm">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Project
                </label>
                {isLoadingProjects ? (
                    <div className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ) : projects.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        No projects found. Create one in Run Settings first.
                    </p>
                ) : (
                    <select
                        className={SELECT_CLASS}
                        value={selectedProjectId || ''}
                        onChange={e => { setSelectedProjectId(e.target.value); resetForm(); }}
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {selectedProjectId && (
                <>
                    {/* ── Add / Edit Form ─────────────────────────────────────── */}
                    <div className="border border-slate-200 dark:border-gh-border-dark rounded-xl p-5 bg-slate-50 dark:bg-gh-surface-dark space-y-4">
                        <h3 className="text-sm font-semibold text-gh-text dark:text-gh-text-dark">
                            {editingId ? 'Edit Variable' : 'Add Variable'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Key
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="E2E_EMAIL"
                                        className={INPUT_CLASS}
                                        value={form.key}
                                        onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                                        spellCheck={false}
                                        autoComplete="off"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        Value
                                        {editingId && envVars.find(v => v.id === editingId)?.isSecret && (
                                            <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-normal">
                                                (leave blank to keep existing secret)
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type={form.isSecret ? 'password' : 'text'}
                                        placeholder={form.isSecret ? '••••••••' : 'https://example.com'}
                                        className={INPUT_CLASS}
                                        value={form.value}
                                        onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            {/* Secret toggle */}
                            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={form.isSecret}
                                    onClick={() => setForm(f => ({ ...f, isSecret: !f.isSecret }))}
                                    className={[
                                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gh-accent',
                                        form.isSecret
                                            ? 'bg-gh-accent dark:bg-gh-accent-dark'
                                            : 'bg-slate-300 dark:bg-slate-600',
                                    ].join(' ')}
                                >
                                    <span
                                        className={[
                                            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                                            form.isSecret ? 'translate-x-4' : 'translate-x-1',
                                        ].join(' ')}
                                    />
                                </button>
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    Secret
                                </span>
                                {form.isSecret && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                        Value will be encrypted and never shown again
                                    </span>
                                )}
                            </label>

                            {/* Feedback */}
                            {error && (
                                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                            )}
                            {successMsg && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">{successMsg}</p>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                                <button type="submit" className={BTN_PRIMARY} disabled={isSaving}>
                                    {isSaving ? 'Saving…' : editingId ? 'Update Variable' : 'Add Variable'}
                                </button>
                                {editingId && (
                                    <button type="button" className={BTN_GHOST} onClick={resetForm}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* ── Variable Table ───────────────────────────────────────── */}
                    <div className="border border-slate-200 dark:border-gh-border-dark rounded-xl overflow-hidden">
                        {isLoadingVars ? (
                            <div className="p-6 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                ))}
                            </div>
                        ) : envVars.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    No environment variables yet. Add one above.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-gh-surface-dark border-b border-slate-200 dark:border-gh-border-dark">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[35%]">
                                            Key
                                        </th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                            Value
                                        </th>
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide w-20">
                                            Type
                                        </th>
                                        <th className="px-4 py-2.5 w-24" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-gh-border-dark">
                                    {envVars.map(v => (
                                        <tr
                                            key={v.id}
                                            className={[
                                                'group transition-colors',
                                                editingId === v.id
                                                    ? 'bg-blue-50 dark:bg-blue-900/10'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                                            ].join(' ')}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-xs text-gh-text dark:text-gh-text-dark bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                    {v.key}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs truncate max-w-xs">
                                                {v.isSecret ? (
                                                    <span className="text-slate-400 dark:text-slate-500 tracking-widest">
                                                        ••••••••
                                                    </span>
                                                ) : (
                                                    v.value
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {v.isSecret ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                                                        Secret
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                        Plain
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        type="button"
                                                        className={BTN_GHOST}
                                                        onClick={() => startEdit(v)}
                                                        disabled={!!deletingId}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={BTN_DANGER}
                                                        onClick={() => handleDelete(v.id)}
                                                        disabled={deletingId === v.id}
                                                    >
                                                        {deletingId === v.id ? '…' : 'Delete'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        {envVars.length} variable{envVars.length !== 1 ? 's' : ''} · Max 50 per project
                    </p>
                </>
            )}
        </div>
    );
}
