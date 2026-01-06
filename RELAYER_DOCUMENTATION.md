# Dogenado Relayer Documentation

## Overview

The Dogenado Relayer is a service that submits shielded transactions (unshields and transfers) on behalf of users, allowing them to interact with the shielded pool **without paying gas fees**. The relayer is compensated through transaction fees deducted from the withdrawal amount.

**Relayer Address:** `0xaD4d17B583f513eAfF85C0d76Fb91c014227377B`  
**Current Balance:** 212.0543 DOGE  
**Status:** ✅ Available

---

## Architecture

### Two Relayer Implementations

Your codebase has **two separate relayer services**:

1. **Legacy Relayer** (`backend/src/relayer/index.ts`)
   - For the old `MixerPool` contracts (fixed-denomination pools)
   - Uses `withdraw()` function
   - Supports all tokens (DOGE, USDC, USDT, WETH, LBTC, USD1)

2. **Shielded Relayer** (`backend/src/shielded/shielded-routes.ts`)
   - For the new `ShieldedPoolMultiToken` contract
   - Uses `unshieldNative()` and `transfer()` functions
   - **Currently only supports DOGE** (see limitations below)

---

## Current Implementation: Shielded Relayer

### Supported Operations

#### ✅ Unshield Native DOGE
- **Endpoint:** `POST /api/shielded/relay/unshield`
- **Contract Function:** `unshieldNative()`
- **Location:** Line 393 in `shielded-routes.ts`

```typescript
await relayerWallet.writeContract({
  address: poolAddress,
  abi: ShieldedPoolABI,
  functionName: 'unshieldNative',
  args: [
    proofBigInts,
    root,
    nullifierHash,
    recipient,
    amountBigInt,
    relayerAddress!,
    fee,
  ],
});
```

#### ✅ Private Transfer (z→z)
- **Endpoint:** `POST /api/shielded/relay/transfer`
- **Contract Function:** `transfer()`
- **Location:** Line 571 in `shielded-routes.ts`

#### ❌ Unshield ERC20 Tokens
- **NOT IMPLEMENTED** - No endpoint for `unshieldToken()`

---

## Fee Structure

### Configuration
```typescript
const RELAYER_FEE_PERCENT = 0.5;  // 0.5% of withdrawal amount
const MIN_RELAYER_FEE = BigInt(0.001 * 1e18); // Minimum 0.001 DOGE
```

### Fee Calculation
1. **Percentage-based:** `fee = (amount * 0.5) / 100`
2. **Minimum enforced:** If calculated fee < 0.001 DOGE, use 0.001 DOGE
3. **Maximum check:** Fee cannot exceed withdrawal amount

### Fee Payment Flow

#### For Native DOGE (Current Implementation)
```solidity
// Contract: ShieldedPoolMultiToken.sol, lines 349-356
if (_token == NATIVE_TOKEN) {
    // Send amount to recipient
    _recipient.call{value: _amount}("");
    
    // Send fee to relayer (also in DOGE)
    if (_fee > 0 && _relayer != address(0)) {
        _relayer.call{value: _fee}("");
    }
}
```

**Why this works:**
- Relayer receives DOGE fees
- Relayer uses DOGE for gas
- ✅ Self-sustaining

#### For ERC20 Tokens (Not Implemented)
```solidity
// Contract: ShieldedPoolMultiToken.sol, lines 357-363
else {
    // Send amount to recipient
    IERC20(_token).safeTransfer(_recipient, _amount);
    
    // Send fee to relayer (in same token, e.g., USDC)
    if (_fee > 0 && _relayer != address(0)) {
        IERC20(_token).safeTransfer(_relayer, _fee);
    }
}
```

**Why this is problematic:**
- Relayer receives USDC fees (for example)
- But relayer needs DOGE for gas
- ❌ Requires token conversion or separate DOGE balance management

---

## Why Only DOGE is Supported

### 1. Implementation Limitation

The relayer only implements `unshieldNative()` (line 393), not `unshieldToken()`:

```typescript
// Current implementation
functionName: 'unshieldNative',  // ✅ Only this

// Missing implementation
functionName: 'unshieldToken',    // ❌ Not implemented
```

### 2. Gas vs Fee Currency Mismatch

**The Problem:**
- **Gas is paid in:** DOGE (native currency)
- **ERC20 fees are paid in:** The same token (USDC fee for USDC unshield)

**Example Scenario:**
1. User unshields 100 USDC
2. Relayer receives 0.5 USDC fee
3. Relayer needs DOGE for gas
4. ❌ Relayer has USDC but needs DOGE

**Solutions (not implemented):**
- Convert USDC fees to DOGE via DEX
- Maintain separate DOGE balance for gas
- Accept only DOGE fees (even for ERC20 unshields)

### 3. Contract Support vs Relayer Support

**Contract supports:** ✅ All tokens (DOGE, USDC, USDT, WETH, LBTC, USD1)  
**Relayer supports:** ❌ Only DOGE

The `ShieldedPoolMultiToken` contract has both functions:
- `unshieldNative()` - ✅ Implemented in relayer
- `unshieldToken()` - ❌ Not implemented in relayer

---

## Relayer Info Endpoint

### GET `/api/shielded/relay/info`

Returns:
```json
{
  "available": true,
  "address": "0xaD4d17B583f513eAfF85C0d76Fb91c014227377B",
  "balance": "212.0543",
  "feePercent": 0.5,
  "minFee": "0.001",
  "supportedTokens": ["DOGE"]  // ← Only DOGE listed
}
```

