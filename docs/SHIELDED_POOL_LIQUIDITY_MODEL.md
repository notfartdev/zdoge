# Shielded Pool Liquidity Model

## How Token Flows Work

The `ShieldedPoolMultiToken` contract maintains a **shared liquidity pool** for all tokens. Here's how each operation affects liquidity:

---

## 1. Shield (t→z) - ADDS Liquidity ✅

**Flow:**
- User sends tokens (DOGE or ERC20) → Contract
- Contract receives actual tokens (physically)
- Creates a shielded note commitment
- Updates `totalShieldedBalance[token] += amount`

**Liquidity Impact:**
- ✅ **ADDS tokens to contract**
- Tokens are physically in the contract
- Can be unshielded later

**Example:**
```
User shields 10 DOGE
→ Contract receives 10 DOGE (native balance)
→ Contract creates DOGE note
→ User can unshield these 10 DOGE anytime
```

---

## 2. Transfer (z→z) - NO Liquidity Change ✅

**Flow:**
- User A has a shielded note
- User A sends note to User B privately
- Input note is nullified (spent)
- Output note created for User B
- **NO token movement happens**

**Liquidity Impact:**
- ✅ **NO CHANGE to contract token balances**
- Tokens stay in the contract (same tokens)
- Only accounting changes (different owner)
- User B can unshield the same tokens User A originally shielded

**Example:**
```
User A shields 10 DOGE (contract now has 10 DOGE)
User A transfers 10 DOGE note to User B (private transfer)
→ Contract still has 10 DOGE (no movement)
→ User B now owns the note
→ User B can unshield the same 10 DOGE
```

**Key Point:** Transfer doesn't need liquidity because it's just changing ownership of tokens already in the contract.

---

## 3. Swap (z→z, different token) - REQUIRES Liquidity ⚠️

**Flow:**
- User swaps 10 DOGE note → 1.5 USDC note
- Input DOGE note is nullified (spent)
- Output USDC commitment created
- Updates accounting:
  - `totalShieldedBalance[DOGE] -= 10`
  - `totalShieldedBalance[USDC] += 1.5`

**Liquidity Impact:**
- ⚠️ **REQUIRES output token to already exist in contract**
- The swap does **accounting only** - doesn't transfer tokens
- For the swap to work, contract must have 1.5 USDC already available
- When you unshield the USDC note, contract pays from existing USDC balance

**Example (Working Swap):**
```
Step 1: Someone shields 2 USDC
→ Contract receives 2 USDC (has liquidity)

Step 2: You swap 10 DOGE → 1.5 USDC
→ Your DOGE note is spent (can't unshield DOGE anymore)
→ New USDC note created
→ Contract still has 2 USDC (no movement)
→ Accounting: totalShieldedBalance[USDC] = 2 + 1.5 = 3.5
→ But contract still only has 2 USDC physically!

Step 3: You unshield 1.5 USDC
→ Contract transfers 1.5 USDC from its 2 USDC balance
→ Works! ✅
```

**Example (Broken Swap):**
```
Step 1: No one has shielded USDC
→ Contract has 0 USDC

Step 2: You swap 10 DOGE → 1.5 USDC
→ Your DOGE note is spent
→ New USDC note created
→ Accounting: totalShieldedBalance[USDC] = 1.5
→ But contract still has 0 USDC!

Step 3: You try to unshield 1.5 USDC
→ Contract tries to transfer 1.5 USDC
→ ❌ FAILS! Contract has 0 USDC
```

---

## Summary: Unshield Requirements

| Source of Note | Requires Liquidity? | Why? |
|---------------|-------------------|------|
| **Shield** | ✅ No | Tokens were physically transferred during shield |
| **Transfer** | ✅ No | Tokens already in contract from original shield |
| **Swap** | ⚠️ **YES** | Contract must have output tokens from previous shields |

---

## The Swap Liquidity Model

Swaps work like a **liquidity pool**:

1. **Initial Liquidity:** Users shield tokens → creates liquidity
2. **Swap Consumes:** When you swap A→B, you consume B tokens from the pool
3. **Your Input Adds:** Your A tokens go back into the pool (accounting)
4. **Unshield Withdraws:** Unshielding removes tokens from the pool

**For swaps to work:**
- Someone must provide liquidity first by shielding the output token
- OR swaps must go both ways (A→B and B→A) to maintain balance

---

## Current Implementation Limitation

**Problem:** The swap function uses **mock rates** and doesn't actually transfer tokens.

**Current Behavior:**
- Swap updates accounting only
- Doesn't check if output tokens exist
- Unshield fails if tokens aren't available

**Solutions:**

### Option A: Require Liquidity (Current Fix)
- Add balance check before swap
- Require output tokens to exist
- Clear error: "Insufficient liquidity for output token"

### Option B: DEX Integration (Production)
- Swap actually calls DEX router
- Gets real tokens from DEX
- No liquidity requirement

### Option C: Internal AMM (Future)
- Maintain internal liquidity pools
- AMM-style pricing
- No external dependencies

---

## For Your Current Situation

**Problem:** You swapped DOGE → USDC, but contract has 0 USDC.

**Solution:** Shield some USDC first, then your swap-created USDC note can be unshielded.

**Steps:**
1. Shield 2-3 USDC into the contract (provides liquidity)
2. Your existing USDC note from swap is now unshieldable
3. Future swaps will work as long as liquidity exists
