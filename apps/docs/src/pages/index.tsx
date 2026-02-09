import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className={styles.heroTitle}>
          Test Any Framework. Anywhere.
        </Heading>
        <p className={styles.heroSubtitle}>
          High-performance, multi-tenant test automation infrastructure.
          <br />
          Run Playwright, Cypress, or Selenium tests at scale with AI-powered analysis.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/integration/quickstart">
            Get Started →
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/api">
            API Reference
          </Link>
        </div>
      </div>
    </header>
  );
}

type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

const FeatureList: FeatureItem[] = [
  {
    icon: '🔌',
    title: 'Framework Agnostic',
    description:
      'Run tests from any framework — Playwright, Cypress, Selenium, or custom solutions. Just package your tests in a Docker image and go.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Analysis',
    description:
      'Gemini-powered root cause analysis automatically identifies why tests fail, saving hours of debugging time.',
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant Architecture',
    description:
      'Complete data isolation between organizations. RBAC, API keys, and audit logs included out of the box.',
  },
  {
    icon: '📊',
    title: 'Real-Time Streaming',
    description:
      'Watch test output live via WebSocket streaming. No waiting for tests to complete to see what\'s happening.',
  },
  {
    icon: '📈',
    title: 'Usage Tracking',
    description:
      'Built-in billing integration with Stripe. Track test runs, storage, and users per organization.',
  },
  {
    icon: '🐳',
    title: 'Docker Native',
    description:
      'Tests run in isolated Docker containers with configurable resource limits. Scale horizontally as needed.',
  },
];

function Feature({ icon, title, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Test Automation Platform"
      description="High-performance, multi-tenant test automation infrastructure. Run Playwright, Cypress, or Selenium tests at scale.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
