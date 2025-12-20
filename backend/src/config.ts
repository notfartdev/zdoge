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
    // All pools (multi-token support)
    pools: {
      // USDC
      'usdc-1': '0x381Ea9De3e18684Ceb27C484F9967b5e66192c39',
      'usdc-10': '0xfaA751c76d4aEA7e729bDCfBFD2eb0B6edCc8cbb',
      'usdc-100': '0x0843FfA3f936D671b5A8fcD7485589aD2DDe79E1',
      'usdc-1000': '0xC832b63d408FA3Aa337Bcb6142820Dce42742dB8',
      // USDT
      'usdt-1': '0xed030C6747f58C0ae2577179E997Db7d4913161c',
      'usdt-10': '0xe28FcC3C7699f4363F0ECA318545873b3ec776De',
      'usdt-100': '0x397851793EB29a1cADb8bBd84cde191755550092',
      'usdt-1000': '0x8Cb14297AB6CBBeE5A051359050c5e7b6bB749E4',
      // USD1
      'usd1-1': '0xac8b5d8CaD366B2CB4649CF6d19912143617d13c',
      'usd1-10': '0xA03388ae4E6ed03eE5312C3AEFaD8418636040bf',
      'usd1-100': '0x9EDAd2F0196e7B3ab38b1844964de1A06EB2e6B1',
      'usd1-1000': '0xd9EB8AaD52806E47b5E7DcbE4Dffb95CA81a8fd9',
      // WDOGE
      'wdoge-100': '0xAAbC0bF61d4c0C580f94133a2E905Ae3DB2C9689',
      'wdoge-1000': '0xF09a1A994610E50e38FC9535d9151127F126dAbe',
      'wdoge-10000': '0x687c1566B204350C91aB25f8B43235bF59e6535d',
      'wdoge-100000': '0x7d1cF893E6B2192D3a34369a3D2742F572879E17',
      // WETH
      'weth-0.01': '0x72734eDD05E680a4dB4312974EE46ce903aE807C',
      'weth-0.1': '0x1d5d2c74e3b402749Fd9BeD709a749A0E5E2ea8e',
      'weth-1': '0xb3748014f9bDB54F7fc33d8aea6Fbff7a0750d6b',
      'weth-10': '0xfAfD381E6246E67607603BCf617AB522Ce4de1D9',
      // LBTC
      'lbtc-0.001': '0x144679135b82d21577409Ee9F479a06DC5f795cD',
      'lbtc-0.01': '0x7C4702b79d3B1Faf63CA75e27365Ed69c6C7641d',
      'lbtc-0.1': '0x568726722BC8170079DAb667813C8894A7c96b4D',
      'lbtc-1': '0x6eCAAF4b39bb68f49b02f97191D40e5f5dccD419',
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

