# Regenerate SwapVerifier After Circuit Changes

When the swap circuit (`swap.circom`) is modified, the SwapVerifier contract must be regenerated and redeployed to match.

## Quick Steps

1. **Regenerate Verifier Contract:**
   ```powershell
   cd circuits/shielded
   .\regenerate-swap-verifier.ps1
   ```

2. **Deploy New SwapVerifier:**
   ```powershell
   cd contracts
   npx hardhat run scripts/deploy-swap-verifier-only.ts --network dogeosTestnet
   ```

3. **Update Config:**
   Edit `lib/dogeos-config.ts` with the new SwapVerifier address:
   ```typescript
   swapVerifier: '0x...' as `0x${string}`, // New address from step 2
   ```

4. **Redeploy ShieldedPoolMultiToken:**
   ```powershell
   cd contracts
   npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet
   ```
   
   The deployment script will automatically use the updated `SwapVerifier.sol` from `contracts/src/`.

5. **Update Config Again:**
   Edit `lib/dogeos-config.ts` with the new ShieldedPoolMultiToken address and all verifier addresses.

## What Changed?

The swap circuit was updated with:
- **Domain separator fix**: Changed from `0` to `2` for owner hash (matches `DOMAIN.SHIELDED_ADDRESS`)
- **Nullifier hash fix**: Changed from `MiMC(nullifier, 0)` to `MiMC(nullifier, nullifier)` (matches client-side computation)

These changes require a new verification key, hence a new verifier contract.

## Verification

After deployment, test a swap:
1. Shield tokens into the new contract
2. Generate a swap proof (should succeed)
3. Submit swap transaction (should verify correctly)

If you see `InvalidProof()` error after these steps, the verifier still doesn't match the circuit.
