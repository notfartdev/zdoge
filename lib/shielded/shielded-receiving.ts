/**
 * Shielded Receiving System
 * 
 * Enables automatic discovery of incoming shielded transfers.
 * 
 * When User A transfers to User B:
 * 1. User A encrypts the note details with User B's viewing key
 * 2. The encrypted memo is published on-chain with the transfer
 * 3. User B scans Transfer events and tries to decrypt with their viewing key
 * 4. If decryption succeeds → they own the note → auto-import
 * 
 * This is similar to Zcash's encrypted memo field.
 */

import {
  ShieldedNote,
  createNoteWithRandomness,
  serializeNote,
  deserializeNote,
} from './shielded-note';
import { ShieldedIdentity } from './shielded-address';
import { shieldedPool } from '../dogeos-config';
import {
  mimcHash2,
  randomFieldElement,
  toBytes32,
  fromHex,
  FIELD_SIZE,
} from './shielded-crypto';

/**
 * Encrypted note memo (published on-chain)
 * Contains all info needed for recipient to reconstruct the note
 */
export interface EncryptedMemo {
  // The encrypted data (hex string)
  ciphertext: string;
  
  // Ephemeral public key (for ECDH-like key exchange)
  ephemeralPubkey: string;
  
  // Nonce for decryption
  nonce: string;
}

/**
 * Note data that gets encrypted in the memo
 */
interface NoteMemoData {
  amount: string;
  secret: string;
  blinding: string;
  token: string;
}

/**
 * Derive encryption key from viewing key and ephemeral key
 * Simple key derivation: encKey = MiMC(viewingKey, ephemeralPubkey)
 */
async function deriveEncryptionKey(
  viewingKey: bigint,
  ephemeralPubkey: bigint
): Promise<bigint> {
  return mimcHash2(viewingKey, ephemeralPubkey);
}

/**
 * Simple XOR-based encryption (for demo - use proper encryption in production)
 * In production, use AES-GCM or ChaCha20-Poly1305
 */
function xorEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

/**
 * Convert bigint to bytes
 */
