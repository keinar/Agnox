import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Shield, AlertCircle, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const styles = {
  section: {
    marginBottom: '32px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  sectionDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '20px',
    lineHeight: '1.6',
    maxWidth: '800px',
  } as React.CSSProperties,
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  } as React.CSSProperties,
  toggle: {
    position: 'relative' as const,
    width: '48px',
    height: '28px',
    borderRadius: '9999px',
    transition: 'background-color 0.2s',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    flexShrink: 0,
  } as React.CSSProperties,
  toggleActive: {
    backgroundColor: '#4f46e5',
  } as React.CSSProperties,
  toggleDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#e5e7eb',
  } as React.CSSProperties,
  toggleSlider: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '24px',
    height: '24px',
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  } as React.CSSProperties,
  toggleSliderActive: {
    transform: 'translateX(20px)',
  } as React.CSSProperties,
  toggleLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    userSelect: 'none' as const,
  } as React.CSSProperties,
  alert: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    lineHeight: '1.5',
    marginBottom: '24px',
  } as React.CSSProperties,
  alertInfo: {
    backgroundColor: '#eff6ff',
    border: '1px solid #dbeafe',
    color: '#1e40af',
  } as React.CSSProperties,
  alertWarning: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fef3c7',
    color: '#92400e',
  } as React.CSSProperties,
  alertDisabled: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    color: '#4b5563',
  } as React.CSSProperties,
  disclosure: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #f1f5f9',
  } as React.CSSProperties,
  disclosureTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '12px',
  } as React.CSSProperties,
  disclosureText: {
    fontSize: '13px',
    color: '#64748b',
    lineHeight: '1.6',
    margin: 0,
  } as React.CSSProperties,
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
  } as React.CSSProperties,
  errorMessage: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#991b1b',
    fontSize: '14px',
  } as React.CSSProperties,
};

export function SecurityTab() {
  const { user, token } = useAuth();
  const [aiAnalysisEnabled, setAiAnalysisEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setAiAnalysisEnabled(response.data.organization.aiAnalysisEnabled);
      }
    } catch (error: any) {
      console.error('Failed to fetch organization:', error);
      setError('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAiAnalysis() {
    if (!isAdmin || updating) return;

    const newValue = !aiAnalysisEnabled;
    setUpdating(true);
    setError(null);

    try {
      const response = await axios.patch(
        `${API_URL}/api/organization`,
        { aiAnalysisEnabled: newValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setAiAnalysisEnabled(newValue);
      }
    } catch (error: any) {
      console.error('Failed to update AI analysis setting:', error);
      setError(error.response?.data?.message || 'Failed to update AI analysis setting');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading security settings...</div>;
  }

  return (
    <div>
      {error && <div style={styles.errorMessage}>{error}</div>}

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>
          <Shield size={20} />
          AI-Powered Test Analysis
        </h2>
        <p style={styles.sectionDescription}>
          When enabled, test failures are automatically analyzed by Google's Gemini AI to provide intelligent
          insights, root cause analysis, and debugging suggestions.
        </p>

        {isAdmin ? (
          <>
            <div style={styles.toggleContainer}>
              <button
                onClick={handleToggleAiAnalysis}
                style={{
                  ...styles.toggle,
                  ...(aiAnalysisEnabled ? styles.toggleActive : { backgroundColor: '#e5e7eb' }),
                  ...(updating ? styles.toggleDisabled : {}),
                }}
                disabled={updating}
              >
                <div
                  style={{
                    ...styles.toggleSlider,
                    ...(aiAnalysisEnabled ? styles.toggleSliderActive : {}),
                  }}
                />
              </button>
              <label style={styles.toggleLabel}>
                {updating
                  ? 'Updating...'
                  : aiAnalysisEnabled
                  ? 'AI Analysis Enabled'
                  : 'AI Analysis Disabled'}
              </label>
            </div>

            {aiAnalysisEnabled ? (
              <div style={{ ...styles.alert, ...styles.alertInfo }}>
                <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>AI analysis is active.</strong> Failed and unstable test runs will be automatically
                  analyzed to help identify issues faster.
                </div>
              </div>
            ) : (
              <div style={{ ...styles.alert, ...styles.alertWarning }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>AI analysis is currently disabled.</strong> Test failures will not receive AI-powered
                  insights.
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...styles.alert, ...styles.alertDisabled }}>
            <Shield size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              AI Analysis is currently{' '}
              <strong>{aiAnalysisEnabled ? 'enabled' : 'disabled'}</strong> for your organization. Only
              administrators can change this setting.
            </div>
          </div>
        )}

        <div style={styles.disclosure}>
          <h3 style={styles.disclosureTitle}>Data Processing & Privacy</h3>
          <p style={styles.disclosureText}>
            When AI analysis is enabled, test failure logs and relevant diagnostic information are sent to Google's
            Gemini API for processing. The data is analyzed in real-time and is not stored by Google.
          </p>
          <p style={{ ...styles.disclosureText, marginTop: '12px' }}>
            All data transmission is encrypted using TLS 1.3. See our <a href="#" style={styles.link}>Privacy Policy</a> for details.
          </p>
        </div>
      </div>
    </div>
  );
}