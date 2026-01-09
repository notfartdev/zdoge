/**
 * Privacy Utilities
 * 
 * Utility functions for privacy enhancements:
 * - Timestamp rounding
 * - Memo hashing
 * - RPC rotation
 */

import { keccak256, toBytes } from 'viem';

/**
 * Round timestamp to buckets to reduce timing correlation
 * @param timestamp Unix timestamp in seconds
 * @param bucketMinutes Bucket size in minutes (default: 5)
 * @returns Rounded timestamp
 */
export function roundTimestamp(timestamp: number, bucketMinutes: number = 5): number {
  const bucketSeconds = bucketMinutes * 60;
  return Math.floor(timestamp / bucketSeconds) * bucketSeconds;
}

/**
 * Hash a memo to reduce on-chain data
 * @param memo Encrypted memo (Uint8Array or hex string)
 * @returns keccak256 hash of memo
 */
export function hashMemo(memo: Uint8Array | string): string {
  const bytes = typeof memo === 'string' 
    ? (memo.startsWith('0x') ? toBytes(memo as `0x${string}`) : new TextEncoder().encode(memo))
    : memo;
  return keccak256(bytes);
}

/**
 * Validate memo size
 * @param memo Encrypted memo (Uint8Array or hex string)
 * @param maxBytes Maximum allowed bytes (default: 128)
 * @returns True if valid
 */
export function validateMemoSize(memo: Uint8Array | string, maxBytes: number = 128): boolean {
  const bytes = typeof memo === 'string'
    ? Buffer.from(memo.startsWith('0x') ? memo.slice(2) : memo, 'hex')
    : Buffer.from(memo);
  return bytes.length <= maxBytes;
}

/**
 * Privacy-focused RPC providers
 * Rotate through providers to reduce tracking
 * Currently only one RPC (DogeOS Chikyū), but structure ready for more
 */
export const PRIVACY_RPC_PROVIDERS = [
  process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.dogeos.com',
  // Add more providers here when available:
  // 'https://rpc2.testnet.dogeos.com',
  // 'https://rpc3.testnet.dogeos.com',
];

let currentRpcIndex = 0;

/**
 * Get next RPC URL in rotation
 * With only one RPC, this just returns that one RPC
 * When more RPCs are added, it will rotate through them
 */
export function getPrivacyRpcUrl(): string {
  if (PRIVACY_RPC_PROVIDERS.length === 0) {
    // Fallback to default
    return 'https://rpc.testnet.dogeos.com';
  }
  const url = PRIVACY_RPC_PROVIDERS[currentRpcIndex];
  currentRpcIndex = (currentRpcIndex + 1) % PRIVACY_RPC_PROVIDERS.length;
  return url;
}

/**
 * Get random RPC URL (more privacy, less predictable)
 */
export function getRandomRpcUrl(): string {
  if (PRIVACY_RPC_PROVIDERS.length === 0) {
    throw new Error('No RPC providers configured');
  }
  const index = Math.floor(Math.random() * PRIVACY_RPC_PROVIDERS.length);
  return PRIVACY_RPC_PROVIDERS[index];
}

/**
 * Reset RPC rotation index (useful for testing)
 */
export function resetRpcRotation(): void {
  currentRpcIndex = 0;
}
