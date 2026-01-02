/**
 * Shielded Address System for Dogenado
 * 
 * Each user has:
 * - Spending Key (sk): Private, used to spend notes
 * - Viewing Key (vk): Private, used to decrypt received notes (future)
 * - Shielded Address (addr): Public, share with others to receive funds
 * 
 * Key Derivation:
 * sk = random()
 * vk = MiMC(sk, DOMAIN.VIEWING_KEY)
 * addr = MiMC(sk, DOMAIN.SHIELDED_ADDRESS)
 */

import {
  randomFieldElement,
  mimcHash2,
  toBytes32,
  fromHex,
  DOMAIN,
  FIELD_SIZE,
} from './shielded-crypto';

// Address format version
const ADDRESS_VERSION = 1;

// Address prefix
const ADDRESS_PREFIX = 'dogenado:z';

/**
 * A complete shielded identity (keys + address)
 */
export interface ShieldedIdentity {
  // Private - NEVER share
  spendingKey: bigint;
  
  // Private - Can share with auditors/services for viewing
  viewingKey: bigint;
  
  // Public - Share with anyone to receive funds
  shieldedAddress: bigint;
  
  // Serialized address string
  addressString: string;
}

/**
 * Serialized format for storage
 */
export interface SerializedShieldedIdentity {
  spendingKey: string;
  viewingKey: string;
  shieldedAddress: string;
  addressString: string;
  version: number;
}

/**
 * Generate a new shielded identity
 * 
 * @returns Complete shielded identity with all keys
 */
export async function generateShieldedIdentity(): Promise<ShieldedIdentity> {
  // Generate random spending key
  const spendingKey = randomFieldElement();
  
  // Derive viewing key
  const viewingKey = await mimcHash2(spendingKey, DOMAIN.VIEWING_KEY);
  
  // Derive shielded address (public key)
  const shieldedAddress = await mimcHash2(spendingKey, DOMAIN.SHIELDED_ADDRESS);
  
  // Create address string
  const addressString = serializeShieldedAddress(shieldedAddress);
  
  return {
    spendingKey,
    viewingKey,
    shieldedAddress,
    addressString,
  };
}

/**
 * Recover identity from spending key
 * Use this to restore from backup
 */
export async function recoverFromSpendingKey(spendingKey: bigint): Promise<ShieldedIdentity> {
  // Validate spending key
  if (spendingKey <= 0n || spendingKey >= FIELD_SIZE) {
    throw new Error('Invalid spending key');
  }
  
  // Derive all other keys
  const viewingKey = await mimcHash2(spendingKey, DOMAIN.VIEWING_KEY);
  const shieldedAddress = await mimcHash2(spendingKey, DOMAIN.SHIELDED_ADDRESS);
  const addressString = serializeShieldedAddress(shieldedAddress);
  
  return {
    spendingKey,
    viewingKey,
    shieldedAddress,
    addressString,
  };
}

/**
 * Serialize shielded address to shareable string format
 * Format: dogenado:z<version><base16_pubkey>
 * 
 * Example: dogenado:z1abc123...def456
 */
export function serializeShieldedAddress(shieldedAddress: bigint): string {
  const hex = shieldedAddress.toString(16).padStart(64, '0');
  return `${ADDRESS_PREFIX}${ADDRESS_VERSION}${hex}`;
}

/**
 * Parse shielded address from string
 * 
 * @returns The public key (bigint)
 */
export function parseShieldedAddress(addressString: string): bigint {
  // Validate prefix
  if (!addressString.startsWith(ADDRESS_PREFIX)) {
    throw new Error(`Invalid address format: must start with ${ADDRESS_PREFIX}`);
  }
  
  // Extract version and pubkey
  const afterPrefix = addressString.slice(ADDRESS_PREFIX.length);
  
  if (afterPrefix.length < 65) { // 1 char version + 64 char hex
    throw new Error('Invalid address format: too short');
  }
  
  const version = parseInt(afterPrefix[0], 10);
  if (version !== ADDRESS_VERSION) {
    throw new Error(`Unsupported address version: ${version}`);
  }
  
  const hex = afterPrefix.slice(1);
  
  // Validate hex
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('Invalid address format: invalid hex');
  }
  
  const pubkey = BigInt('0x' + hex);
  
  // Validate field element
  if (pubkey >= FIELD_SIZE) {
    throw new Error('Invalid address: exceeds field size');
  }
  
  return pubkey;
}

/**
 * Validate a shielded address string
 */
export function isValidShieldedAddress(addressString: string): boolean {
  try {
    parseShieldedAddress(addressString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serialize identity for secure storage
 */
export function serializeIdentity(identity: ShieldedIdentity): SerializedShieldedIdentity {
  return {
    spendingKey: identity.spendingKey.toString(16).padStart(64, '0'),
    viewingKey: identity.viewingKey.toString(16).padStart(64, '0'),
    shieldedAddress: identity.shieldedAddress.toString(16).padStart(64, '0'),
    addressString: identity.addressString,
    version: ADDRESS_VERSION,
  };
}

/**
 * Deserialize identity from storage
 */
export function deserializeIdentity(serialized: SerializedShieldedIdentity): ShieldedIdentity {
  if (serialized.version !== ADDRESS_VERSION) {
    throw new Error(`Unsupported identity version: ${serialized.version}`);
  }
  
  return {
    spendingKey: BigInt('0x' + serialized.spendingKey),
    viewingKey: BigInt('0x' + serialized.viewingKey),
    shieldedAddress: BigInt('0x' + serialized.shieldedAddress),
    addressString: serialized.addressString,
  };
}

/**
 * Export spending key as backup phrase (hex string)
 * WARNING: This is the master key - losing it means losing all funds
 */
export function exportSpendingKey(identity: ShieldedIdentity): string {
  return identity.spendingKey.toString(16).padStart(64, '0');
}

/**
 * Import spending key from backup
 */
export async function importSpendingKey(hexKey: string): Promise<ShieldedIdentity> {
  const spendingKey = BigInt('0x' + hexKey.replace('0x', ''));
  return recoverFromSpendingKey(spendingKey);
}

/**
 * Shorten address for display
 * dogenado:z1abc...xyz
 */
export function shortenAddress(addressString: string, chars: number = 6): string {
  if (addressString.length <= ADDRESS_PREFIX.length + 1 + chars * 2) {
    return addressString;
  }
  
  const prefix = addressString.slice(0, ADDRESS_PREFIX.length + 1 + chars);
  const suffix = addressString.slice(-chars);
  return `${prefix}...${suffix}`;
}


