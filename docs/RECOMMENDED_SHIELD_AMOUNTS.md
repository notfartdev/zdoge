# Recommended Shield Amounts for Testing

## Option 1: Minimal Testing (Recommended Start)

**For basic swap testing:**

1. **Shield DOGE:** 5-10 DOGE
   - Enough to test swapping
   - Low risk if something goes wrong

2. **Shield USDC:** 3-5 USDC
   - Provides liquidity for unshielding swapped USDC
   - Buffer for fees and testing

**Total:** ~5-10 DOGE + 3-5 USDC

---

## Option 2: Comprehensive Testing

**For thorough testing (all scenarios):**

1. **Shield DOGE:** 20 DOGE
   - Test multiple swaps
   - Test different amounts
   - Have leftover for testing

2. **Shield USDC:** 10 USDC
   - Test swapping both directions
   - Test unshielding multiple times
   - Good liquidity buffer

**Total:** ~20 DOGE + 10 USDC

---

## Recommended Strategy

### Step-by-Step Testing:

1. **Start Small (Option 1):**
   ```
   Shield: 10 DOGE + 5 USDC
   ```

2. **Test Swaps:**
   - Swap 5 DOGE → USDC
   - Swap back 2-3 USDC → DOGE
   - Verify everything works

3. **If Everything Works, Shield More:**
   - Add more tokens as needed
   - Test larger amounts

---

## Why These Amounts?

### For DOGE:
- **10 DOGE** = Good starting point
- Enough for multiple test swaps
- Not too much if testing fails
- Can always shield more later

### For USDC (Liquidity):
- **5 USDC** = Safe buffer
- Covers typical swap amounts (1-3 USDC)
- Leaves room for fees
- Enough for testing unshield

---

## Important Notes

⚠️ **Liquidity Trap Reminder:**
- If you swap DOGE → USDC, you'll get a USDC note
- To unshield that USDC note, the contract needs physical USDC
- Shield USDC **BEFORE** swapping if you plan to unshield swapped USDC
- OR just swap back (USDC → DOGE) which doesn't need extra USDC liquidity

---

## My Recommendation

**Start with:**
- ✅ **10 DOGE** (for testing swaps)
- ✅ **5 USDC** (for liquidity and testing)

**This gives you:**
- Enough to test multiple swaps
- Liquidity buffer for unshielding
- Low risk if something goes wrong
- Can always add more later

**After testing:**
- If everything works, shield more as needed
- If issues occur, you haven't risked much

---

## Example Test Flow

1. Shield **10 DOGE** → Get DOGE note
2. Shield **5 USDC** → Provides liquidity
3. Swap **5 DOGE → USDC** → Get USDC note
4. Unshield **2 USDC** → Should work (contract has liquidity)
5. Swap remaining **USDC → DOGE** → Get DOGE note
6. Unshield **DOGE** → Should work

This tests the full flow without needing large amounts!
