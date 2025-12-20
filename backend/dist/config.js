"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MixerPoolABI = exports.config = exports.dogeosTestnet = void 0;
const viem_1 = require("viem");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// DogeOS Testnet Chain Definition
exports.dogeosTestnet = (0, viem_1.defineChain)({
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
exports.config = {
    // Network
    rpcUrl: process.env.DOGEOS_RPC_URL || 'https://rpc.testnet.dogeos.com',
    wsRpcUrl: process.env.DOGEOS_WS_RPC_URL || 'wss://ws.rpc.testnet.dogeos.com',
    chainId: 6281971,
    // Contract addresses - deployed on DogeOS Testnet (circomlibjs compatible)
    contracts: {
        hasher: process.env.HASHER_ADDRESS || '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D',
        verifier: process.env.VERIFIER_ADDRESS || '0xE8Ef2495F741467D746E27548BF71948A0554Ad6',
        // V1 Pools (instant only)
        poolsV1: {
            usdc1: '0x374F532FF869E61029a793520A9F351d42D0E03D',
            usdc10: '0x4f5A610E096a03179D0853eeA4976e058700C5C6',
            usdc100: '0x84F4eAF70cF6Fe5C0F58012Fc5E32C916292cc57',
            usdc1000: '0xd6BC051EE37396095960aCb1fce9c0Fe5B13152D',
        },
        // V2 Pools (with timelock)
        poolsV2: {
            usdc1: '0x552E1d86D3D1eaf9DA9587242d7bb6d580adca9F',
            usdc10: '0xB00e47b2E108236352aeb83ECa92a3045C82822b',
            usdc100: '0x2300461E7ea01b24ED2f1Fd75fc7D2dDE8Eb1F5D',
            usdc1000: '0x6c342E5b560B226e81690de953F78a0f93f6946f',
        },
        // Default to V2 pools
        pools: {
            usdc1: process.env.POOL_1_USDC || '0x552E1d86D3D1eaf9DA9587242d7bb6d580adca9F',
            usdc10: process.env.POOL_10_USDC || '0xB00e47b2E108236352aeb83ECa92a3045C82822b',
            usdc100: process.env.POOL_100_USDC || '0x2300461E7ea01b24ED2f1Fd75fc7D2dDE8Eb1F5D',
            usdc1000: process.env.POOL_1000_USDC || '0x6c342E5b560B226e81690de953F78a0f93f6946f',
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
exports.MixerPoolABI = [
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
];
