import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Agnostic Automation Center',
  tagline: 'High-performance, multi-tenant test automation platform',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // Use CommonMark format to avoid MDX issues with angle brackets in docs
  markdown: {
    format: 'detect',
  },

  url: 'https://docs.automation.keinar.com',
  baseUrl: '/',

  organizationName: 'keinar',
  projectName: 'Agnostic-Automation-Center',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../../docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/keinar/Agnostic-Automation-Center/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Agnostic Automation',
      style: 'dark',
      // logo: {
      //   alt: 'AAC Logo',
      //   src: 'img/logo.svg',
      // },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/integration/quickstart',
          label: 'Quick Start',
          position: 'left',
        },
        {
          to: '/docs/api',
          label: 'API',
          position: 'left',
        },
        {
          href: 'https://github.com/keinar/Agnostic-Automation-Center',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Quick Start',
              to: '/docs/integration/quickstart',
            },
            {
              label: 'API Reference',
              to: '/docs/api',
            },
            {
              label: 'Deployment',
              to: '/docs/setup/deployment',
            },
          ],
        },
        {
          title: 'Product',
          items: [
            {
              label: 'Dashboard',
              href: 'https://automation.keinar.com',
            },
            {
              label: 'Status',
              href: 'https://status.automation.keinar.com',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/keinar/Agnostic-Automation-Center',
            },
            {
              label: 'Issues',
              href: 'https://github.com/keinar/Agnostic-Automation-Center/issues',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Agnostic Automation Center`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'typescript', 'docker'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
