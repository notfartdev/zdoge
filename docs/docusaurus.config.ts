import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Dogenado',
  tagline: 'Privacy Protocol for DogeOS',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.dogenado.cash',
  baseUrl: '/',

  organizationName: 'dogenado',
  projectName: 'dogenado-docs',

  onBrokenLinks: 'throw',

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
      title: 'Dogenado',
      logo: {
        alt: 'Dogenado Logo',
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
          href: 'https://dogenado.cash',
          label: 'Launch App',
          position: 'right',
        },
        {
          href: 'https://github.com/notfartdev/dogenadocash',
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
              href: 'https://dogenado.cash',
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
              label: 'GitHub',
              href: 'https://github.com/notfartdev/dogenadocash',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Dogenado. Privacy Protocol for DogeOS.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
