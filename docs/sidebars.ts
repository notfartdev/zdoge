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
      items: [
        'user-guide/connect-wallet',
        'user-guide/deposit',
        'user-guide/withdraw',
        'user-guide/check-status',
        'user-guide/tips-anonymity',
      ],
    },
    {
      type: 'category',
      label: 'Technical',
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
      items: [
        'resources/contract-addresses',
        'resources/supported-tokens',
        'resources/faq',
      ],
    },
    'disclaimer',
  ],
};

export default sidebars;
