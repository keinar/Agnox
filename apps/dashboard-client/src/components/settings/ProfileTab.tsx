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

const styles = {
    section: {
        marginBottom: '32px',
    } as React.CSSProperties,
    sectionTitle: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#1e293b',
        marginBottom: '16px',
    } as React.CSSProperties,
    fieldGroup: {
        marginBottom: '24px',
    } as React.CSSProperties,
    label: {
        display: 'block',
        fontSize: '14px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '8px',
    } as React.CSSProperties,
    input: {
        width: '100%',
        maxWidth: '400px',
        padding: '10px 12px',
        fontSize: '14px',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box' as const,
    } as React.CSSProperties,
    inputDisabled: {
        background: '#f9fafb',
        color: '#6b7280',
        cursor: 'not-allowed',
    } as React.CSSProperties,
    button: {
        marginTop: '12px',
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 600,
        color: '#ffffff',
        background: 'linear-gradient(to right, #4f46e5, #7c3aed)',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    } as React.CSSProperties,
    secondaryButton: {
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 500,
        color: '#374151',
        background: '#f3f4f6',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    } as React.CSSProperties,
    dangerButton: {
        padding: '6px 12px',
        fontSize: '12px',
        fontWeight: 500,
        color: '#dc2626',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '4px',
        cursor: 'pointer',
    } as React.CSSProperties,
    roleBadge: {
        display: 'inline-block',
        padding: '6px 14px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
    } as React.CSSProperties,
    adminBadge: {
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
        color: '#667eea',
        border: '1px solid #c7d2fe',
    },
    developerBadge: {
        background: '#f0fdf4',
        color: '#16a34a',
        border: '1px solid #86efac',
    },
    viewerBadge: {
        background: '#f3f4f6',
        color: '#6b7280',
        border: '1px solid #d1d5db',
    },
    message: {
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '14px',
    } as React.CSSProperties,
    successMessage: {
        background: '#ecfdf5',
        color: '#047857',
        border: '1px solid #a7f3d0',
    },
    errorMessage: {
        background: '#fef2f2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
    },
    // API Key specific styles
    keyTable: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        marginTop: '16px',
    } as React.CSSProperties,
    keyRow: {
        borderBottom: '1px solid #e5e7eb',
    } as React.CSSProperties,
    keyCell: {
        padding: '12px 8px',
        fontSize: '14px',
        color: '#374151',
        textAlign: 'left' as const,
    } as React.CSSProperties,
    keyPrefix: {
        fontFamily: 'monospace',
        fontSize: '13px',
        background: '#f3f4f6',
        padding: '4px 8px',
        borderRadius: '4px',
        color: '#4b5563',
    } as React.CSSProperties,
    modalOverlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    } as React.CSSProperties,
    modal: {
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    } as React.CSSProperties,
    keyDisplay: {
        fontFamily: 'monospace',
        fontSize: '14px',
        background: '#1e293b',
        color: '#22c55e',
        padding: '16px',
        borderRadius: '8px',
        wordBreak: 'break-all' as const,
        marginBottom: '12px',
    } as React.CSSProperties,
    warningBox: {
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '13px',
        color: '#92400e',
        marginBottom: '16px',
    } as React.CSSProperties,
    emptyState: {
        textAlign: 'center' as const,
        padding: '32px',
        color: '#6b7280',
        fontSize: '14px',
    } as React.CSSProperties,
};

