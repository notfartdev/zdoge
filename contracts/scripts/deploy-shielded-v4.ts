import { ethers } from "hardhat";

/**
 * Deploy ShieldedPoolMultiTokenV4 to DogeOS Chikyū Testnet
 * 
 * V4 Features (Security Fixes):
 * - ✅ Swap rate validation (prevents pool draining)
 * - ✅ Rug pull prevention (wasEverSupported mapping)
 * - ✅ Platform fee enforcement (calculated internally, 5 DOGE)
 * - ✅ Change commitment validation (partial unshield fix)
 * - ✅ Merkle root manipulation protection (500 root history)
 * - ✅ Commitment uniqueness checks (prevents duplicates)
 * - ✅ Proof malleability protection (canonical point validation)
 * - ✅ HasherAdapter optimization (gas savings)
 * 
 * Network Info:
 * - Chain ID: 6281971
 * - RPC: https://rpc.testnet.dogeos.com
 * - Explorer: https://blockscout.testnet.dogeos.com
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("ZDOGE - ShieldedPoolMultiTokenV4 Deployment");
  console.log("DogeOS Chikyū Testnet - Security Fixes");
  console.log("=".repeat(80));
  console.log("\n📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "DOGE");
  
  if (balance < ethers.parseEther("1.0")) {
    console.error("\n❌ Insufficient balance! Need at least 1.0 DOGE for deployment");
    console.log("🚰 Get testnet DOGE from: https://faucet.testnet.dogeos.com");
    process.exit(1);
  }

  // ============ Deploy Verifiers with Canonical Point Validation ============
  
  console.log("\n🔨 Deploying verifiers with canonical point validation...");
  
  // Deploy ShieldVerifier (using fully qualified name to avoid ambiguity)
  console.log("\n[1/4] Deploying ShieldVerifier...");
  const ShieldVerifier = await ethers.getContractFactory("src/ShieldVerifier.sol:ShieldVerifier");
  const shieldVerifier = await ShieldVerifier.deploy();
  await shieldVerifier.waitForDeployment();
  const SHIELD_VERIFIER = await shieldVerifier.getAddress();
  console.log("✅ ShieldVerifier deployed to:", SHIELD_VERIFIER);

  // Deploy TransferVerifier (using fully qualified name to avoid ambiguity)
  console.log("\n[2/4] Deploying TransferVerifier...");
  const TransferVerifier = await ethers.getContractFactory("src/TransferVerifier.sol:TransferVerifier");
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  const TRANSFER_VERIFIER = await transferVerifier.getAddress();
  console.log("✅ TransferVerifier deployed to:", TRANSFER_VERIFIER);

  // Deploy UnshieldVerifier (using fully qualified name to avoid ambiguity)
  console.log("\n[3/4] Deploying UnshieldVerifier...");
  const UnshieldVerifier = await ethers.getContractFactory("src/UnshieldVerifier.sol:UnshieldVerifier");
  const unshieldVerifier = await UnshieldVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  const UNSHIELD_VERIFIER = await unshieldVerifier.getAddress();
  console.log("✅ UnshieldVerifier deployed to:", UNSHIELD_VERIFIER);

  // Deploy SwapVerifier (using fully qualified name to avoid ambiguity)
  console.log("\n[4/4] Deploying SwapVerifier...");
  const SwapVerifier = await ethers.getContractFactory("src/SwapVerifier.sol:SwapVerifier");
  const swapVerifier = await SwapVerifier.deploy();
  await swapVerifier.waitForDeployment();
  const SWAP_VERIFIER = await swapVerifier.getAddress();
  console.log("✅ SwapVerifier deployed to:", SWAP_VERIFIER);

  // ============ Configuration ============
  
  // Hasher address (reuse from V1 - NOT changing it to avoid breaking existing commitments)
  const HASHER = "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D";
  
  // DEX Router (optional - set to zero if not using DEX)
  const DEX_ROUTER = ethers.ZeroAddress; // No DEX for now
  
  // Max swap slippage: 500 basis points = 5%
  const MAX_SWAP_SLIPPAGE_BPS = 500;
  
  console.log("\n📋 Configuration:");
  console.log("├─ Shield Verifier:      ", SHIELD_VERIFIER, " ⭐ NEW (with canonical validation)");
  console.log("├─ Transfer Verifier:    ", TRANSFER_VERIFIER, " ⭐ NEW (with canonical validation)");
  console.log("├─ Unshield Verifier:    ", UNSHIELD_VERIFIER, " ⭐ NEW (with canonical validation)");
  console.log("├─ Swap Verifier:        ", SWAP_VERIFIER, " ⭐ NEW (with canonical validation)");
  console.log("├─ Hasher:               ", HASHER, " (reused from V1)");
  console.log("├─ DEX Router:           ", DEX_ROUTER === ethers.ZeroAddress ? "None" : DEX_ROUTER);
  console.log("└─ Max Swap Slippage:    ", MAX_SWAP_SLIPPAGE_BPS, "bps (5%)");

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
  
  console.log("\n🪙 Initializing token support (V3 tokens)...");
  console.log("⚠️  IMPORTANT: This sets wasEverSupported[token] = true");
  console.log("   Users who shielded tokens in V3 can unshield them in V4");
  
  const tokens = {
    NATIVE_DOGE: "0x0000000000000000000000000000000000000000", // Native DOGE
    WDOGE: "0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE",
    USDC: "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925",
    USDT: "0xC81800b77D91391Ef03d7868cB81204E753093a9",
    USD1: "0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F",
    WETH: "0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000",
    LBTC: "0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E"
  };
  
  // Note: Native DOGE is always supported, but we'll add it to wasEverSupported
  for (const [symbol, address] of Object.entries(tokens)) {
    if (address === "0x0000000000000000000000000000000000000000") {
      // Native DOGE - check if already supported (should be)
      const isSupported = await shieldedPool.supportedTokens(address);
      console.log(`├─ ${symbol} (${address})...`);
      if (!isSupported) {
        console.log("   ⚠️  Native DOGE should be supported by default, but it's not!");
      } else {
        console.log("   ✓ Native DOGE is supported");
      }
      // Still call addSupportedToken to set wasEverSupported
      const tx = await shieldedPool.addSupportedToken(address);
      await tx.wait();
      console.log("   ✓ wasEverSupported set for Native DOGE");
    } else {
      console.log(`├─ Adding ${symbol} (${address})...`);
      const tx = await shieldedPool.addSupportedToken(address);
      await tx.wait();
      console.log(`   ✓ ${symbol} added (supported + wasEverSupported)`);
    }
  }
  
  console.log("└─ All tokens initialized!");

  // ============ Verify Deployment ============
  
  console.log("\n📊 Verifying deployment...");
  
  // Verify maxSwapSlippageBps
  const maxSlippage = await shieldedPool.maxSwapSlippageBps();
  console.log("├─ Max Swap Slippage:    ", maxSlippage.toString(), "bps", maxSlippage === BigInt(MAX_SWAP_SLIPPAGE_BPS) ? "✓" : "✗");
  
  // Verify ROOT_HISTORY_SIZE
  const rootHistorySize = await shieldedPool.ROOT_HISTORY_SIZE();
  console.log("├─ Root History Size:    ", rootHistorySize.toString(), rootHistorySize === 500n ? "✓" : "✗");
  
  // Verify platform fee
  const platformFee = await shieldedPool.PLATFORM_FEE_DOGE();
  console.log("├─ Platform Fee:         ", ethers.formatEther(platformFee), "DOGE", platformFee === ethers.parseEther("5") ? "✓" : "✗");
  
  // Verify verifier addresses
  console.log("\n🔍 Verifying verifier addresses...");
  const shieldVerifierAddr = await shieldedPool.shieldVerifier();
  const transferVerifierAddr = await shieldedPool.transferVerifier();
  const unshieldVerifierAddr = await shieldedPool.unshieldVerifier();
  const swapVerifierAddr = await shieldedPool.swapVerifier();
  
  console.log("├─ Shield Verifier:  ", shieldVerifierAddr, shieldVerifierAddr === SHIELD_VERIFIER ? "✓" : "✗");
  console.log("├─ Transfer Verifier:", transferVerifierAddr, transferVerifierAddr === TRANSFER_VERIFIER ? "✓" : "✗");
  console.log("├─ Unshield Verifier:", unshieldVerifierAddr, unshieldVerifierAddr === UNSHIELD_VERIFIER ? "✓" : "✗");
  console.log("└─ Swap Verifier:    ", swapVerifierAddr, swapVerifierAddr === SWAP_VERIFIER ? "✓" : "✗");
  
  // Verify wasEverSupported for all tokens
  console.log("\n🔒 Verifying rug pull prevention (wasEverSupported)...");
  for (const [symbol, address] of Object.entries(tokens)) {
    const wasEverSupported = await shieldedPool.wasEverSupported(address);
    console.log(`${wasEverSupported ? "✓" : "✗"} ${symbol}:`, wasEverSupported ? "Protected" : "NOT PROTECTED!");
  }

  // ============ Summary ============
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ V4 DEPLOYMENT COMPLETE");
  console.log("=".repeat(80));
  console.log("\n📝 Contract Addresses:");
  console.log("ShieldedPoolMultiTokenV4:", poolAddress);
  console.log("ShieldVerifier:          ", SHIELD_VERIFIER);
  console.log("TransferVerifier:        ", TRANSFER_VERIFIER);
  console.log("UnshieldVerifier:        ", UNSHIELD_VERIFIER);
  console.log("SwapVerifier:            ", SWAP_VERIFIER);
  
  console.log("\n🔗 Verification Commands:");
  console.log(`# Verify Verifiers:`);
  console.log(`npx hardhat verify --network dogeosTestnet ${SHIELD_VERIFIER}`);
  console.log(`npx hardhat verify --network dogeosTestnet ${TRANSFER_VERIFIER}`);
  console.log(`npx hardhat verify --network dogeosTestnet ${UNSHIELD_VERIFIER}`);
  console.log(`npx hardhat verify --network dogeosTestnet ${SWAP_VERIFIER}`);
  console.log(`\n# Verify ShieldedPoolMultiTokenV4:`);
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
  console.log(`ShieldVerifier: https://blockscout.testnet.dogeos.com/address/${SHIELD_VERIFIER}`);
  console.log(`TransferVerifier: https://blockscout.testnet.dogeos.com/address/${TRANSFER_VERIFIER}`);
  console.log(`UnshieldVerifier: https://blockscout.testnet.dogeos.com/address/${UNSHIELD_VERIFIER}`);
  console.log(`SwapVerifier: https://blockscout.testnet.dogeos.com/address/${SWAP_VERIFIER}`);
  
  console.log("\n📚 Next Steps:");
  console.log("1. ✅ Update lib/dogeos-config.ts with new pool address");
  console.log("2. ✅ Update backend/src/config.ts (SHIELDED_POOL_ADDRESS)");
  console.log("3. ✅ Verify contracts on block explorer");
  console.log("4. ✅ Test all operations (shield, transfer, unshield, swap)");
  console.log("5. ✅ Verify platform fee is charged correctly (5 DOGE per swap)");
  console.log("6. ✅ Test partial unshield with change commitment");
  console.log("7. ✅ Test swap rate validation (should reject unrealistic rates)");
  console.log("8. ✅ Test rug pull prevention (remove token, verify users can still unshield)");
  
  console.log("\n💡 Security Fixes in V4:");
  console.log("🔒 Swap rate validation (prevents pool draining)");
  console.log("🔒 Rug pull prevention (wasEverSupported mapping)");
  console.log("🔒 Platform fee enforcement (5 DOGE, calculated internally)");
  console.log("🔒 Change commitment validation (partial unshield fix)");
  console.log("🔒 Merkle root manipulation protection (500 root history)");
  console.log("🔒 Commitment uniqueness checks (prevents duplicates)");
  console.log("🔒 Proof malleability protection (canonical point validation)");
  console.log("⚡ HasherAdapter optimization (gas savings)");
  
  console.log("\n" + "=".repeat(80));
  
  // Return addresses for potential script chaining
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
