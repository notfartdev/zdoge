# ERC20 Token Unshield Implementation Guide

## Current Status

**✅ Contract Support**: The `ShieldedPoolMultiToken` contract already supports ERC20 unshielding via `unshieldToken()` function.

**❌ Backend Limitation**: The relayer only implements `unshieldNative()` for DOGE. ERC20 tokens are not supported yet.

**✅ Frontend Ready**: The frontend already supports token selection and can pass token information.

---

## What Needs to Be Implemented

### 1. Backend API Changes (`backend/src/shielded/shielded-routes.ts`)

#### Current Implementation (DOGE only)
```typescript
// Line 393: Only calls unshieldNative
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
```

#### Required Changes

**Step 1: Add `token` parameter to request body**
```typescript
const { 
  poolAddress, 
  proof, 
  root, 
  nullifierHash, 
  recipient, 
  amount, 
  fee: requestFee,
  token  // NEW: Token address (optional, defaults to native DOGE)
} = req.body;
```

**Step 2: Determine if native or ERC20**
```typescript
// Check if token is provided and not native
const isNative = !token || token === '0x0000000000000000000000000000000000000000';
const tokenAddress = isNative ? null : (token as Address);
```

**Step 3: Call appropriate contract function**
```typescript
if (isNative) {
  // Native DOGE unshield
  const txHash = await relayerWallet.writeContract({
    chain: dogeosTestnet,
    account: relayerAccount!,
    address: poolAddress as Address,
    abi: ShieldedPoolABI,
    functionName: 'unshieldNative',
    args: [
      proofBigInts,
      root as `0x${string}`,
      nullifierHash as `0x${string}`,
      recipient as Address,
      amountBigInt,
      relayerAddress!,
      fee,
    ],
  });
} else {
  // ERC20 token unshield
  const txHash = await relayerWallet.writeContract({
    chain: dogeosTestnet,
    account: relayerAccount!,
    address: poolAddress as Address,
    abi: ShieldedPoolABI,
    functionName: 'unshieldToken',
    args: [
      proofBigInts,
      root as `0x${string}`,
      nullifierHash as `0x${string}`,
      recipient as Address,
      tokenAddress!,  // Token address
      amountBigInt,
      relayerAddress!,
      fee,
    ],
  });
}
```

**Step 4: Update validation**
```typescript
// Validate token if provided
if (token && token !== '0x0000000000000000000000000000000000000000') {
  // Check if token is supported by contract
  const isSupported = await publicClient.readContract({
    address: poolAddress as Address,
    abi: ShieldedPoolABI,
    functionName: 'supportedTokens',
    args: [token as Address],
  });
  
  if (!isSupported) {
    return res.status(400).json({ 
      error: 'Unsupported token',
      message: `Token ${token} is not supported by the pool`,
    });
  }
}
```

**Step 5: Update response to include token**
```typescript
res.json({
  success: true,
  txHash,
  blockNumber: Number(receipt.blockNumber),
  recipient,
  token: isNative ? '0x0000000000000000000000000000000000000000' : tokenAddress,
  amountReceived: amountAfterFee.toString(),
  fee: fee.toString(),
  relayer: relayerAddress,
});
```

---

### 2. Frontend Changes (`components/shielded/unshield-interface.tsx`)

#### Current Implementation
```typescript
// Line 379-390: Only sends amount, no token info
body: JSON.stringify({
  poolAddress: SHIELDED_POOL_ADDRESS,
  proof: proofResult.proof.proof,
  root: proofResult.root,
  nullifierHash: proofResult.nullifierHash,
  recipient: recipientAddress,
  amount: proofResult.amount.toString(),
  fee: relayerFeeWei.toString(),
}),
```

#### Required Changes

**Step 1: Get token address from selected token**
```typescript
// Import token config
import { shieldedPool } from "@/lib/dogeos-config"

// Get token address
const tokenAddress = selectedToken === 'DOGE' 
  ? '0x0000000000000000000000000000000000000000'  // Native
  : shieldedPool.supportedTokens[selectedToken]?.address
```

