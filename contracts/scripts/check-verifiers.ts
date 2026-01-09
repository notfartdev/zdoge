import { ethers } from "hardhat";
import { config } from "../hardhat.config";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=".repeat(60));
  console.log("Checking Verifier Addresses in Deployed Contract");
  console.log("=".repeat(60));
  console.log("\nWallet:", signer.address);
  
  // Contract address from latest deployment
  const POOL_ADDRESS = process.env.POOL_ADDRESS || "0x2e93EC915E439920a770e5c9d8c207A6160929a8";
  
  console.log("\nPool Address:", POOL_ADDRESS);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  
  // Get contract instance
  const pool = await ethers.getContractAt("ShieldedPoolMultiToken", POOL_ADDRESS);
  
  try {
    // Query verifier addresses (these are public immutable variables)
    const shieldVerifier = await pool.shieldVerifier();
    const transferVerifier = await pool.transferVerifier();
    const unshieldVerifier = await pool.unshieldVerifier();
    const swapVerifier = await pool.swapVerifier();
    
    console.log("\n--- Verifier Addresses ---");
    console.log("Shield Verifier:   ", shieldVerifier);
    console.log("Transfer Verifier: ", transferVerifier);
    console.log("Unshield Verifier: ", unshieldVerifier);
    console.log("Swap Verifier:     ", swapVerifier);
    
    // Expected SwapVerifier from our latest deployment (matches new circuit)
    const EXPECTED_SWAP_VERIFIER = "0xE264695FF93e2baa700C3518227EBc917092bd3A";
    
    console.log("\n--- Verification ---");
    console.log("Expected SwapVerifier:", EXPECTED_SWAP_VERIFIER);
    console.log("Actual SwapVerifier:  ", swapVerifier);
    
    if (swapVerifier.toLowerCase() === EXPECTED_SWAP_VERIFIER.toLowerCase()) {
      console.log("\n✅ SwapVerifier matches! The contract should work with the updated circuit.");
    } else {
      console.log("\n❌ SwapVerifier MISMATCH!");
      console.log("   The deployed contract uses a different SwapVerifier.");
      console.log("   This means the contract's verifier doesn't match the new circuit.");
      console.log("\n   Options:");
      console.log("   1. Redeploy SwapVerifier with the new circuit");
      console.log("   2. Redeploy ShieldedPoolMultiToken with the new SwapVerifier");
      console.log("   ⚠️  Note: Redeployment means migrating funds from old contract!");
    }
    
  } catch (error: any) {
    console.error("\n❌ Error querying contract:", error.message);
    console.error("\nPossible causes:");
    console.error("  - Contract address is incorrect");
    console.error("  - Network is wrong (should be DogeOS Testnet)");
    console.error("  - Contract doesn't have public getter methods");
  }
  
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
