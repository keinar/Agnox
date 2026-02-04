import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  limits: {
    maxProjects: number;
    maxTestRuns: number;
    maxUsers: number;
    maxConcurrentRuns: number;
  };
  userCount: number;
  userLimit: number;
  aiAnalysisEnabled: boolean;
  createdAt: string;
  updatedAt: string;
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
    padding: '10px 14px',
    fontSize: '15px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  } as React.CSSProperties,
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  planBadge: {
    display: 'inline-block',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  button: {
    marginTop: '12px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  infoText: {
    fontSize: '13px',
    color: '#6b7280',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  upgradeLink: {
    display: 'inline-block',
    marginTop: '8px',
    fontSize: '14px',
    color: '#667eea',
    fontWeight: 600,
    textDecoration: 'none',
  } as React.CSSProperties,
  successMessage: {
    padding: '12px 16px',
    background: '#d1fae5',
    border: '1px solid #6ee7b7',
    borderRadius: '8px',
    color: '#047857',
    fontSize: '14px',
    marginBottom: '16px',
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

export function OrganizationTab() {
  const { user, token } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchOrganization();
  }, []);

  async function fetchOrganization() {
    try {
      const response = await axios.get(`${API_URL}/api/organization`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setOrganization(response.data.organization);
        setName(response.data.organization.name);
      }
    } catch (error: any) {
      console.error('Failed to fetch organization:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load organization details',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim() || name === organization?.name) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await axios.patch(
        `${API_URL}/api/organization`,
        { name: name.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setOrganization((prev) => (prev ? { ...prev, name: name.trim() } : null));
        setMessage({ type: 'success', text: 'Organization name updated successfully' });

        // Clear success message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      console.error('Failed to update organization:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update organization name',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading organization details...</div>;
  }

  if (!organization) {
    return <div style={{ color: '#dc2626', fontSize: '14px' }}>Failed to load organization details</div>;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div>
      {/* Success/Error Messages */}
      {message && (
        <div style={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}

      {/* Organization Name */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Organization Details</h2>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Organization Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              ...styles.input,
              ...(isAdmin ? {} : styles.inputDisabled),
            }}
            disabled={!isAdmin}
            onFocus={(e) => {
              if (isAdmin) {
                e.target.style.borderColor = '#667eea';
              }
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
            }}
          />
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name === organization.name}
              style={{
                ...styles.button,
                ...(saving || !name.trim() || name === organization.name ? styles.buttonDisabled : {}),
              }}
              onMouseOver={(e) => {
                if (!saving && name.trim() && name !== organization.name) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          {!isAdmin && (
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
              Only administrators can change the organization name.
            </p>
          )}
        </div>

        {/* Current Plan */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Current Plan</label>
          <div style={styles.planBadge}>{organization.plan}</div>
          {organization.plan === 'free' && (
            <a href="/billing/upgrade" style={styles.upgradeLink}>
              Upgrade to Team Plan →
            </a>
          )}
        </div>

        {/* Organization ID */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Organization ID</label>
          <code style={styles.infoText}>{organization.id}</code>
        </div>

        {/* Created Date */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Created</label>
          <span style={{ fontSize: '14px', color: '#374151' }}>
            {formatDate(organization.createdAt)}
          </span>
        </div>
      </div>

      {/* Plan Limits */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Plan Limits</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={styles.label}>Test Runs / Month</label>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
              {organization.limits.maxTestRuns.toLocaleString()}
            </div>
          </div>

          <div>
            <label style={styles.label}>Team Members</label>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
              {organization.limits.maxUsers}
            </div>
          </div>

          <div>
            <label style={styles.label}>Concurrent Runs</label>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
              {organization.limits.maxConcurrentRuns}
            </div>
          </div>

          <div>
            <label style={styles.label}>Projects</label>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
              {organization.limits.maxProjects}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
