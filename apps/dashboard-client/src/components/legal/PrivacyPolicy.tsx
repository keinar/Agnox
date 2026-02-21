import { Link } from 'react-router-dom';

export function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gh-bg-dark py-10 px-5">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gh-bg-subtle-dark rounded-2xl shadow-xl p-12 border border-slate-200 dark:border-gh-border-dark">
                {/* Header */}
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Privacy Policy</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Last updated: February 2026</p>
                </header>

                {/* Section helper */}
                {[
                    {
                        title: '1. Information We Collect',
                        content: (
                            <>
                                <p>When you use Agnostic Automation Center, we collect information to provide and improve our services:</p>
                                <ul>
                                    <li><strong>Account Information:</strong> Email address, name, and organization details when you register.</li>
                                    <li><strong>Usage Data:</strong> Test execution logs, performance metrics, and platform usage statistics.</li>
                                    <li><strong>Technical Data:</strong> Browser type, IP address, and device information for security and optimization.</li>
                                </ul>
                            </>
                        ),
                    },
                    {
                        title: '2. How We Use Your Information',
                        content: (
                            <>
                                <p>We use collected information to:</p>
                                <ul>
                                    <li>Provide, maintain, and improve our test automation platform</li>
                                    <li>Process test executions and generate reports</li>
                                    <li>Send important notifications about your account and usage</li>
                                    <li>Analyze platform performance and user experience</li>
                                    <li>Detect and prevent security threats or fraudulent activity</li>
                                </ul>
                            </>
                        ),
                    },
                    {
                        title: '3. AI-Powered Analysis',
                        content: (
                            <>
                                <p>
                                    When AI analysis is enabled for your organization, test failure logs are processed by Google's Gemini AI
                                    to provide intelligent debugging suggestions. This data is transmitted securely using TLS 1.3 encryption
                                    and is not stored by Google after processing.
                                </p>
                                <p>You can disable AI analysis at any time from your organization's Security settings.</p>
                            </>
                        ),
                    },
                    {
                        title: '4. Third-Party Services',
                        content: (
                            <>
                                <p>We use the following third-party services:</p>
                                <ul>
                                    <li><strong>Stripe:</strong> For payment processing and subscription management</li>
                                    <li><strong>SendGrid:</strong> For transactional email delivery</li>
                                    <li><strong>Google Gemini AI:</strong> For optional AI-powered test analysis (when enabled)</li>
                                </ul>
                                <p>Each third-party service operates under their own privacy policy.</p>
                            </>
                        ),
                    },
                    {
                        title: '5. Data Security',
                        content: (
                            <>
                                <p>We implement industry-standard security measures to protect your data:</p>
                                <ul>
                                    <li>All data transmitted is encrypted using TLS 1.3</li>
                                    <li>Passwords are hashed using bcrypt with appropriate cost factors</li>
                                    <li>Multi-tenant isolation ensures your data is separated from other organizations</li>
                                    <li>Regular security audits and vulnerability assessments</li>
                                </ul>
                            </>
                        ),
                    },
                    {
                        title: '6. Data Retention',
                        content: (
                            <p>
                                We retain your data for as long as your account is active or as needed to provide services.
                                Test execution logs are retained according to your plan's limits. You can request data deletion
                                by contacting support.
                            </p>
                        ),
                    },
                    {
                        title: '7. Your Rights',
                        content: (
                            <>
                                <p>You have the right to:</p>
                                <ul>
                                    <li>Access and export your personal data</li>
                                    <li>Correct inaccurate information</li>
                                    <li>Request deletion of your account and data</li>
                                    <li>Opt out of AI-powered analysis</li>
                                    <li>Withdraw consent for data processing</li>
                                </ul>
                            </>
                        ),
                    },
                    {
                        title: '8. Contact Us',
                        content: (
                            <p>
                                If you have questions about this Privacy Policy or our data practices, please contact us at{' '}
                                <a
                                    href="mailto:privacy@automation.keinar.com"
                                    className="text-gh-accent dark:text-gh-accent-dark hover:underline"
                                >
                                    privacy@automation.keinar.com
                                </a>
                            </p>
                        ),
                    },
                ].map(({ title, content }) => (
                    <section key={title} className="mb-7">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h2>
                        <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-3 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">
                            {content}
                        </div>
                    </section>
                ))}

                <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 mt-6 px-5 py-3 text-sm font-medium text-gh-accent dark:text-gh-accent-dark bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                >
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
