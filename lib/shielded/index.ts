/**
 * Shielded Transaction System for Dogenado
 * 
 * Enables private transfers on DogeOS using Zcash-style notes.
 * 
 * Flows:
 * 1. Shield (t→z): Deposit public DOGE into shielded note
 * 2. Transfer (z→z): Send shielded funds to another shielded address
 * 3. Unshield (z→t): Withdraw shielded funds to public address
 * 4. Swap (z→z): Exchange one shielded token for another
 * 
 * Auto-discovery:
 * - When User A transfers to User B, encrypted memos are published on-chain
 * - User B can scan events and decrypt memos with their viewing key
 * - Notes are automatically discovered and imported
 */

// Core cryptography
export * from './shielded-crypto';

// Address and key management
export * from './shielded-address';

// Note management
export * from './shielded-note';

// Receiving and auto-discovery
export * from './shielded-receiving';

// Proof generation
export * from './shielded-proof-service';

// High-level wallet service
export * from './shielded-service';

// Swap functionality
export * from './shielded-swap-service';

// Stealth addresses (one-time receive addresses)
export * from './stealth-address';