**Step 2: Add token to request body**
```typescript
body: JSON.stringify({
  poolAddress: SHIELDED_POOL_ADDRESS,
  proof: proofResult.proof.proof,
  root: proofResult.root,
  nullifierHash: proofResult.nullifierHash,
  recipient: recipientAddress,
  amount: proofResult.amount.toString(),
  fee: relayerFeeWei.toString(),
  token: tokenAddress,  // NEW: Token address
}),
```

**Step 3: Update consolidation to include token**
```typescript
// In handleConsolidateAll, add token to each request
body: JSON.stringify({
  poolAddress: SHIELDED_POOL_ADDRESS,
  proof: proofResult.proof.proof,
  root: proofResult.root,
  nullifierHash: proofResult.nullifierHash,
  recipient: wallet.address,
  amount: proofResult.amount.toString(),
  fee: relayerFeeWei.toString(),
  token: tokenAddress,  // NEW: Token address
}),
```

---

### 3. Shielded Service Changes (`lib/shielded/shielded-service.ts`)

#### Current Implementation
The `prepareUnshield()` function doesn't need changes - it already works with any token type since it only deals with notes (which contain token info).

However, we should verify that the proof generation works correctly for all tokens. The unshield circuit should be token-agnostic (it only cares about amounts, not token types).

---

### 4. Relayer Balance Management

#### Challenge: ERC20 Fees vs Gas

**Problem**: 
- Relayer needs DOGE for gas (always)
- ERC20 unshields pay fees in the same token (e.g., USDC fee for USDC unshield)
- Relayer would accumulate ERC20 tokens but still need DOGE for gas

**Solutions**:

**Option A: Convert ERC20 Fees to DOGE**
```typescript
// After receiving ERC20 fee, convert to DOGE via DEX
// Requires: DEX integration (Uniswap, etc.)
// Pros: Relayer always has DOGE for gas
// Cons: Requires DEX integration, slippage, complexity
```

**Option B: Maintain Separate DOGE Balance**
```typescript
// Relayer maintains DOGE balance separately
// ERC20 fees go to relayer but don't help with gas
// Pros: Simple, no DEX needed
// Cons: Relayer needs separate DOGE funding
```

**Option C: Fee in DOGE for All Tokens** (Current Transfer Approach)
```typescript
// Always charge fee in DOGE, even for ERC20 unshields
// Requires contract changes (not recommended)
// Pros: Simple for relayer
// Cons: Requires contract modification
```

**Recommended: Option B** (Maintain Separate DOGE Balance)
- Simplest to implement
- No contract changes needed
- Relayer just needs DOGE balance for gas
- ERC20 fees are separate revenue stream

---

### 5. API Documentation Updates

#### Request Body
```typescript
{
  poolAddress: string,      // ShieldedPool contract address
  proof: string[],          // [8] ZK proof elements
  root: string,             // bytes32 Merkle root
  nullifierHash: string,    // bytes32 nullifier
  recipient: string,        // Recipient address (0x...)
  amount: string,           // Amount in wei
  fee: string,              // Fee in wei
  token?: string            // NEW: Token address (optional, defaults to native)
}
```

#### Response
```typescript
{
  success: true,
  txHash: string,
  blockNumber: number,
  recipient: string,
  token: string,            // NEW: Token address
  amountReceived: string,    // Amount after fee
  fee: string,
  relayer: string
}
```

---

## Implementation Checklist

### Backend (`backend/src/shielded/shielded-routes.ts`)
- [ ] Add `token` parameter to request validation
- [ ] Add token support check (verify token is supported by contract)
- [ ] Implement conditional logic: `unshieldNative` vs `unshieldToken`
- [ ] Update contract call to use `unshieldToken` for ERC20
- [ ] Update response to include token address
- [ ] Update error messages to include token info
- [ ] Test with USDC, USDT, WETH, LBTC, USD1

### Frontend (`components/shielded/unshield-interface.tsx`)
- [ ] Import token configuration
- [ ] Get token address from `selectedToken`
- [ ] Add `token` to single unshield request
- [ ] Add `token` to consolidation requests
- [ ] Update transaction history to use correct token
- [ ] Test with all supported tokens

