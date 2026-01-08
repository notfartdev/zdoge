# Adding Change Note Support to Swap Circuit

## Why This Is Needed

**Current State:**
- Transfer circuit: ✅ Supports change notes (`outputCommitment2`)
- Swap circuit: ❌ No change notes (must spend entire note)
- **Not fully Zcash-style** - users can't do partial swaps

**Desired State:**
- Swap should support change notes (like transfer)
- Allow partial swaps: spend 5 DOGE from 10 DOGE note, get 5 DOGE change back
- Full Zcash-style privacy and convenience

---

## Changes Required

### 1. Circuit Changes (`swap.circom`)

**Current:**
```circom
signal input outputCommitment;  // Only one output
```

**Should be:**
```circom
signal input outputCommitment1;  // Output token note (USDC)
signal input outputCommitment2;  // Change note (DOGE back to sender)
```

**Add constraints:**
- `outputCommitment2` can be 0 (no change needed)
- Verify `inputAmount >= outputAmount1` (can't spend more than you have)
- Change amount = `inputAmount - outputAmount1` (if swap is partial)
- Both output commitments must be valid (or change is 0)

### 2. Contract Changes (`ShieldedPoolMultiToken.sol`)

**Update `swap` function:**
- Accept `outputCommitment2` parameter
- Insert both output commitments into Merkle tree
- Handle case where `outputCommitment2 == 0` (no change)

**Update proof verification:**
- Public inputs: `[root, inputNullifier, outputCommitment1, outputCommitment2, tokenIn, tokenOut, amountIn, outputAmount]`
- Verify both output commitments (if change exists)

### 3. Frontend/Service Changes

**Update `generateSwapProof`:**
- Calculate if change is needed: `changeAmount = inputAmount - swapAmount`
- Create change note if `changeAmount > 0`
- Generate proof with both output notes

**Update swap interface:**
- Allow user to enter amount less than note amount
- Show change amount in UI
- Handle receiving change note after swap

---

## Implementation Steps

### Step 1: Update Circuit

```circom
template Swap(levels) {
    // Add outputCommitment2
    signal input outputCommitment1;  // Output token note
    signal input outputCommitment2;  // Change note (can be 0)
    
    // ... existing inputs ...
    
    // Verify outputCommitment2 (change note)
    component changeCommitment = NoteCommitment();
    changeCommitment.amount <== changeAmount;
    changeCommitment.ownerPubkey <== inOwnerPubkey;  // Change goes back to sender
    changeCommitment.secret <== changeSecret;
    changeCommitment.blinding <== changeBlinding;
    
    // Allow outputCommitment2 to be 0 (no change)
    component changeCommitmentHash = MiMC2();
    changeCommitmentHash.in[0] <== outputCommitment2;
    changeCommitmentHash.in[1] <== outputCommitment2;
    
    // Verify: if changeAmount > 0, outputCommitment2 must match
    // If changeAmount == 0, outputCommitment2 can be 0
    (changeAmount === 0) * (outputCommitment2 === 0) + 
    (changeAmount > 0) * (outputCommitment2 === changeCommitment.commitment) === 1;
    
    // Verify amount conservation
    // inputAmount = outputAmount1 + changeAmount
    // Or: inputAmount >= outputAmount1 (changeAmount can be 0)
}
```

### Step 2: Update Contract

```solidity
function swap(
    uint256[8] calldata _proof,
    bytes32 _root,
    bytes32 _inputNullifier,
    bytes32 _outputCommitment1,  // Output token note
    bytes32 _outputCommitment2,  // Change note (can be 0)
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _outputAmount,
    uint256 _minAmountOut,
    bytes calldata _encryptedMemo
) external nonReentrant {
    // ... existing checks ...
    
    // Verify proof with outputCommitment2
    uint256[8] memory publicInputs = [
        uint256(_root),
        uint256(_inputNullifier),
        uint256(_outputCommitment1),
        uint256(_outputCommitment2),  // Add change commitment
        tokenInUint,
        tokenOutUint,
        _amountIn,
        _outputAmount
    ];
    
    // ... verify proof ...
    
    // Insert both output commitments
    uint256 leafIndex1 = _insert(_outputCommitment1);
    commitments[_outputCommitment1] = true;
    
    uint256 leafIndex2 = 0;
    if (_outputCommitment2 != bytes32(0)) {
        leafIndex2 = _insert(_outputCommitment2);
        commitments[_outputCommitment2] = true;
    }
    
    // ... rest of swap logic ...
}
```

### Step 3: Update Proof Generation

```typescript
export async function generateSwapProof(
  inputNote: ShieldedNote,
  identity: ShieldedIdentity,
  swapAmount: bigint,  // Amount to swap (can be less than note amount)
  outputToken: string,
  outputAmount: bigint,
  poolAddress: string
) {
  // Calculate change
  const changeAmount = inputNote.amount - swapAmount;
  
  // Create output note (swapped token)
  const outputNote = createNote(outputAmount, outputToken, identity);
  
  // Create change note (if needed)
  let changeNote: ShieldedNote | null = null;
  let changeCommitment = 0n;
  if (changeAmount > 0n) {
    changeNote = createNote(changeAmount, inputNote.token, identity);
    changeCommitment = changeNote.commitment;
  }
  
  // Generate proof with both commitments
  // ... proof generation ...
  
  return {
    proof,
    outputNote,
    changeNote,  // Return change note for wallet state update
    // ...
  };
}
```

---

## Benefits

✅ **True Zcash-style:** Supports partial spends with change
✅ **User convenience:** Can swap exact amounts, get change back
✅ **Privacy preserved:** Change note is private (same as transfer)
✅ **Consistent:** Matches transfer circuit behavior

---

## Considerations

⚠️ **Circuit complexity:** Slightly more complex (handling optional change)
⚠️ **Gas cost:** Slightly higher (inserting 2 notes instead of 1)
⚠️ **Testing:** Need to test with and without change
⚠️ **Migration:** Existing swaps won't work (circuit changes)

---

## Recommendation

**Yes, we should implement this!** It's essential for full Zcash-style functionality and user experience. The implementation is straightforward since we already have the pattern from the transfer circuit.

**Priority:** High - this is a core privacy feature

**Effort:** Medium - requires circuit, contract, and frontend updates

Would you like me to start implementing this?
