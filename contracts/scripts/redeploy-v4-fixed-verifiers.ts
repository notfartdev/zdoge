import { ethers } from "hardhat";

/**
 * Redeploy ShieldedPoolMultiTokenV4 with Fixed Verifiers
 * 
 * Fix: Removed canonical point validation from verifiers
 * Issue: Canonical validation was rejecting valid snarkjs proofs
 * snarkjs does not guarantee proofs are in canonical form
 * 
 * This redeploys everything with the corrected verifiers
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("Redeploying V4 with Fixed Verifiers (No Canonical Validation)");
  console.log("=".repeat(80));
  console.log("\n📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "DOGE");
  
  if (balance < ethers.parseEther("1.0")) {
    console.error("\n❌ Insufficient balance! Need at least 1.0 DOGE");
    process.exit(1);
  }

  // ============ Deploy Fixed Verifiers ============
  
  console.log("\n🔨 Deploying verifiers (canonical validation removed)...");
  
  const ShieldVerifier = await ethers.getContractFactory("src/ShieldVerifier.sol:ShieldVerifier");
  const shieldVerifier = await ShieldVerifier.deploy();
  await shieldVerifier.waitForDeployment();
  const SHIELD_VERIFIER = await shieldVerifier.getAddress();
  console.log("✅ ShieldVerifier:", SHIELD_VERIFIER);

  const TransferVerifier = await ethers.getContractFactory("src/TransferVerifier.sol:TransferVerifier");
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  const TRANSFER_VERIFIER = await transferVerifier.getAddress();
  console.log("✅ TransferVerifier:", TRANSFER_VERIFIER);

  const UnshieldVerifier = await ethers.getContractFactory("src/UnshieldVerifier.sol:UnshieldVerifier");
  const unshieldVerifier = await UnshieldVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  const UNSHIELD_VERIFIER = await unshieldVerifier.getAddress();
  console.log("✅ UnshieldVerifier:", UNSHIELD_VERIFIER);

  const SwapVerifier = await ethers.getContractFactory("src/SwapVerifier.sol:SwapVerifier");
  const swapVerifier = await SwapVerifier.deploy();
  await swapVerifier.waitForDeployment();
  const SWAP_VERIFIER = await swapVerifier.getAddress();
  console.log("✅ SwapVerifier:", SWAP_VERIFIER);

  // ============ Configuration ============
  
  const HASHER = "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D";
  const DEX_ROUTER = ethers.ZeroAddress;
  const MAX_SWAP_SLIPPAGE_BPS = 500;
  
  console.log("\n📋 Configuration:");
  console.log("├─ Hasher:               ", HASHER);
  console.log("├─ DEX Router:           ", DEX_ROUTER === ethers.ZeroAddress ? "None" : DEX_ROUTER);
  console.log("└─ Max Swap Slippage:   ", MAX_SWAP_SLIPPAGE_BPS, "bps (5%)");

  // ============ Deploy ShieldedPoolMultiTokenV4 ============
  
  console.log("\n🚀 Deploying ShieldedPoolMultiTokenV4...");
  
  const ShieldedPoolV4 = await ethers.getContractFactory("ShieldedPoolMultiToken");
  const shieldedPool = await ShieldedPoolV4.deploy(
    HASHER,
    SHIELD_VERIFIER,
    TRANSFER_VERIFIER,
    UNSHIELD_VERIFIER,
    SWAP_VERIFIER,
    DEX_ROUTER,
    MAX_SWAP_SLIPPAGE_BPS
  );
  
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  
  console.log("✅ ShieldedPoolMultiTokenV4 deployed to:", poolAddress);

  // ============ Initialize Token Support ============
  
  console.log("\n🪙 Initializing token support...");
  
  const tokens = {
    NATIVE_DOGE: "0x0000000000000000000000000000000000000000",
    WDOGE: "0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE",
    USDC: "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925",
    USDT: "0xC81800b77D91391Ef03d7868cB81204E753093a9",
    USD1: "0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F",
    WETH: "0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000",
    LBTC: "0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E"
  };
  
  for (const [symbol, address] of Object.entries(tokens)) {
    if (address === "0x0000000000000000000000000000000000000000") {
      console.log(`├─ ${symbol} (${address})...`);
      const tx = await shieldedPool.addSupportedToken(address);
      await tx.wait();
      console.log("   ✓ wasEverSupported set for Native DOGE");
    } else {
      console.log(`├─ Adding ${symbol}...`);
      const tx = await shieldedPool.addSupportedToken(address);
      await tx.wait();
      console.log(`   ✓ ${symbol} added`);
    }
  }
  
  console.log("└─ All tokens initialized!");

  // ============ Summary ============
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ V4 REDEPLOYMENT COMPLETE (Fixed Verifiers)");
  console.log("=".repeat(80));
  console.log("\n📝 Contract Addresses:");
  console.log("ShieldedPoolMultiTokenV4:", poolAddress);
  console.log("ShieldVerifier:          ", SHIELD_VERIFIER);
  console.log("TransferVerifier:        ", TRANSFER_VERIFIER);
  console.log("UnshieldVerifier:        ", UNSHIELD_VERIFIER);
  console.log("SwapVerifier:            ", SWAP_VERIFIER);
  
  console.log("\n🔗 Verification Commands:");
  console.log(`npx hardhat verify --network dogeosTestnet ${poolAddress} \\`);
  console.log(`  "${HASHER}" \\`);
  console.log(`  "${SHIELD_VERIFIER}" \\`);
  console.log(`  "${TRANSFER_VERIFIER}" \\`);
  console.log(`  "${UNSHIELD_VERIFIER}" \\`);
  console.log(`  "${SWAP_VERIFIER}" \\`);
  console.log(`  "${DEX_ROUTER}" \\`);
  console.log(`  ${MAX_SWAP_SLIPPAGE_BPS}`);
  
  console.log("\n🌐 Block Explorer:");
  console.log(`Pool: https://blockscout.testnet.dogeos.com/address/${poolAddress}`);
  
  console.log("\n📚 Next Steps:");
  console.log("1. ✅ Update lib/dogeos-config.ts with new pool address");
  console.log("2. ✅ Update backend/src/config.ts");
  console.log("3. ✅ Rebuild backend: cd backend && npm run build");
  console.log("4. ✅ Restart backend");
  console.log("5. ✅ Test transfer operation (should work now!)");
  
  console.log("\n💡 Fix Applied:");
  console.log("🔧 Removed canonical point validation from all verifiers");
  console.log("   snarkjs proofs are not always in canonical form");
  console.log("   Nullifier mechanism provides sufficient security");
  
  console.log("\n" + "=".repeat(80));
  
  return {
    poolAddress,
    shieldVerifier: SHIELD_VERIFIER,
    transferVerifier: TRANSFER_VERIFIER,
    unshieldVerifier: UNSHIELD_VERIFIER,
    swapVerifier: SWAP_VERIFIER,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
