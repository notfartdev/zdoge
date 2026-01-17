/**
 * DogeOS Testnet Configuration
 * 
 * Chain and contract configuration for Dogenado
 */

// DogeOS Chikyū Testnet
export const dogeosTestnet = {
  id: 6281971,
  name: 'DogeOS Chikyū Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Dogecoin',
    symbol: 'DOGE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.dogeos.com'],
      webSocket: ['wss://ws.rpc.testnet.dogeos.com'],
    },
    unifra: {
      http: ['https://dogeos-testnet-public.unifra.io/'],
    },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://blockscout.testnet.dogeos.com' },
    l2scan: { name: 'L2Scan', url: 'https://dogeos-testnet.l2scan.co/' },
  },
  testnet: true,
} as const;

// Official tokens on DogeOS Testnet
export const tokens = {
  // Native DOGE (uses DogeRouter for deposits/withdrawals)
  DOGE: {
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Native token, no address
    symbol: 'DOGE',
    decimals: 18,
    name: 'Dogecoin',
    isNative: true, // Flag to indicate this uses DogeRouter
  },
  WDOGE: {
    address: '0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE' as `0x${string}`,
    symbol: 'WDOGE',
    decimals: 18,
    name: 'Wrapped DOGE',
  },
  USDC: {
    address: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925' as `0x${string}`,
    symbol: 'USDC',
    decimals: 18, // DogeOS testnet USDC uses 18 decimals (not 6 like on Ethereum mainnet)
    name: 'USD Coin',
  },
  USDT: {
    address: '0xC81800b77D91391Ef03d7868cB81204E753093a9' as `0x${string}`,
    symbol: 'USDT',
    decimals: 18, // DogeOS testnet USDT uses 18 decimals (not 6 like on Ethereum mainnet)
    name: 'Tether USD',
  },
  USD1: {
    address: '0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F' as `0x${string}`,
    symbol: 'USD1',
    decimals: 18,
    name: 'USD1',
  },
  WETH: {
    address: '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000' as `0x${string}`,
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped ETH',
  },
  LBTC: {
    address: '0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E' as `0x${string}`,
    symbol: 'LBTC',
    decimals: 18, // DogeOS testnet LBTC uses 18 decimals (not 8 like on other chains)
    name: 'Liquid BTC',
  },
} as const;

// Supported tokens for mixing
// DOGE uses native pools (no wrapping needed)
export const SUPPORTED_TOKENS = ['DOGE', 'USDC', 'USDT', 'USD1', 'WETH', 'LBTC'] as const;
export type SupportedToken = typeof SUPPORTED_TOKENS[number];

