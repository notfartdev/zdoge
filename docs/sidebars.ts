import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    'how-it-works',
    {
      type: 'category',
      label: 'User Guide',
      link: {
        type: 'generated-index',
        description: 'Step-by-step guides for using Dogenado',
      },
      items: [
        'user-guide/connect-wallet',
        'user-guide/shield',
        'user-guide/transfer',
        'user-guide/swap',
        'user-guide/unshield',
        'user-guide/check-status',
        'user-guide/tips-anonymity',
      ],
    },
    {
      type: 'category',
      label: 'Technical',
      link: {
        type: 'generated-index',
        description: 'Technical deep-dive into Dogenado architecture',
      },
      items: [
        'technical/architecture',
        'technical/smart-contracts',
        'technical/zero-knowledge',
        'technical/merkle-tree',
      ],
    },
    {
      type: 'category',
      label: 'Resources',
      link: {
        type: 'generated-index',
        description: 'Additional resources and references',
      },
      items: [
        'resources/contract-addresses',
        'resources/supported-tokens',
        'resources/trust-model',
        'resources/features-updates',
        'resources/faq',
      ],
    },
    'disclaimer',
  ],
};

export default sidebars;
