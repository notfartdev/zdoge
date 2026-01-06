# Note Spent Detection & State Sync Explanation

## How We Determine If a Note Is Already Spent

### 1. **Nullifier System (Double-Spend Prevention)**

Each shielded note has a unique **nullifier** that prevents double-spending:

```
nullifier = MiMC(secret, leafIndex, spendingKey)
nullifierHash = MiMC(nullifier, nullifier)
```

**Key Properties:**
- **Deterministic:** Same note always produces the same nullifierHash
- **Unique:** Each note has a different nullifierHash
- **One-time use:** Once spent, the nullifierHash is permanently recorded on-chain

### 2. **On-Chain Storage**

When a note is spent (via `unshield()` or `transfer()`), the contract records:

```solidity
// In ShieldedPoolMultiToken.sol (line 51)
mapping(bytes32 => bool) public nullifierHashes;
```

**What happens:**
1. User generates ZK proof with nullifierHash
2. Contract verifies proof
3. Contract checks: `if (nullifierHashes[nullifierHash]) revert NullifierAlreadySpent()`
4. Contract marks: `nullifierHashes[nullifierHash] = true`
5. Contract transfers funds

**This is permanent and immutable** - once a nullifierHash is marked as spent, it can never be used again.

### 3. **How We Check**

**Method 1: API Endpoint (Current Implementation)**
```typescript
// Check via backend indexer
GET /api/shielded/pool/:address/nullifier/:hash

// Backend checks its indexed state
isNullifierSpent(poolAddress, nullifierHash)
// Returns: { isSpent: true/false }
```

**Method 2: Direct Contract Call (Alternative)**
```typescript
// Can also call contract directly
const isSpent = await publicClient.readContract({
  address: poolAddress,
  abi: ShieldedPoolABI,
  functionName: 'isSpent',
  args: [nullifierHash],
})
```

**Method 3: Relayer Validation (Automatic)**
```typescript
// Relayer checks before submitting
if (isSpent) {
  return { valid: false, error: 'Nullifier already spent' }
}
```

### 4. **Our Implementation**

In the consolidation code, we:

1. **Generate proof** (computes nullifierHash from note)
2. **Check if spent** via API:
   ```typescript
   const isSpent = await checkNullifierSpent(proofResult.nullifierHash)
   ```
3. **If spent:** Skip note, remove from local state
4. **If not spent:** Proceed with unshield

---

## Why Notes Can Be in Local State But Already Spent

### **Root Cause: State Synchronization Issue**

Your **local state** (browser localStorage) and **blockchain state** can get out of sync.

### **Common Scenarios:**

#### **1. Multi-Device Usage**
```
Device A: Unshields note → Note removed from Device A's localStorage
Device B: Still has note in localStorage → Shows in balance
```

**Example:**
- You unshield on your phone
- Note is removed from phone's localStorage
- But your laptop still has the old note
- Laptop shows the note in balance, but it's already spent on-chain

#### **2. Transaction Succeeded But UI Didn't Update**
```
User clicks unshield → Transaction succeeds on-chain
But: JavaScript error / network issue / page refresh
Result: Note still in localStorage, but nullifierHash is spent on-chain
```

**Example:**
- You unshield 1 DOGE
- Transaction confirms on blockchain
- But your browser crashes before `completeUnshield()` runs
- Note remains in localStorage, but it's already spent

#### **3. localStorage Corruption or Manual Import**
```
User imports old note backup → Note was already spent in the past
Or: localStorage gets corrupted → Old notes reappear
```

**Example:**
- You have a note backup from last week
- You import it today
- But that note was already unshielded last week
- Now it shows in balance but is spent on-chain

#### **4. Browser/Storage Issues**
```
localStorage cleared → Notes lost
Then: Notes restored from backup → But backup contains spent notes
Or: Multiple tabs → One tab removes note, other tab still shows it
```

#### **5. Race Conditions**
```
Tab 1: Starts unshield → Note still in localStorage
Tab 2: Also sees note → Tries to unshield same note
Result: One succeeds, one fails, but both tabs might not update
```

---

## How Our Fix Handles This

### **Automatic Detection & Cleanup**

1. **Pre-flight Check:**
   ```typescript
   // Before attempting unshield
   const isSpent = await checkNullifierSpent(nullifierHash)
   if (isSpent) {
     // Skip and remove from local state
     completeUnshield(noteIndex)
     continue
   }
   ```

2. **Error Handling:**
   ```typescript
   // If relayer returns "already spent" error
   if (error.message.includes('already') || error.message.includes('spent')) {
     // Remove from local state
     completeUnshield(noteIndex)
     continue
   }
   ```

3. **User Feedback:**
   ```typescript
   // Show notification
   toast({
     title: "Note Cleanup",
     description: "Removed X already-spent note(s) from your wallet"
   })
   ```

### **What Happens:**

1. **Consolidation starts** → Checks each note
2. **Finds spent note** → Removes it from localStorage
3. **Continues with valid notes** → Processes remaining notes
4. **Shows success** → With cleaned-up balance

---

## Prevention Strategies

### **1. Always Sync After Transactions**

After any unshield/transfer:
```typescript
// Remove note from local state immediately
completeUnshield(noteIndex)  // ✅ Already implemented
```

### **2. Periodic Validation**

Could add a background sync that:
- Periodically checks all notes against blockchain
- Removes spent notes automatically
- Updates balance display

### **3. Better State Management**

- Use indexedDB instead of localStorage (more reliable)
- Add transaction IDs to notes
- Verify note status before showing in balance

### **4. User Education**

- Warn users about multi-device usage
- Suggest refreshing/clearing cache if balance seems wrong
- Show note status (spent/unspent) in UI

---

## Technical Details

### **Nullifier Computation**

```typescript
// From shielded-proof-service.ts
const nullifier = await computeNullifier(
  note.secret,           // Private secret from note
  BigInt(note.leafIndex), // Position in Merkle tree
  identity.spendingKey    // User's spending key
)
const nullifierHash = await computeNullifierHash(nullifier)
```

### **Contract Check**

```solidity
// ShieldedPoolMultiToken.sol
function unshieldNative(...) {
    // Check if already spent
    if (nullifierHashes[_nullifierHash]) revert NullifierAlreadySpent();
    
    // Mark as spent
    nullifierHashes[_nullifierHash] = true;
    
    // Transfer funds
    ...
}
```

### **Indexer Tracking**

```typescript
// backend/src/shielded/shielded-indexer.ts
export function isNullifierSpent(poolAddress: string, nullifierHash: string): boolean {
  const pool = shieldedPools.get(poolAddress.toLowerCase());
  if (!pool) return false;
  
  // Check indexed nullifiers
  return pool.nullifiers.has(nullifierHash);
}
```

The indexer tracks all `Unshield` and `Transfer` events and adds their nullifierHashes to a Set.

---

## Summary

**How we detect:**
- Compute nullifierHash from note
- Check contract's `nullifierHashes` mapping
- Query via API endpoint or direct contract call

**Why it happens:**
- Local state (localStorage) ≠ Blockchain state
- Multi-device usage
- Transaction succeeded but UI didn't update
- localStorage corruption/import issues
- Race conditions

**Our solution:**
- Pre-check before unshielding
- Auto-remove spent notes from local state
- Continue with valid notes
- User-friendly notifications

**Result:**
- Stuck notes are automatically detected and removed
- Balance updates correctly
- No more errors about already-spent notes

---

*This is a common issue in privacy-preserving systems where local state must be kept in sync with on-chain state. Our fix ensures automatic cleanup and prevents user confusion.*

