import { ethers } from "hardhat";

/**
 * Rebuild and redeploy TransferVerifier
 * 
 * This script should be run after rebuilding transfer_final.zkey with the correct PTAU file.
 * It will:
 * 1. Deploy the new TransferVerifier contract (from circuits/shielded/build/transferVerifier.sol)
 * 2. Update the ShieldedPoolMultiTokenV3 contract to use the new verifier
 * 
 * Prerequisites:
 * - transfer_final.zkey must be rebuilt with the correct PTAU
 * - TransferVerifier.sol must be exported from the new zkey
 * - TransferVerifier.sol must be in contracts/src/verifiers/TransferVerifier.sol
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("ZDOGE - TransferVerifier Rebuild & Redeploy");
  console.log("DogeOS Chikyū Testnet");
  console.log("=".repeat(80));
  console.log("\n📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "DOGE");
  
  if (balance < ethers.parseEther("0.2")) {
    console.error("\n❌ Insufficient balance! Need at least 0.2 DOGE for deployment");
    process.exit(1);
  }

  // ============ Deploy New TransferVerifier ============
  
  console.log("\n🔨 Deploying new TransferVerifier...");
  console.log("⚠️  Make sure TransferVerifier.sol was exported from the NEW transfer_final.zkey!");
  
  const TransferVerifier = await ethers.getContractFactory("TransferVerifier");
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  const TRANSFER_VERIFIER_NEW = await transferVerifier.getAddress();
  console.log("✅ TransferVerifier deployed to:", TRANSFER_VERIFIER_NEW);

  // ============ Update ShieldedPoolMultiTokenV3 ============
  
  const SHIELDED_POOL_V3 = "0xa1090Bd1Ef3492AB3345B14E5BE5C044D5f6614b";
  
  console.log("\n📝 Updating ShieldedPoolMultiTokenV3 to use new verifier...");
  console.log("⚠️  NOTE: The V3 contract uses immutable verifiers!");
  console.log("⚠️  You cannot update the verifier address on the existing contract.");
  console.log("⚠️  You must deploy a NEW ShieldedPoolMultiTokenV3 contract with the new verifier.");
  
  console.log("\n📋 New Configuration:");
  console.log("├─ Transfer Verifier (NEW):", TRANSFER_VERIFIER_NEW);
  console.log("└─ Shielded Pool V3:        ", SHIELDED_POOL_V3, " (needs redeployment)");
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ TRANSFER VERIFIER DEPLOYED");
  console.log("=".repeat(80));
  console.log("\n📝 Next Steps:");
  console.log("1. Update lib/dogeos-config.ts with new transferVerifier address");
  console.log("2. Update backend/src/config.ts (TRANSFER_VERIFIER)");
  console.log("3. Deploy NEW ShieldedPoolMultiTokenV3 with new verifier (or update if upgradeable)");
  console.log("4. Update all contract addresses in config files");
  console.log("5. Test transfer functionality");
  
  console.log("\n🌐 Block Explorer:");
  console.log(`TransferVerifier: https://blockscout.testnet.dogeos.com/address/${TRANSFER_VERIFIER_NEW}`);
  
  console.log("\n" + "=".repeat(80));
  
  return {
    transferVerifier: TRANSFER_VERIFIER_NEW,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
