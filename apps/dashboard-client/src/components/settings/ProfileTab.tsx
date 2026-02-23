import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    lastUsed: string | null;
}

// ── Shared class strings ───────────────────────────────────────────────────────

const INPUT_CLASS =
    'w-full max-w-sm px-3 py-2.5 text-sm border border-slate-300 dark:border-gh-border-dark rounded-lg ' +
    'bg-white dark:bg-gh-bg-dark text-slate-900 dark:text-slate-200 ' +
    'placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-gh-accent dark:focus:ring-gh-accent-dark focus:border-transparent transition box-border';

const PRIMARY_BTN =
    'px-5 py-2.5 text-sm font-semibold text-white bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90 ' +
    'rounded-lg transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRoleBadgeClass(role: string): string {
    switch (role) {
        case 'admin':
            return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
        case 'developer':
            return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
        default:
            return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
    }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProfileTab() {
    const { user, token } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loadingKeys, setLoadingKeys] = useState(true);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatingKey, setGeneratingKey] = useState(false);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);

    useEffect(() => { fetchApiKeys(); }, []);

    async function fetchApiKeys() {
        try {
            const response = await axios.get(`${API_URL}/api/auth/api-keys`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.success) { setApiKeys(response.data.data); }
        } catch {
            // Non-critical
        } finally {
            setLoadingKeys(false);
        }
    }

    async function handleSave() {
        if (!name.trim() || name === user?.name) return;
        setSaving(true);
        setMessage(null);
        try {
            const response = await axios.patch(
                `${API_URL}/api/auth/profile`,
                { name: name.trim() },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Profile updated successfully. Refresh the page to see changes.' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    }

    async function handleGenerateKey() {
        setGeneratingKey(true);
        try {
            const response = await axios.post(
                `${API_URL}/api/auth/api-keys`,
                { name: newKeyName.trim() || 'Unnamed Key' },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (response.data.success) {
                setNewlyCreatedKey(response.data.apiKey);
                setShowNewKeyModal(true);
                setNewKeyName('');
                fetchApiKeys();
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to generate API key' });
        } finally {
            setGeneratingKey(false);
        }
    }

    async function handleRevokeKey(keyId: string) {
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;
        try {
            await axios.delete(`${API_URL}/api/auth/api-keys/${keyId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchApiKeys();
            setMessage({ type: 'success', text: 'API key revoked successfully.' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to revoke API key' });
        }
    }

    function handleCopyKey() {
        if (newlyCreatedKey) {
            navigator.clipboard.writeText(newlyCreatedKey);
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2000);
        }
    }

    function closeModal() {
        setShowNewKeyModal(false);
        setNewlyCreatedKey(null);
        setCopiedKey(false);
    }

    function formatDate(dateString: string | null) {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

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

            {/* ── Profile Section ───────────────────────────────────────────────── */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">My Profile</h2>

                {/* Name */}
                <div className="mb-5">
                    <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Name</label>
                    <input
                        id="profile-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`mr-2.5 ${INPUT_CLASS}`}
                        placeholder="Your name"
                    />
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim() || name === user?.name}
                        className={`mt-3 ${PRIMARY_BTN}`}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                {/* Email (read-only) */}
                <div className="mb-5">
                    <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
                    <input
                        id="profile-email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full max-w-sm px-3 py-2.5 text-sm border border-slate-200 dark:border-gh-border-dark rounded-lg bg-slate-100 dark:bg-gh-bg-subtle-dark text-slate-500 dark:text-slate-500 cursor-not-allowed box-border"
                    />
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Email cannot be changed</p>
                </div>

                {/* Role badge */}
                <div className="mb-5">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</p>
                    <span className={`inline-block px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide ${getRoleBadgeClass(user?.role || 'viewer')}`}>
                        {user?.role || 'viewer'}
                    </span>
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Your role is assigned by an administrator</p>
                </div>
            </section>

            {/* ── API Access ────────────────────────────────────────────────────── */}
            <section className="mb-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">API Access</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                    Generate API keys for CI/CD integration. Use these keys instead of username/password.
                </p>

                {/* Generate key row */}
                <div className="flex gap-3 items-end mb-6">
                    <div className="flex-1 max-w-xs">
                        <label htmlFor="new-key-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Key Name (optional)
                        </label>
                        <input
                            id="new-key-name"
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className={INPUT_CLASS}
                            placeholder="e.g., GitHub Actions"
                        />
                    </div>
                    <button
                        onClick={handleGenerateKey}
                        disabled={generatingKey}
                        className={PRIMARY_BTN}
                    >
                        {generatingKey ? 'Generating...' : '+ Generate New Key'}
                    </button>
                </div>

                {/* Keys list */}
                {loadingKeys ? (
                    <p className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">Loading API keys...</p>
                ) : apiKeys.length === 0 ? (
                    <p className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                        No API keys yet. Generate one to get started with CI/CD integration.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gh-border-dark">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-gh-bg-dark border-b border-slate-200 dark:border-gh-border-dark">
                                    {['Name', 'Key', 'Created', 'Last Used', 'Actions'].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            {h === 'Actions' ? '' : h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {apiKeys.map((key) => (
                                    <tr key={key.id} className="border-b border-slate-100 dark:border-gh-border-dark last:border-0 hover:bg-slate-50 dark:hover:bg-gh-bg-dark transition-colors">
                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{key.name}</td>
                                        <td className="px-4 py-3">
                                            <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded">
                                                {key.prefix}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums">{formatDate(key.createdAt)}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums">{formatDate(key.lastUsed)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleRevokeKey(key.id)}
                                                className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                                            >
                                                Revoke
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ── New Key Modal ─────────────────────────────────────────────────── */}
            {showNewKeyModal && newlyCreatedKey && (
                <div
                    role="presentation"
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/50"
                    onClick={closeModal}
                    onKeyDown={(e) => e.key === 'Escape' && closeModal()}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="apikey-modal-title"
                        className="bg-white dark:bg-gh-bg-subtle-dark rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-gh-border-dark"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        <h3 id="apikey-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                            API Key Created
                        </h3>

                        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                            <strong>Important:</strong> This is the only time you'll see this key. Copy it now and store it securely.
                        </div>

                        <div className="mb-4 font-mono text-sm bg-slate-950 text-emerald-400 px-4 py-4 rounded-lg break-all">
                            {newlyCreatedKey}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCopyKey}
                                className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer ${copiedKey
                                    ? 'bg-emerald-500 hover:bg-emerald-600'
                                    : 'bg-gh-accent dark:bg-gh-accent-dark hover:opacity-90'
                                    }`}
                            >
                                {copiedKey ? '✓ Copied!' : 'Copy Key'}
                            </button>
                            <button
                                onClick={closeModal}
                                className="flex-1 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-gh-bg-dark border border-slate-200 dark:border-gh-border-dark rounded-lg hover:bg-slate-200 dark:hover:bg-gh-bg-subtle-dark transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>

                        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                            Use this key as a Bearer token in the <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Authorization</code> header, or in the <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">x-api-key</code> header for API requests.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
