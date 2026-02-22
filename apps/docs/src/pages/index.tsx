import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className={styles.heroTitle}>
          {siteConfig.title}
        </Heading>
        <p className={styles.heroSubtitle}>
          {siteConfig.tagline}
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/architecture/overview">
            Read the Docs →
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/integration/quickstart">
            Quick Start
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
    icon: '🐳',
    title: 'Framework Agnostic',
    description:
      'Run Playwright, Pytest, Mocha, and more in isolated, secure Docker containers. Package your tests once and execute them on any infrastructure without configuration lock-in.',
  },
  {
    icon: '🔬',
    title: 'The Investigation Hub',
    description:
      'Triage failures instantly with a real-time streaming terminal and visual artifact gallery. Drill into screenshots, traces, and logs from a single, unified interface.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Triage',
    description:
      'Automatic root-cause analysis and actionable fix recommendations powered by Gemini. Stop guessing why tests fail — get answers in seconds.',
  },
  {
    icon: '🎯',
    title: 'Quality Hub',
    description:
      'Build a living manual test repository with suite-grouped test cases. Generate structured test steps instantly with AI — describe your intent and let Gemini do the rest.',
  },
  {
    icon: '🔄',
    title: 'Hybrid Test Cycles',
    description:
      'Combine manual and automated tests into unified cycles. Execute manual steps with an interactive player while automated items sync results in real time.',
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
      title={siteConfig.title}
      description="Enterprise-grade test execution, real-time investigation, and AI-driven analysis for modern engineering teams.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
