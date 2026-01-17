import { ethers } from "hardhat";

/**
 * Check which verifier addresses the deployed ShieldedPoolMultiTokenV3 is using
 */
async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("SHIELDED POOL V3 - VERIFIER ADDRESS CHECK");
  console.log("=".repeat(80));
  console.log("\nWallet:", signer.address);
  console.log("Network: DogeOS Chikyū Testnet\n");

  const POOL_ADDRESS = "0x6FdE88710d7D8974A040064a294A6a9aAE956D0F"; // NEW V3 Pool
  
  // ABI to read verifier addresses
  const poolABI = [
    "function shieldVerifier() public view returns (address)",
    "function transferVerifier() public view returns (address)",
    "function unshieldVerifier() public view returns (address)",
    "function swapVerifier() public view returns (address)",
  ];

  const expectedVerifiers = {
    shield: "0x2cD2A2126825fC8000C1AD2dFD25D15F8Cc365f1",
    transfer: "0xE523d6BBbB837bc4962F8AF497CdA322adF9B1d0", // NEW - Redeployed
    unshield: "0x3865bA5f2a3501960192139F3A503d9abf985fa6", // NEW - Redeployed
    swap: "0xE264695FF93e2baa700C3518227EBc917092bd3A",
  };

  try {
    const pool = new ethers.Contract(POOL_ADDRESS, poolABI, signer);
    
    console.log("Reading verifier addresses from pool contract...\n");
    
    const shieldVerifier = await pool.shieldVerifier();
    const transferVerifier = await pool.transferVerifier();
    const unshieldVerifier = await pool.unshieldVerifier();
    const swapVerifier = await pool.swapVerifier();
    
    console.log("Shield Verifier:");
    console.log("  Expected:  ", expectedVerifiers.shield);
    console.log("  Actual:    ", shieldVerifier);
    console.log("  Match:     ", shieldVerifier.toLowerCase() === expectedVerifiers.shield.toLowerCase() ? "✅" : "❌");
    
    console.log("\nTransfer Verifier:");
    console.log("  Expected:  ", expectedVerifiers.transfer);
    console.log("  Actual:    ", transferVerifier);
    console.log("  Match:     ", transferVerifier.toLowerCase() === expectedVerifiers.transfer.toLowerCase() ? "✅" : "❌");
    
    console.log("\nUnshield Verifier:");
    console.log("  Expected:  ", expectedVerifiers.unshield);
    console.log("  Actual:    ", unshieldVerifier);
    console.log("  Match:     ", unshieldVerifier.toLowerCase() === expectedVerifiers.unshield.toLowerCase() ? "✅" : "❌");
    
    console.log("\nSwap Verifier:");
    console.log("  Expected:  ", expectedVerifiers.swap);
    console.log("  Actual:    ", swapVerifier);
    console.log("  Match:     ", swapVerifier.toLowerCase() === expectedVerifiers.swap.toLowerCase() ? "✅" : "❌");
    
    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    
    const allMatch = 
      shieldVerifier.toLowerCase() === expectedVerifiers.shield.toLowerCase() &&
      transferVerifier.toLowerCase() === expectedVerifiers.transfer.toLowerCase() &&
      unshieldVerifier.toLowerCase() === expectedVerifiers.unshield.toLowerCase() &&
      swapVerifier.toLowerCase() === expectedVerifiers.swap.toLowerCase();
    
    if (allMatch) {
      console.log("\n✅ All verifier addresses match!");
      console.log("⚠️  If InvalidProof() persists, the verifier contracts themselves may not match the zkeys.");
      console.log("   Need to verify the deployed verifier contract bytecode matches the source.");
    } else {
      console.log("\n❌ Verifier address mismatch detected!");
      console.log("   The pool contract is using different verifier addresses than expected.");
    }
    
  } catch (error: any) {
    console.error("❌ Error reading contract:", error.message);
    console.error("\nThis might mean:");
    console.error("1. The contract address is wrong");
    console.error("2. The contract doesn't have these functions");
    console.error("3. Network/RPC issue");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
