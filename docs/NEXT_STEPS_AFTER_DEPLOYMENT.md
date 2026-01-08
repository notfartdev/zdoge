# Next Steps After Contract Deployment

## ✅ What's Complete

1. **Contract Deployed** with fixed swap logic
   - Address: `0xf8462dbE50C6cC2F7a8E5CFa5dd05D6E910f301b`
   - Fixes: Trusts proof's `outputAmount` instead of mock rates
   - Liquidity checks: Validates output token liquidity

2. **Config Updated**
   - `lib/dogeos-config.ts` updated with new addresses

3. **Old Notes Cleared**
   - Local storage cleared
   - Ready for fresh start

4. **Frontend Fixes**
   - Quote amount matching fixed
   - Liquidity warnings added
   - Better error handling

---

## 🧪 Testing Checklist

### Step 1: Shield Tokens
**Test basic shield functionality:**
1. Go to Shield interface
2. Shield some DOGE (e.g., 10 DOGE)
3. Verify balance updates correctly
4. Verify note appears in wallet

**Expected:** Shield should work normally, balance shows correctly

---

### Step 2: Test Swap (DOGE → USDC)
**Test the fixed swap functionality:**
1. Go to Swap interface
2. Select DOGE → USDC
3. Enter amount (must be ≤ your shielded DOGE balance)
4. Check quote appears
5. Click "Swap Privately"
6. Verify swap succeeds

**Expected:**
- ✅ Quote generated successfully
- ✅ Swap transaction succeeds (no `InvalidSwapRate` error)
- ✅ Balance updates (DOGE decreases, USDC increases)
- ✅ New USDC note created

---

### Step 3: Provide Liquidity for Unshield
**Before unshielding USDC, need liquidity:**
1. Shield some USDC into the contract (e.g., 5 USDC)
2. This provides liquidity for unshielding

**Why:** Swaps only do accounting, so contract needs physical USDC to unshield

---

### Step 4: Test Reverse Swap (USDC → DOGE)
**Test swap in the other direction:**
1. Go to Swap interface
2. Select USDC → DOGE
3. Enter amount (must be ≤ your shielded USDC balance)
4. Click "Swap Privately"
5. Verify swap succeeds

**Expected:**
- ✅ Swap succeeds
- ✅ Balance updates (USDC decreases, DOGE increases)
- ✅ New DOGE note created

---

### Step 5: Test Unshield
**Test unshielding swapped tokens:**
1. Go to Unshield interface
2. Try to unshield USDC (should work if liquidity exists)
3. Try to unshield DOGE (should work)

**Expected:**
- ✅ Unshield succeeds if liquidity exists
- ✅ Tokens received in public wallet
- ✅ Balance updates correctly

---

### Step 6: Verify On-Chain
**Check transactions on Blockscout:**
1. Open transaction hash in Blockscout
2. Verify `Swap` event is emitted
3. Verify `LeafInserted` event shows new commitment
4. Check token transfers (if any)

**Expected:**
- ✅ Swap events visible
- ✅ Merkle tree updates correctly
- ✅ All on-chain state is correct

---

## 🐛 If Issues Occur

### Swap Fails with `InvalidSwapRate`
- **Cause:** Contract not updated (but we just deployed, so shouldn't happen)
- **Fix:** Verify contract address in config matches deployed contract

### Swap Fails with `Insufficient Liquidity`
- **Cause:** Contract doesn't have output tokens
- **Fix:** Shield output token first to provide liquidity

### Unshield Fails
- **Cause:** Contract doesn't have physical tokens
- **Fix:** Shield the token first to provide liquidity

---

## 🎯 Success Criteria

You'll know everything works when:
- ✅ Shield works
- ✅ Swap DOGE → USDC works
- ✅ Swap USDC → DOGE works
- ✅ Unshield works (with liquidity)
- ✅ All transactions visible on Blockscout
- ✅ Balances update correctly

---

## Ready to Test!

Start with **Step 1: Shield some DOGE** and work through the checklist. The swap functionality should now work correctly with the fixed contract! 🚀
