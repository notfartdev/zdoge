# V4 Backend Update Instructions

## Quick Update Steps

### 1. Update .env File (if needed)

If you have `SHIELDED_POOL_ADDRESS` in your `.env` file, update it:

```bash
# In backend/.env
SHIELDED_POOL_ADDRESS=0xccBB029f6af4AD8A7D68Bb5A905f7b60a7A9F693
```

**Note:** If you don't have `SHIELDED_POOL_ADDRESS` in your `.env`, the backend will use the default V4 address from `config.ts` (already updated).

### 2. Rebuild Backend

```bash
cd backend
npm run build
```

This will:
- Clean the `dist/` folder
- Compile TypeScript to JavaScript
- Update all config references

### 3. Restart Backend

```bash
# Stop current backend (Ctrl+C if running)
npm start
```

Or if using PM2/process manager:
```bash
pm2 restart backend
```

## Testing Checklist

After restarting, test all operations:

### ✅ Test 1: Shield Operation
- Shield 10 DOGE
- Verify commitment is added
- Check Shield event is emitted
- Verify balance updates

### ✅ Test 2: Transfer Operation
- Transfer 5 DOGE between shielded addresses
- Verify both output commitments are unique
- Check CommitmentAlreadyExists protection works

### ✅ Test 3: Partial Unshield
- Shield 10 DOGE
- Unshield 5 DOGE (partial)
- Verify:
  - ✅ 5 DOGE received
  - ✅ Change commitment inserted into tree
  - ✅ Change note discoverable in wallet

### ✅ Test 4: Full Unshield
- Unshield full amount (changeCommitment = 0)
- Verify works correctly

### ✅ Test 5: Swap Operation
- Swap 10 DOGE for USDC
- Verify:
  - ✅ Platform fee (5 DOGE) is charged
  - ✅ Swap rate validation works
  - ✅ Output commitment is unique
  - ✅ Balance updates correctly

### ✅ Test 6: Security Fixes
- **Swap Rate Validation**: Try unrealistic rate (should reject)
- **Rug Pull Prevention**: Remove token support, verify users can still unshield
- **Commitment Uniqueness**: Try duplicate commitment (should reject)
- **Platform Fee**: Verify 5 DOGE fee is always charged

## Verification

Check backend logs for:
- ✅ No errors on startup
- ✅ Pool address matches V4: `0xccBB029f6af4AD8A7D68Bb5A905f7b60a7A9F693`
- ✅ All endpoints responding correctly
- ✅ Indexer syncing events from V4 contract

## Rollback (if needed)

If issues occur:
1. Revert `.env` to V3 address: `SHIELDED_POOL_ADDRESS=0x05D32B760ff49678FD833a4E2AbD516586362b17`
2. Rebuild: `npm run build`
3. Restart backend

V3 contract remains active and functional.
