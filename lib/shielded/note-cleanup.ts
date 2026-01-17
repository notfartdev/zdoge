/**
 * Note Cleanup Service - Bulletproof Note Management
 * 
 * This service ensures notes are always in sync with on-chain state.
 * Multiple layers of protection to prevent spent notes from remaining in wallet.
 */

import { ShieldedNote } from './shielded-note';
import { computeNullifier, computeNullifierHash, toBytes32 } from './shielded-crypto';
import { createPublicClient, http, type Address } from 'viem';
import { dogeosTestnet } from '../dogeos-config';
import { getPrivacyRpcUrl } from './privacy-utils';

/**
 * Check if a note's nullifier is spent on-chain
 */
export async function isNoteSpentOnChain(
  note: ShieldedNote,
  poolAddress: string,
  spendingKey: bigint
): Promise<boolean> {
  // Note: leafIndex can be 0, so check for undefined/null explicitly
  if (note.leafIndex === undefined || note.leafIndex === null) {
    return false; // Can't check unconfirmed notes
  }

  try {
    const publicClient = createPublicClient({
      chain: dogeosTestnet,
      transport: http(getPrivacyRpcUrl()),
    });

    // Compute nullifier the same way as in proof generation
    const nullifier = await computeNullifier(
      note.secret,
      BigInt(note.leafIndex),
      spendingKey
    );
    const nullifierHash = await computeNullifierHash(nullifier);
    const nullifierHashBytes = toBytes32(nullifierHash);

    const isSpent = await publicClient.readContract({
      address: poolAddress as `0x${string}`,
      abi: [{
        name: 'isSpent',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_nullifierHash', type: 'bytes32' }],
        outputs: [{ name: '', type: 'bool' }],
      }],
      functionName: 'isSpent',
      args: [nullifierHashBytes],
    });

    return isSpent;
  } catch (error) {
    console.warn('[NoteCleanup] Failed to check if note is spent:', error);
    return false; // Conservative: assume not spent if check fails
  }
}

/**
 * Clean up spent notes from wallet by checking on-chain state
 * This is a safety net to remove any notes that should have been removed
 */
export async function cleanupSpentNotes(
  notes: ShieldedNote[],
  poolAddress: string,
  spendingKey: bigint
): Promise<{ removed: ShieldedNote[]; remaining: ShieldedNote[] }> {
  const removed: ShieldedNote[] = [];
  const remaining: ShieldedNote[] = [];

  console.log(`[NoteCleanup] Checking ${notes.length} notes against on-chain state...`);

  for (const note of notes) {
    const isSpent = await isNoteSpentOnChain(note, poolAddress, spendingKey);
    
    if (isSpent) {
      console.warn(
        `[NoteCleanup] Removing spent note: ${Number(note.amount) / 1e18} DOGE ` +
        `(leafIndex: ${note.leafIndex}, commitment: ${note.commitment.toString().slice(0, 16)}...)`
      );
      removed.push(note);
    } else {
      remaining.push(note);
    }
  }

  if (removed.length > 0) {
    console.log(`[NoteCleanup] Cleaned up ${removed.length} spent note(s)`);
  } else {
    console.log(`[NoteCleanup] All notes are valid`);
  }

  return { removed, remaining };
}

/**
 * Verify note removal after transaction confirmation
 * This ensures the note was actually spent on-chain before removing it
 */
export async function verifyAndRemoveNote(
  note: ShieldedNote,
  nullifierHash: `0x${string}`,
  poolAddress: string,
  spendingKey: bigint
): Promise<{ removed: boolean; reason?: string }> {
  // First verify the nullifier hash matches
  // Note: leafIndex can be 0, so check for undefined/null explicitly
  if (note.leafIndex === undefined || note.leafIndex === null) {
    return { removed: false, reason: 'Note has no leafIndex' };
  }

  try {
    // Compute expected nullifier hash
    const nullifier = await computeNullifier(
      note.secret,
      BigInt(note.leafIndex),
      spendingKey
    );
    const expectedNullifierHash = await computeNullifierHash(nullifier);
    const expectedNullifierHashBytes = toBytes32(expectedNullifierHash);

    // Verify nullifier hash matches
    if (expectedNullifierHashBytes.toLowerCase() !== nullifierHash.toLowerCase()) {
      console.warn(
        `[NoteCleanup] Nullifier hash mismatch: ` +
        `expected ${expectedNullifierHashBytes.slice(0, 20)}..., ` +
        `got ${nullifierHash.slice(0, 20)}...`
      );
      return { removed: false, reason: 'Nullifier hash mismatch' };
    }

    // Check on-chain if nullifier is spent
    const publicClient = createPublicClient({
      chain: dogeosTestnet,
      transport: http(getPrivacyRpcUrl()),
    });

    const isSpent = await publicClient.readContract({
      address: poolAddress as `0x${string}`,
      abi: [{
        name: 'isSpent',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_nullifierHash', type: 'bytes32' }],
        outputs: [{ name: '', type: 'bool' }],
      }],
      functionName: 'isSpent',
      args: [nullifierHash],
    });

    if (!isSpent) {
      console.warn(
        `[NoteCleanup] Note nullifier not spent on-chain yet. ` +
        `This might be a timing issue - will retry later.`
      );
      return { removed: false, reason: 'Not spent on-chain yet (timing issue)' };
    }

    // Note is confirmed spent on-chain - safe to remove
    return { removed: true };
  } catch (error: any) {
    console.error('[NoteCleanup] Error verifying note removal:', error);
    return { removed: false, reason: error.message };
  }
}
