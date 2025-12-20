/**
 * Input Sanitization Utilities
 * 
 * Validates and sanitizes user inputs to prevent XSS and injection attacks.
 */

// Valid Ethereum address regex
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Valid hex string regex
const HEX_REGEX = /^0x[a-fA-F0-9]+$/;

// Valid note format (dogenado-token-amount-hex)
const NOTE_REGEX = /^dogenado-[a-zA-Z0-9]+-\d+-0x[a-fA-F0-9]+$/;

/**
 * Sanitize and validate an Ethereum address
 */
export function sanitizeAddress(address: string): string | null {
  if (!address) return null;
  
  // Trim whitespace
  const trimmed = address.trim();
  
  // Validate format
  if (!ETH_ADDRESS_REGEX.test(trimmed)) {
    console.warn('Invalid address format:', address);
    return null;
  }
  
  // Return checksummed or lowercase
  return trimmed.toLowerCase();
}

/**
 * Validate if string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address?.trim() || '');
}

/**
 * Sanitize and validate a hex string
 */
export function sanitizeHex(hex: string): string | null {
  if (!hex) return null;
  
  const trimmed = hex.trim();
  
  // Add 0x prefix if missing
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  
  // Validate format
  if (!HEX_REGEX.test(prefixed)) {
    console.warn('Invalid hex format:', hex);
    return null;
  }
  
  return prefixed.toLowerCase();
}

/**
 * Validate if string is a valid hex
 */
export function isValidHex(hex: string): boolean {
  if (!hex) return false;
  const prefixed = hex.startsWith('0x') ? hex : `0x${hex}`;
  return HEX_REGEX.test(prefixed);
}

/**
 * Sanitize and validate a deposit note
 */
export function sanitizeNote(note: string): string | null {
  if (!note) return null;
  
  const trimmed = note.trim();
  
  // Validate format
  if (!NOTE_REGEX.test(trimmed)) {
    console.warn('Invalid note format');
    return null;
  }
  
  return trimmed;
}

/**
 * Validate if string is a valid deposit note
 */
export function isValidNote(note: string): boolean {
  return NOTE_REGEX.test(note?.trim() || '');
}

/**
 * Sanitize a number input
 */
export function sanitizeNumber(value: string | number): number | null {
  if (value === '' || value === null || value === undefined) return null;
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || !isFinite(num)) {
    console.warn('Invalid number:', value);
    return null;
  }
  
  return num;
}

/**
 * Sanitize a positive integer
 */
export function sanitizePositiveInt(value: string | number): number | null {
  const num = sanitizeNumber(value);
  
  if (num === null || num < 0 || !Number.isInteger(num)) {
    return null;
  }
  
  return num;
}

/**
 * Sanitize a BigInt string
 */
export function sanitizeBigInt(value: string): bigint | null {
  if (!value) return null;
  
  const trimmed = value.trim();
  
  try {
    // Handle hex
    if (trimmed.startsWith('0x')) {
      return BigInt(trimmed);
    }
    // Handle decimal
    if (/^\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }
    console.warn('Invalid BigInt:', value);
    return null;
  } catch {
    console.warn('Failed to parse BigInt:', value);
    return null;
  }
}

/**
 * Sanitize general text (escape HTML)
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strip HTML tags from text
 */
export function stripHtml(text: string): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Validate proof array
 */
export function isValidProof(proof: unknown): proof is string[] {
  if (!Array.isArray(proof)) return false;
  if (proof.length !== 8) return false;
  
  return proof.every(p => 
    typeof p === 'string' && 
    (p.startsWith('0x') || /^\d+$/.test(p))
  );
}

/**
 * Validate and sanitize withdrawal request
 */
export interface WithdrawalRequest {
  pool: string;
  proof: string[];
  root: string;
  nullifierHash: string;
  recipient: string;
  fee: string;
  delay?: number;
}

export function validateWithdrawalRequest(req: unknown): {
  valid: boolean;
  data?: WithdrawalRequest;
  error?: string;
} {
  if (!req || typeof req !== 'object') {
    return { valid: false, error: 'Invalid request format' };
  }
  
  const r = req as Record<string, unknown>;
  
  // Validate pool address
  const pool = sanitizeAddress(r.pool as string);
  if (!pool) {
    return { valid: false, error: 'Invalid pool address' };
  }
  
  // Validate proof
  if (!isValidProof(r.proof)) {
    return { valid: false, error: 'Invalid proof format' };
  }
  
  // Validate root
  const root = sanitizeHex(r.root as string);
  if (!root) {
    return { valid: false, error: 'Invalid merkle root' };
  }
  
  // Validate nullifier hash
  const nullifierHash = sanitizeHex(r.nullifierHash as string);
  if (!nullifierHash) {
    return { valid: false, error: 'Invalid nullifier hash' };
  }
  
  // Validate recipient
  const recipient = sanitizeAddress(r.recipient as string);
  if (!recipient) {
    return { valid: false, error: 'Invalid recipient address' };
  }
  
  // Validate fee
  const fee = sanitizeBigInt(r.fee as string);
  if (fee === null) {
    return { valid: false, error: 'Invalid fee' };
  }
  
  // Validate delay (optional)
  let delay: number | undefined;
  if (r.delay !== undefined) {
    const d = sanitizePositiveInt(r.delay as number);
    if (d === null) {
      return { valid: false, error: 'Invalid delay' };
    }
    delay = d;
  }
  
  return {
    valid: true,
    data: {
      pool,
      proof: r.proof as string[],
      root,
      nullifierHash,
      recipient,
      fee: fee.toString(),
      delay,
    },
  };
}

