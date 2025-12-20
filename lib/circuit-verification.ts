/**
 * Circuit File Verification (Subresource Integrity for Circuit Files)
 * 
 * Verifies the integrity of ZK circuit files before use.
 * This implements SRI-like protection for the critical circuit files
 * that are used to generate zero-knowledge proofs.
 * 
 * For production:
 * 1. Run generateCircuitHashes() on your trusted build
 * 2. Update EXPECTED_HASHES with the generated values
 * 3. Deploy - files will be verified before use
 */

// Expected hashes of circuit files (SHA-256)
// These should be generated during build and stored securely
// Run: generateCircuitHashes() in browser console to get these values
const EXPECTED_HASHES: Record<string, string> = {
  // Circuit WASM file (compiled from circom)
  '/circuits/withdraw.wasm': process.env.NEXT_PUBLIC_CIRCUIT_WASM_HASH || '',
  // ZKey file (contains proving key)
  '/circuits/withdraw_final.zkey': process.env.NEXT_PUBLIC_CIRCUIT_ZKEY_HASH || '',
  // Verification key (for proof verification)
  '/circuits/verification_key.json': process.env.NEXT_PUBLIC_CIRCUIT_VKEY_HASH || '',
};

// Whether to enforce hash verification (set false for development)
const ENFORCE_VERIFICATION = process.env.NODE_ENV === 'production';

// Skip verification entirely in development (speeds up proof generation)
const SKIP_VERIFICATION_IN_DEV = process.env.NODE_ENV !== 'production';

// Cache for verified files
const verifiedFiles = new Set<string>();

/**
 * Calculate SHA-256 hash of an ArrayBuffer
 */
async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a circuit file's integrity
 */
export async function verifyCircuitFile(url: string): Promise<{
  valid: boolean;
  hash: string;
  expected?: string;
  error?: string;
}> {
  try {
    // Check if already verified
    if (verifiedFiles.has(url)) {
      return { valid: true, hash: 'cached' };
    }
    
    // Skip heavy verification in development mode (just check file exists)
    if (SKIP_VERIFICATION_IN_DEV) {
      const headResponse = await fetch(url, { method: 'HEAD' });
      if (headResponse.ok) {
        console.log(`[Circuit] ✓ File exists: ${url} (dev mode, hash skipped)`);
        verifiedFiles.add(url);
        return { valid: true, hash: 'dev-mode-skipped' };
      } else {
        return { valid: false, hash: '', error: `File not found: ${url}` };
      }
    }
    
    // Fetch the file for full verification (production)
    const response = await fetch(url);
    if (!response.ok) {
      return { 
        valid: false, 
        hash: '', 
        error: `Failed to fetch: ${response.status}` 
      };
    }
    
    const buffer = await response.arrayBuffer();
    const hash = await sha256(buffer);
    
    // Check against expected hash if available
    const expectedHash = EXPECTED_HASHES[url];
    
    if (!expectedHash) {
      // No expected hash configured
      if (ENFORCE_VERIFICATION) {
        console.error(`[Circuit] ❌ No expected hash for ${url} in production mode!`);
        console.error(`  Current hash: ${hash}`);
        console.error(`  Add NEXT_PUBLIC_CIRCUIT_*_HASH env vars with the hash values.`);
        return {
          valid: false,
          hash,
          error: 'Missing expected hash in production mode'
        };
      }
      
      // Development mode - warn but allow
      console.warn(`[Circuit] ⚠️ No expected hash for ${url}. Hash: ${hash}`);
      verifiedFiles.add(url);
      return { valid: true, hash };
    }
    
    if (hash !== expectedHash) {
      console.error(`[Circuit] ❌ Hash mismatch for ${url}!`);
      console.error(`  Expected: ${expectedHash}`);
      console.error(`  Got: ${hash}`);
      console.error(`  This file may have been tampered with!`);
      return { 
        valid: false, 
        hash, 
        expected: expectedHash,
        error: 'Hash mismatch - file may be tampered' 
      };
    }
    
    console.log(`[Circuit] Verified ${url}`);
    verifiedFiles.add(url);
    return { valid: true, hash };
    
  } catch (error: any) {
    return { 
      valid: false, 
      hash: '', 
      error: error.message 
    };
  }
}

/**
 * Verify all required circuit files
 */
export async function verifyAllCircuits(): Promise<{
  allValid: boolean;
  results: Record<string, { valid: boolean; hash: string; error?: string }>;
}> {
  const results: Record<string, { valid: boolean; hash: string; error?: string }> = {};
  let allValid = true;
  
  for (const url of Object.keys(EXPECTED_HASHES)) {
    const result = await verifyCircuitFile(url);
    results[url] = result;
    
    if (!result.valid) {
      allValid = false;
    }
  }
  
  return { allValid, results };
}

/**
 * Generate hashes for circuit files (run during build)
 */
export async function generateCircuitHashes(): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  
  for (const url of Object.keys(EXPECTED_HASHES)) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        hashes[url] = await sha256(buffer);
      }
    } catch (error) {
      console.error(`Failed to generate hash for ${url}:`, error);
    }
  }
  
  console.log('Generated circuit hashes:');
  console.log(JSON.stringify(hashes, null, 2));
  return hashes;
}

/**
 * Set expected hashes (for dynamic configuration)
 */
export function setExpectedHashes(hashes: Record<string, string>): void {
  for (const [url, hash] of Object.entries(hashes)) {
    EXPECTED_HASHES[url] = hash;
  }
}

