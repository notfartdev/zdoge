import { ethers } from "hardhat";

/**
 * Redeploy V4 Verifiers WITHOUT Canonical Point Validation
 * 
 * Issue: Canonical point validation rejects valid snarkjs proofs
 * snarkjs does not guarantee proofs are in canonical form (y < (q-1)/2)
 * Both y and -y mod q are valid, and snarkjs can generate either
 * 
 * Fix: Remove canonical point validation from all verifiers
 * Nullifier mechanism already prevents double-spending (main security concern)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("Redeploying V4 Verifiers (Canonical Point Validation Removed)");
  console.log("=".repeat(80));
  console.log("\n📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "DOGE");
  
  if (balance < ethers.parseEther("0.5")) {
    console.error("\n❌ Insufficient balance! Need at least 0.5 DOGE");
    process.exit(1);
  }

  // ============ Deploy Verifiers WITHOUT Canonical Point Validation ============
  
  console.log("\n🔨 Deploying verifiers (canonical validation removed)...");
  
  // Deploy ShieldVerifier
  console.log("\n[1/4] Deploying ShieldVerifier...");
  const ShieldVerifier = await ethers.getContractFactory("src/ShieldVerifier.sol:ShieldVerifier");
  const shieldVerifier = await ShieldVerifier.deploy();
  await shieldVerifier.waitForDeployment();
  const SHIELD_VERIFIER = await shieldVerifier.getAddress();
  console.log("✅ ShieldVerifier deployed to:", SHIELD_VERIFIER);

  // Deploy TransferVerifier
  console.log("\n[2/4] Deploying TransferVerifier...");
  const TransferVerifier = await ethers.getContractFactory("src/TransferVerifier.sol:TransferVerifier");
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  const TRANSFER_VERIFIER = await transferVerifier.getAddress();
  console.log("✅ TransferVerifier deployed to:", TRANSFER_VERIFIER);

  // Deploy UnshieldVerifier
  console.log("\n[3/4] Deploying UnshieldVerifier...");
  const UnshieldVerifier = await ethers.getContractFactory("src/UnshieldVerifier.sol:UnshieldVerifier");
  const unshieldVerifier = await UnshieldVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  const UNSHIELD_VERIFIER = await unshieldVerifier.getAddress();
  console.log("✅ UnshieldVerifier deployed to:", UNSHIELD_VERIFIER);

  // Deploy SwapVerifier
  console.log("\n[4/4] Deploying SwapVerifier...");
  const SwapVerifier = await ethers.getContractFactory("src/SwapVerifier.sol:SwapVerifier");
  const swapVerifier = await SwapVerifier.deploy();
  await swapVerifier.waitForDeployment();
  const SWAP_VERIFIER = await swapVerifier.getAddress();
  console.log("✅ SwapVerifier deployed to:", SWAP_VERIFIER);

  // ============ Summary ============
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ VERIFIERS REDEPLOYED (Canonical Validation Removed)");
  console.log("=".repeat(80));
  console.log("\n📝 New Verifier Addresses:");
  console.log("ShieldVerifier:   ", SHIELD_VERIFIER);
  console.log("TransferVerifier: ", TRANSFER_VERIFIER);
  console.log("UnshieldVerifier: ", UNSHIELD_VERIFIER);
  console.log("SwapVerifier:     ", SWAP_VERIFIER);
  
  console.log("\n⚠️  IMPORTANT: Update ShieldedPoolMultiTokenV4 to use new verifiers!");
  console.log("   The pool contract needs to be updated with these new verifier addresses.");
  console.log("   Option 1: Deploy new V4 pool with new verifiers");
  console.log("   Option 2: If pool has setter functions, update verifier addresses");
  
  console.log("\n🔗 Verification Commands:");
  console.log(`npx hardhat verify --network dogeosTestnet ${SHIELD_VERIFIER}`);
  console.log(`npx hardhat verify --network dogeosTestnet ${TRANSFER_VERIFIER}`);
  console.log(`npx hardhat verify --network dogeosTestnet ${UNSHIELD_VERIFIER}`);
  console.log(`npx hardhat verify --network dogeosTestnet ${SWAP_VERIFIER}`);
  
  console.log("\n🌐 Block Explorer:");
  console.log(`ShieldVerifier: https://blockscout.testnet.dogeos.com/address/${SHIELD_VERIFIER}`);
  console.log(`TransferVerifier: https://blockscout.testnet.dogeos.com/address/${TRANSFER_VERIFIER}`);
  console.log(`UnshieldVerifier: https://blockscout.testnet.dogeos.com/address/${UNSHIELD_VERIFIER}`);
  console.log(`SwapVerifier: https://blockscout.testnet.dogeos.com/address/${SWAP_VERIFIER}`);
  
  console.log("\n" + "=".repeat(80));
  
  return {
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
