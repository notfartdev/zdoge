# Shielded Pool: How Token Flows Work

## Three Ways to Get Notes (and Unshield Them)

### 1. Shield → Unshield ✅ NO Liquidity Issue

**How it works:**
- User shields 10 DOGE → Contract physically receives 10 DOGE
- Contract creates a DOGE note
- `totalShieldedBalance[DOGE] = 10`
- Contract's native balance: **+10 DOGE** (physically in contract)

**Unshield:**
- User unshields 10 DOGE
- Contract transfers 10 DOGE from its balance to recipient
- ✅ Works because tokens are physically in the contract

**Liquidity Required:** NO - tokens were added during shield

---

### 2. Transfer (z→z) → Unshield ✅ NO Liquidity Issue

**How it works:**
- User A shields 10 DOGE (contract has 10 DOGE)
- User A transfers 10 DOGE note → User B (private transfer)
- Input note nullified, output note created for User B
- **NO token movement** - tokens stay in contract
- `totalShieldedBalance[DOGE] = 10` (unchanged)

**Unshield:**
- User B unshields 10 DOGE
- Contract transfers the same 10 DOGE (from User A's original shield)
- ✅ Works because tokens were already in contract

**Liquidity Required:** NO - tokens already in contract from original shield

---

### 3. Swap → Unshield ⚠️ REQUIRES Liquidity

**How it works (CURRENT IMPLEMENTATION):**
- User swaps 10 DOGE note → 1.5 USDC note
- Input DOGE note nullified (spent)
- Output USDC commitment created
- Accounting updated:
  - `totalShieldedBalance[DOGE] -= 10`
  - `totalShieldedBalance[USDC] += 1.5`
- **BUT: NO token transfer happens!** The swap only does accounting.

**The Problem:**
- Contract's actual USDC balance: **0 USDC** (no one shielded USDC)
- Accounting says: `totalShieldedBalance[USDC] = 1.5`
- **Mismatch!** Accounting says 1.5 USDC, but contract has 0 USDC

**Unshield:**
- User tries to unshield 1.5 USDC
- Contract tries to transfer 1.5 USDC
- ❌ **FAILS** - Contract doesn't have any USDC!

**Liquidity Required:** ✅ YES - Output tokens must exist in contract

---

## Why Swaps Need Liquidity

The swap function uses **mock rates** and doesn't actually:
- Call a DEX to get USDC
- Transfer tokens from anywhere
- Mint tokens

It just updates accounting. For swaps to create unshieldable notes, the output tokens must already be in the contract from previous shields.

---

## The Solution

**Option 1: Shield Output Token First (Current Workaround)**
```
1. Someone shields 2 USDC → Contract has 2 USDC
2. You swap 10 DOGE → 1.5 USDC → Creates USDC note
3. You unshield 1.5 USDC → Uses the 2 USDC from step 1
4. ✅ Works!
```

**Option 2: Add Balance Check Before Swap (We Just Did This)**
- Contract checks if it has enough output tokens
- If not, swap fails with clear error: "Insufficient liquidity"
- Prevents creating unshieldable notes

**Option 3: Actually Transfer Tokens During Swap (Future)**
- Swap calls DEX router to get real tokens
- Contract receives output tokens from DEX
- Then swap-created notes are unshieldable
- No liquidity requirement from previous shields

---

## For Your Current Situation

**What happened:**
- You swapped DOGE → USDC (creates USDC note)
- Contract has 0 USDC (no one shielded USDC)
- You can't unshield because contract has no USDC

**To fix:**
1. Shield some USDC first (e.g., 2-3 USDC)
2. Your swap-created USDC note becomes unshieldable
3. Future swaps will work as long as liquidity exists
