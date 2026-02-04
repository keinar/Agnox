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
  } as React.CSSProperties,
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '16px',
  } as React.CSSProperties,
  toggle: {
    position: 'relative' as const,
    width: '48px',
    height: '28px',
    background: '#e5e7eb',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  } as React.CSSProperties,
  toggleActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  } as React.CSSProperties,
  toggleDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  } as React.CSSProperties,
  toggleSlider: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '24px',
    height: '24px',
    background: '#ffffff',
    borderRadius: '50%',
    transition: 'transform 0.2s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  } as React.CSSProperties,
  toggleSliderActive: {
    transform: 'translateX(20px)',
  } as React.CSSProperties,
  toggleLabel: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#1e293b',
  } as React.CSSProperties,
  alert: {
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    lineHeight: '1.6',
  } as React.CSSProperties,
  alertInfo: {
    background: '#f0f4ff',
    border: '1px solid #c7d2fe',
    color: '#667eea',
  } as React.CSSProperties,
  alertWarning: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#d97706',
  } as React.CSSProperties,
  alertDisabled: {
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    color: '#6b7280',
  } as React.CSSProperties,
  disclosure: {
    padding: '20px',
    background: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginTop: '24px',
  } as React.CSSProperties,
  disclosureTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '8px',
  } as React.CSSProperties,
  disclosureText: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
  } as React.CSSProperties,
  link: {
    color: '#667eea',
    fontWeight: 600,
    textDecoration: 'none',
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

      {/* AI Analysis Section */}
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
            {/* Toggle */}
            <div style={styles.toggleContainer}>
              <div
                onClick={handleToggleAiAnalysis}
                style={{
                  ...styles.toggle,
                  ...(aiAnalysisEnabled ? styles.toggleActive : {}),
                  ...(updating ? styles.toggleDisabled : {}),
                }}
              >
                <div
                  style={{
                    ...styles.toggleSlider,
                    ...(aiAnalysisEnabled ? styles.toggleSliderActive : {}),
                  }}
                />
              </div>
              <label style={styles.toggleLabel}>
                {updating
                  ? 'Updating...'
                  : aiAnalysisEnabled
                  ? 'AI Analysis Enabled'
                  : 'AI Analysis Disabled'}
              </label>
            </div>

            {/* Status Message */}
            {aiAnalysisEnabled ? (
              <div style={{ ...styles.alert, ...styles.alertInfo }}>
                <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>AI analysis is active.</strong> Failed and unstable test runs will be automatically
                  analyzed to help identify issues faster. This helps reduce debugging time and improves test
                  reliability.
                </div>
              </div>
            ) : (
              <div style={{ ...styles.alert, ...styles.alertWarning }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>AI analysis is currently disabled.</strong> Test failures will not receive AI-powered
                  insights. You can enable this setting at any time to start receiving intelligent failure analysis.
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

        {/* Data Processing Disclosure */}
        <div style={styles.disclosure}>
          <h3 style={styles.disclosureTitle}>Data Processing & Privacy</h3>
          <p style={styles.disclosureText}>
            When AI analysis is enabled, test failure logs and relevant diagnostic information are sent to Google's
            Gemini API for processing. The data is analyzed in real-time and is not stored by Google beyond the
            duration of the API call. No personal information or sensitive credentials are included in the analysis
            request.
          </p>
          <p style={{ ...styles.disclosureText, marginTop: '12px' }}>
            All data transmission is encrypted using TLS 1.3. You can review our full{' '}
            <a href="/privacy" style={styles.link}>
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/terms" style={styles.link}>
              Terms of Service
            </a>{' '}
            for more details on how we handle your data.
          </p>
        </div>
      </div>
    </div>
  );
}
