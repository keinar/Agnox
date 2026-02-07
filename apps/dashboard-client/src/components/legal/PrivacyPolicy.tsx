import React from 'react';
import { Link } from 'react-router-dom';

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '40px 20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
    } as React.CSSProperties,
    content: {
        maxWidth: '800px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '24px',
        padding: '48px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    } as React.CSSProperties,
    header: {
        marginBottom: '32px',
        textAlign: 'center' as const,
    } as React.CSSProperties,
    title: {
        fontSize: '32px',
        fontWeight: 700,
        color: '#1a1a2e',
        margin: '0 0 8px 0',
    } as React.CSSProperties,
    lastUpdated: {
        fontSize: '14px',
        color: '#6b7280',
    } as React.CSSProperties,
    section: {
        marginBottom: '28px',
    } as React.CSSProperties,
    sectionTitle: {
        fontSize: '20px',
        fontWeight: 600,
        color: '#1e293b',
        marginBottom: '12px',
    } as React.CSSProperties,
    paragraph: {
        fontSize: '15px',
        lineHeight: '1.7',
        color: '#4b5563',
        marginBottom: '12px',
    } as React.CSSProperties,
    list: {
        marginLeft: '20px',
        marginBottom: '12px',
        fontSize: '15px',
        lineHeight: '1.7',
        color: '#4b5563',
    } as React.CSSProperties,
    backLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        color: '#667eea',
        textDecoration: 'none',
        fontWeight: 500,
        marginTop: '24px',
        padding: '12px 24px',
        background: '#f0f4ff',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
    } as React.CSSProperties,
};

export function PrivacyPolicy() {
    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <header style={styles.header}>
                    <h1 style={styles.title}>Privacy Policy</h1>
                    <p style={styles.lastUpdated}>Last updated: February 2026</p>
                </header>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>1. Information We Collect</h2>
                    <p style={styles.paragraph}>
                        When you use Agnostic Automation Center, we collect information to provide and improve our services:
                    </p>
                    <ul style={styles.list}>
                        <li><strong>Account Information:</strong> Email address, name, and organization details when you register.</li>
                        <li><strong>Usage Data:</strong> Test execution logs, performance metrics, and platform usage statistics.</li>
                        <li><strong>Technical Data:</strong> Browser type, IP address, and device information for security and optimization.</li>
                    </ul>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>2. How We Use Your Information</h2>
                    <p style={styles.paragraph}>We use collected information to:</p>
                    <ul style={styles.list}>
                        <li>Provide, maintain, and improve our test automation platform</li>
                        <li>Process test executions and generate reports</li>
                        <li>Send important notifications about your account and usage</li>
                        <li>Analyze platform performance and user experience</li>
                        <li>Detect and prevent security threats or fraudulent activity</li>
                    </ul>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>3. AI-Powered Analysis</h2>
                    <p style={styles.paragraph}>
                        When AI analysis is enabled for your organization, test failure logs are processed by Google's Gemini AI
                        to provide intelligent debugging suggestions. This data is transmitted securely using TLS 1.3 encryption
                        and is not stored by Google after processing.
                    </p>
                    <p style={styles.paragraph}>
                        You can disable AI analysis at any time from your organization's Security settings.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>4. Third-Party Services</h2>
                    <p style={styles.paragraph}>We use the following third-party services:</p>
                    <ul style={styles.list}>
                        <li><strong>Stripe:</strong> For payment processing and subscription management</li>
                        <li><strong>SendGrid:</strong> For transactional email delivery</li>
                        <li><strong>Google Gemini AI:</strong> For optional AI-powered test analysis (when enabled)</li>
                    </ul>
                    <p style={styles.paragraph}>
                        Each third-party service operates under their own privacy policy.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>5. Data Security</h2>
                    <p style={styles.paragraph}>
                        We implement industry-standard security measures to protect your data:
                    </p>
                    <ul style={styles.list}>
                        <li>All data transmitted is encrypted using TLS 1.3</li>
                        <li>Passwords are hashed using bcrypt with appropriate cost factors</li>
                        <li>Multi-tenant isolation ensures your data is separated from other organizations</li>
                        <li>Regular security audits and vulnerability assessments</li>
                    </ul>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>6. Data Retention</h2>
                    <p style={styles.paragraph}>
                        We retain your data for as long as your account is active or as needed to provide services.
                        Test execution logs are retained according to your plan's limits. You can request data deletion
                        by contacting support.
                    </p>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>7. Your Rights</h2>
                    <p style={styles.paragraph}>You have the right to:</p>
                    <ul style={styles.list}>
                        <li>Access and export your personal data</li>
                        <li>Correct inaccurate information</li>
                        <li>Request deletion of your account and data</li>
                        <li>Opt out of AI-powered analysis</li>
                        <li>Withdraw consent for data processing</li>
                    </ul>
                </section>

                <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>8. Contact Us</h2>
                    <p style={styles.paragraph}>
                        If you have questions about this Privacy Policy or our data practices, please contact us at{' '}
                        <a href="mailto:privacy@automation.keinar.com" style={{ color: '#667eea' }}>
                            privacy@automation.keinar.com
                        </a>
                    </p>
                </section>

                <Link
                    to="/dashboard"
                    style={styles.backLink}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = '#e0e7ff';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = '#f0f4ff';
                    }}
                >
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