// Pool configuration per token
export const tokenPools: Record<SupportedToken, {
  token: typeof tokens[keyof typeof tokens];
  amounts: number[];
  pools: Record<string, `0x${string}`>;
  isNative?: boolean; // If true, deposit sends native value (no ERC20 approval)
}> = {
  // DOGE uses native pools - accepts native DOGE directly (no wrapping)
  DOGE: {
    token: tokens.DOGE,
    amounts: [1, 10, 100, 1000],
    pools: {
      // Native DOGE pools - MixerPoolNative contracts
      '1': '0xb253d81E44bCE93Fb742EE8cD26D96eD910f401a',
      '10': '0x01aA22f48DBA28934b0aABB0D949F56d942775e6',
      '100': '0x0E9A2FD5b4176fFb7C3dE11a8D90D8AAD5dC0811',
      '1000': '0xe1c751D6F65768EB6d3BCb84760bDd68C6d3F7D4',
    },
    isNative: true, // Flag for native DOGE pools
  },
  USDC: {
    token: tokens.USDC,
    amounts: [1, 10, 100, 1000],
    pools: {
      '1': '0x3c1FDFdBc9f436c9D370c57C658C1ca67EBAa146',
      '10': '0xd8d301c460023D320f44da2f696831ECc7F60504',
      '100': '0xe00bC9e7431dFF487ac9EB7b51d8B14C5B7b0847',
      '1000': '0xde641902e9986eFD55A664230AC0203d3286E2b0',
    },
  },
  USDT: {
    token: tokens.USDT,
    amounts: [1, 10, 100, 1000],
    pools: {
      '1': '0x3B80e33752634d856AE6e6f68570157637912000',
      '10': '0x6f9210EDd0985eA6f9FEeAB080FA85933178D38c',
      '100': '0x13DC6fda3cF0990e7D15750A2c3ce8693c351e46',
      '1000': '0x308C8f3692c6C19B84A24466D1792f7B794cF5ae',
    },
  },
  USD1: {
    token: tokens.USD1,
    amounts: [1, 10, 100, 1000],
    pools: {
      '1': '0x72CdC6eA899621be7dF24c8084C667276D23F5b3',
      '10': '0x47fE455020B010c114356C88C291118918e32c57',
      '100': '0x248A93958693fD9Cc260676B63440F5eBAf25B79',
      '1000': '0x307d1D56a321eE5f4334b6A3A00E6Cc6ad8598b1',
    },
  },
  // WDOGE hidden from UI - users use DOGE instead (same pools via DogeRouter)
  // Pool addresses kept in DOGE config above
  WETH: {
    token: tokens.WETH,
    amounts: [0.01, 0.1, 1, 10],
    pools: {
      '0.01': '0x72734eDD05E680a4dB4312974EE46ce903aE807C',
      '0.1': '0x1d5d2c74e3b402749Fd9BeD709a749A0E5E2ea8e',
      '1': '0xb3748014f9bDB54F7fc33d8aea6Fbff7a0750d6b',
      '10': '0xfAfD381E6246E67607603BCf617AB522Ce4de1D9',
    },
  },
  LBTC: {
    token: tokens.LBTC,
    amounts: [0.001, 0.01, 0.1, 1],
    pools: {
      '0.001': '0x821EdB78D739759F0E226DF9a0B8D87f7c78cA77',
      '0.01': '0xda43aA668640CA2F48364adCC01B1Ed5c11D6385',
      '0.1': '0x5ffc61930595BA9Fae2a0D0b0651cd65BC105e92',
      '1': '0x526A143FD0C0429cE71FB8FA09ACa6f4876d29a5',
    },
  },
};

// Get all pool addresses as flat array
export function getAllPoolAddresses(): string[] {
  const addresses: string[] = [];
  for (const tokenConfig of Object.values(tokenPools)) {
    addresses.push(...Object.values(tokenConfig.pools));
  }
  return addresses;
}

