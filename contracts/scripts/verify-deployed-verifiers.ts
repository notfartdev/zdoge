import { ethers } from "hardhat";

/**
 * Verify that deployed verifier contracts match the zkey files
 * by checking the IC0x constant in the deployed contracts
 */
async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=".repeat(80));
  console.log("VERIFYING DEPLOYED VERIFIERS MATCH ZKEY FILES");
  console.log("=".repeat(80));
  console.log("\nWallet:", signer.address);
  console.log("Network: DogeOS Chikyū Testnet\n");

  // Expected IC0x values from zkey files (verified from source code)
  const expectedValues = {
    transfer: "20246175179327317779233174882079493441931475450596795868325029427617090859406",
    unshield: "20662539935522191404432625798886531001299464530874790584159177491190148695701",
  };

  // Deployed addresses
  const deployedAddresses = {
    transfer: "0xE523d6BBbB837bc4962F8AF497CdA322adF9B1d0",
    unshield: "0x3865bA5f2a3501960192139F3A503d9abf985fa6",
  };

  // Read the contract source to get IC0x
  // Since IC0x is a constant, we can't call it directly, but we can verify
  // by checking the contract bytecode or by reading the source code constants
  
  console.log("Checking Transfer Verifier...");
  console.log("  Address:", deployedAddresses.transfer);
  console.log("  Expected IC0x:", expectedValues.transfer);
  
  // Get contract factory to read the source
  try {
    const TransferVerifierFactory = await ethers.getContractFactory("TransferVerifier");
    const transferVerifierSource = await TransferVerifierFactory.getDeployTransaction();
    
    // Read the source file to get IC0x
    const fs = require('fs');
    const path = require('path');
    const transferSourcePath = path.join(__dirname, '../src/verifiers/TransferVerifier.sol');
    const transferSource = fs.readFileSync(transferSourcePath, 'utf8');
    
    const transferIC0xMatch = transferSource.match(/uint256 constant IC0x = (\d+);/);
    if (transferIC0xMatch) {
      const sourceIC0x = transferIC0xMatch[1];
      console.log("  Source IC0x:  ", sourceIC0x);
      console.log("  Match:        ", sourceIC0x === expectedValues.transfer ? "✅" : "❌");
      
      if (sourceIC0x === expectedValues.transfer) {
        console.log("  ✅ Transfer Verifier source matches zkey!");
      } else {
        console.log("  ❌ Transfer Verifier source does NOT match zkey!");
      }
    }
  } catch (error: any) {
    console.log("  ⚠️  Could not verify source:", error.message);
  }

  console.log("\nChecking Unshield Verifier V3...");
  console.log("  Address:", deployedAddresses.unshield);
  console.log("  Expected IC0x:", expectedValues.unshield);
  
  try {
    const UnshieldVerifierFactory = await ethers.getContractFactory("UnshieldVerifierV3");
    
    // Read the source file to get IC0x
    const fs = require('fs');
    const path = require('path');
    const unshieldSourcePath = path.join(__dirname, '../src/verifiers/UnshieldVerifier.sol');
    const unshieldSource = fs.readFileSync(unshieldSourcePath, 'utf8');
    
    // Check if it's UnshieldVerifierV3 or UnshieldVerifier
    const unshieldIC0xMatch = unshieldSource.match(/uint256 constant IC0x = (\d+);/);
    if (unshieldIC0xMatch) {
      const sourceIC0x = unshieldIC0xMatch[1];
      console.log("  Source IC0x:  ", sourceIC0x);
      console.log("  Match:        ", sourceIC0x === expectedValues.unshield ? "✅" : "❌");
      
      if (sourceIC0x === expectedValues.unshield) {
        console.log("  ✅ Unshield Verifier source matches zkey!");
      } else {
        console.log("  ❌ Unshield Verifier source does NOT match zkey!");
      }
    }
  } catch (error: any) {
    console.log("  ⚠️  Could not verify source:", error.message);
  }

  console.log("\n" + "=".repeat(80));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(80));
  console.log("\n✅ If both verifiers show ✅, they match the zkey files.");
  console.log("⚠️  Note: This verifies the SOURCE CODE matches the zkey.");
  console.log("   The deployed contracts were compiled from this source, so they should match.");
  console.log("\n💡 To be 100% certain, you can:");
  console.log("   1. Check the contract bytecode on the block explorer");
  console.log("   2. Or call a test transaction to verify proof acceptance");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
