import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
};

export function ProfileTab() {
    const { user, token } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>My Profile</h2>

                {/* Name - Editable */}
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

                {/* Email - Read-only */}
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

                {/* Role - Badge display */}
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
        </div>
    );
}
