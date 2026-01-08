# ⚠️ Liquidity Trap Warning

## The Problem

**If you shield USDC to provide liquidity for a swap-created note, you can get trapped:**

### Scenario:

1. **You shield 10 USDC**
   - Contract receives: **10 USDC** (physical tokens)
   - You get: **1 shielded note** for 10 USDC
   - `totalShieldedBalance[USDC] = 10`

2. **Someone swaps DOGE → USDC**
   - Creates a **swap-created note** for 10 USDC
   - **NO physical USDC added** (only accounting)
   - `totalShieldedBalance[USDC] = 10 + 10 = 20` (but contract still only has 10 USDC!)

3. **They unshield their swap-created 10 USDC note**
   - Contract transfers: **10 USDC** to them
   - Contract now has: **0 USDC** (all used)
   - `totalShieldedBalance[USDC] = 20 - 10 = 10` (but contract has 0!)

4. **You try to unshield your original 10 USDC note** ❌
   - Contract has: **0 USDC**
   - You need: **10 USDC**
   - **FAILS!** Your USDC is stuck

---

## The Root Cause

**Swaps only do accounting, not physical token transfers:**

```
Swap DOGE → USDC:
  ✅ Creates new USDC note
  ✅ Updates totalShieldedBalance[USDC] += 10
  ❌ Does NOT transfer USDC into contract
  ❌ Contract still has same USDC balance
```

**Result:** The contract's `totalShieldedBalance` can exceed its actual token balance.

---

## Current Situation

**Your case:**
- Contract has: **7.2 USDC** (physical tokens)
- You have: **1 swap-created note** for 10 USDC
- `totalShieldedBalance[USDC]` = probably ~17.2 (from previous swaps/shields)

**If you shield 10 USDC:**
- Contract will have: **17.2 USDC**
- You get: **1 new note** for 10 USDC
- You can unshield your swap-created 10 USDC note ✅
- **BUT:** If someone else unshields first, your new 10 USDC note might also get stuck later ❌

---

## Solutions

### Option 1: Only Shield What You Need (Immediate Fix)
- Shield **exactly 10 USDC** (or slightly more for fees)
- Unshield your swap-created note **immediately**
- **Don't shield extra** - it can get trapped

### Option 2: Wait for Liquidity Provider (Best for Ecosystem)
- Someone else shields USDC (they take the risk)
- You unshield your swap-created note using their liquidity
- **You avoid the trap**

### Option 3: Swap Back (If Possible)
- Swap your USDC note → DOGE
- Then unshield DOGE (contract has 60 DOGE, so liquidity exists)
- **Avoids USDC liquidity trap**

### Option 4: Fix the System (Long-term)
- **DEX Integration:** Swaps actually transfer tokens from DEX
- **Or:** Maintain separate liquidity pools per token
- **Or:** Only allow swaps when both sides have liquidity

---

## Why This Happens

**The current swap implementation:**
- Uses **mock rates** for MVP/testnet
- Only updates **accounting** (`totalShieldedBalance`)
- Does **NOT** transfer physical tokens
- Creates **accounting imbalance**

**This is fine for testnet**, but creates liquidity traps.

---

## For Your Immediate Situation

**Recommended Actions:**

1. **Shield minimum needed:** Shield exactly **10.05 USDC** (to cover 9.95 + 0.05 fee)
2. **Unshield immediately:** Unshield your swap-created note right after
3. **Don't leave extra:** Don't shield more than needed

**OR:**

1. **Swap back:** If possible, swap your USDC note → DOGE
2. **Unshield DOGE:** Contract has 60 DOGE, so this will work
3. **Avoid USDC trap entirely**

---

## Future Fix

**For production, swaps should:**
- Actually transfer tokens (via DEX or liquidity pools)
- Not create accounting-only notes
- Maintain 1:1 relationship between `totalShieldedBalance` and actual balance
