/**
 * FINAL DEPLOYMENT: Deploy ALL verifiers and pool contract
 * 
 * This script:
 * 1. Deploys all verifiers (Shield, Transfer, Unshield, Swap)
 * 2. Deploys the ShieldedPoolMultiTokenV3 with all verifiers
 * 3. Configures supported tokens
 * 
 * This is the FINAL deployment - all verifiers are generated from correct zkeys
 * and match their circuit's public input counts.
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("FINAL DEPLOYMENT: All Verifiers + Pool");
  console.log("=".repeat(80));
  console.log("\n⚠️  This will deploy NEW contracts. Old contracts will remain.");
  console.log("   Users must unshield from old pool and shield into new pool.\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "DOGE\n");

  // ============ Step 1: Deploy All Verifiers ============

  console.log("=".repeat(80));
  console.log("STEP 1: Deploying All Verifiers");
  console.log("=".repeat(80));
  console.log("");

  // Deploy ShieldVerifier (2 public inputs)
  console.log("📦 Deploying ShieldVerifier (2 public inputs)...");
  const ShieldVerifier = await ethers.getContractFactory("ShieldVerifier");
  const shieldVerifier = await ShieldVerifier.deploy();
  await shieldVerifier.waitForDeployment();
  const SHIELD_VERIFIER = await shieldVerifier.getAddress();
  console.log("✅ ShieldVerifier deployed to:", SHIELD_VERIFIER);
  console.log("");

  // Deploy TransferVerifier (6 public inputs)
  console.log("📦 Deploying TransferVerifier (6 public inputs)...");
  const TransferVerifier = await ethers.getContractFactory("src/TransferVerifier.sol:TransferVerifier");
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  const TRANSFER_VERIFIER = await transferVerifier.getAddress();
  console.log("✅ TransferVerifier deployed to:", TRANSFER_VERIFIER);
  console.log("");

  // Deploy UnshieldVerifier (7 public inputs - V3 with changeCommitment)
  console.log("📦 Deploying UnshieldVerifier (7 public inputs - V3)...");
  const UnshieldVerifier = await ethers.getContractFactory("UnshieldVerifier");
  const unshieldVerifier = await UnshieldVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  const UNSHIELD_VERIFIER = await unshieldVerifier.getAddress();
  console.log("✅ UnshieldVerifier deployed to:", UNSHIELD_VERIFIER);
  console.log("");

  // Deploy SwapVerifier (8 public inputs)
  console.log("📦 Deploying SwapVerifier (8 public inputs)...");
  const SwapVerifier = await ethers.getContractFactory("SwapVerifier");
  const swapVerifier = await SwapVerifier.deploy();
  await swapVerifier.waitForDeployment();
  const SWAP_VERIFIER = await swapVerifier.getAddress();
  console.log("✅ SwapVerifier deployed to:", SWAP_VERIFIER);
  console.log("");

  // TransferMultiVerifier (not deployed yet - use zero address)
  const TRANSFER_MULTI_VERIFIER = ethers.ZeroAddress;

  // Hasher address (reuse existing)
  const HASHER = "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D";

  // DEX Router (optional)
  const DEX_ROUTER = ethers.ZeroAddress;

  console.log("\n📋 Verifier Configuration:");
  console.log("├─ Shield Verifier:      ", SHIELD_VERIFIER, " (2 public inputs)");
  console.log("├─ Transfer Verifier:    ", TRANSFER_VERIFIER, " (6 public inputs)");
  console.log("├─ Unshield Verifier:    ", UNSHIELD_VERIFIER, " (7 public inputs - V3)");
  console.log("├─ Swap Verifier:        ", SWAP_VERIFIER, " (8 public inputs)");
  console.log("├─ Transfer Multi Verifier:", TRANSFER_MULTI_VERIFIER === ethers.ZeroAddress ? "None (not deployed)" : TRANSFER_MULTI_VERIFIER);
  console.log("├─ Hasher:               ", HASHER);
  console.log("└─ DEX Router:           ", DEX_ROUTER === ethers.ZeroAddress ? "None" : DEX_ROUTER);
  console.log("");

  // ============ Step 2: Deploy ShieldedPoolMultiTokenV3 ============

  console.log("=".repeat(80));
  console.log("STEP 2: Deploying ShieldedPoolMultiTokenV3");
  console.log("=".repeat(80));
  console.log("");

  const ShieldedPoolV3 = await ethers.getContractFactory("ShieldedPoolMultiTokenV3");
  const shieldedPool = await ShieldedPoolV3.deploy(
    HASHER,
    SHIELD_VERIFIER,
    TRANSFER_VERIFIER,
    UNSHIELD_VERIFIER,
    SWAP_VERIFIER,
    TRANSFER_MULTI_VERIFIER,
    DEX_ROUTER
  );
  await shieldedPool.waitForDeployment();
  const POOL_ADDRESS = await shieldedPool.getAddress();

  console.log("✅ ShieldedPoolMultiTokenV3 deployed to:", POOL_ADDRESS);
  console.log("");

  // ============ Step 3: Configure Supported Tokens ============

  console.log("=".repeat(80));
  console.log("STEP 3: Adding Supported Tokens");
  console.log("=".repeat(80));
  console.log("");

  const tokens = {
    WDOGE: "0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE",
    LBTC: "0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E",
    WETH: "0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000",
    USD1: "0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F",
    USDC: "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925",
    USDT: "0xC81800b77D91391Ef03d7868cB81204E753093a9"
  };

  for (const [symbol, address] of Object.entries(tokens)) {
    try {
      const tx = await shieldedPool.addSupportedToken(address);
      await tx.wait();
      console.log(`✅ Added ${symbol}: ${address}`);
    } catch (error: any) {
      console.error(`❌ Failed to add ${symbol}:`, error.message);
    }
  }

  console.log("");

  // ============ Step 4: Verification ============

  console.log("=".repeat(80));
  console.log("STEP 4: Verification");
  console.log("=".repeat(80));
  console.log("");

  // Verify verifier addresses in pool
  const poolShieldVerifier = await shieldedPool.shieldVerifier();
  const poolTransferVerifier = await shieldedPool.transferVerifier();
  const poolUnshieldVerifier = await shieldedPool.unshieldVerifier();
  const poolSwapVerifier = await shieldedPool.swapVerifier();

  console.log("Verifying verifier addresses in pool:");
  console.log(`  Shield:   ${poolShieldVerifier} ${poolShieldVerifier.toLowerCase() === SHIELD_VERIFIER.toLowerCase() ? '✅' : '❌'}`);
  console.log(`  Transfer: ${poolTransferVerifier} ${poolTransferVerifier.toLowerCase() === TRANSFER_VERIFIER.toLowerCase() ? '✅' : '❌'}`);
  console.log(`  Unshield: ${poolUnshieldVerifier} ${poolUnshieldVerifier.toLowerCase() === UNSHIELD_VERIFIER.toLowerCase() ? '✅' : '❌'}`);
  console.log(`  Swap:     ${poolSwapVerifier} ${poolSwapVerifier.toLowerCase() === SWAP_VERIFIER.toLowerCase() ? '✅' : '❌'}`);
  console.log("");

  // ============ Step 5: Summary ============

  console.log("=".repeat(80));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(80));
  console.log("");
  console.log("📦 Verifiers:");
  console.log(`   ShieldVerifier:   ${SHIELD_VERIFIER}`);
  console.log(`   TransferVerifier: ${TRANSFER_VERIFIER}`);
  console.log(`   UnshieldVerifier: ${UNSHIELD_VERIFIER}`);
  console.log(`   SwapVerifier:     ${SWAP_VERIFIER}`);
  console.log("");
  console.log("🏊 Pool:");
  console.log(`   ShieldedPoolMultiTokenV3: ${POOL_ADDRESS}`);
  console.log("");
  console.log("📝 Next Steps:");
  console.log("   1. Update lib/dogeos-config.ts with new pool address");
  console.log("   2. Update backend/src/config.ts with new pool address");
  console.log("   3. Update backend/.env with new pool address");
  console.log("   4. Update backend/render.yaml with new pool address");
  console.log("   5. Rebuild backend: cd backend && npm run build");
  console.log("   6. Test all operations: Shield, Transfer, Swap, Unshield");
  console.log("");
  console.log("✅ FINAL DEPLOYMENT COMPLETE!");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