### Testing
- [ ] Test USDC unshield
- [ ] Test USDT unshield
- [ ] Test WETH unshield
- [ ] Test LBTC unshield
- [ ] Test USD1 unshield
- [ ] Test consolidation with ERC20 tokens
- [ ] Verify fees are paid in correct token
- [ ] Verify relayer receives fees correctly

### Documentation
- [ ] Update API documentation
- [ ] Update `UNSHIELD_FUNCTION_ANALYSIS.md`
- [ ] Update relayer documentation

---

## Code Example: Complete Implementation

### Backend Route Handler
```typescript
shieldedRouter.post('/relay/unshield', async (req: Request, res: Response) => {
  if (!relayerWallet || !relayerAddress) {
    return res.status(503).json({ 
      error: 'Relayer not available',
      message: 'Relayer wallet not configured. Please try again later.',
    });
  }
  
  const { 
    poolAddress, 
    proof, 
    root, 
    nullifierHash, 
    recipient, 
    amount, 
    fee: requestFee,
    token  // NEW: Optional token address
  } = req.body;
  
  // Validate inputs
  if (!poolAddress || !proof || !root || !nullifierHash || !recipient || !amount) {
    return res.status(400).json({ 
      error: 'Missing parameters',
      required: ['poolAddress', 'proof', 'root', 'nullifierHash', 'recipient', 'amount'],
    });
  }
  
  if (!Array.isArray(proof) || proof.length !== 8) {
    return res.status(400).json({ error: 'Proof must be array of 8 elements' });
  }
  
  // Determine if native or ERC20
  const isNative = !token || token === '0x0000000000000000000000000000000000000000';
  const tokenAddress = isNative ? null : (token as Address);
  
  // Validate token if provided
  if (!isNative) {
    try {
      const isSupported = await publicClient.readContract({
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'supportedTokens',
        args: [tokenAddress!],
      });
      
      if (!isSupported) {
        return res.status(400).json({ 
          error: 'Unsupported token',
          message: `Token ${token} is not supported by the pool`,
        });
      }
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid token',
        message: 'Could not verify token support',
      });
    }
  }
  
  const amountBigInt = BigInt(amount);
  let fee: bigint;
  if (requestFee !== undefined && requestFee !== null) {
    fee = BigInt(requestFee);
  } else {
    const feePercent = BigInt(Math.floor(RELAYER_FEE_PERCENT * 100));
    fee = (amountBigInt * feePercent) / 10000n;
    if (fee < MIN_RELAYER_FEE) {
      fee = MIN_RELAYER_FEE;
    }
  }
  
  if (fee >= amountBigInt) {
    return res.status(400).json({ 
      error: 'Amount too small',
      message: `Minimum withdrawal is ${(Number(MIN_RELAYER_FEE) / 1e18 * 2).toFixed(4)} ${isNative ? 'DOGE' : 'tokens'}`,
    });
  }
  
  const amountAfterFee = amountBigInt - fee;
  
  console.log(`[ShieldedRelayer] Processing unshield:`);
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Token: ${isNative ? 'Native DOGE' : tokenAddress}`);
  console.log(`  Recipient: ${recipient}`);
  console.log(`  Amount: ${Number(amountBigInt) / 1e18}`);
  console.log(`  Fee: ${Number(fee) / 1e18} (${RELAYER_FEE_PERCENT}%)`);
  console.log(`  After fee: ${Number(amountAfterFee) / 1e18}`);
  
  try {
    // Check relayer balance (always needs DOGE for gas)
    const relayerBalance = await publicClient.getBalance({ address: relayerAddress });
    if (relayerBalance < BigInt(0.01 * 1e18)) {
      console.error('[ShieldedRelayer] Insufficient gas balance');
      return res.status(503).json({ 
        error: 'Relayer temporarily unavailable',
        message: 'Relayer needs more gas. Please try again later.',
      });
    }
    
    const proofBigInts = proof.map((p: string) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    
    // Call appropriate function based on token type
    let txHash: `0x${string}`;
    
    if (isNative) {
      // Native DOGE unshield
      txHash = await relayerWallet.writeContract({
        chain: dogeosTestnet,
        account: relayerAccount!,
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'unshieldNative',
        args: [
          proofBigInts,
          root as `0x${string}`,
          nullifierHash as `0x${string}`,
          recipient as Address,
          amountBigInt,
          relayerAddress!,
          fee,
        ],
      });
    } else {
      // ERC20 token unshield
      txHash = await relayerWallet.writeContract({
        chain: dogeosTestnet,
        account: relayerAccount!,
        address: poolAddress as Address,
        abi: ShieldedPoolABI,
        functionName: 'unshieldToken',
        args: [
          proofBigInts,
          root as `0x${string}`,
          nullifierHash as `0x${string}`,
          recipient as Address,
          tokenAddress!,  // Token address
          amountBigInt,
          relayerAddress!,
          fee,
        ],
      });
    }
    
    console.log(`[ShieldedRelayer] TX submitted: ${txHash}`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      confirmations: 1,
    });
    
    if (receipt.status === 'reverted') {
      console.error('[ShieldedRelayer] TX reverted');
      return res.status(500).json({ 
        error: 'Transaction reverted',
        message: 'The unshield transaction was rejected by the contract. Proof may be invalid.',
      });
    }
    
    console.log(`[ShieldedRelayer] TX confirmed in block ${receipt.blockNumber}`);
    
    res.json({
      success: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      recipient,
      token: isNative ? '0x0000000000000000000000000000000000000000' : tokenAddress,
      amountReceived: amountAfterFee.toString(),
      fee: fee.toString(),
      relayer: relayerAddress,
    });
    
  } catch (error: any) {
    console.error('[ShieldedRelayer] Error:', error.message);
    
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('InvalidProof')) {
      return res.status(400).json({ error: 'Invalid proof', message: 'ZK proof verification failed' });
    }
    if (errorMsg.includes('UnknownRoot') || errorMsg.includes('InvalidMerkleRoot')) {
      return res.status(400).json({ error: 'Invalid root', message: 'Merkle root not recognized' });
    }
    if (errorMsg.includes('NullifierAlreadySpent') || errorMsg.includes('already spent')) {
      return res.status(400).json({ error: 'Already spent', message: 'This note has already been withdrawn' });
    }
    if (errorMsg.includes('UnsupportedToken')) {
      return res.status(400).json({ error: 'Unsupported token', message: 'This token is not supported' });
    }
    if (errorMsg.includes('insufficient funds')) {
      return res.status(503).json({ error: 'Relayer out of gas', message: 'Please try again later' });
    }
    
    res.status(500).json({ 
      error: 'Transaction failed',
      message: errorMsg.slice(0, 200),
    });
  }
});
```

### Frontend Request Update
```typescript
// Get token address
const tokenAddress = selectedToken === 'DOGE' 
  ? '0x0000000000000000000000000000000000000000'
  : shieldedPool.supportedTokens[selectedToken]?.address

// Add to request
const response = await fetch(`${RELAYER_URL}/api/shielded/relay/unshield`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    poolAddress: SHIELDED_POOL_ADDRESS,
    proof: proofResult.proof.proof,
    root: proofResult.root,
    nullifierHash: proofResult.nullifierHash,
    recipient: recipientAddress,
    amount: proofResult.amount.toString(),
    fee: relayerFeeWei.toString(),
    token: tokenAddress,  // NEW
  }),
})
```

---

## Summary

To support ERC20 token unshielding, you need to:

1. **Backend**: Add `token` parameter and conditional logic to call `unshieldToken()` for ERC20 tokens
2. **Frontend**: Pass token address in the request body
3. **Relayer Balance**: Ensure relayer has DOGE for gas (ERC20 fees are separate)
4. **Testing**: Test with all supported ERC20 tokens

The contract already supports this - it's just a matter of updating the relayer and frontend to use it!

