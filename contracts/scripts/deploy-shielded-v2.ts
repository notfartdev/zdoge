import { ethers } from "hardhat";

/**
 * Deploy ShieldedPoolMultiTokenV2 to DogeOS Chikyū Testnet
 * 
 * Network Info:
 * - Chain ID: 6281971
 * - RPC: https://rpc.testnet.dogeos.com
 * - Explorer: https://blockscout.testnet.dogeos.com
 * - Faucet: https://faucet.testnet.dogeos.com
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("ZDOGE - ShieldedPoolMultiTokenV2 Deployment");
  console.log("DogeOS Chikyū Testnet");
  console.log("=".repeat(80));
  console.log("\n📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "DOGE");
  
  if (balance < ethers.parseEther("0.1")) {
    console.error("\n❌ Insufficient balance! Need at least 0.1 DOGE for deployment");
    console.log("🚰 Get testnet DOGE from: https://faucet.testnet.dogeos.com");
    process.exit(1);
  }

  // ============ Configuration ============
  
  // Existing verifier addresses (reuse from V1)
  const SHIELD_VERIFIER = "0x2cD2A2126825fC8000C1AD2dFD25D15F8Cc365f1";
  const TRANSFER_VERIFIER = "0x0568BF5FaAEf348B71BdD18a05e1EC55a23459B2";
  const UNSHIELD_VERIFIER = "0x7DFEa7a81B6f7098DB4a973b052A08899865b60b";
  const SWAP_VERIFIER = "0xE264695FF93e2baa700C3518227EBc917092bd3A";
  const TRANSFER_MULTI_VERIFIER = ethers.ZeroAddress; // Not deployed yet (using batchTransfer instead)
  
  // Hasher address (reuse from V1)
  const HASHER = "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D";
  
  // DEX Router (optional - set to zero if not using DEX)
  const DEX_ROUTER = ethers.ZeroAddress; // No DEX for now
  
  console.log("\n📋 Configuration:");
  console.log("├─ Shield Verifier:      ", SHIELD_VERIFIER);
  console.log("├─ Transfer Verifier:    ", TRANSFER_VERIFIER);
  console.log("├─ Unshield Verifier:    ", UNSHIELD_VERIFIER);
  console.log("├─ Swap Verifier:        ", SWAP_VERIFIER);
  console.log("├─ Transfer Multi Verifier:", TRANSFER_MULTI_VERIFIER === ethers.ZeroAddress ? "None (using batchTransfer)" : TRANSFER_MULTI_VERIFIER);
  console.log("├─ Hasher:               ", HASHER);
  console.log("└─ DEX Router:           ", DEX_ROUTER === ethers.ZeroAddress ? "None" : DEX_ROUTER);

  // ============ Deploy ShieldedPoolMultiTokenV2 ============
  
  console.log("\n🚀 Deploying ShieldedPoolMultiTokenV2...");
  
  const ShieldedPoolV2 = await ethers.getContractFactory("ShieldedPoolMultiTokenV2");
  const shieldedPool = await ShieldedPoolV2.deploy(
    HASHER,
    SHIELD_VERIFIER,
    TRANSFER_VERIFIER,
    UNSHIELD_VERIFIER,
    SWAP_VERIFIER,
    TRANSFER_MULTI_VERIFIER,
    DEX_ROUTER
  );
  
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  
  console.log("✅ ShieldedPoolMultiTokenV2 deployed to:", poolAddress);

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

  // ============ Verify Pool Info ============
  
  console.log("\n📊 Verifying deployment...");
  
  const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const poolInfo = await shieldedPool.getPoolInfo(NATIVE_TOKEN);
  
  console.log("├─ Total Shielded (DOGE):", ethers.formatEther(poolInfo[0]), "DOGE");
  console.log("├─ Notes Count:          ", poolInfo[1].toString());
  console.log("├─ Current Root:         ", poolInfo[2]);
  console.log("└─ Is Supported (DOGE):  ", poolInfo[3]);

  // ============ Summary ============
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(80));
  console.log("\n📝 Contract Addresses:");
  console.log("ShieldedPoolMultiTokenV2:", poolAddress);
  console.log("\n🔗 Verification Command:");
  console.log(`npx hardhat verify --network dogeosTestnet ${poolAddress} \\`);
  console.log(`  "${HASHER}" \\`);
  console.log(`  "${SHIELD_VERIFIER}" \\`);
  console.log(`  "${TRANSFER_VERIFIER}" \\`);
  console.log(`  "${UNSHIELD_VERIFIER}" \\`);
  console.log(`  "${SWAP_VERIFIER}" \\`);
  console.log(`  "${TRANSFER_MULTI_VERIFIER}" \\`);
  console.log(`  "${DEX_ROUTER}"`);
  
  console.log("\n🌐 Block Explorer:");
  console.log(`https://blockscout.testnet.dogeos.com/address/${poolAddress}`);
  
  console.log("\n📚 Next Steps:");
  console.log("1. Update lib/dogeos-config.ts with new address");
  console.log("2. Update backend/src/config.ts (SHIELDED_POOL_ADDRESS)");
  console.log("3. Verify contract on block explorer");
  console.log("4. Fund relayer wallet with DOGE");
  console.log("5. Test all functions (shield, transfer, unshield, swap)");
  console.log("6. Create migration UI for V1 users");
  
  console.log("\n💡 New Features in V2:");
  console.log("✨ Multi-note spending (batchTransfer)");
  console.log("✨ Emergency pause mechanism");
  console.log("✨ Enhanced privacy (minimal event data)");
  console.log("✨ Minimum amount validation (0.001 DOGE)");
  console.log("✨ Token blacklist for scam protection");
  console.log("✨ Batch unshield");
  console.log("✨ Optimized commitment checks");
  console.log("✨ Two-step ownership transfer");
  console.log("✨ Memo size limits (1KB max)");
  
  console.log("\n" + "=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