function bigintToBytes(value: bigint, length: number): Uint8Array {
  const hex = value.toString(16).padStart(length * 2, '0');
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Encrypt note details for a recipient
 * 
 * @param note The note being sent (with recipient's pubkey as owner)
 * @param recipientShieldedAddress Recipient's shielded address (public)
 * @returns Encrypted memo to publish on-chain
 */
export async function encryptNoteForRecipient(
  note: ShieldedNote,
  recipientShieldedAddress: bigint
): Promise<EncryptedMemo> {
  // Generate ephemeral key pair for this transfer
  const ephemeralPrivate = randomFieldElement();
  const ephemeralPubkey = await mimcHash2(ephemeralPrivate, BigInt(0));
  
  // Derive shared secret using ephemeralPubkey and recipientShieldedAddress
  // Recipient will compute the SAME value: MiMC(ephemeralPubkey, theirShieldedAddress)
  const sharedSecret = await mimcHash2(ephemeralPubkey, recipientShieldedAddress);
  
  // Prepare note data (include full token metadata)
  const memoData: NoteMemoData = {
    amount: note.amount.toString(),
    secret: note.secret.toString(16).padStart(64, '0'),
    blinding: note.blinding.toString(16).padStart(64, '0'),
    token: note.token,
    tokenAddress: note.tokenAddress,
    decimals: note.decimals,
  };
  
  // Serialize and encrypt
  const dataJson = JSON.stringify(memoData);
  const dataBytes = new TextEncoder().encode(dataJson);
  
  // Generate nonce
  const nonce = randomFieldElement();
  
  // Derive encryption key from shared secret and nonce
  const encKey = await mimcHash2(sharedSecret, nonce);
  const keyBytes = bigintToBytes(encKey, 32);
  
  // Encrypt
  const ciphertext = xorEncrypt(dataBytes, keyBytes);
  
  return {
    ciphertext: Buffer.from(ciphertext).toString('hex'),
    ephemeralPubkey: ephemeralPubkey.toString(16).padStart(64, '0'),
    nonce: nonce.toString(16).padStart(64, '0'),
  };
}

/**
 * Try to decrypt an encrypted memo
 * 
 * @param memo The encrypted memo from on-chain
 * @param identity Your shielded identity
 * @returns Decrypted note if it's for you, null otherwise
 */
export async function tryDecryptMemo(
  memo: EncryptedMemo,
  identity: ShieldedIdentity
): Promise<ShieldedNote | null> {
  try {
    // Parse ephemeral pubkey and nonce
    const ephemeralPubkey = BigInt('0x' + memo.ephemeralPubkey);
    const nonce = BigInt('0x' + memo.nonce);
    
    // Compute shared secret: MiMC(ephemeralPubkey, ourShieldedAddress)
    // This matches what the sender computed: MiMC(ephemeralPubkey, recipientShieldedAddress)
    // If we're the recipient, these will be equal!
    const sharedSecret = await mimcHash2(ephemeralPubkey, identity.shieldedAddress);
    
    // Derive decryption key
    const decKey = await mimcHash2(sharedSecret, nonce);
    const keyBytes = bigintToBytes(decKey, 32);
    
    // Decrypt
    const ciphertext = Buffer.from(memo.ciphertext, 'hex');
    const plaintext = xorEncrypt(new Uint8Array(ciphertext), keyBytes);
    
    // Parse JSON
    const dataJson = new TextDecoder().decode(plaintext);
    const memoData: NoteMemoData = JSON.parse(dataJson);
    
    // Get token metadata - use memo data if available, otherwise look up from config
    let tokenAddress: `0x${string}`;
    let decimals: number;
    
    if (memoData.tokenAddress && memoData.decimals != null) {
      // Modern memo with full metadata
      tokenAddress = memoData.tokenAddress as `0x${string}`;
      decimals = memoData.decimals;
    } else {
      // Legacy memo - look up from token symbol
      const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as `0x${string}`;
      if (memoData.token === 'DOGE') {
        tokenAddress = NATIVE_TOKEN;
        decimals = 18;
      } else {
        const token = shieldedPool.supportedTokens[memoData.token as keyof typeof shieldedPool.supportedTokens];
        if (!token) {
          throw new Error(`Token ${memoData.token} not found in config`);
        }
        tokenAddress = token.address;
        decimals = token.decimals;
      }
    }
    
    // Reconstruct note with full token metadata
    const note = await createNoteWithRandomness(
      BigInt(memoData.amount),
      identity.shieldedAddress,
      BigInt('0x' + memoData.secret),
      BigInt('0x' + memoData.blinding),
      memoData.token,
      tokenAddress,
      decimals
    );
    
    return note;
  } catch (error) {
    // Decryption failed - this memo is not for us
    return null;
  }
}

/**
 * Scan for incoming transfers
 * 
 * @param events Transfer events from the contract
 * @param identity Your shielded identity
 * @returns Array of notes that belong to you
 */
export async function scanForIncomingTransfers(
  events: Array<{
    nullifierHash: string;
    outputCommitment1: string;
    outputCommitment2: string;
    encryptedMemo1?: string;
    encryptedMemo2?: string;
    leafIndex1: number;
    leafIndex2: number;
  }>,
  identity: ShieldedIdentity
): Promise<ShieldedNote[]> {
  const discoveredNotes: ShieldedNote[] = [];
  
  for (const event of events) {
    // Try to decrypt memo 1 (recipient's note)
    if (event.encryptedMemo1) {
      try {
        const memo = JSON.parse(event.encryptedMemo1) as EncryptedMemo;
        const note = await tryDecryptMemo(memo, identity);
        if (note) {
          note.leafIndex = event.leafIndex1;
          discoveredNotes.push(note);
        }
      } catch (e) {
        // Not for us or invalid memo
      }
    }
    
    // Try to decrypt memo 2 (change note - only if we're the sender)
    if (event.encryptedMemo2) {
      try {
        const memo = JSON.parse(event.encryptedMemo2) as EncryptedMemo;
        const note = await tryDecryptMemo(memo, identity);
        if (note) {
          note.leafIndex = event.leafIndex2;
          discoveredNotes.push(note);
        }
      } catch (e) {
        // Not for us or invalid memo
      }
    }
  }
  
  return discoveredNotes;
}

/**
 * Format encrypted memo for contract call
 * Returns hex-encoded bytes
 */
export function formatMemoForContract(memo: EncryptedMemo): `0x${string}` {
  const json = JSON.stringify(memo);
  const hex = Buffer.from(json).toString('hex');
  return `0x${hex}`;
}

/**
 * Parse encrypted memo from contract event
 */
export function parseMemoFromContract(hexData: string): EncryptedMemo | null {
  try {
    const json = Buffer.from(hexData.replace('0x', ''), 'hex').toString('utf-8');
    return JSON.parse(json) as EncryptedMemo;
  } catch {
    return null;
  }
}


