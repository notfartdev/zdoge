# Warning: Direct Token Transfer to Pool Contract

## ⚠️ Don't Send Tokens Directly!

**Contract Address:** `0x40c74Fd9B171D34d971B182bDd5756fe39e477E9`

### What Happens if You Send USDC/ERC20 Directly:

1. ✅ **Tokens will be received** - Contract can receive ERC20 tokens
2. ✅ **Balance increases** - Contract's `balanceOf(contract)` will increase
3. ✅ **Can provide liquidity** - Tokens can be used for unshielding
4. ❌ **NO commitment created** - No note added to Merkle tree
5. ❌ **NO accounting update** - `totalShieldedBalance[token]` won't increase
6. ❌ **Tokens become "orphaned"** - Not associated with any shielded note
7. ❌ **You can't unshield them** - No note = no way to create unshield proof

### Result:
- **Physical Balance:** Contract has tokens ✅
- **Accounting Balance:** Contract thinks it doesn't have them ❌
- **Mismatch:** Creates accounting discrepancy
- **Your Tokens:** Stuck forever (can't unshield without a note)

---

## ✅ Proper Way: Use Shield Function

### From Your Other Wallet:

1. **Connect** the wallet with USDC to the dApp
2. **Shield** the USDC using the shield interface
3. This will:
   - Create a commitment (note)
   - Add to Merkle tree
   - Update `totalShieldedBalance`
   - Create a note you can unshield later

### Why Shield is Better:

- ✅ Creates a note you own
- ✅ Updates accounting correctly
- ✅ You can unshield later if needed
- ✅ Maintains proper accounting balance

---

## Quick Solution for Your Current Situation:

**Instead of sending tokens directly, just:**

1. **From your other wallet:** Shield 2-3 USDC
2. **This provides liquidity** for your current trapped USDC note
3. **Then unshield** your 1.407 USDC note
4. **Or swap back:** USDC → DOGE (simpler!)

---

## Alternative: Swap Back (Easiest)

Just swap the trapped USDC → DOGE:
- No need for external wallet
- No need to shield more USDC
- DOGE liquidity already exists
- You can unshield DOGE later
