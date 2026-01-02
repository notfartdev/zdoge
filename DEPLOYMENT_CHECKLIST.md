# Shielded Pool Deployment Checklist

Complete checklist for deploying the shielded transaction system to DogeOS Testnet.

---

## 📋 Pre-Deployment Status

| Component | Status | Location |
|-----------|--------|----------|
| Smart Contract | ✅ Ready | `contracts/src/ShieldedPoolMultiToken.sol` |
| Mock Verifier | ✅ Ready | `contracts/src/mocks/MockVerifier.sol` |
| ZK Circuits | ✅ Ready | `circuits/shielded/*.circom` |
| Build Script | ✅ Ready | `circuits/shielded/build.sh` |
| Deployment Script | ✅ Ready | `contracts/scripts/deploy-shielded-multitoken.ts` |
| Verification Script | ✅ Ready | `contracts/scripts/verify-shielded-deployment.ts` |
| Backend Indexer | ✅ Ready | `backend/src/shielded/shielded-indexer.ts` |
| Backend Routes | ✅ Ready | `backend/src/shielded/shielded-routes.ts` |
| Frontend Services | ✅ Ready | `lib/shielded/*.ts` |
| Frontend Components | ✅ Ready | `components/shielded/*.tsx` |
| Dashboard Page | ✅ Ready | `app/dashboard/shielded/page.tsx` |

---

## 🚀 Deployment Steps

### Step 1: Prepare Environment

```bash
# Navigate to contracts directory
cd contracts

# Install dependencies (if not done)
npm install

# Create .env file if not exists
echo "PRIVATE_KEY=your_private_key_here" > .env
```

**Required:**
- Private key with DOGE for gas (at least 10 DOGE recommended)
- Get testnet DOGE from: https://faucet.testnet.dogeos.com

### Step 2: Deploy Shielded Pool (Mock Verifiers)

```bash
npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet
```

This will:
- ✓ Deploy 4 mock verifiers (shield, transfer, unshield, swap)
- ✓ Deploy ShieldedPoolMultiToken contract
- ✓ Add all supported tokens (DOGE, USDC, USDT, WETH, LBTC, USD1)
- ✓ Save deployment info to `deployments/shielded-multitoken-6281971.json`

### Step 3: Verify Deployment

```bash
npx hardhat run scripts/verify-shielded-deployment.ts --network dogeosTestnet
```

This tests:
- ✓ Token support
- ✓ Pool info
- ✓ Shield operation (small test amount)

### Step 4: Update Frontend Config

Open `lib/dogeos-config.ts` and update with deployed addresses:

```typescript
export const shieldedPool = {
  address: '0x...',  // From deployment output
  shieldVerifier: '0x...',
  transferVerifier: '0x...',
  unshieldVerifier: '0x...',
  swapVerifier: '0x...',
  // ... rest stays the same
};
```

### Step 5: Update Backend Config

Set environment variable:

```bash
export SHIELDED_POOL_ADDRESS=0x...
```

Or add to backend `.env` file:

```
SHIELDED_POOL_ADDRESS=0x...
```

### Step 6: Start Backend

```bash
cd backend
npm run dev
```

Check logs for:
```
[ShieldedPool] Initializing: 0x...
[ShieldedPool] Synced successfully!
```

### Step 7: Test Frontend

```bash
cd ..  # Root directory
npm run dev
```

Navigate to: http://localhost:3000/dashboard/shielded

Test:
1. Generate shielded address
2. Shield some DOGE
3. View shielded balance

---

## ⚠️ Important Notes

### Mock Verifiers (Testing Only)

The initial deployment uses **mock verifiers** that always return `true`.

**This is fine for testing but NOT secure for production!**

For production:
1. Build real circuits (see Step 8 below)
2. Redeploy with real verifier addresses

### Step 8: Build Production Circuits (Optional for Testnet)

```bash
# Install circom (if not installed)
# See: https://docs.circom.io/getting-started/installation/

cd circuits/shielded
chmod +x build.sh
./build.sh
```

This takes ~10-30 minutes and generates:
- `*.wasm` - WebAssembly for frontend proofs
- `*_final.zkey` - Proving keys
- `*Verifier.sol` - Solidity verifiers

Then redeploy with real verifiers:
```bash
cd ../../contracts
# Set verifier addresses as env vars
export SHIELD_VERIFIER_ADDRESS=0x...
export TRANSFER_VERIFIER_ADDRESS=0x...
export UNSHIELD_VERIFIER_ADDRESS=0x...
export SWAP_VERIFIER_ADDRESS=0x...

npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet
```

---

## 🧪 Testing Checklist

After deployment, verify each operation:

### Shield (t → z)
- [ ] Connect wallet on dashboard
- [ ] Enter amount (e.g., 10 DOGE)
- [ ] Click Shield
- [ ] Confirm transaction
- [ ] See note appear in "My Notes"

### Transfer (z → z)
- [ ] Have shielded note
- [ ] Get recipient's shielded address
- [ ] Enter amount and recipient
- [ ] Click Transfer
- [ ] Confirm transaction
- [ ] Note disappears, change note appears

### Unshield (z → t)
- [ ] Have shielded note
- [ ] Enter recipient public address
- [ ] Click Unshield
- [ ] Confirm transaction
- [ ] Check recipient received funds

### Swap (z → z)
- [ ] Have shielded DOGE note
- [ ] Select output token (e.g., USDC)
- [ ] See real-time quote
- [ ] Click Swap
- [ ] New token note appears

---

## 📊 Verify on Block Explorer

Check deployed contracts on Blockscout:

https://blockscout.testnet.dogeos.com/address/{CONTRACT_ADDRESS}

---

## 🔧 Troubleshooting

### "Pool not found" in Backend
- Check `SHIELDED_POOL_ADDRESS` is set
- Restart backend after setting

### "Transaction reverted"
- Check you have enough DOGE for gas
- Check token is supported (DOGE, USDC, etc.)

### "Proof generation failed"
- Circuit files may not be loaded
- Check `/public/circuits/shielded/` has wasm/zkey files

### "Nullifier spent"
- Note was already used
- Refresh wallet to sync notes

---

## ✅ Deployment Complete When:

- [ ] ShieldedPoolMultiToken deployed
- [ ] All tokens showing as supported
- [ ] Frontend can shield DOGE
- [ ] Backend syncing pool events
- [ ] Notes appearing in wallet

---

## 📞 Support

If issues occur:
1. Check this document
2. Check console logs (frontend/backend)
3. Check Blockscout for transaction status