**Code Location:** `backend/src/shielded/shielded-routes.ts`, lines 280-302

---

## How It Works

### User Flow (Unshield)

1. **User generates proof** (client-side)
   - Includes: recipient, relayer address, fee amount
   - Fee must match what relayer expects

2. **User calls relayer API**
   ```typescript
   POST /api/shielded/relay/unshield
   {
     poolAddress,
     proof,
     root,
     nullifierHash,
     recipient,
     amount,
     fee  // Must match proof!
   }
   ```

3. **Relayer validates**
   - Checks relayer balance (needs ≥ 0.01 DOGE for gas)
   - Validates fee bounds
   - Verifies proof format

4. **Relayer submits transaction**
   - Calls `unshieldNative()` on contract
   - Pays gas from relayer's DOGE balance
   - Receives fee in DOGE

5. **Contract executes**
   - Verifies ZK proof
   - Transfers `amount - fee` to recipient
   - Transfers `fee` to relayer
   - Marks nullifier as spent

### Security Features

- ✅ **Rate limiting:** 5 requests per minute per IP
- ✅ **Proof validation:** Contract verifies ZK proof
- ✅ **Nullifier check:** Prevents double-spending
- ✅ **Root validation:** Ensures Merkle root is known
- ✅ **Balance check:** Relayer must have gas funds

---

## Extending to Support ERC20 Tokens

### Option 1: Accept DOGE Fees for All Tokens

**Pros:**
- Simple implementation
- No token conversion needed
- Relayer always has DOGE for gas

**Cons:**
- Users pay fees in DOGE even for USDC withdrawals
- Requires users to have DOGE balance

**Implementation:**
```typescript
// Modify unshieldToken() to accept DOGE fee
// Contract would need to be updated
```

### Option 2: Implement Token-to-DOGE Conversion

**Pros:**
- Users pay fees in same token
- More intuitive UX

**Cons:**
- Complex implementation
- Requires DEX integration
- Slippage risk
- Gas costs for swaps

**Implementation:**
```typescript
// In relayer, after receiving USDC fee:
const dogeForGas = await swapUSDCtoDOGE(usdcFee);
// Use dogeForGas for gas, keep remainder as profit
```

### Option 3: Maintain Separate DOGE Balance

**Pros:**
- Users pay fees in same token
- No conversion needed

**Cons:**
- Relayer needs to fund DOGE balance separately
- Risk of running out of gas DOGE

**Implementation:**
```typescript
// Relayer maintains minimum DOGE balance
// Replenishes from token fee conversions periodically
```

### Recommended: Option 1 (Simplest)

For MVP, accept DOGE fees for all tokens. This is the simplest and most reliable approach.

---

## Code Locations

### Relayer Implementation
- **Shielded Relayer:** `backend/src/shielded/shielded-routes.ts`
  - Info endpoint: Lines 280-302
  - Unshield endpoint: Lines 316-457
  - Transfer endpoint: Lines 474-650

### Contract Functions
- **ShieldedPoolMultiToken:** `contracts/src/ShieldedPoolMultiToken.sol`
  - `unshieldNative()`: Lines 284-294
  - `unshieldToken()`: Lines 299-311
  - `_unshield()` (internal): Lines 313-374

### Frontend Integration
- **Unshield Interface:** `components/shielded/unshield-interface.tsx`
  - Relayer info fetch: Lines 120-133
  - Unshield submission: Lines 230-261

---

## Monitoring & Maintenance

### Health Checks
- **Endpoint:** `GET /api/shielded/relay/info`
- **Check balance:** Should be > 0.01 DOGE
- **Check availability:** Should be `true`

### Balance Management
- Current balance: **212.0543 DOGE** ✅
- Minimum for gas: **0.01 DOGE**
- Recommended minimum: **1 DOGE** (buffer for multiple transactions)

### Fee Economics
- **Fee rate:** 0.5% per transaction
- **Minimum fee:** 0.001 DOGE
- **Gas cost:** ~0.001-0.01 DOGE per transaction (varies)
- **Profit margin:** Fee - Gas cost

**Example:**
- User unshields 100 DOGE
- Fee: 0.5 DOGE
- Gas: ~0.005 DOGE
- Profit: ~0.495 DOGE

---

## Summary

### Current State
- ✅ **DOGE unshields:** Fully supported
- ✅ **Private transfers:** Fully supported
- ❌ **ERC20 unshields:** Not supported (implementation missing)
- ❌ **Token fees:** Would require conversion or separate DOGE balance

### Why Only DOGE?
1. **Implementation:** Only `unshieldNative()` is implemented
2. **Gas currency:** Relayer needs DOGE for gas
3. **Fee currency:** ERC20 fees create currency mismatch
4. **Comment in code:** Line 300 says "Native DOGE for now" - indicates this is intentional for MVP

### Next Steps (If Extending)
1. Implement `unshieldToken()` endpoint in relayer
2. Choose fee strategy (DOGE for all, or conversion)
3. Update `/relay/info` to list supported tokens
4. Test with USDC/USDT unshields

---

## Verification

You can verify relayer transactions on Blockscout:
1. Go to: https://blockscout.testnet.dogeos.com
2. Search for relayer address: `0xaD4d17B583f513eAfF85C0d76Fb91c014227377B`
3. Check transaction details
4. Look for `relayer` parameter in `unshieldNative()` calls

---

*Last updated: Based on codebase analysis of shielded-routes.ts and ShieldedPoolMultiToken.sol*

