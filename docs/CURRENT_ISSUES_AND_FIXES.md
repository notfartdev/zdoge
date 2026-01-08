# Current Issues and Fixes

## Issue 1: Unshield Failing - Insufficient USDC Liquidity ❌

### Problem
**Error:** `The contract function "unshieldToken" reverted with signature: 0xe450d38c`

**Root Cause:**
- Contract has: **7.208687 USDC**
- User trying to unshield: **9.95 USDC + 0.05 fee = 10.0 USDC**
- **Insufficient balance** → SafeERC20 transfer fails

### Solution
**Shield more USDC to provide liquidity:**
1. Go to Shield interface
2. Shield at least **3-5 more USDC** (to have enough for this unshield + buffer)
3. Then try unshielding again

**Why This Happens:**
- The contract's `_unshield` function checks balance before transferring
- It should revert with `InsufficientPoolBalance()` error
- But if the check doesn't catch it, the `safeTransfer` fails with SafeERC20 error

---

## Issue 2: Swap Failing - Contract Needs Redeployment ⚠️

### Problem
**Error:** `InvalidSwapRate()` when swapping USDC → DOGE

**Root Cause:**
- Frontend uses CoinGecko rates: 10 USDC → ~71.3 DOGE
- Contract uses 1:1 mock rates: 10 USDC → 10 DOGE
- Contract checks mock result against CoinGecko minimum → FAILS

### Solution
**Redeploy contract with fixed swap logic:**
- ✅ Code is fixed (trusts proof's `outputAmount`)
- ❌ Contract not redeployed yet

### How to Fix

**Option A: Redeploy Contract (Recommended)**
```bash
cd contracts
npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeos-testnet
```
Then update `lib/dogeos-config.ts` with new contract address.

**Option B: Wait for Production DEX Integration**
- In production, contract will call actual DEX
- Real rates will match frontend
- No mock rate issues

---

## Summary of Fixes Needed

### Immediate Actions:
1. ✅ **Frontend liquidity warning** - Already implemented
2. ✅ **Contract swap fix** - Code fixed, needs deployment
3. ⚠️ **Provide USDC liquidity** - Shield more USDC for unshield
4. ⚠️ **Redeploy contract** - To fix swap rate issue

### Testing Checklist After Fixes:
- [ ] Shield additional USDC (provide liquidity)
- [ ] Unshield USDC note (should work with liquidity)
- [ ] Swap DOGE → USDC (after contract redeployment)
- [ ] Swap USDC → DOGE (after contract redeployment)
- [ ] Unshield swapped tokens

---

## Error Decoding Improvements

**Added to backend:**
- Better error messages for `InsufficientPoolBalance`
- Better error messages for `SafeERC20FailedOperation`
- Clearer user-facing error messages

**Next:**
- Frontend should show these errors clearly
- Guide users to provide liquidity when needed
