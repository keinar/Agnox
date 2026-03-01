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
    body: "Drop our reporter into your Playwright, Cypress, or Pytest config, or let Agnox host your containerized runs. Watch your test results stream into a beautiful dashboard in seconds.",
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

function FeatureShowcase(): ReactNode {
  return (
    <section className={clsx('padding-vert--xl', styles.showcase)}>
      <div className="container">
        {/* Showcase 1 — Text Left / Image Right */}
        <div className={clsx('row', styles.showcaseRow)}>
          <div className="col col--6">
            <div className={styles.showcaseText}>
              <div className={styles.showcaseBadge}>The Investigation Hub</div>
              <Heading as="h2" className={styles.showcaseHeading}>
                Debug Failures in Seconds, Not Hours
              </Heading>
              <p className={styles.showcaseBody}>
                Stop digging through raw CI logs. Agnox streams your test output in real time directly into a terminal built for debugging — so you see exactly what went wrong the moment it happens.
              </p>
              <ul className={styles.showcaseList}>
                <li>🖥️ <strong>Real-time streaming terminal</strong> — no more refreshing CI pages</li>
                <li>🖼️ <strong>Visual artifact gallery</strong> — screenshots, traces, and videos at a glance</li>
                <li>🤖 <strong>AI root-cause analysis</strong> — Gemini surfaces the fix, not just the failure</li>
              </ul>
              <Link className="button button--primary" to="/docs/features/investigation-hub">
                Explore the Hub →
              </Link>
            </div>
          </div>
          <div className="col col--6">
            <div className={styles.showcaseImageWrapper}>
              <img
                src="/img/dashboard-preview.png"
                alt="Agnox Dashboard"
                style={{ borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', width: '100%', border: '1px solid #eaeaea' }}
              />
            </div>
          </div>
        </div>

        {/* Showcase 2 — Image Left / Text Right */}
        <div className={clsx('row', styles.showcaseRow)}>
          <div className="col col--6">
            <div className={styles.showcaseImageWrapper}>
              <img
                src="/img/cycles-preview.png"
                alt="Hybrid Test Cycles"
                style={{ borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', width: '100%', border: '1px solid #eaeaea' }}
              />
            </div>
          </div>
          <div className="col col--6">
            <div className={styles.showcaseText}>
              <div className={styles.showcaseBadge}>Hybrid Test Cycles</div>
              <Heading as="h2" className={styles.showcaseHeading}>
                Automated & Manual Tests, Finally Unified
              </Heading>
              <p className={styles.showcaseBody}>
                No more spreadsheets for manual QA alongside a separate dashboard for automation. Agnox brings them together in a single cycle — with live result sync and a dedicated interactive player for manual execution.
              </p>
              <ul className={styles.showcaseList}>
                <li>🔄 <strong>Unified cycle view</strong> — mix automated and manual items seamlessly</li>
                <li>▶️ <strong>Interactive player</strong> — step-by-step manual execution with pass/fail controls</li>
                <li>📊 <strong>Live progress tracking</strong> — watch the cycle complete in real time</li>
              </ul>
              <Link className="button button--primary" to="/docs/features/test-cycles">
                Learn About Cycles →
              </Link>
            </div>
          </div>
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
        <FeatureShowcase />
      </main>
    </Layout>
  );
}
