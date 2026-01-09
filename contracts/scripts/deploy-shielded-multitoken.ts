/**
 * Deploy ShieldedPoolMultiToken Contract
 * 
 * Complete deployment for multi-token shielded transactions.
 * Supports: Native DOGE + any ERC20 (USDC, USDT, WETH, LBTC)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-shielded-multitoken.ts --network dogeosTestnet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// DogeOS Testnet tokens
const TOKENS = {
  DOGE: '0x0000000000000000000000000000000000000000', // Native
  USDC: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925',
  USDT: '0xC81800b77D91391Ef03d7868cB81204E753093a9',
  USD1: '0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F',
  WETH: '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000',
  LBTC: '0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E',
};

const CONFIG = {
  HASHER_ADDRESS: "0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D",
  DEX_ROUTER: "", // Set to DEX router address if available
};

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   DOGENADO SHIELDED POOL (MULTI-TOKEN) - DEPLOYMENT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "DOGE\n");

  // ============ Step 1: Deploy Real ZK Verifiers ============
  
  console.log("Step 1: Deploying Real ZK Verifiers...\n");
  
  const ShieldVerifier = await ethers.getContractFactory("ShieldVerifier");
  const shieldVerifier = await ShieldVerifier.deploy();
  await shieldVerifier.waitForDeployment();
  console.log("  ✓ ShieldVerifier (real):", await shieldVerifier.getAddress());
  
  const TransferVerifier = await ethers.getContractFactory("TransferVerifier");
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  console.log("  ✓ TransferVerifier (real):", await transferVerifier.getAddress());
  
  const UnshieldVerifier = await ethers.getContractFactory("UnshieldVerifier");
  const unshieldVerifier = await UnshieldVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  console.log("  ✓ UnshieldVerifier (real):", await unshieldVerifier.getAddress());
  
    // Use pre-deployed SwapVerifier (matches updated circuit with change notes support)
    // This is the newly deployed SwapVerifier that supports outputCommitment2 (change notes)
    // Generated from the latest circuit rebuild (8 public inputs, change notes support)
    const swapVerifierAddress = process.env.SWAP_VERIFIER_ADDRESS || "0xE264695FF93e2baa700C3518227EBc917092bd3A";
    console.log("  ✓ SwapVerifier (using pre-deployed with change notes support):", swapVerifierAddress);
  
  console.log("");

  // ============ Step 2: Deploy ShieldedPoolMultiToken ============
  
  console.log("Step 2: Deploying ShieldedPoolMultiToken...\n");
  
  const ShieldedPool = await ethers.getContractFactory("ShieldedPoolMultiToken");
  const shieldedPool = await ShieldedPool.deploy(
    CONFIG.HASHER_ADDRESS,
    await shieldVerifier.getAddress(),
    await transferVerifier.getAddress(),
    await unshieldVerifier.getAddress(),
    swapVerifierAddress,
    CONFIG.DEX_ROUTER || ethers.ZeroAddress
  );
  
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  console.log("  ✓ ShieldedPoolMultiToken:", poolAddress);
  console.log("");

  // ============ Step 3: Add Supported Tokens ============
  
  console.log("Step 3: Adding Supported Tokens...\n");
  
  for (const [symbol, address] of Object.entries(TOKENS)) {
    if (address === ethers.ZeroAddress) {
      console.log(`  ✓ ${symbol}: Native (always supported)`);
      continue;
    }
    
    try {
      const tx = await shieldedPool.addSupportedToken(address);
      await tx.wait();
      console.log(`  ✓ ${symbol}: ${address}`);
    } catch (error: any) {
      console.log(`  ✗ ${symbol}: Failed - ${error.message}`);
    }
  }
  console.log("");

  // ============ Step 4: Verify Deployment ============
  
  console.log("Step 4: Verifying Deployment...\n");
  
  const [totalShielded, notesCount, currentRoot, isSupported] = await shieldedPool.getPoolInfo(ethers.ZeroAddress);
  console.log("  Merkle tree levels: 20 (hardcoded in contract)");
  console.log("  Initial root:", currentRoot);
  console.log("  DOGE supported:", isSupported);
  console.log("");

  // ============ Step 5: Save Deployment ============
  
  const deployment = {
    shieldedPool: poolAddress,
    shieldVerifier: await shieldVerifier.getAddress(),
    transferVerifier: await transferVerifier.getAddress(),
    unshieldVerifier: await unshieldVerifier.getAddress(),
    swapVerifier: swapVerifierAddress,
    hasher: CONFIG.HASHER_ADDRESS,
    supportedTokens: TOKENS,
    deployer: deployer.address,
    network: `chain-${network.chainId}`,
    timestamp: new Date().toISOString(),
    isMock: false,
  };
  
  const deploymentPath = path.join(__dirname, `../deployments/shielded-multitoken-${network.chainId}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  
  console.log("Deployment saved to:", deploymentPath);
  console.log("");

  // ============ Output ============
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    DEPLOYMENT COMPLETE! 🎉");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("Contract Address:");
  console.log(`  ShieldedPoolMultiToken: ${poolAddress}\n`);
  
  console.log("Supported Tokens:");
  for (const [symbol, address] of Object.entries(TOKENS)) {
    console.log(`  ${symbol}: ${address}`);
  }
  console.log("");
  
  console.log("Features:");
  console.log("  ✓ Multi-token support (DOGE + ERC20)");
  console.log("  ✓ Variable amounts (no fixed limits)");
  console.log("  ✓ Private transfers (z→z)");
  console.log("  ✓ Private swaps (z→z, different token)");
  console.log("  ✓ Auto-discovery via encrypted memos");
  console.log("  ✓ Real-time swap rates");
  console.log("");
  
  console.log("Update lib/dogeos-config.ts:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`
export const shieldedPool = {
  address: '${poolAddress}' as \`0x\${string}\`,
  shieldVerifier: '${await shieldVerifier.getAddress()}' as \`0x\${string}\`,
  transferVerifier: '${await transferVerifier.getAddress()}' as \`0x\${string}\`,
  unshieldVerifier: '${await unshieldVerifier.getAddress()}' as \`0x\${string}\`,
  swapVerifier: '${swapVerifierAddress}' as \`0x\${string}\`,
  // ... keep the rest
};
`);
  
  console.log("✅ PRODUCTION READY: Using real ZK verifiers!");
  console.log("All proofs are cryptographically verified on-chain.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

