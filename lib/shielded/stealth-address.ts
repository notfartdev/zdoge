/**
 * Stealth Address Implementation
 * 
 * Creates one-time receive addresses for enhanced privacy.
 * Based on EIP-5564 Stealth Address standard with adaptations for our shielded system.
 * 
 * Flow:
 * 1. Recipient publishes their "meta-address" (derived from spending + viewing keys)
 * 2. Sender generates ephemeral keypair and derives one-time stealth address
 * 3. Sender sends funds and publishes ephemeral pubkey
 * 4. Recipient scans ephemeral pubkeys to find funds sent to them
 * 
 * This breaks the link between transactions and recipient identity.
 */

import { keccak256, toBytes, bytesToHex, hexToBytes } from 'viem';
import { FIELD_SIZE, randomFieldElement, mimcHash2, initMimc } from './shielded-crypto';

// ============ Types ============

export interface StealthMetaAddress {
  // Public spending key (recipient proves ownership to spend)
  spendingPubKey: bigint;
  // Public viewing key (for scanning incoming transfers)
  viewingPubKey: bigint;
}

export interface StealthAddress {
  // The one-time address funds should be sent to
  address: string;
  // Ephemeral public key (published for recipient to scan)
  ephemeralPubKey: bigint;
  // Encrypted note data (only recipient can decrypt)
  encryptedData: string;
  // View tag for fast scanning (first 20 bits of shared secret hash)
  viewTag: string;
}

export interface StealthKeys {
  // Private spending key
  spendingKey: bigint;
  // Private viewing key
  viewingKey: bigint;
  // Meta-address (public)
  metaAddress: StealthMetaAddress;
}

// ============ Key Generation ============

/**
 * Generate stealth keys from a seed (typically derived from wallet signature)
 */
export async function generateStealthKeys(seed: string): Promise<StealthKeys> {
  await initMimc();
  
  // Derive keys from seed using domain separation
  const seedHash = keccak256(toBytes(seed));
  
  // Spending key = Hash(seed || "spending")
  const spendingHash = keccak256(toBytes(seedHash + 'spending'));
  const spendingKey = BigInt(spendingHash) % FIELD_SIZE;
  
  // Viewing key = Hash(seed || "viewing")
  const viewingHash = keccak256(toBytes(seedHash + 'viewing'));
  const viewingKey = BigInt(viewingHash) % FIELD_SIZE;
  
  // Derive public keys (simplified - in production use proper curve operations)
  // For now we use MiMC hash as a one-way function to derive pubkeys
  const spendingPubKey = await mimcHash2(spendingKey, 1n);
  const viewingPubKey = await mimcHash2(viewingKey, 1n);
  
  return {
    spendingKey,
    viewingKey,
    metaAddress: {
      spendingPubKey,
      viewingPubKey,
    },
  };
}

/**
 * Encode meta-address to a shareable string
 * Format: dogenado:stealth:<spendingPubKey>:<viewingPubKey>
 */
export function encodeMetaAddress(metaAddress: StealthMetaAddress): string {
  const spendHex = metaAddress.spendingPubKey.toString(16).padStart(64, '0');
  const viewHex = metaAddress.viewingPubKey.toString(16).padStart(64, '0');
  return `dogenado:stealth:${spendHex}:${viewHex}`;
}

/**
 * Decode meta-address from string
 */
export function decodeMetaAddress(encoded: string): StealthMetaAddress | null {
  if (!encoded.startsWith('dogenado:stealth:')) {
    return null;
  }
  
  const parts = encoded.slice('dogenado:stealth:'.length).split(':');
  if (parts.length !== 2) {
    return null;
  }
  
  try {
    return {
      spendingPubKey: BigInt('0x' + parts[0]),
      viewingPubKey: BigInt('0x' + parts[1]),
    };
  } catch {
    return null;
  }
}

// ============ Stealth Address Generation (Sender Side) ============

/**
 * Generate a one-time stealth address for the recipient
 * 
 * @param recipientMetaAddress - Recipient's public meta-address
 * @param noteData - Data to encrypt (amount, token, etc.)
 * @returns StealthAddress with one-time address and ephemeral key
 */
