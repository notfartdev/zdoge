/**
 * Production Deployment Script for Shielded Pool
 * 
 * This is the complete deployment for DogeOS Chikyū Testnet.
 * 
 * Prerequisites:
 * 1. Environment variables:
 *    - PRIVATE_KEY: Deployer wallet private key
 *    - SHIELD_VERIFIER_ADDRESS (optional, if already deployed)
 *    - TRANSFER_VERIFIER_ADDRESS (optional, if already deployed)
 *    - UNSHIELD_VERIFIER_ADDRESS (optional, if already deployed)
 * 
 * 2. Compiled circuits in:
 *    - circuits/shielded/build/ShieldVerifier.sol
 *    - circuits/shielded/build/TransferVerifier.sol
 *    - circuits/shielded/build/UnshieldVerifier.sol
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-production.ts --network dogeosTestnet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// DogeOS Chikyū Testnet config
const CONFIG = {
  // Existing Hasher from mixer deployment
  HASHER_ADDRESS: "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D",
  
  // Merkle tree depth (20 levels = ~1M notes)
  MERKLE_TREE_LEVELS: 20,
  
  // Wait for confirmations
  CONFIRMATIONS: 2,
};

interface DeploymentResult {
  shieldedPool: string;
  shieldVerifier: string;
  transferVerifier: string;
  unshieldVerifier: string;
  hasher: string;
  deployer: string;
  network: string;
  timestamp: string;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("     DOGENADO SHIELDED POOL - PRODUCTION DEPLOYMENT");
  console.log("═══════════════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "DOGE\n");

  if (balance < ethers.parseEther("10")) {
    console.log("⚠️  Warning: Low balance. Deployment may fail.");
    console.log("    Need at least 10 DOGE for deployment gas.\n");
  }

  // ============ Step 1: Deploy or use existing verifiers ============
  
  console.log("Step 1: Verifier Contracts\n");
  
  let shieldVerifierAddr = process.env.SHIELD_VERIFIER_ADDRESS || "";
  let transferVerifierAddr = process.env.TRANSFER_VERIFIER_ADDRESS || "";
  let unshieldVerifierAddr = process.env.UNSHIELD_VERIFIER_ADDRESS || "";
  
  // Check if verifiers exist
  const needVerifiers = !shieldVerifierAddr || !transferVerifierAddr || !unshieldVerifierAddr;
  
  if (needVerifiers) {
    // Check if compiled verifiers exist
    const circuitBuildDir = path.join(__dirname, "../../circuits/shielded/build");
    const verifierFiles = [
      "ShieldVerifier.sol",
      "TransferVerifier.sol", 
      "UnshieldVerifier.sol"
    ];
    
    const allVerifiersExist = verifierFiles.every(f => 
      fs.existsSync(path.join(circuitBuildDir, f))
    );
    
    if (allVerifiersExist) {
      console.log("Found compiled verifier contracts in circuits/shielded/build/");
      console.log("Copy them to contracts/src/ and run: npx hardhat compile\n");
      console.log("Then deploy the verifiers manually or set environment variables.\n");
      
      // Check if they're in contracts/src
      const contractsSrc = path.join(__dirname, "../src");
      const verifiersInSrc = verifierFiles.every(f =>
        fs.existsSync(path.join(contractsSrc, f))
      );
      
      if (verifiersInSrc) {
        console.log("Verifiers found in contracts/src/, deploying...\n");
        
        // Deploy Shield Verifier
        console.log("Deploying ShieldVerifier...");
        const ShieldVerifier = await ethers.getContractFactory("Groth16Verifier");
        const shieldVerifier = await ShieldVerifier.deploy();
        await shieldVerifier.waitForDeployment();
        shieldVerifierAddr = await shieldVerifier.getAddress();
        console.log("  ✓ ShieldVerifier:", shieldVerifierAddr);
        
        // Note: In production, each circuit has its own verifier
        // For now, we'll use the same verifier for testing
        transferVerifierAddr = shieldVerifierAddr;
        unshieldVerifierAddr = shieldVerifierAddr;
        
        console.log("\n⚠️  Using same verifier for all circuits (testing only)\n");
      } else {
        console.log("Verifiers not in contracts/src/. Deploying mock verifiers...\n");
        await deployMockVerifiers();
        return;
      }
    } else {
      console.log("No compiled verifiers found. Building circuits first...\n");
      console.log("Run these commands:");
      console.log("  cd circuits/shielded");
      console.log("  chmod +x build.sh");
      console.log("  ./build.sh\n");
      console.log("Deploying mock verifiers for testing...\n");
      await deployMockVerifiers();
      return;
    }
  } else {
    console.log("Using provided verifier addresses:");
    console.log("  Shield:", shieldVerifierAddr);
    console.log("  Transfer:", transferVerifierAddr);
    console.log("  Unshield:", unshieldVerifierAddr);
    console.log("");
  }

  // ============ Step 2: Deploy ShieldedPool ============
  
  console.log("Step 2: Deploying ShieldedPool...\n");
  
  const ShieldedPool = await ethers.getContractFactory("ShieldedPool");
  const shieldedPool = await ShieldedPool.deploy(
    CONFIG.HASHER_ADDRESS,
    shieldVerifierAddr,
    transferVerifierAddr,
    unshieldVerifierAddr
  );
  
  console.log("  Transaction sent:", shieldedPool.deploymentTransaction()?.hash);
  console.log("  Waiting for confirmations...");
  
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  
  console.log("  ✓ ShieldedPool deployed:", poolAddress);
  console.log("");

  // ============ Step 3: Verify deployment ============
  
  console.log("Step 3: Verifying deployment...\n");
  
  // Check contract state
  const root = await shieldedPool.getLastRoot();
  const levels = await shieldedPool.levels();
  
  console.log("  Merkle tree levels:", levels.toString());
  console.log("  Initial root:", root);
  console.log("");

  // ============ Step 4: Save deployment info ============
  
  const deployment: DeploymentResult = {
    shieldedPool: poolAddress,
    shieldVerifier: shieldVerifierAddr,
    transferVerifier: transferVerifierAddr,
    unshieldVerifier: unshieldVerifierAddr,
    hasher: CONFIG.HASHER_ADDRESS,
    deployer: deployer.address,
    network: network.name || `chain-${network.chainId}`,
    timestamp: new Date().toISOString(),
  };
  
  // Save to file
  const deploymentPath = path.join(__dirname, `../deployments/shielded-${network.chainId}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  
  console.log("Step 4: Deployment saved to:", deploymentPath);
  console.log("");

  // ============ Output configuration ============
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("                 DEPLOYMENT COMPLETE! 🎉");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  console.log("Contract Addresses:");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  ShieldedPool:     ${poolAddress}`);
  console.log(`  ShieldVerifier:   ${shieldVerifierAddr}`);
  console.log(`  TransferVerifier: ${transferVerifierAddr}`);
  console.log(`  UnshieldVerifier: ${unshieldVerifierAddr}`);
  console.log("");
  
  console.log("Frontend Configuration (lib/dogeos-config.ts):");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`
  shieldedPool: {
    address: "${poolAddress}" as \`0x\${string}\`,
    shieldVerifier: "${shieldVerifierAddr}" as \`0x\${string}\`,
    transferVerifier: "${transferVerifierAddr}" as \`0x\${string}\`,
    unshieldVerifier: "${unshieldVerifierAddr}" as \`0x\${string}\`,
  },
  `);
  
  console.log("Backend Configuration (backend/src/config.ts):");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`
  contracts: {
    shieldedPool: "${poolAddress}",
  },
  `);
  
  console.log("Verify on Explorer:");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`npx hardhat verify --network dogeosTestnet ${poolAddress} \\`);
  console.log(`  ${CONFIG.MERKLE_TREE_LEVELS} \\`);
  console.log(`  ${CONFIG.HASHER_ADDRESS} \\`);
  console.log(`  ${shieldVerifierAddr} \\`);
  console.log(`  ${transferVerifierAddr} \\`);
  console.log(`  ${unshieldVerifierAddr}`);
  console.log("");
}

async function deployMockVerifiers() {
  console.log("Deploying mock verifiers (for testing only)...\n");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  const MockVerifier = await ethers.getContractFactory("MockVerifier");
  
  const shieldVerifier = await MockVerifier.deploy();
  await shieldVerifier.waitForDeployment();
  const shieldVerifierAddr = await shieldVerifier.getAddress();
  console.log("  ✓ Mock ShieldVerifier:", shieldVerifierAddr);
  
  const transferVerifier = await MockVerifier.deploy();
  await transferVerifier.waitForDeployment();
  const transferVerifierAddr = await transferVerifier.getAddress();
  console.log("  ✓ Mock TransferVerifier:", transferVerifierAddr);
  
  const unshieldVerifier = await MockVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  const unshieldVerifierAddr = await unshieldVerifier.getAddress();
  console.log("  ✓ Mock UnshieldVerifier:", unshieldVerifierAddr);
  
  console.log("");
  
  // Deploy pool with mock verifiers
  console.log("Deploying ShieldedPool with mock verifiers...\n");
  
  const ShieldedPool = await ethers.getContractFactory("ShieldedPool");
  const shieldedPool = await ShieldedPool.deploy(
    CONFIG.HASHER_ADDRESS,
    shieldVerifierAddr,
    transferVerifierAddr,
    unshieldVerifierAddr
  );
  
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  
  console.log("  ✓ ShieldedPool:", poolAddress);
  console.log("");
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("   ⚠️  MOCK DEPLOYMENT - FOR TESTING ONLY!");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log("This deployment uses mock verifiers that always return true.");
  console.log("DO NOT use in production!\n");
  
  console.log("For production, compile the circuits first:");
  console.log("  cd circuits/shielded");
  console.log("  chmod +x build.sh");
  console.log("  ./build.sh\n");
  
  const deployment = {
    shieldedPool: poolAddress,
    shieldVerifier: shieldVerifierAddr,
    transferVerifier: transferVerifierAddr,
    unshieldVerifier: unshieldVerifierAddr,
    hasher: CONFIG.HASHER_ADDRESS,
    deployer: deployer.address,
    network: `chain-${network.chainId}`,
    timestamp: new Date().toISOString(),
    isMock: true,
  };
  
  const deploymentPath = path.join(__dirname, `../deployments/shielded-mock-${network.chainId}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  
  console.log("Deployment saved to:", deploymentPath);
  console.log("");
  
  console.log(`ShieldedPool (MOCK): ${poolAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

