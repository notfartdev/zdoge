import { defineChain } from 'viem';
import * as dotenv from 'dotenv';

dotenv.config();

// DogeOS Testnet Chain Definition
export const dogeosTestnet = defineChain({
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
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://blockscout.testnet.dogeos.com' },
  },
  testnet: true,
});

// Configuration
export const config = {
  // Network
  rpcUrl: process.env.DOGEOS_RPC_URL || 'https://rpc.testnet.dogeos.com',
  wsRpcUrl: process.env.DOGEOS_WS_RPC_URL || 'wss://ws.rpc.testnet.dogeos.com',
  chainId: 6281971,

  // Contract addresses - deployed on DogeOS Testnet (circomlibjs compatible)
  contracts: {
    hasher: process.env.HASHER_ADDRESS || '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D',
    verifier: process.env.VERIFIER_ADDRESS || '0xE8Ef2495F741467D746E27548BF71948A0554Ad6',
    // DogeRouter - allows native DOGE deposits/withdrawals (auto-wraps to wDOGE)
    dogeRouter: '0x0A26D94E458EA685dAb82445914519DE6D26EB57',
    // All pools (multi-token support) - Updated with 18 decimal pools
    pools: {
      // USDC (18 decimals on DogeOS testnet)
      'usdc-1': '0x3c1FDFdBc9f436c9D370c57C658C1ca67EBAa146',
      'usdc-10': '0xd8d301c460023D320f44da2f696831ECc7F60504',
      'usdc-100': '0xe00bC9e7431dFF487ac9EB7b51d8B14C5B7b0847',
      'usdc-1000': '0xde641902e9986eFD55A664230AC0203d3286E2b0',
      // USDT (18 decimals on DogeOS testnet)
      'usdt-1': '0x3B80e33752634d856AE6e6f68570157637912000',
      'usdt-10': '0x6f9210EDd0985eA6f9FEeAB080FA85933178D38c',
      'usdt-100': '0x13DC6fda3cF0990e7D15750A2c3ce8693c351e46',
      'usdt-1000': '0x308C8f3692c6C19B84A24466D1792f7B794cF5ae',
      // USD1 (18 decimals)
      'usd1-1': '0x72CdC6eA899621be7dF24c8084C667276D23F5b3',
      'usd1-10': '0x47fE455020B010c114356C88C291118918e32c57',
      'usd1-100': '0x248A93958693fD9Cc260676B63440F5eBAf25B79',
      'usd1-1000': '0x307d1D56a321eE5f4334b6A3A00E6Cc6ad8598b1',
      // Native DOGE pools (MixerPoolNative - accepts native DOGE directly)
      'doge-1': '0xb253d81E44bCE93Fb742EE8cD26D96eD910f401a',
      'doge-10': '0x01aA22f48DBA28934b0aABB0D949F56d942775e6',
      'doge-100': '0x0E9A2FD5b4176fFb7C3dE11a8D90D8AAD5dC0811',
      'doge-1000': '0xe1c751D6F65768EB6d3BCb84760bDd68C6d3F7D4',
      // WETH (18 decimals - already correct)
      'weth-0.01': '0x72734eDD05E680a4dB4312974EE46ce903aE807C',
      'weth-0.1': '0x1d5d2c74e3b402749Fd9BeD709a749A0E5E2ea8e',
      'weth-1': '0xb3748014f9bDB54F7fc33d8aea6Fbff7a0750d6b',
      'weth-10': '0xfAfD381E6246E67607603BCf617AB522Ce4de1D9',
      // LBTC (18 decimals on DogeOS testnet)
      'lbtc-0.001': '0x821EdB78D739759F0E226DF9a0B8D87f7c78cA77',
      'lbtc-0.01': '0xda43aA668640CA2F48364adCC01B1Ed5c11D6385',
      'lbtc-0.1': '0x5ffc61930595BA9Fae2a0D0b0651cd65BC105e92',
      'lbtc-1': '0x526A143FD0C0429cE71FB8FA09ACa6f4876d29a5',
    },
  },

  // Token addresses
  tokens: {
    wdoge: '0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE',
    usdc: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925',
    usdt: '0xC81800b77D91391Ef03d7868cB81204E753093a9',
  },

  // Relayer config
  relayer: {
    privateKey: process.env.RELAYER_PRIVATE_KEY || '',
    minFee: BigInt(process.env.MIN_RELAYER_FEE || '0'),
    maxFee: BigInt(process.env.MAX_RELAYER_FEE || '1000000'), // 1 USDC max
  },

  // Server config
  server: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
  },

  // Merkle tree
  merkleTreeDepth: 20,

  // Shielded Pool V3 (with partial unshield support + platform fee for swaps)
  shieldedPool: {
    // V4 contract address - can be overridden with SHIELDED_POOL_ADDRESS env var
    // V4: All security fixes deployed - Jan 2025 (verifiers fixed - canonical validation removed)
    address: process.env.SHIELDED_POOL_ADDRESS || '0x37A7bA0f6769ae08c4331A48f737d4Ffe1bb721a',
  },
};

// MixerPool ABI (minimal for events and calls)
export const MixerPoolABI = [
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
    name: 'nextLeafIndex',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

