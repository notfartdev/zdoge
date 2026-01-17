import { ethers } from "hardhat";

/**
 * Redeploy UnshieldVerifier and ShieldedPoolMultiTokenV3 to fix unshield zkey mismatch
 * 
 * This script:
 * 1. Deploys a new UnshieldVerifier (generated from current zkey)
 * 2. Redeploys ShieldedPoolMultiTokenV3 with the new UnshieldVerifier
 * 3. Keeps all other verifiers unchanged (shield/transfer/swap continue working)
 * 
 * ⚠️ IMPORTANT: This creates a NEW pool contract. Old pool remains with existing balances.
 * Users must unshield from old pool and shield into new pool to use unshield.
 * 
 * Network: DogeOS Chikyū Testnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("ZDOGE - Unshield Fix: Redeploy UnshieldVerifier + ShieldedPoolMultiTokenV3");
  console.log("DogeOS Chikyū Testnet");
  console.log("=".repeat(80));
  console.log("\n📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "DOGE");
  
  if (balance < ethers.parseEther("0.2")) {
    console.error("\n❌ Insufficient balance! Need at least 0.2 DOGE for deployment");
    console.log("🚰 Get testnet DOGE from: https://faucet.testnet.dogeos.com");
    process.exit(1);
  }

  // ============ Step 1: Deploy New UnshieldVerifier ============
  
  console.log("\n" + "=".repeat(80));
  console.log("STEP 1: Deploying New UnshieldVerifier");
  console.log("=".repeat(80));
  console.log("\n⚠️  Make sure you've generated UnshieldVerifier.sol from the current zkey!");
  console.log("   Run: circuits/shielded/regenerate-unshield-verifier.ps1");
  console.log("   This ensures the verifier matches the current unshield_final.zkey\n");
  
  console.log("Deploying UnshieldVerifier...");
  const UnshieldVerifier = await ethers.getContractFactory("UnshieldVerifier");
  const unshieldVerifier = await UnshieldVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  const NEW_UNSHIELD_VERIFIER = await unshieldVerifier.getAddress();
  
  console.log("✅ New UnshieldVerifier deployed to:", NEW_UNSHIELD_VERIFIER);
  
  // ============ Step 2: Configuration ============
  
  console.log("\n" + "=".repeat(80));
  console.log("STEP 2: Configuration");
  console.log("=".repeat(80));
  
  // Reuse existing verifiers (shield, transfer, swap are unchanged)
  const SHIELD_VERIFIER = "0x2cD2A2126825fC8000C1AD2dFD25D15F8Cc365f1";
  const TRANSFER_VERIFIER = "0x0568BF5FaAEf348B71BdD18a05e1EC55a23459B2";
  const SWAP_VERIFIER = "0x3865bA5f2a3501960192139F3A503d9abf985fa6"; // From previous swap fix
  // OLD_UNSHIELD_VERIFIER = "0x7DFEa7a81B6f7098DB4a973b052A08899865b60b" (replaced)
  const TRANSFER_MULTI_VERIFIER = ethers.ZeroAddress; // Not deployed yet
  
  // Hasher address (reuse)
  const HASHER = "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D";
  
  // DEX Router (optional)
  const DEX_ROUTER = ethers.ZeroAddress;
  
  console.log("\n📋 Verifier Configuration:");
  console.log("├─ Shield Verifier:      ", SHIELD_VERIFIER, " (unchanged)");
  console.log("├─ Transfer Verifier:    ", TRANSFER_VERIFIER, " (unchanged)");
  console.log("├─ Swap Verifier:        ", SWAP_VERIFIER, " (unchanged)");
  console.log("├─ Unshield Verifier:    ", NEW_UNSHIELD_VERIFIER, " ⭐ NEW");
  console.log("├─ Transfer Multi Verifier:", TRANSFER_MULTI_VERIFIER === ethers.ZeroAddress ? "None" : TRANSFER_MULTI_VERIFIER);
  console.log("├─ Hasher:               ", HASHER);
  console.log("└─ DEX Router:           ", DEX_ROUTER === ethers.ZeroAddress ? "None" : DEX_ROUTER);
  
  // ============ Step 3: Deploy New ShieldedPoolMultiTokenV3 ============
  
  console.log("\n" + "=".repeat(80));
  console.log("STEP 3: Deploying New ShieldedPoolMultiTokenV3");
  console.log("=".repeat(80));
  console.log("\n⚠️  This creates a NEW pool contract with a NEW address.");
  console.log("   Old pool at 0x1B20e3f7cadc01C9B33C1ca76F7D28eBfcc6e63F will remain.");
  console.log("   Users must unshield from old pool and shield into new pool.\n");
  
  const ShieldedPoolV3 = await ethers.getContractFactory("ShieldedPoolMultiTokenV3");
  const shieldedPool = await ShieldedPoolV3.deploy(
    HASHER,
    SHIELD_VERIFIER,
    TRANSFER_VERIFIER,
    NEW_UNSHIELD_VERIFIER,  // NEW: Updated unshield verifier
    SWAP_VERIFIER,
    TRANSFER_MULTI_VERIFIER,
    DEX_ROUTER
  );
  
  await shieldedPool.waitForDeployment();
  const NEW_POOL_ADDRESS = await shieldedPool.getAddress();
  
  console.log("✅ New ShieldedPoolMultiTokenV3 deployed to:", NEW_POOL_ADDRESS);
  
  // ============ Step 4: Configure Supported Tokens ============
  
  console.log("\n" + "=".repeat(80));
  console.log("STEP 4: Adding Supported Tokens");
  console.log("=".repeat(80));
  
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
  
  // ============ Step 5: Verify Deployment ============
  
  console.log("\n" + "=".repeat(80));
  console.log("STEP 5: Verifying Deployment");
  console.log("=".repeat(80));
  
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
  
  console.log("├─ Shield Verifier:  ", shieldVerifierAddr, shieldVerifierAddr === SHIELD_VERIFIER ? "✅" : "❌");
  console.log("├─ Transfer Verifier:", transferVerifierAddr, transferVerifierAddr === TRANSFER_VERIFIER ? "✅" : "❌");
  console.log("├─ Unshield Verifier:", unshieldVerifierAddr, unshieldVerifierAddr === NEW_UNSHIELD_VERIFIER ? "✅" : "❌");
  console.log("└─ Swap Verifier:    ", swapVerifierAddr, swapVerifierAddr === SWAP_VERIFIER ? "✅" : "❌");
  
  // ============ Summary ============
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
  console.log("\n📝 New Contract Addresses:");
  console.log("ShieldedPoolMultiTokenV3:", NEW_POOL_ADDRESS);
  console.log("UnshieldVerifier:        ", NEW_UNSHIELD_VERIFIER);
  
  console.log("\n📝 Old Contract Addresses (still exists):");
  console.log("Old ShieldedPoolMultiTokenV3: 0x1B20e3f7cadc01C9B33C1ca76F7D28eBfcc6e63F");
  console.log("Old UnshieldVerifier:         0x7DFEa7a81B6f7098DB4a973b052A08899865b60b");
  
  console.log("\n🔗 Verification Commands:");
  console.log(`# Verify UnshieldVerifier:`);
  console.log(`npx hardhat verify --network dogeosTestnet ${NEW_UNSHIELD_VERIFIER}`);
  console.log(`\n# Verify ShieldedPoolMultiTokenV3:`);
  console.log(`npx hardhat verify --network dogeosTestnet ${NEW_POOL_ADDRESS} \\`);
  console.log(`  "${HASHER}" \\`);
  console.log(`  "${SHIELD_VERIFIER}" \\`);
  console.log(`  "${TRANSFER_VERIFIER}" \\`);
  console.log(`  "${NEW_UNSHIELD_VERIFIER}" \\`);
  console.log(`  "${SWAP_VERIFIER}" \\`);
  console.log(`  "${TRANSFER_MULTI_VERIFIER}" \\`);
  console.log(`  "${DEX_ROUTER}"`);
  
  console.log("\n🌐 Block Explorer:");
  console.log(`New Pool: https://blockscout.testnet.dogeos.com/address/${NEW_POOL_ADDRESS}`);
  console.log(`New UnshieldVerifier: https://blockscout.testnet.dogeos.com/address/${NEW_UNSHIELD_VERIFIER}`);
  
  console.log("\n" + "=".repeat(80));
  console.log("📋 NEXT STEPS:");
  console.log("=".repeat(80));
  console.log("\n1. Update lib/dogeos-config.ts:");
  console.log(`   shieldedPool.address: '${NEW_POOL_ADDRESS}'`);
  console.log("\n2. Update backend/src/config.ts:");
  console.log(`   SHIELDED_POOL_ADDRESS: '${NEW_POOL_ADDRESS}'`);
  console.log("\n3. Update backend/src/shielded/shielded-routes.ts:");
  console.log(`   Expected UnshieldVerifier: '${NEW_UNSHIELD_VERIFIER}'`);
  console.log("\n4. Update backend/render.yaml (if using):");
  console.log(`   SHIELDED_POOL_ADDRESS: ${NEW_POOL_ADDRESS}`);
  console.log("\n5. Restart backend server");
  console.log("\n6. Restart frontend development server");
  console.log("\n7. Test all operations:");
  console.log("   ✅ Shield (should work)");
  console.log("   ✅ Transfer (should work)");
  console.log("   ✅ Swap (should work)");
  console.log("   ✅ Unshield (should work now!)");
  console.log("\n8. Verify unshield works correctly");
  console.log("\n" + "=".repeat(80));
  console.log("🎉 Unshield should now work! All other operations continue working.");
  console.log("=".repeat(80));
  
  return {
    newPoolAddress: NEW_POOL_ADDRESS,
    newUnshieldVerifier: NEW_UNSHIELD_VERIFIER,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