// Legacy pools export for backwards compatibility
export const pools = {
  USDC_1: { address: tokenPools.USDC.pools['1'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(1 * 10 ** 18), amount: 1 },
  USDC_10: { address: tokenPools.USDC.pools['10'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(10 * 10 ** 18), amount: 10 },
  USDC_100: { address: tokenPools.USDC.pools['100'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(100 * 10 ** 18), amount: 100 },
  USDC_1000: { address: tokenPools.USDC.pools['1000'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(1000 * 10 ** 18), amount: 1000 },
};

// Pool denomination options (legacy)
export const POOL_AMOUNTS = [1, 10, 100, 1000] as const;
export type PoolAmount = typeof POOL_AMOUNTS[number];

// V1 Pools (deprecated - kept for reference)
export const poolsV1 = {
  USDC_1: {
    address: '0x374F532FF869E61029a793520A9F351d42D0E03D' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(1 * 10 ** 6),
    displayAmount: '1 USDC',
    amount: 1,
    version: 1,
  },
  USDC_10: {
    address: '0x4f5A610E096a03179D0853eeA4976e058700C5C6' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(10 * 10 ** 6),
    displayAmount: '10 USDC',
    amount: 10,
    version: 1,
  },
  USDC_100: {
    address: '0x84F4eAF70cF6Fe5C0F58012Fc5E32C916292cc57' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(100 * 10 ** 6),
    displayAmount: '100 USDC',
    amount: 100,
    version: 1,
  },
  USDC_1000: {
    address: '0xd6BC051EE37396095960aCb1fce9c0Fe5B13152D' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(1000 * 10 ** 6),
    displayAmount: '1,000 USDC',
    amount: 1000,
    version: 1,
  },
} as const;

// V2 Pools (supports scheduled withdrawals with timelock)
export const poolsV2 = {
  USDC_1: {
    address: '0x552E1d86D3D1eaf9DA9587242d7bb6d580adca9F' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(1 * 10 ** 6),
    displayAmount: '1 USDC',
    amount: 1,
    version: 2,
    minDelay: 3600, // 1 hour
    maxDelay: 604800, // 7 days
  },
  USDC_10: {
    address: '0xB00e47b2E108236352aeb83ECa92a3045C82822b' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(10 * 10 ** 6),
    displayAmount: '10 USDC',
    amount: 10,
    version: 2,
    minDelay: 3600,
    maxDelay: 604800,
  },
  USDC_100: {
    address: '0x2300461E7ea01b24ED2f1Fd75fc7D2dDE8Eb1F5D' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(100 * 10 ** 6),
    displayAmount: '100 USDC',
    amount: 100,
    version: 2,
    minDelay: 3600,
    maxDelay: 604800,
  },
  USDC_1000: {
    address: '0x6c342E5b560B226e81690de953F78a0f93f6946f' as `0x${string}`,
    token: tokens.USDC,
    denomination: BigInt(1000 * 10 ** 6),
    displayAmount: '1,000 USDC',
    amount: 1000,
    version: 2,
    minDelay: 3600,
    maxDelay: 604800,
  },
} as const;

// Withdrawal delay options (in seconds)
export const WITHDRAWAL_DELAYS = {
  instant: 0,
  suggested: [
    { label: '1 hour', value: 3600 },
    { label: '6 hours', value: 21600 },
    { label: '24 hours', value: 86400 },
    { label: '3 days', value: 259200 },
    { label: '1 week', value: 604800 },
  ],
} as const;

// Price API configuration
export const priceConfig = {
  // Using CoinGecko API for price data
  apiUrl: 'https://api.coingecko.com/api/v3',
  // Token IDs for CoinGecko
  tokenIds: {
    USDC: 'usd-coin',
    USDT: 'tether',
    WETH: 'ethereum',
    DOGE: 'dogecoin',
    LBTC: 'bitcoin',
  },
  // Cache duration in milliseconds (5 minutes)
  cacheDuration: 5 * 60 * 1000,
} as const;

// Contract addresses
export const contracts = {
  hasher: '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D' as `0x${string}`,
  verifier: '0xE8Ef2495F741467D746E27548BF71948A0554Ad6' as `0x${string}`,
  // DogeRouter - allows native DOGE deposits/withdrawals (auto-wraps to wDOGE)
  dogeRouter: '0x0A26D94E458EA685dAb82445914519DE6D26EB57' as `0x${string}`,
};

// Shielded Pool (Zcash-style private transfers + swaps)
// V4 deployed Jan 2025 with all security fixes
export const shieldedPool = {
  // Main pool contract V4 - All security fixes applied
  // V4 FEATURES: Swap rate validation, rug pull prevention, platform fee enforcement, change commitment validation,
  //              root manipulation protection, commitment uniqueness, proof malleability protection
  // V3 FEATURES: Partial unshield (e.g., unshield 5 DOGE from 10 DOGE note) + Platform fee (5 DOGE per swap)
  // V2 FEATURES: batchTransfer, batchUnshield, privacy-preserving events, token blacklist
  address: '0x37A7bA0f6769ae08c4331A48f737d4Ffe1bb721a' as `0x${string}`, // V4 - All security fixes deployed (verifiers fixed - canonical validation removed)
  
  // Real ZK verifier contracts (production-ready) - V4: All verifiers match zkey files
  shieldVerifier: '0xD5AB6Ee21afcb4468DD11dA9a2BF58005A9cB5f9' as `0x${string}`, // V4: Generated from shield_final.zkey (2 inputs) - canonical validation removed
  transferVerifier: '0xBAa02AB5Ca5bC2F5c0bC95d0fEE176F06c9DBb0D' as `0x${string}`, // V4: Generated from transfer_final.zkey (6 inputs) - canonical validation removed
  unshieldVerifier: '0x0FFd1824c84b064083F377392537645313eEA540' as `0x${string}`, // V4: Generated from unshield_final.zkey (7 inputs) - canonical validation removed
  swapVerifier: '0xFB463d228d5f1BB7aF5672b3197871Cc9b87b1A5' as `0x${string}`, // V4: Generated from swap_final.zkey (8 inputs) - canonical validation removed
  
  // Circuit files for frontend proof generation
  circuitFiles: {
    shield: {
      wasm: '/circuits/shielded/build/shield_js/shield.wasm',
      zkey: '/circuits/shielded/build/shield_final.zkey',
      vkey: '/circuits/shielded/build/shield_vkey.json',
    },
    transfer: {
      wasm: '/circuits/shielded/build/transfer_js/transfer.wasm',
      zkey: '/circuits/shielded/build/transfer_final.zkey',
      vkey: '/circuits/shielded/build/transfer_vkey.json',
    },
    unshield: {
      wasm: '/circuits/shielded/build/unshield_js/unshield.wasm',
      zkey: '/circuits/shielded/build/unshield_final.zkey',
      vkey: '/circuits/shielded/build/unshield_vkey.json',
    },
    swap: {
      wasm: '/circuits/shielded/build/swap_js/swap.wasm',
      zkey: '/circuits/shielded/build/swap_final.zkey',
      vkey: '/circuits/shielded/build/swap_vkey.json',
    },
  },
  
  // Merkle tree configuration
  merkleTreeLevels: 20,
  
  // All supported tokens for shielded pool
  supportedTokens: {
    DOGE: {
      address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      symbol: 'DOGE',
      decimals: 18,
      isNative: true,
    },
    USDC: {
      address: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925' as `0x${string}`,
      symbol: 'USDC',
      decimals: 18,
    },
    USDT: {
      address: '0xC81800b77D91391Ef03d7868cB81204E753093a9' as `0x${string}`,
      symbol: 'USDT',
      decimals: 18,
    },
    USD1: {
      address: '0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F' as `0x${string}`,
      symbol: 'USD1',
      decimals: 18,
    },
    WETH: {
      address: '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000' as `0x${string}`,
      symbol: 'WETH',
      decimals: 18,
    },
    LBTC: {
      address: '0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E' as `0x${string}`,
      symbol: 'LBTC',
      decimals: 18,
    },
  },
  
  // Price oracle (for real-time swap rates)
  priceOracle: {
    source: 'coingecko',
    cacheDuration: 30000, // 30 seconds
  },
};

// Backend API URLs (indexer + relayer on same server)
// Defaults to Render backend for production, can be overridden with .env.local for local development
export const api = {
  indexer: process.env.NEXT_PUBLIC_INDEXER_URL || 'https://dogenadocash.onrender.com',
  relayer: process.env.NEXT_PUBLIC_RELAYER_URL || 'https://dogenadocash.onrender.com', // Same as indexer
};

// External links
export const links = {
  faucet: 'https://faucet.testnet.dogeos.com',
  explorer: 'https://blockscout.testnet.dogeos.com',
  portal: 'https://portal.testnet.dogeos.com',
  docs: 'https://docs.dogeos.com',
};

// MixerPool ABI for frontend
export const MixerPoolABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'proof', type: 'uint256[8]' },
      { name: 'root', type: 'bytes32' },
      { name: 'nullifierHash', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'fee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPoolInfo',
    inputs: [],
    outputs: [
      { name: '_token', type: 'address' },
      { name: '_denomination', type: 'uint256' },
      { name: '_depositsCount', type: 'uint256' },
      { name: '_root', type: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isKnownRoot',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSpent',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLatestRoot',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'leafIndex', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawal',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'relayer', type: 'address', indexed: true },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
] as const;

// MixerPoolV2 ABI (extends V1 with scheduled withdrawals)
export const MixerPoolV2ABI = [
  ...MixerPoolABI,
  {
    type: 'function',
    name: 'scheduleWithdrawal',
    inputs: [
      { name: 'proof', type: 'uint256[8]' },
      { name: 'root', type: 'bytes32' },
      { name: 'nullifierHash', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'fee', type: 'uint256' },
      { name: 'delay', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeScheduledWithdrawal',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getWithdrawalStatus',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [
      { name: 'timeRemaining', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'isReady', type: 'bool' },
      { name: 'executed', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPendingWithdrawal',
    inputs: [{ name: 'nullifierHash', type: 'bytes32' }],
    outputs: [
      { name: 'recipient', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'fee', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'executed', type: 'bool' },
      { name: 'exists', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolInfoV2',
    inputs: [],
    outputs: [
      { name: '_token', type: 'address' },
      { name: '_denomination', type: 'uint256' },
      { name: '_depositsCount', type: 'uint256' },
      { name: '_scheduledCount', type: 'uint256' },
      { name: '_root', type: 'bytes32' },
      { name: '_minDelay', type: 'uint256' },
      { name: '_maxDelay', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'WithdrawalScheduled',
    inputs: [
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'unlockTime', type: 'uint256', indexed: false },
      { name: 'delay', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WithdrawalExecuted',
    inputs: [
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'executor', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ERC20 ABI for approvals
export const ERC20ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;

// DogeRouter ABI for native DOGE deposits/withdrawals
export const DogeRouterABI = [
  {
    type: 'function',
    name: 'depositDoge',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'commitment', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdrawDoge',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'proof', type: 'uint256[8]' },
      { name: 'root', type: 'bytes32' },
      { name: 'nullifierHash', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'fee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'validPools',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'wdoge',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'DepositDoge',
    inputs: [
      { name: 'pool', type: 'address', indexed: true },
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WithdrawDoge',
    inputs: [
      { name: 'pool', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ShieldedPool ABI (for Zcash-style shielded transactions)
export const ShieldedPoolABI = [
  // Shield native (t→z): Deposit public DOGE into shielded note
  {
    type: 'function',
    name: 'shieldNative',
    inputs: [{ name: '_commitment', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'payable',
  },
  // Shield ERC20 token (t→z): Deposit ERC20 token into shielded note
  {
    type: 'function',
    name: 'shieldToken',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_commitment', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Transfer (z→z): Send shielded DOGE to another shielded address
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_nullifierHash', type: 'bytes32' },
      { name: '_outputCommitment1', type: 'bytes32' },
      { name: '_outputCommitment2', type: 'bytes32' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
      { name: '_encryptedMemo1', type: 'bytes' },
      { name: '_encryptedMemo2', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Unshield (z→t): Withdraw shielded DOGE to public address
  {
    type: 'function',
    name: 'unshield',
    inputs: [
      { name: '_proof', type: 'uint256[8]' },
      { name: '_root', type: 'bytes32' },
      { name: '_nullifierHash', type: 'bytes32' },
      { name: '_recipient', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_relayer', type: 'address' },
      { name: '_fee', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // View functions
  {
    type: 'function',
    name: 'getLastRoot',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isKnownRoot',
    inputs: [{ name: '_root', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSpentNullifier',
    inputs: [{ name: '_nullifierHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalShieldedBalance',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'Shield',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'leafIndex', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'outputCommitment1', type: 'bytes32', indexed: false },
      { name: 'outputCommitment2', type: 'bytes32', indexed: false },
      { name: 'leafIndex1', type: 'uint256', indexed: true },
      { name: 'leafIndex2', type: 'uint256', indexed: true },
      { name: 'encryptedMemo1', type: 'bytes', indexed: false },
      { name: 'encryptedMemo2', type: 'bytes', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Unshield',
    inputs: [
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'relayer', type: 'address', indexed: true },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

