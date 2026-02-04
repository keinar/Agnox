import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { X, Mail, Shield } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Organization {
  userCount: number;
  userLimit: number;
}

interface InviteModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  } as React.CSSProperties,
  modal: {
    background: '#ffffff',
    borderRadius: '16px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    maxHeight: '90vh',
    overflow: 'auto',
  } as React.CSSProperties,
  header: {
    padding: '24px 24px 20px 24px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#1e293b',
  } as React.CSSProperties,
  closeButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  content: {
    padding: '24px',
  } as React.CSSProperties,
  usageInfo: {
    padding: '12px 16px',
    background: '#f0f4ff',
    border: '1px solid #c7d2fe',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#667eea',
    marginBottom: '24px',
  } as React.CSSProperties,
  warningInfo: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#dc2626',
    marginBottom: '24px',
  } as React.CSSProperties,
  fieldGroup: {
    marginBottom: '20px',
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
    padding: '12px 14px 12px 42px',
    fontSize: '15px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  inputWrapper: {
    position: 'relative' as const,
  } as React.CSSProperties,
  inputIcon: {
    position: 'absolute' as const,
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    fontSize: '15px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    cursor: 'pointer',
    background: '#ffffff',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  roleOption: {
    padding: '8px',
    fontSize: '14px',
  } as React.CSSProperties,
  roleDescription: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '6px',
  } as React.CSSProperties,
  footer: {
    padding: '20px 24px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#6b7280',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  submitButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  submitButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  errorMessage: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '16px',
  } as React.CSSProperties,
};

export function InviteModal({ onClose, onSuccess }: InviteModalProps) {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'developer' | 'viewer' | 'admin'>('developer');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganization();
  }, []);

  async function fetchOrganization() {
    try {
      const response = await axios.get(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setOrganization({
          userCount: response.data.organization.userCount,
          userLimit: response.data.organization.userLimit,
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch organization:', error);
      setError('Failed to load organization details');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/invitations`,
        { email, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to send invitation:', error);
      setError(error.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  const canInvite = organization && organization.userCount < organization.userLimit;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Invite Team Member</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div style={styles.content}>
            {loading ? (
              <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading...</div>
            ) : (
              <>
                {/* Usage Info */}
                {organization && (
                  <div style={canInvite ? styles.usageInfo : styles.warningInfo}>
                    <strong>
                      Team Members: {organization.userCount} / {organization.userLimit}
                    </strong>
                    {!canInvite && (
                      <div style={{ marginTop: '8px' }}>
                        You've reached your user limit. Upgrade your plan to invite more members.
                      </div>
                    )}
                  </div>
                )}

                {/* Error Message */}
                {error && <div style={styles.errorMessage}>{error}</div>}

                {/* Email Input */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Email Address</label>
                  <div style={styles.inputWrapper}>
                    <Mail size={18} style={styles.inputIcon} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={styles.input}
                      placeholder="colleague@company.com"
                      required
                      disabled={!canInvite || submitting}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#667eea';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                      }}
                    />
                  </div>
                </div>

                {/* Role Selector */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Role</label>
                  <div style={styles.inputWrapper}>
                    <Shield size={18} style={styles.inputIcon} />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      style={styles.select}
                      disabled={!canInvite || submitting}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#667eea';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <option value="developer">Developer - Can run tests and view reports</option>
                      <option value="viewer">Viewer - Read-only access</option>
                      <option value="admin">Admin - Full access (use sparingly)</option>
                    </select>
                  </div>
                  <div style={styles.roleDescription}>
                    {role === 'developer' && 'Can run tests, edit tests, and view all reports.'}
                    {role === 'viewer' && 'Can view test results and reports, but cannot run or edit tests.'}
                    {role === 'admin' &&
                      'Full organization access including managing members, billing, and settings.'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelButton}
              disabled={submitting}
              onMouseOver={(e) => {
                if (!submitting) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canInvite || submitting || loading}
              style={{
                ...styles.submitButton,
                ...(!canInvite || submitting || loading ? styles.submitButtonDisabled : {}),
              }}
              onMouseOver={(e) => {
                if (canInvite && !submitting && !loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {submitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
