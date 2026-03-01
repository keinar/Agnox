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
    icon: '🔌',
    title: 'Dual Architecture & CI Sync',
    description:
      'Stream results instantly from your existing GitHub Actions/GitLab pipelines using our native reporters, or let Agnox host and execute your containerized tests directly.',
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
  {
    icon: '🔗',
    title: 'Enterprise Connectors',
    description:
      'Create Jira tickets with one click directly from failed tests. Keep your team in the loop with real-time Slack notifications and custom Webhooks.',
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

type HighlightItem = {
  icon: string;
  title: string;
  body: string;
};

const highlights: HighlightItem[] = [
  {
    icon: '🗂️',
    title: 'Single Source of Truth',
    body: 'Stop jumping between your CI logs, Jira, and spreadsheets. Agnox centralizes your entire QA operation.',
  },
  {
    icon: '⚡',
    title: 'Zero-Config Setup',
    body: 'Drop our reporter into your Playwright config and see your tests appear in a beautiful dashboard in seconds.',
  },
  {
    icon: '🤝',
    title: 'Empower Everyone',
    body: 'From QA engineers writing manual steps to SDETs investigating flaky automated tests, Agnox speaks everyone\'s language.',
  },
];

function PlatformHighlights(): ReactNode {
  return (
    <section className={clsx('padding-vert--xl', styles.highlights)}>
      <div className="container">
        <div className="text--center margin-bottom--lg">
          <Heading as="h2">Why Choose Agnox?</Heading>
          <p className={styles.highlightsSubtitle}>
            Built for modern engineering teams who refuse to compromise on visibility, speed, or quality.
          </p>
        </div>
        <div className="row">
          {highlights.map(({ icon, title, body }) => (
            <div key={title} className="col col--4 text--center">
              <div className={styles.highlightCard}>
                <div className={styles.highlightIcon}>{icon}</div>
                <Heading as="h3" className={styles.highlightTitle}>{title}</Heading>
                <p className={styles.highlightBody}>{body}</p>
              </div>
            </div>
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
      description="Agnox is the ultimate unified testing platform for modern engineering teams. External CI ingestion, hybrid test cycles, and AI-driven triage.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <PlatformHighlights />
      </main>
    </Layout>
  );
}
