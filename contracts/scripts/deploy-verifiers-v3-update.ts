import { ethers } from "hardhat";

/**
 * Deploy new TransferVerifier and UnshieldVerifierV3, then redeploy ShieldedPoolMultiTokenV3
 * 
 * This script should be run AFTER rebuilding transfer and unshield circuits with pot16.
 * It will:
 * 1. Deploy new TransferVerifier (from circuits/shielded/build/transferVerifier.sol)
 * 2. Deploy new UnshieldVerifierV3 (from circuits/shielded/build/unshieldVerifier.sol)
 * 3. Redeploy ShieldedPoolMultiTokenV3 with new verifier addresses
 * 
 * Prerequisites:
 * - transfer_final.zkey and unshield_final.zkey rebuilt with pot16
 * - TransferVerifier.sol and UnshieldVerifierV3.sol exported to contracts/src/verifiers/
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("ZDOGE - Verifier & V3 Contract Redeployment");
  console.log("DogeOS Chikyū Testnet");
  console.log("=".repeat(80));
  console.log("\n📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "DOGE");
  
  if (balance < ethers.parseEther("0.5")) {
    console.error("\n❌ Insufficient balance! Need at least 0.5 DOGE for deployment");
    process.exit(1);
  }

  // ============ Deploy New Verifiers ============
  
  console.log("\n🔨 Deploying new verifiers...");
  
  // Deploy TransferVerifier (new - rebuilt with pot16)
  console.log("\n[1/2] Deploying TransferVerifier...");
  const TransferVerifier = await ethers.getContractFactory("TransferVerifier");
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  const TRANSFER_VERIFIER_NEW = await transferVerifier.getAddress();
  console.log("✅ TransferVerifier deployed to:", TRANSFER_VERIFIER_NEW);

  // Deploy UnshieldVerifierV3 (new - rebuilt with pot16)
  console.log("\n[2/2] Deploying UnshieldVerifierV3...");
  const UnshieldVerifierV3 = await ethers.getContractFactory("UnshieldVerifierV3");
  const unshieldVerifierV3 = await UnshieldVerifierV3.deploy();
  await unshieldVerifierV3.waitForDeployment();
  const UNSHIELD_VERIFIER_V3_NEW = await unshieldVerifierV3.getAddress();
  console.log("✅ UnshieldVerifierV3 deployed to:", UNSHIELD_VERIFIER_V3_NEW);

  // ============ Configuration ============
  
  // Reuse existing verifiers (shield, swap are unchanged)
  const SHIELD_VERIFIER = "0x2cD2A2126825fC8000C1AD2dFD25D15F8Cc365f1";
  const SWAP_VERIFIER = "0xE264695FF93e2baa700C3518227EBc917092bd3A";
  const TRANSFER_MULTI_VERIFIER = ethers.ZeroAddress; // Not deployed yet
  
  // Hasher address (reuse from V1)
  const HASHER = "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D";
  
  // DEX Router (optional)
  const DEX_ROUTER = ethers.ZeroAddress;
  
  console.log("\n📋 Configuration:");
  console.log("├─ Shield Verifier:      ", SHIELD_VERIFIER, " (unchanged)");
  console.log("├─ Transfer Verifier:    ", TRANSFER_VERIFIER_NEW, " ⭐ NEW");
  console.log("├─ Unshield Verifier V3: ", UNSHIELD_VERIFIER_V3_NEW, " ⭐ NEW");
  console.log("├─ Swap Verifier:        ", SWAP_VERIFIER, " (unchanged)");
  console.log("├─ Transfer Multi Verifier:", TRANSFER_MULTI_VERIFIER === ethers.ZeroAddress ? "None" : TRANSFER_MULTI_VERIFIER);
  console.log("├─ Hasher:               ", HASHER);
  console.log("└─ DEX Router:           ", DEX_ROUTER === ethers.ZeroAddress ? "None" : DEX_ROUTER);

  // ============ Redeploy ShieldedPoolMultiTokenV3 ============
  
  console.log("\n🚀 Redeploying ShieldedPoolMultiTokenV3 with new verifiers...");
  
  const ShieldedPoolV3 = await ethers.getContractFactory("ShieldedPoolMultiTokenV3");
  const shieldedPool = await ShieldedPoolV3.deploy(
    HASHER,
    SHIELD_VERIFIER,
    TRANSFER_VERIFIER_NEW,  // NEW: Updated transfer verifier
    UNSHIELD_VERIFIER_V3_NEW,  // NEW: Updated unshield verifier
    SWAP_VERIFIER,
    TRANSFER_MULTI_VERIFIER,
    DEX_ROUTER
  );
  
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  
  console.log("✅ ShieldedPoolMultiTokenV3 redeployed to:", poolAddress);

  // ============ Configure Supported Tokens ============
  
  console.log("\n🪙 Adding supported tokens...");
  
  const tokens = {
    WDOGE: "0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE",
    LBTC: "0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E",
    WETH: "0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000",
    USD1: "0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F",
    USDC: "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925",
    USDT: "0xC81800b77D91391Ef03d7868cB81204E753093a9"
  };
  
  for (const [symbol, address] of Object.entries(tokens)) {
    console.log(`├─ Adding ${symbol} (${address})...`);
    const tx = await shieldedPool.addSupportedToken(address);
    await tx.wait();
    console.log(`   ✓ ${symbol} added`);
  }
  
  console.log("└─ All tokens added!");

  // ============ Verify Deployment ============
  
  console.log("\n📊 Verifying deployment...");
  
  const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const poolInfo = await shieldedPool.getPoolInfo(NATIVE_TOKEN);
  
  console.log("├─ Total Shielded (DOGE):", ethers.formatEther(poolInfo[0]), "DOGE");
  console.log("├─ Notes Count:          ", poolInfo[1].toString());
  console.log("├─ Current Root:         ", poolInfo[2]);
  console.log("└─ Is Supported (DOGE):  ", poolInfo[3]);

  // Verify verifier addresses
  console.log("\n🔍 Verifying verifier addresses...");
  const shieldVerifierAddr = await shieldedPool.shieldVerifier();
  const transferVerifierAddr = await shieldedPool.transferVerifier();
  const unshieldVerifierAddr = await shieldedPool.unshieldVerifier();
  const swapVerifierAddr = await shieldedPool.swapVerifier();
  
  console.log("├─ Shield Verifier:  ", shieldVerifierAddr, shieldVerifierAddr === SHIELD_VERIFIER ? "✓" : "✗");
  console.log("├─ Transfer Verifier:", transferVerifierAddr, transferVerifierAddr === TRANSFER_VERIFIER_NEW ? "✓" : "✗");
  console.log("├─ Unshield Verifier:", unshieldVerifierAddr, unshieldVerifierAddr === UNSHIELD_VERIFIER_V3_NEW ? "✓" : "✗");
  console.log("└─ Swap Verifier:    ", swapVerifierAddr, swapVerifierAddr === SWAP_VERIFIER ? "✓" : "✗");

  // ============ Summary ============
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(80));
  console.log("\n📝 Contract Addresses:");
  console.log("ShieldedPoolMultiTokenV3:", poolAddress);
  console.log("TransferVerifier:       ", TRANSFER_VERIFIER_NEW);
  console.log("UnshieldVerifierV3:     ", UNSHIELD_VERIFIER_V3_NEW);
  console.log("\n🔗 Verification Commands:");
  console.log(`# Verify TransferVerifier:`);
  console.log(`npx hardhat verify --network dogeosTestnet ${TRANSFER_VERIFIER_NEW}`);
  console.log(`\n# Verify UnshieldVerifierV3:`);
  console.log(`npx hardhat verify --network dogeosTestnet ${UNSHIELD_VERIFIER_V3_NEW}`);
  console.log(`\n# Verify ShieldedPoolMultiTokenV3:`);
  console.log(`npx hardhat verify --network dogeosTestnet ${poolAddress} \\`);
  console.log(`  "${HASHER}" \\`);
  console.log(`  "${SHIELD_VERIFIER}" \\`);
  console.log(`  "${TRANSFER_VERIFIER_NEW}" \\`);
  console.log(`  "${UNSHIELD_VERIFIER_V3_NEW}" \\`);
  console.log(`  "${SWAP_VERIFIER}" \\`);
  console.log(`  "${TRANSFER_MULTI_VERIFIER}" \\`);
  console.log(`  "${DEX_ROUTER}"`);
  
  console.log("\n🌐 Block Explorer:");
  console.log(`Pool: https://blockscout.testnet.dogeos.com/address/${poolAddress}`);
  console.log(`TransferVerifier: https://blockscout.testnet.dogeos.com/address/${TRANSFER_VERIFIER_NEW}`);
  console.log(`UnshieldVerifierV3: https://blockscout.testnet.dogeos.com/address/${UNSHIELD_VERIFIER_V3_NEW}`);
  
  console.log("\n📚 Next Steps:");
  console.log("1. Update lib/dogeos-config.ts with new addresses");
  console.log("2. Update backend/src/config.ts (SHIELDED_POOL_ADDRESS, TRANSFER_VERIFIER, UNSHIELD_VERIFIER)");
  console.log("3. Update backend/render.yaml (SHIELDED_POOL_ADDRESS)");
  console.log("4. Test transfer functionality");
  console.log("5. Test unshield functionality");
  
  console.log("\n💡 Important Notes:");
  console.log("⚠️  Old V3 contract at 0xa1090Bd1Ef3492AB3345B14E5BE5C044D5f6614b will be deprecated");
  console.log("⚠️  Users with shielded balance in old contract will need to unshield before migration");
  console.log("⚠️  Or implement a migration mechanism if needed");
  
  console.log("\n" + "=".repeat(80));
  
  return {
    poolAddress,
    transferVerifier: TRANSFER_VERIFIER_NEW,
    unshieldVerifierV3: UNSHIELD_VERIFIER_V3_NEW,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