export function ProfileTab() {
    const { user, token } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // API Key state
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [loadingKeys, setLoadingKeys] = useState(true);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatingKey, setGeneratingKey] = useState(false);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);

    const getRoleBadgeStyle = (role: string) => {
        switch (role) {
            case 'admin':
                return { ...styles.roleBadge, ...styles.adminBadge };
            case 'developer':
                return { ...styles.roleBadge, ...styles.developerBadge };
            case 'viewer':
                return { ...styles.roleBadge, ...styles.viewerBadge };
            default:
                return styles.roleBadge;
        }
    };

    // Fetch API keys on mount
    useEffect(() => {
        fetchApiKeys();
    }, []);

    async function fetchApiKeys() {
        try {
            const response = await axios.get(`${API_URL}/api/auth/api-keys`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setApiKeys(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch API keys:', error);
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
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setMessage({ type: 'success', text: 'Profile updated successfully. Refresh the page to see changes.' });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error: any) {
            console.error('Failed to update profile:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Failed to update profile',
            });
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
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setNewlyCreatedKey(response.data.apiKey);
                setShowNewKeyModal(true);
                setNewKeyName('');
                fetchApiKeys(); // Refresh the list
            }
        } catch (error: any) {
            console.error('Failed to generate API key:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Failed to generate API key',
            });
        } finally {
            setGeneratingKey(false);
        }
    }

    async function handleRevokeKey(keyId: string) {
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/api/auth/api-keys/${keyId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchApiKeys(); // Refresh the list
            setMessage({ type: 'success', text: 'API key revoked successfully.' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            console.error('Failed to revoke API key:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Failed to revoke API key',
            });
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
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }

    return (
        <div>
            {message && (
                <div style={{
                    ...styles.message,
                    ...(message.type === 'success' ? styles.successMessage : styles.errorMessage),
                }}>
                    {message.text}
                </div>
            )}

            {/* Profile Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>My Profile</h2>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={styles.input}
                        placeholder="Your name"
                    />
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim() || name === user?.name}
                        style={{
                            ...styles.button,
                            opacity: saving || !name.trim() || name === user?.name ? 0.5 : 1,
                            cursor: saving || !name.trim() || name === user?.name ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Email</label>
                    <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        style={{ ...styles.input, ...styles.inputDisabled }}
                    />
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        Email cannot be changed
                    </p>
                </div>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Role</label>
                    <span style={getRoleBadgeStyle(user?.role || 'viewer')}>
                        {user?.role || 'viewer'}
                    </span>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                        Your role is assigned by an administrator
                    </p>
                </div>
            </div>

            {/* API Access Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>🔑 API Access</h2>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                    Generate API keys for CI/CD integration. Use these keys instead of username/password.
                </p>

                {/* Generate New Key */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '24px' }}>
                    <div style={{ flex: 1, maxWidth: '300px' }}>
                        <label style={styles.label}>Key Name (optional)</label>
                        <input
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            style={styles.input}
                            placeholder="e.g., GitHub Actions"
                        />
                    </div>
                    <button
                        onClick={handleGenerateKey}
                        disabled={generatingKey}
                        style={{
                            ...styles.button,
                            marginTop: 0,
                            opacity: generatingKey ? 0.5 : 1,
                        }}
                    >
                        {generatingKey ? 'Generating...' : '+ Generate New Key'}
                    </button>
                </div>

                {/* Keys List */}
                {loadingKeys ? (
                    <div style={styles.emptyState}>Loading API keys...</div>
                ) : apiKeys.length === 0 ? (
                    <div style={styles.emptyState}>
                        No API keys yet. Generate one to get started with CI/CD integration.
                    </div>
                ) : (
                    <table style={styles.keyTable}>
                        <thead>
                            <tr style={styles.keyRow}>
                                <th style={{ ...styles.keyCell, fontWeight: 600 }}>Name</th>
                                <th style={{ ...styles.keyCell, fontWeight: 600 }}>Key</th>
                                <th style={{ ...styles.keyCell, fontWeight: 600 }}>Created</th>
                                <th style={{ ...styles.keyCell, fontWeight: 600 }}>Last Used</th>
                                <th style={{ ...styles.keyCell, fontWeight: 600 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {apiKeys.map((key) => (
                                <tr key={key.id} style={styles.keyRow}>
                                    <td style={styles.keyCell}>{key.name}</td>
                                    <td style={styles.keyCell}>
                                        <code style={styles.keyPrefix}>{key.prefix}</code>
                                    </td>
                                    <td style={styles.keyCell}>{formatDate(key.createdAt)}</td>
                                    <td style={styles.keyCell}>{formatDate(key.lastUsed)}</td>
                                    <td style={styles.keyCell}>
                                        <button
                                            onClick={() => handleRevokeKey(key.id)}
                                            style={styles.dangerButton}
                                        >
                                            Revoke
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* New Key Modal */}
            {showNewKeyModal && newlyCreatedKey && (
                <div style={styles.modalOverlay} onClick={closeModal}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                            🎉 API Key Created
                        </h3>

                        <div style={styles.warningBox}>
                            ⚠️ <strong>Important:</strong> This is the only time you'll see this key.
                            Copy it now and store it securely.
                        </div>

                        <div style={styles.keyDisplay}>
                            {newlyCreatedKey}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleCopyKey}
                                style={{
                                    ...styles.button,
                                    flex: 1,
                                    marginTop: 0,
                                    background: copiedKey ? '#22c55e' : undefined,
                                }}
                            >
                                {copiedKey ? '✓ Copied!' : 'Copy Key'}
                            </button>
                            <button
                                onClick={closeModal}
                                style={{ ...styles.secondaryButton, flex: 1 }}
                            >
                                Done
                            </button>
                        </div>

                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '16px' }}>
                            Use this key in the <code>x-api-key</code> header for API requests.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