export async function generateStealthAddress(
  recipientMetaAddress: StealthMetaAddress,
  noteData: { amount: bigint; token: string; secret: bigint; blinding: bigint }
): Promise<StealthAddress> {
  await initMimc();
  
  // Generate ephemeral keypair
  const ephemeralPrivKey = await randomFieldElement();
  const ephemeralPubKey = await mimcHash2(ephemeralPrivKey, 1n);
  
  // Compute shared secret: ss = Hash(ephemeralPriv * recipientViewingPub)
  // In our simplified version: ss = MiMC(ephemeralPriv, viewingPubKey)
  const sharedSecret = await mimcHash2(ephemeralPrivKey, recipientMetaAddress.viewingPubKey);
  
  // Derive one-time spending pubkey: P = spendingPub + Hash(ss)
  const stealthFactor = await mimcHash2(sharedSecret, 0n);
  const stealthPubKey = (recipientMetaAddress.spendingPubKey + stealthFactor) % FIELD_SIZE;
  
  // Create stealth address string
  const stealthAddress = 'dogenado:s1_' + stealthPubKey.toString(16).padStart(64, '0');
  
  // Create view tag (first 5 hex chars of shared secret hash for fast scanning)
  const viewTagHash = keccak256(toBytes('0x' + sharedSecret.toString(16).padStart(64, '0')));
  const viewTag = viewTagHash.slice(2, 12); // 5 bytes = 10 hex chars
  
  // Encrypt note data with shared secret
  const dataToEncrypt = JSON.stringify({
    amount: noteData.amount.toString(),
    token: noteData.token,
    secret: noteData.secret.toString(16),
    blinding: noteData.blinding.toString(16),
  });
  
  // Simple XOR encryption with shared secret (for demo - use proper encryption in production)
  const encryptedData = await encryptWithSharedSecret(dataToEncrypt, sharedSecret);
  
  return {
    address: stealthAddress,
    ephemeralPubKey,
    encryptedData,
    viewTag,
  };
}

// ============ Stealth Address Scanning (Recipient Side) ============

/**
 * Scan an ephemeral pubkey to see if funds were sent to us
 * 
 * @param ephemeralPubKey - Published ephemeral key from a transaction
 * @param viewTag - View tag from the transaction (for fast filtering)
 * @param encryptedData - Encrypted note data
 * @param stealthKeys - Recipient's stealth keys
 * @returns Decrypted note data if this transfer is for us, null otherwise
 */
export async function scanStealthTransfer(
  ephemeralPubKey: bigint,
  viewTag: string,
  encryptedData: string,
  stealthKeys: StealthKeys
): Promise<{
  amount: bigint;
  token: string;
  secret: bigint;
  blinding: bigint;
  stealthPrivKey: bigint;
} | null> {
  await initMimc();
  
  // Compute shared secret from our viewing key and sender's ephemeral pubkey
  // ss = MiMC(viewingKey, ephemeralPubKey)
  const sharedSecret = await mimcHash2(stealthKeys.viewingKey, ephemeralPubKey);
  
  // Quick check: compare view tags
  const viewTagHash = keccak256(toBytes('0x' + sharedSecret.toString(16).padStart(64, '0')));
  const computedViewTag = viewTagHash.slice(2, 12);
  
  if (computedViewTag !== viewTag) {
    return null; // Not for us
  }
  
  // Decrypt the note data
  try {
    const decryptedJson = await decryptWithSharedSecret(encryptedData, sharedSecret);
    const data = JSON.parse(decryptedJson);
    
    // Derive the stealth private key (so we can spend the funds)
    // stealthPriv = spendingKey + Hash(ss)
    const stealthFactor = await mimcHash2(sharedSecret, 0n);
    const stealthPrivKey = (stealthKeys.spendingKey + stealthFactor) % FIELD_SIZE;
    
    return {
      amount: BigInt(data.amount),
      token: data.token,
      secret: BigInt('0x' + data.secret),
      blinding: BigInt('0x' + data.blinding),
      stealthPrivKey,
    };
  } catch {
    return null; // Decryption failed, not for us
  }
}

