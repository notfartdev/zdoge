# Implementation Plan: Add Change Notes to Swap

## Overview

We need to add change note support to the swap circuit to match Zcash-style behavior and allow partial swaps.

**Current:** Must spend entire note
**Target:** Can swap part of note, get change back

---

## Implementation Steps

### 1. Update Swap Circuit (`circuits/shielded/swap.circom`)

**Key Changes:**
- Add `outputCommitment2` public input (change note)
- Add private inputs for change note (amount, secret, blinding)
- Add constraints to verify change note (optional - can be 0)
- Verify value conservation: `inputAmount = outputAmount1 + changeAmount`

**Pattern:** Follow the same structure as `transfer.circom` (lines 233-258)

### 2. Regenerate Circuit Artifacts

- Recompile circuit → generates new R1CS
- Regenerate zkey (using pot16_final.ptau)
- Export new verifier contract

### 3. Update Contract (`ShieldedPoolMultiToken.sol`)

**Changes:**
- Add `outputCommitment2` parameter to `swap()` function
- Update public inputs array (now 8 instead of 7)
- Insert both output commitments into Merkle tree
- Handle case where `outputCommitment2 == 0` (no change)

### 4. Update Proof Generation (`lib/shielded/shielded-proof-service.ts`)

**Changes:**
- Calculate change: `changeAmount = inputNote.amount - swapAmount`
- Create change note if `changeAmount > 0`
- Include change note in circuit inputs
- Return both output notes

### 5. Update Frontend (`components/shielded/swap-interface.tsx`)

**Changes:**
- Allow entering amount less than note amount
- Show change amount in UI preview
- Handle receiving both output notes after swap
- Update wallet state with both notes

### 6. Update Backend (`backend/src/shielded/shielded-routes.ts`)

**Changes:**
- Accept `outputCommitment2` in swap request
- Pass to contract swap function
- Return both leaf indices

---

## Circuit Changes Detail

```circom
template Swap(levels) {
    // Public inputs - ADD outputCommitment2
    signal input outputCommitment1;  // Output token note
    signal input outputCommitment2;  // Change note (can be 0)
    
    // Private inputs - ADD change note fields
    signal input changeAmount;
    signal input changeSecret;
    signal input changeBlinding;
    
    // Verify change commitment (if changeAmount > 0)
    component changeCommitment = NoteCommitment();
    changeCommitment.amount <== changeAmount;
    changeCommitment.ownerPubkey <== inOwnerPubkey;  // Change back to sender
    changeCommitment.secret <== changeSecret;
    changeCommitment.blinding <== changeBlinding;
    
    // Allow outputCommitment2 to be 0 (no change)
    // If changeAmount > 0, outputCommitment2 must match changeCommitment
    // If changeAmount == 0, outputCommitment2 must be 0
    
    // Value conservation
    // inputAmount === outputAmount1 + changeAmount
}
```

---

## Benefits

✅ **True Zcash-style:** Matches transfer circuit behavior
✅ **User convenience:** Partial swaps with change
✅ **Privacy preserved:** Change note is private
✅ **Consistent:** Same pattern across all operations

---

## Migration Impact

⚠️ **Breaking Change:**
- Old swap proofs won't work (circuit changed)
- Must redeploy contract
- Frontend needs update

**But:**
- New contract was just deployed (empty Merkle tree)
- Users haven't done swaps yet on new contract
- Perfect time to add this feature!

---

## Recommendation

**Yes, implement this now!** 

**Why now:**
- Contract just deployed (fresh start)
- No users have swapped yet on new contract
- This is the right time for breaking changes
- Makes swaps fully Zcash-style

**Effort:** Medium (2-3 hours)
**Impact:** High (core privacy feature)
