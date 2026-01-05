import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'zDoge',
  tagline: 'Zcash-style shielded transactions for DogeOS - Private payments with zero-knowledge proofs',
  favicon: 'img/dogenadologo.png',

  future: {
    v4: true,
  },

  url: 'https://docs.zdoge.cash',
  baseUrl: '/',

  organizationName: 'zdoge',
  projectName: 'zdoge-docs',

  onBrokenLinks: 'throw',
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
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // Docs at root
        },
        blog: false, // Disable blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/dogenadobanner.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'zDoge',
      logo: {
        alt: 'zDoge Logo',
        src: 'img/dogenadologo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://zdoge.cash',
          label: 'Launch App',
          position: 'right',
        },
        {
          href: 'https://x.com/zDogeCash',
          label: 'X',
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
              label: 'Introduction',
              to: '/',
            },
            {
              label: 'How It Works',
              to: '/how-it-works',
            },
            {
              label: 'User Guide',
              to: '/category/user-guide',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Launch App',
              href: 'https://zdoge.cash',
            },
            {
              label: 'Block Explorer',
              href: 'https://blockscout.testnet.dogeos.com',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'X (Twitter)',
              href: 'https://x.com/zDogeCash',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} zDoge. A Zcash-style shielded transaction system for DogeOS.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
