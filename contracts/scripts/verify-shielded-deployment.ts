/**
 * Verify Shielded Pool Deployment
 * 
 * Tests all operations after deployment to ensure everything works:
 * 1. Shield native DOGE
 * 2. Check pool state
 * 3. Verify supported tokens
 * 
 * Usage:
 *   npx hardhat run scripts/verify-shielded-deployment.ts --network dogeosTestnet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ShieldedPoolABI = [
  "function shieldNative(bytes32 _commitment) external payable",
  "function shieldToken(address _token, uint256 _amount, bytes32 _commitment) external",
  "function getPoolInfo(address _token) external view returns (uint256, uint256, bytes32, bool)",
  "function supportedTokens(address _token) external view returns (bool)",
  "function totalShieldedBalance(address _token) external view returns (uint256)",
  "function isSpent(bytes32 _nullifierHash) external view returns (bool)",
  "event Shield(bytes32 indexed commitment, uint256 indexed leafIndex, address indexed token, uint256 amount, uint256 timestamp)",
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("      SHIELDED POOL DEPLOYMENT VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("Verifier:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "DOGE\n");

  // Load deployment info
  const deploymentPath = path.join(__dirname, `../deployments/shielded-multitoken-${network.chainId}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.log("❌ Deployment file not found:", deploymentPath);
    console.log("   Run deploy-shielded-multitoken.ts first.");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  console.log("Loaded deployment:", deploymentPath);
  console.log("Pool address:", deployment.shieldedPool);
  console.log("");

  const pool = new ethers.Contract(deployment.shieldedPool, ShieldedPoolABI, deployer);

  // ============ Test 1: Check Supported Tokens ============
  
  console.log("Test 1: Checking Supported Tokens...\n");
  
  const tokens = {
    DOGE: '0x0000000000000000000000000000000000000000',
    USDC: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925',
    USDT: '0xC81800b77D91391Ef03d7868cB81204E753093a9',
    WETH: '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000',
  };
  
  for (const [symbol, address] of Object.entries(tokens)) {
    try {
      const supported = await pool.supportedTokens(address);
      console.log(`  ${symbol}: ${supported ? '✓ Supported' : '✗ Not supported'}`);
    } catch (error: any) {
      console.log(`  ${symbol}: ✗ Error - ${error.message}`);
    }
  }
  console.log("");

  // ============ Test 2: Get Pool Info ============
  
  console.log("Test 2: Getting Pool Info...\n");
  
  try {
    const [totalShielded, notesCount, root, isSupported] = await pool.getPoolInfo(tokens.DOGE);
    console.log(`  Total shielded (DOGE): ${ethers.formatEther(totalShielded)} DOGE`);
    console.log(`  Notes count: ${notesCount}`);
    console.log(`  Current root: ${root}`);
    console.log(`  DOGE supported: ${isSupported}`);
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
  console.log("");

  // ============ Test 3: Test Shield (Optional) ============
  
  console.log("Test 3: Testing Shield (0.01 DOGE)...\n");
  
  if (balance < ethers.parseEther("0.1")) {
    console.log("  ⚠️  Skipping shield test - insufficient balance");
    console.log("     Need at least 0.1 DOGE for test + gas");
  } else {
    try {
      // Generate random commitment
      const commitment = ethers.randomBytes(32);
      const commitmentHex = ethers.hexlify(commitment);
      
      console.log(`  Commitment: ${commitmentHex.slice(0, 20)}...`);
      console.log("  Sending 0.01 DOGE...");
      
      const tx = await pool.shieldNative(commitmentHex, {
        value: ethers.parseEther("0.01"),
      });
      
      console.log(`  TX: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`  ✓ Shield successful! Block: ${receipt.blockNumber}`);
      
      // Parse event
      const shieldEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = pool.interface.parseLog(log);
          return parsed?.name === 'Shield';
        } catch {
          return false;
        }
      });
      
      if (shieldEvent) {
        const parsed = pool.interface.parseLog(shieldEvent);
        console.log(`  Leaf index: ${parsed?.args.leafIndex}`);
        console.log(`  Amount: ${ethers.formatEther(parsed?.args.amount || 0)} DOGE`);
      }
    } catch (error: any) {
      console.log(`  ✗ Shield failed: ${error.message}`);
    }
  }
  console.log("");

  // ============ Summary ============
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    VERIFICATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("Pool Status:");
  console.log(`  Address: ${deployment.shieldedPool}`);
  console.log(`  Mock Verifiers: ${deployment.isMock ? 'Yes (testing only)' : 'No (production ready)'}`);
  console.log("");
  
  if (deployment.isMock) {
    console.log("⚠️  WARNING: Using mock verifiers!");
    console.log("   For production:");
    console.log("   1. Build circuits: cd circuits/shielded && ./build.sh");
    console.log("   2. Deploy real verifiers from generated Solidity");
    console.log("   3. Redeploy pool with real verifier addresses");
  }
  
  console.log("");
  console.log("Frontend Config (add to lib/dogeos-config.ts):");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`
export const shieldedPool = {
  address: '${deployment.shieldedPool}' as \`0x\${string}\`,
  // ... (copy from deployment output)
};
`);
  
  console.log("Backend Config (set environment variable):");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`SHIELDED_POOL_ADDRESS=${deployment.shieldedPool}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });


