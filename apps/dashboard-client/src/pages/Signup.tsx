import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  } as React.CSSProperties,
  wrapper: {
    width: '100%',
    maxWidth: '420px',
  } as React.CSSProperties,
  logoSection: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  } as React.CSSProperties,
  logoBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    marginBottom: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,
  logoText: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-1px',
  } as React.CSSProperties,
  brandName: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#ffffff',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,
  card: {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  } as React.CSSProperties,
  header: {
    marginBottom: '32px',
  } as React.CSSProperties,
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 8px 0',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    margin: 0,
  } as React.CSSProperties,
  errorBox: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '12px',
    marginBottom: '24px',
    color: '#dc2626',
    fontSize: '14px',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  } as React.CSSProperties,
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  } as React.CSSProperties,
  inputWrapper: {
    position: 'relative' as const,
  } as React.CSSProperties,
  inputIcon: {
    position: 'absolute' as const,
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '20px',
    height: '20px',
    color: '#9ca3af',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '14px 14px 14px 46px',
    fontSize: '15px',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  helperText: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '4px',
  } as React.CSSProperties,
  button: {
    width: '100%',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginTop: '8px',
  } as React.CSSProperties,
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  footer: {
    marginTop: '28px',
    textAlign: 'center' as const,
    paddingTop: '20px',
    borderTop: '1px solid #f3f4f6',
  } as React.CSSProperties,
  footerText: {
    fontSize: '14px',
    color: '#6b7280',
  } as React.CSSProperties,
  footerLink: {
    color: '#667eea',
    fontWeight: 600,
    textDecoration: 'none',
  } as React.CSSProperties,
};

export function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Invitation flow state
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('token');
  const [invitedOrgName, setInvitedOrgName] = useState<string | null>(null);
  const [isValidatingInvite, setIsValidatingInvite] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  // Validate invitation token on mount
  useEffect(() => {
    if (invitationToken) {
      setIsValidatingInvite(true);
      axios.get(`${API_URL}/api/invitations/validate/${invitationToken}`)
        .then(response => {
          if (response.data.valid) {
            setInvitedOrgName(response.data.organizationName);
            setEmail(response.data.email || '');
          } else {
            setError('This invitation link is invalid or has expired.');
          }
        })
        .catch(err => {
          console.error('Failed to validate invitation:', err);
          setError('Failed to validate invitation. Please try again or contact support.');
        })
        .finally(() => {
          setIsValidatingInvite(false);
        });
    }
  }, [invitationToken]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Pass invitationToken if present, otherwise use entered organization name
      await signup(email, password, name, invitationToken ? '' : organizationName, invitationToken || undefined);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  }

  const getInputStyle = (fieldName: string) => ({
    ...styles.input,
    borderColor: focusedField === fieldName ? '#667eea' : '#e5e7eb',
    boxShadow: focusedField === fieldName ? '0 0 0 3px rgba(102, 126, 234, 0.1)' : 'none',
  });

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* Logo */}
        <div style={styles.logoSection}>
          <div style={styles.logoBox}>
            <span style={styles.logoText}>AAC</span>
          </div>
          <h1 style={styles.brandName}>Agnostic Automation Center</h1>
        </div>

        {/* Card */}
        <div style={styles.card}>
          <div style={styles.header}>
            <h2 style={styles.title}>{invitedOrgName ? 'Join Organization' : 'Create Account'}</h2>
            <p style={styles.subtitle}>
              {invitedOrgName
                ? `You're invited to join ${invitedOrgName}`
                : 'Start automating your tests today'}
            </p>
          </div>

          {/* Loading state for invitation validation */}
          {isValidatingInvite && (
            <div style={{
              padding: '12px 16px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              marginBottom: '24px',
              color: '#1e40af',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⏳</span> Validating invitation...
            </div>
          )}

          {/* Invitation banner */}
          {invitedOrgName && !isValidatingInvite && (
            <div style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #a7f3d0',
              borderRadius: '12px',
              marginBottom: '24px',
              color: '#047857',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🎉</span> You're joining <strong style={{ marginLeft: '4px' }}>{invitedOrgName}</strong>
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full Name</label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  style={getInputStyle('name')}
                  placeholder="John Doe"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email Address</label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={getInputStyle('email')}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrapper}>
                <svg style={styles.inputIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={getInputStyle('password')}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
              <span style={styles.helperText}>
                Min 8 characters with uppercase, lowercase, number & special character
              </span>
            </div>

            {/* Only show Organization Name field if NOT using invitation */}
            {!invitationToken && (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Organization Name</label>
                <div style={styles.inputWrapper}>
                  <svg style={styles.inputIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    onFocus={() => setFocusedField('org')}
                    onBlur={() => setFocusedField(null)}
                    style={getInputStyle('org')}
                    placeholder="Your Company"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                ...styles.button,
                ...(isLoading ? styles.buttonDisabled : {}),
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={styles.footer}>
            <span style={styles.footerText}>
              Already have an account?{' '}
              <a href="/login" style={styles.footerLink}>
                Sign in
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}