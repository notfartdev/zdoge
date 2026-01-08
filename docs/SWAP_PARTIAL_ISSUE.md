# ⚠️ Current Swap Limitation: No Change Notes

## The Problem

**Current Implementation:**
- Swap circuit only supports **ONE output note**
- Must spend the **entire input note**
- **No change notes** (not fully Zcash-style)

**Example:**
- You have: **10 DOGE note**
- You want to swap: **5 DOGE → USDC**
- **Current behavior:** ❌ Must swap entire 10 DOGE, no way to get 5 DOGE change back

---

## How Zcash/Transfer Works (Correct Behavior)

**Transfer circuit supports change:**
- `outputCommitment1`: Recipient note
- `outputCommitment2`: Change note (can be empty)
- Can spend part of a note and get change back

**Zcash-style swap should:**
1. Spend input note (e.g., 10 DOGE)
2. Create output note (e.g., 5 DOGE worth of USDC)
3. Create change note (e.g., 5 DOGE back to you)
4. **OR** create two output notes (USDC + DOGE change)

---

## Current Workaround

**Option 1: Use exact amounts**
- Shield smaller notes (e.g., shield 5 DOGE separately)
- Swap exact amounts

**Option 2: Accept full swap**
- Swap entire note
- Get all value in output token
- No change back

**Option 3: Swap back**
- Swap 10 DOGE → USDC (get all USDC)
- Swap some USDC → DOGE (to get DOGE back)
- More expensive (2 swaps + 2 fees)

---

## Solution: Add Change Note Support

To be fully Zcash-style, the swap circuit should support:

```circom
// Two output commitments:
signal input outputCommitment1;  // Output token note
signal input outputCommitment2;  // Change note (same token as input)

// In circuit:
// Verify: inputAmount = outputAmount1 + changeAmount
```

**This would allow:**
- Swap 5 DOGE from a 10 DOGE note
- Get: USDC note (for swapped amount)
- Get: 5 DOGE change note (back to you)
- **Full Zcash-style privacy** ✅

---

## Current Status

✅ **Privacy:** Still private (amounts, identities hidden)
⚠️ **Convenience:** Limited (must swap entire note)
❌ **Zcash-style:** Incomplete (no change support)

---

## Recommendation

**For now:**
- Shield smaller, exact amounts for swaps
- Or accept full swaps (get all value in output token)

**Future enhancement:**
- Add change note support to swap circuit
- Requires circuit modification and recompilation
- Would make swaps fully Zcash-style

---

## Answer to Your Question

**"Can I swap partially (5 DOGE from a 10 DOGE note)?"**

**Current answer: ❌ NO**
- Must swap entire note
- No change note support yet

**To swap 5 DOGE:**
- Option A: Shield 5 DOGE separately first
- Option B: Swap entire 10 DOGE (get all USDC)
- Option C: Wait for change note support (future)

**We're NOT fully Zcash-style yet** - this is a limitation we should fix! 🔧
