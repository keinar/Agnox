import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
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
            <h2 style={styles.title}>Welcome Back</h2>
            <p style={styles.subtitle}>Sign in to your account to continue</p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
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
                />
              </div>
            </div>

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
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={styles.footer}>
            <span style={styles.footerText}>
              Don't have an account?{' '}
              <a href="/signup" style={styles.footerLink}>
                Sign up
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}