# V4 Deployment Guide

## Overview

This guide walks you through deploying ShieldedPoolMultiToken V4 with all security fixes.

## Prerequisites

1. **Environment Setup**
   - Node.js and npm/pnpm installed
   - Hardhat configured for DogeOS Testnet
   - Deployer account with at least 1.0 DOGE for gas

2. **Network Configuration**
   - Network: DogeOS Chikyū Testnet
   - Chain ID: 6281971
   - RPC: `https://rpc.testnet.dogeos.com`

3. **Required Files**
   - All contracts compiled (`npx hardhat compile`)
   - Verifier contracts with canonical point validation
   - Deployment script: `deploy-shielded-v4.ts`

## Deployment Steps

### Step 1: Compile Contracts

```bash
cd contracts
npx hardhat compile
```

Verify all contracts compile successfully (12 Solidity files).

### Step 2: Verify Verifiers Have Canonical Point Validation

All 4 verifiers must include canonical point validation:
- `ShieldVerifier.sol`
- `TransferVerifier.sol`
- `UnshieldVerifier.sol`
- `SwapVerifier.sol`

Check that each verifier's `verifyProof()` function includes:
```solidity
// Check if G1 point is in canonical form (y < (q-1)/2)
function checkCanonicalPoint(x, y) {
    let halfQ := div(sub(q, 1), 2)
    if gt(y, halfQ) {
        mstore(0, 0)
        return(0, 0x20)
    }
}
```

### Step 3: Set Environment Variables

Create/update `.env` file:
```bash
DOGEOS_RPC_URL=https://rpc.testnet.dogeos.com
PRIVATE_KEY=your_deployer_private_key_here
```

### Step 4: Deploy V4 Contract

```bash
cd contracts
npx hardhat run scripts/deploy-shielded-v4.ts --network dogeosTestnet
```

The script will:
1. Deploy all 4 verifiers (with canonical point validation)
2. Deploy ShieldedPoolMultiTokenV4 with `maxSwapSlippageBps = 500`
3. Initialize all V3 tokens (sets `wasEverSupported[token] = true`)
4. Verify deployment parameters

### Step 5: Verify Contracts on Block Explorer

After deployment, verify each contract:

```bash
# Verify Verifiers
npx hardhat verify --network dogeosTestnet <SHIELD_VERIFIER_ADDRESS>
npx hardhat verify --network dogeosTestnet <TRANSFER_VERIFIER_ADDRESS>
npx hardhat verify --network dogeosTestnet <UNSHIELD_VERIFIER_ADDRESS>
npx hardhat verify --network dogeosTestnet <SWAP_VERIFIER_ADDRESS>

# Verify Main Pool
npx hardhat verify --network dogeosTestnet <POOL_ADDRESS> \
  "<HASHER_ADDRESS>" \
  "<SHIELD_VERIFIER_ADDRESS>" \
  "<TRANSFER_VERIFIER_ADDRESS>" \
  "<UNSHIELD_VERIFIER_ADDRESS>" \
  "<SWAP_VERIFIER_ADDRESS>" \
  "<DEX_ROUTER_ADDRESS>" \
  500
```

### Step 6: Update Configuration Files

**1. Update `lib/dogeos-config.ts`:**
```typescript
export const shieldedPool = {
  address: '0x...' as `0x${string}`, // NEW V4 ADDRESS
  // ... rest of config
};
```

**2. Update `backend/src/config.ts`:**
```typescript
export const config = {
  contracts: {
    shieldedPool: '0x...', // NEW V4 ADDRESS
    // ... rest of config
  },
};
```

**3. Update `docs/docs/resources/contract-addresses.md`:**
- Update ShieldedPoolMultiToken address
- Update all verifier addresses
- Update version to V4

### Step 7: Post-Deployment Testing

Test all operations to ensure V4 works correctly:

#### Test 1: Shield Operation
```bash
# Shield 10 DOGE
# Verify commitment is added to Merkle tree
# Verify Shield event is emitted
```

#### Test 2: Transfer Operation
```bash
# Transfer 5 DOGE from one shielded address to another
# Verify both output commitments are unique
# Verify CommitmentAlreadyExists check works
```

#### Test 3: Partial Unshield
```bash
# Shield 10 DOGE
# Unshield 5 DOGE (partial)
# Verify:
#   - 5 DOGE received
#   - Change commitment is inserted into tree
#   - Change note is discoverable
```

#### Test 4: Swap Operation
```bash
# Swap 10 DOGE for USDC
# Verify:
#   - Platform fee (5 DOGE) is charged
#   - Swap rate validation works (rejects unrealistic rates)
#   - Output commitment is unique
```

#### Test 5: Rug Pull Prevention
```bash
# Shield USDC
# Owner removes USDC support
# Verify:
#   - User can still unshield USDC (wasEverSupported check)
#   - New shields of USDC are rejected
```

#### Test 6: Root Manipulation Protection
```bash
# Verify ROOT_HISTORY_SIZE = 500
# Perform 30 shield operations
# Verify old roots are still valid (not cycled out)
```

#### Test 7: Commitment Uniqueness
```bash
# Try to create duplicate commitment
# Verify CommitmentAlreadyExists error
```

## Deployment Checklist

- [ ] Contracts compiled successfully
- [ ] Verifiers have canonical point validation
- [ ] Deployer has sufficient DOGE balance (≥1.0 DOGE)
- [ ] V4 contract deployed
- [ ] All 4 verifiers deployed
- [ ] All V3 tokens initialized (wasEverSupported set)
- [ ] Contracts verified on block explorer
- [ ] Configuration files updated
- [ ] All operations tested (shield, transfer, unshield, swap)
- [ ] Security fixes verified
- [ ] Documentation updated

## Rollback Plan

If deployment fails or issues are discovered:

1. **Keep V3 Running**: V3 contract remains active at `0x05D32B760ff49678FD833a4E2AbD516586362b17`
2. **Update Configs Back**: Revert configuration files to V3 addresses
3. **Investigate Issues**: Check deployment logs and contract verification
4. **Fix and Redeploy**: Address issues and redeploy

## Important Notes

1. **Token Migration**: Users who shielded tokens in V3 can unshield them in V4 because `wasEverSupported` is set during initialization.

2. **Platform Fee**: V4 calculates platform fee internally (5 DOGE). Frontend can still send `platformFee` in request body, but it's ignored.

3. **Root History**: V4 has 500 root history slots (increased from 30). This prevents root manipulation attacks.

4. **Verifier Compatibility**: V4 verifiers include canonical point validation. Old proofs will still work, but new proofs must use canonical points.

5. **Gas Costs**: V4 includes HasherAdapter optimization (not currently used, but ready for future).

## Support

If you encounter issues during deployment:

1. Check deployment logs for errors
2. Verify network connectivity
3. Ensure sufficient gas balance
4. Review contract verification status
5. Check `audit/SMART_CONTRACT_AUDIT_FIXES.md` for fix details

## Security Fixes Summary

V4 includes 8 security fixes:

1. ✅ Swap Rate Validation (CRITICAL)
2. ✅ Rug Pull Prevention (CRITICAL)
3. ✅ Platform Fee Bypass Fix (HIGH)
4. ✅ Change Commitment Validation (HIGH)
5. ✅ Merkle Root Manipulation Protection (MEDIUM)
6. ✅ Commitment Uniqueness Checks (MEDIUM)
7. ✅ Proof Malleability Protection (LOW)
8. ✅ HasherAdapter Optimization (GAS)

See `audit/SMART_CONTRACT_AUDIT_FIXES.md` for detailed information.
