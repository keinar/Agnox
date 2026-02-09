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

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../../docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/keinar/Agnostic-Automation-Center/tree/main/',
        },
        blog: false, // Disable blog
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
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Agnostic Automation Center',
      logo: {
        alt: 'AAC Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          to: '/docs/integration/quickstart',
          label: 'Tutorial',
          position: 'left',
        },
        {
          to: '/docs/api/README',
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
              to: '/docs/api/README',
            },
            {
              label: 'Setup Guide',
              to: '/docs/setup/deployment',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/keinar/Agnostic-Automation-Center',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Agnostic Automation Center. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
