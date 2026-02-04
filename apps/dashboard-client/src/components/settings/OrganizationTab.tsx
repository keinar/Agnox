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
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s',
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
  planBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    background: 'linear-gradient(to right, #4f46e5, #7c3aed)',
    color: 'white',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  limitsGrid: {
    display: 'grid',

    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
    gap: '16px',
  } as React.CSSProperties,
  limitCard: {
    background: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #f1f5f9',
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

  if (loading) return <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading organization details...</div>;
  if (!organization) return <div style={{ color: '#dc2626', fontSize: '14px' }}>Failed to load organization details</div>;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <div>
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px',
          background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: message.type === 'success' ? '#047857' : '#b91c1c',
          border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
        }}>
          {message.text}
        </div>
      )}

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
              borderColor: isAdmin ? '#e2e8f0' : '#e2e8f0',
              background: isAdmin ? '#fff' : '#f9fafb',
              cursor: isAdmin ? 'text' : 'not-allowed',
            }}
            disabled={!isAdmin}
          />
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name === organization.name}
              style={{
                ...styles.button,
                opacity: saving || !name.trim() || name === organization.name ? 0.5 : 1,
                cursor: saving || !name.trim() || name === organization.name ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Current Plan</label>
          <div style={styles.planBadge}>{organization.plan}</div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Organization ID</label>
          <code style={{ fontSize: '13px', color: '#4b5563', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>
            {organization.id}
          </code>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Created</label>
          <span style={{ fontSize: '14px', color: '#374151' }}>{formatDate(organization.createdAt)}</span>
        </div>
      </div>

      {/* Plan Limits - Responsive Grid */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Plan Limits</h2>
        <div style={styles.limitsGrid}>
          {[
            { label: 'Test Runs / Month', value: organization.limits.maxTestRuns.toLocaleString() },
            { label: 'Team Members', value: organization.limits.maxUsers },
            { label: 'Concurrent Runs', value: organization.limits.maxConcurrentRuns },
            { label: 'Projects', value: organization.limits.maxProjects },
          ].map((item, i) => (
            <div key={i} style={styles.limitCard}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                {item.label}
              </label>
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}