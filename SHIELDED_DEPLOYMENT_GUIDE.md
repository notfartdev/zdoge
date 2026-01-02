# Shielded Pool Deployment Guide

Complete guide to deploy and use Dogenado's Zcash-style shielded transactions.

---

## 📋 Quick Summary

### How Does a User Get Shielded DOGE?

```
1. User has 100 DOGE in their public wallet
2. User calls shieldNative() with 100 DOGE
3. Contract creates a "shielded note" (private IOU)
4. Now user has 100 shielded DOGE
```

```
Public Wallet: 100 DOGE → [SHIELD] → Shielded Note: [100 DOGE, owner: YOU]
```

### Features

| Feature | Status |
|---------|--------|
| Multi-token support | ✅ DOGE, USDC, USDT, WETH, LBTC, USD1 |
| Variable amounts | ✅ Any amount (no fixed denominations) |
| Private transfers | ✅ z→z with auto-discovery |
| Private swaps | ✅ Real-time rates from CoinGecko |
| ERC20 support | ✅ Shield any supported token |

---

## 🚀 Deployment Steps

### Step 1: Build ZK Circuits (Optional for Testing)

For production, build real circuits:

```bash
cd circuits/shielded
chmod +x build.sh
./build.sh
```

For testing, mock verifiers are auto-deployed.

### Step 2: Deploy to Testnet

```bash
cd contracts

# Install dependencies
npm install

# Deploy multi-token shielded pool
npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet
```

### Step 3: Update Frontend Config

After deployment, update `lib/dogeos-config.ts`:

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

---

## 🔄 User Flows

### Flow 1: Shield DOGE

```
Public Wallet: 100 DOGE
       │
       ▼ shieldNative(commitment) + 100 DOGE
       │
Shielded Layer: Note [100 DOGE, owner: YOU, secret: xxx]
```

**Contract call:**
```typescript
await shieldedPool.shieldNative(commitment, { value: parseEther("100") });
```

### Flow 2: Shield ERC20 (USDC, etc.)

```
Public Wallet: 1000 USDC
       │
       ▼ approve(shieldedPool, amount)
       ▼ shieldToken(token, amount, commitment)
       │
Shielded Layer: Note [1000 USDC, owner: YOU]
```

**Contract calls:**
```typescript
await usdc.approve(shieldedPoolAddress, amount);
await shieldedPool.shieldToken(usdcAddress, amount, commitment);
```

### Flow 3: Private Transfer

```
User A: Note [100 DOGE]
       │
       ▼ transfer(proof, ..., encryptedMemo)
       │
User B: Note [100 DOGE] ← Auto-discovered!
```

**User B's wallet automatically:**
1. Scans Transfer events
2. Decrypts memo with viewing key
3. Imports the note
4. Shows "You received 100 DOGE!"

### Flow 4: Private Swap

```
Your Shielded Balance: 100 DOGE
       │
       ▼ swap(proof, DOGE, USDC, 100)
       │    │
       │    ▼ Real-time price: 1 DOGE = $0.15
       │    ▼ 100 DOGE = 15 USDC (minus 0.3% fee)
       │
Your Shielded Balance: 14.95 USDC ← Still shielded!
```

### Flow 5: Unshield

```
Shielded Layer: Note [15 USDC]
       │
       ▼ unshieldToken(proof, recipient, token, amount)
       │
Public Wallet: 15 USDC
```

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `contracts/src/ShieldedPoolMultiToken.sol` | Multi-token shielded pool contract |
| `contracts/scripts/deploy-shielded-multitoken.ts` | Deployment script |
| `lib/shielded/shielded-swap-service.ts` | Real-time swap quotes |
| `lib/shielded/shielded-receiving.ts` | Auto-discovery system |
| `lib/dogeos-config.ts` | Updated with all tokens |
| `SHIELDED_USER_FLOWS.md` | User flow documentation |

---

## 💱 Real-Time Swap Rates

Swaps use **real-time prices from CoinGecko**:

```typescript
// Get current swap quote
const quote = await getSwapQuote('DOGE', 'USDC', parseEther("100"));

console.log(quote);
// {
//   inputToken: 'DOGE',
//   outputToken: 'USDC',
//   inputAmount: 100000000000000000000n,  // 100 DOGE
//   outputAmount: 14955000000000000000n,   // 14.955 USDC
//   exchangeRate: 0.15,
//   fee: 45000000000000000n,               // 0.045 USDC (0.3%)
//   expiresAt: 1704200000000,              // Valid for 30 sec
// }
```

Prices are cached for 30 seconds to reduce API calls.

---

## 🔒 Security Notes

### For Testing (Current Setup)
- Uses **MockVerifier** that always returns `true`
- Safe for testnet experimentation
- NOT for production!

### For Production
1. Build real ZK circuits using `build.sh`
2. Deploy generated `*Verifier.sol` contracts
3. Deploy pool with real verifier addresses
4. Verify all contracts on block explorer

---

## 🧪 Testing the Deployment

After deployment, test each flow:

```bash
# 1. Shield native DOGE
cast send $POOL "shieldNative(bytes32)" $COMMITMENT --value 100ether

# 2. Check balance
cast call $POOL "getPoolInfo(address)" 0x0000000000000000000000000000000000000000

# 3. Check token is supported
cast call $POOL "supportedTokens(address)" $USDC_ADDRESS
```

---

## 🎯 What's Next?

1. **Deploy to testnet** using the deployment script
2. **Test each flow**: shield → transfer → unshield
3. **Test swaps**: shield DOGE → swap to USDC → unshield
4. **Build real circuits** for production security
5. **Integrate DEX router** for actual on-chain swaps

Ready to deploy? Run:

```bash
cd contracts
npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet
```


