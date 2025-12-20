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
  WDOGE: {
    address: '0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE' as `0x${string}`,
    symbol: 'WDOGE',
    decimals: 18,
    name: 'Wrapped DOGE',
  },
  USDC: {
    address: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925' as `0x${string}`,
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  USDT: {
    address: '0xC81800b77D91391Ef03d7868cB81204E753093a9' as `0x${string}`,
    symbol: 'USDT',
    decimals: 6,
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
    decimals: 8,
    name: 'Liquid BTC',
  },
} as const;

// Supported tokens for mixing
export const SUPPORTED_TOKENS = ['USDC', 'USDT', 'USD1', 'WDOGE', 'WETH', 'LBTC'] as const;
export type SupportedToken = typeof SUPPORTED_TOKENS[number];

// Pool configuration per token
export const tokenPools: Record<SupportedToken, {
  token: typeof tokens[keyof typeof tokens];
  amounts: number[];
  pools: Record<string, `0x${string}`>;
}> = {
  USDC: {
    token: tokens.USDC,
    amounts: [1, 10, 100, 1000],
    pools: {
      '1': '0x381Ea9De3e18684Ceb27C484F9967b5e66192c39',
      '10': '0xfaA751c76d4aEA7e729bDCfBFD2eb0B6edCc8cbb',
      '100': '0x0843FfA3f936D671b5A8fcD7485589aD2DDe79E1',
      '1000': '0xC832b63d408FA3Aa337Bcb6142820Dce42742dB8',
    },
  },
  USDT: {
    token: tokens.USDT,
    amounts: [1, 10, 100, 1000],
    pools: {
      '1': '0xed030C6747f58C0ae2577179E997Db7d4913161c',
      '10': '0xe28FcC3C7699f4363F0ECA318545873b3ec776De',
      '100': '0x397851793EB29a1cADb8bBd84cde191755550092',
      '1000': '0x8Cb14297AB6CBBeE5A051359050c5e7b6bB749E4',
    },
  },
  USD1: {
    token: tokens.USD1,
    amounts: [1, 10, 100, 1000],
    pools: {
      '1': '0xac8b5d8CaD366B2CB4649CF6d19912143617d13c',
      '10': '0xA03388ae4E6ed03eE5312C3AEFaD8418636040bf',
      '100': '0x9EDAd2F0196e7B3ab38b1844964de1A06EB2e6B1',
      '1000': '0xd9EB8AaD52806E47b5E7DcbE4Dffb95CA81a8fd9',
    },
  },
  WDOGE: {
    token: tokens.WDOGE,
    amounts: [100, 1000, 10000, 100000],
    pools: {
      '100': '0xAAbC0bF61d4c0C580f94133a2E905Ae3DB2C9689',
      '1000': '0xF09a1A994610E50e38FC9535d9151127F126dAbe',
      '10000': '0x687c1566B204350C91aB25f8B43235bF59e6535d',
      '100000': '0x7d1cF893E6B2192D3a34369a3D2742F572879E17',
    },
  },
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
      '0.001': '0x144679135b82d21577409Ee9F479a06DC5f795cD',
      '0.01': '0x7C4702b79d3B1Faf63CA75e27365Ed69c6C7641d',
      '0.1': '0x568726722BC8170079DAb667813C8894A7c96b4D',
      '1': '0x6eCAAF4b39bb68f49b02f97191D40e5f5dccD419',
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
  USDC_1: { address: tokenPools.USDC.pools['1'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(1 * 10 ** 6), amount: 1 },
  USDC_10: { address: tokenPools.USDC.pools['10'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(10 * 10 ** 6), amount: 10 },
  USDC_100: { address: tokenPools.USDC.pools['100'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(100 * 10 ** 6), amount: 100 },
  USDC_1000: { address: tokenPools.USDC.pools['1000'] as `0x${string}`, token: tokens.USDC, denomination: BigInt(1000 * 10 ** 6), amount: 1000 },
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
};

// Backend API URLs (indexer + relayer on same server)
export const api = {
  indexer: process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001',
  relayer: process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3001', // Same as indexer
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