// ============ Encryption Helpers ============

/**
 * Simple encryption using shared secret (XOR-based)
 * In production, use ChaCha20-Poly1305 or similar
 */
async function encryptWithSharedSecret(plaintext: string, secret: bigint): Promise<string> {
  const keyBytes = hexToBytes(('0x' + secret.toString(16).padStart(64, '0')) as `0x${string}`);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  
  // Expand key to match plaintext length using keccak
  const expandedKey = new Uint8Array(plaintextBytes.length);
  for (let i = 0; i < plaintextBytes.length; i += 32) {
    const blockIndex = Math.floor(i / 32);
    const keyBlock = keccak256(
      new Uint8Array([...keyBytes, ...new Uint8Array([blockIndex])])
    );
    const keyBlockBytes = hexToBytes(keyBlock as `0x${string}`);
    for (let j = 0; j < 32 && i + j < plaintextBytes.length; j++) {
      expandedKey[i + j] = keyBlockBytes[j];
    }
  }
  
  // XOR encrypt
  const encrypted = new Uint8Array(plaintextBytes.length);
  for (let i = 0; i < plaintextBytes.length; i++) {
    encrypted[i] = plaintextBytes[i] ^ expandedKey[i];
  }
  
  return bytesToHex(encrypted);
}

/**
 * Decrypt using shared secret
 */
async function decryptWithSharedSecret(ciphertext: string, secret: bigint): Promise<string> {
  const keyBytes = hexToBytes(('0x' + secret.toString(16).padStart(64, '0')) as `0x${string}`);
  const ciphertextBytes = hexToBytes(ciphertext as `0x${string}`);
  
  // Expand key
  const expandedKey = new Uint8Array(ciphertextBytes.length);
  for (let i = 0; i < ciphertextBytes.length; i += 32) {
    const blockIndex = Math.floor(i / 32);
    const keyBlock = keccak256(
      new Uint8Array([...keyBytes, ...new Uint8Array([blockIndex])])
    );
    const keyBlockBytes = hexToBytes(keyBlock as `0x${string}`);
    for (let j = 0; j < 32 && i + j < ciphertextBytes.length; j++) {
      expandedKey[i + j] = keyBlockBytes[j];
    }
  }
  
  // XOR decrypt
  const decrypted = new Uint8Array(ciphertextBytes.length);
  for (let i = 0; i < ciphertextBytes.length; i++) {
    decrypted[i] = ciphertextBytes[i] ^ expandedKey[i];
  }
  
  return new TextDecoder().decode(decrypted);
}

// ============ One-Time Address Format ============

/**
 * Generate a shareable one-time receive address
 * This is what users share to receive funds privately
 * 
 * Format: dogenado:recv:<base64(ephemeralPubKey|viewTag|encryptedPlaceholder)>
 */
export async function generateReceiveAddress(stealthKeys: StealthKeys): Promise<{
  address: string;
  metaAddress: string;
}> {
  // The receive address is just the meta-address
  // Senders will derive one-time addresses from it
  const metaAddress = encodeMetaAddress(stealthKeys.metaAddress);
  
  return {
    address: metaAddress,
    metaAddress,
  };
}

/**
 * Parse a stealth address to determine if it's for us
 */
export function parseStealthAddress(address: string): {
  type: 'meta' | 'one-time' | 'invalid';
  data?: any;
} {
  if (address.startsWith('dogenado:stealth:')) {
    const meta = decodeMetaAddress(address);
    if (meta) {
      return { type: 'meta', data: meta };
    }
  }
  
  if (address.startsWith('dogenado:s1_')) {
    const pubKey = address.slice('dogenado:s1_'.length);
    try {
      return { type: 'one-time', data: { pubKey: BigInt('0x' + pubKey) } };
    } catch {
      // Invalid
    }
  }
  
  return { type: 'invalid' };
}

