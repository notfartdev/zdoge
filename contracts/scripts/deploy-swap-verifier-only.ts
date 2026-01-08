/**
 * Deploy SwapVerifier Contract Only
 * 
 * This script deploys only the SwapVerifier contract.
 * Use this after regenerating SwapVerifier.sol from an updated circuit.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-swap-verifier-only.ts --network dogeosTestnet
 */

import { ethers } from "hardhat";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   DEPLOYING SWAP VERIFIER (FROM UPDATED CIRCUIT)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "DOGE\n");

  // Deploy SwapVerifier
  console.log("Deploying SwapVerifier...\n");
  
  const SwapVerifier = await ethers.getContractFactory("SwapVerifier");
  const swapVerifier = await SwapVerifier.deploy();
  await swapVerifier.waitForDeployment();
  
  const verifierAddress = await swapVerifier.getAddress();
  console.log("  ✓ SwapVerifier deployed to:", verifierAddress);
  console.log("");

  // Output
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    DEPLOYMENT COMPLETE! 🎉");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("SwapVerifier Address:");
  console.log(`  ${verifierAddress}\n`);
  
  console.log("⚠️  IMPORTANT: This verifier was generated from the updated circuit.");
  console.log("   It matches the circuit fixes (domain separator=2, nullifier hash fix).\n");
  
  console.log("Next steps:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("1. Update lib/dogeos-config.ts:");
  console.log(`   swapVerifier: '${verifierAddress}' as \`0x\${string}\`,`);
  console.log("");
  console.log("2. Update deploy-shielded-multitoken.ts to use this verifier:");
  console.log("   Replace SwapVerifier deployment with:");
  console.log(`   const swapVerifierAddress = '${verifierAddress}';`);
  console.log("");
  console.log("3. Redeploy ShieldedPoolMultiToken with this verifier:");
  console.log("   npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet");
  console.log("");
  console.log("4. Update lib/dogeos-config.ts with the new ShieldedPoolMultiToken address");
  console.log("");
  console.log("✅ Then swap functionality will work correctly!");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
