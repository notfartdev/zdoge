/**
 * Deploy ShieldedPool Contract
 * 
 * This script deploys the shielded pool for native DOGE.
 * 
 * Prerequisites:
 * 1. Build the circuits (circuits/shielded/build.sh)
 * 2. Deploy the verifier contracts (from build/*Verifier.sol)
 * 3. Have PRIVATE_KEY set in environment
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-shielded-pool.ts --network dogeosTestnet
 */

import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ShieldedPool...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "DOGE\n");

  // ============ Configuration ============
  
  // Use existing hasher from mixer deployment
  const HASHER_ADDRESS = "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D";
  
  // Merkle tree depth (20 = ~1M notes)
  const MERKLE_TREE_LEVELS = 20;
  
  // Verifier addresses - MUST be deployed first from generated Solidity
  // TODO: Deploy these from circuits/shielded/build/*Verifier.sol
  const SHIELD_VERIFIER = process.env.SHIELD_VERIFIER_ADDRESS || "";
  const TRANSFER_VERIFIER = process.env.TRANSFER_VERIFIER_ADDRESS || "";
  const UNSHIELD_VERIFIER = process.env.UNSHIELD_VERIFIER_ADDRESS || "";
  
  if (!SHIELD_VERIFIER || !TRANSFER_VERIFIER || !UNSHIELD_VERIFIER) {
    console.log("⚠️  Verifier addresses not set!");
    console.log("First deploy the verifiers from circuits/shielded/build/");
    console.log("");
    console.log("Set these environment variables:");
    console.log("  SHIELD_VERIFIER_ADDRESS=0x...");
    console.log("  TRANSFER_VERIFIER_ADDRESS=0x...");
    console.log("  UNSHIELD_VERIFIER_ADDRESS=0x...");
    console.log("");
    
    // For development, deploy mock verifiers that always return true
    console.log("Deploying mock verifiers for testing...\n");
    
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    
    const shieldVerifier = await MockVerifier.deploy();
    await shieldVerifier.waitForDeployment();
    console.log("Mock ShieldVerifier:", await shieldVerifier.getAddress());
    
    const transferVerifier = await MockVerifier.deploy();
    await transferVerifier.waitForDeployment();
    console.log("Mock TransferVerifier:", await transferVerifier.getAddress());
    
    const unshieldVerifier = await MockVerifier.deploy();
    await unshieldVerifier.waitForDeployment();
    console.log("Mock UnshieldVerifier:", await unshieldVerifier.getAddress());
    
    // Use mock addresses
    const shieldVerifierAddr = await shieldVerifier.getAddress();
    const transferVerifierAddr = await transferVerifier.getAddress();
    const unshieldVerifierAddr = await unshieldVerifier.getAddress();
    
    console.log("\nDeploying ShieldedPool with mock verifiers...");
    
    const ShieldedPool = await ethers.getContractFactory("ShieldedPool");
    const shieldedPool = await ShieldedPool.deploy(
      HASHER_ADDRESS,
      shieldVerifierAddr,
      transferVerifierAddr,
      unshieldVerifierAddr
    );
    
    await shieldedPool.waitForDeployment();
    const poolAddress = await shieldedPool.getAddress();
    
    console.log("\n✅ ShieldedPool deployed:", poolAddress);
    console.log("\n⚠️  WARNING: Using mock verifiers - NOT FOR PRODUCTION!");
    
    // Output configuration
    console.log("\n============ Configuration ============");
    console.log(`
// Add to lib/shielded/shielded-service.ts and components
const SHIELDED_POOL_ADDRESS = "${poolAddress}"

// Backend config (backend/src/config.ts)
shieldedPool: "${poolAddress}"
`);
    
    return;
  }
  
  // ============ Deploy with real verifiers ============
  
  console.log("Using verifiers:");
  console.log("  Shield:", SHIELD_VERIFIER);
  console.log("  Transfer:", TRANSFER_VERIFIER);
  console.log("  Unshield:", UNSHIELD_VERIFIER);
  console.log("");
  
  const ShieldedPool = await ethers.getContractFactory("ShieldedPool");
  const shieldedPool = await ShieldedPool.deploy(
    HASHER_ADDRESS,
    SHIELD_VERIFIER,
    TRANSFER_VERIFIER,
    UNSHIELD_VERIFIER
  );
  
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  
  console.log("\n✅ ShieldedPool deployed:", poolAddress);
  
  // Verify on explorer
  console.log("\nVerify on explorer:");
  console.log(`npx hardhat verify --network dogeosTestnet ${poolAddress} ${MERKLE_TREE_LEVELS} ${HASHER_ADDRESS} ${SHIELD_VERIFIER} ${TRANSFER_VERIFIER} ${UNSHIELD_VERIFIER}`);
  
  // Output configuration
  console.log("\n============ Configuration ============");
  console.log(`
// Frontend: Update lib/shielded/shielded-service.ts
const SHIELDED_POOL_ADDRESS = "${poolAddress}"

// Frontend: Update components/shielded/*-interface.tsx
const SHIELDED_POOL_ADDRESS = "${poolAddress}"

// Backend: Add to backend/src/config.ts
contracts: {
  ...
  shieldedPool: "${poolAddress}",
}
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

