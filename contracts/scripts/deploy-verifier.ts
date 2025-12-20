import { ethers } from "hardhat";

/**
 * Deploy the real Groth16 Verifier and Adapter
 * 
 * This script deploys:
 * 1. Groth16Verifier - The snarkjs-generated verifier
 * 2. VerifierAdapter - Wrapper that converts our interface to snarkjs format
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying real ZK Verifier with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy Groth16Verifier (snarkjs generated)
  console.log("\n1. Deploying Groth16Verifier...");
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16Address = await groth16Verifier.getAddress();
  console.log("   Groth16Verifier deployed to:", groth16Address);

  // Deploy VerifierAdapter
  console.log("\n2. Deploying VerifierAdapter...");
  const VerifierAdapter = await ethers.getContractFactory("VerifierAdapter");
  const verifierAdapter = await VerifierAdapter.deploy(groth16Address);
  await verifierAdapter.waitForDeployment();
  const adapterAddress = await verifierAdapter.getAddress();
  console.log("   VerifierAdapter deployed to:", adapterAddress);

  // Summary
  console.log("\n========================================");
  console.log("VERIFIER DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("\nContract Addresses:");
  console.log("  Groth16Verifier: ", groth16Address);
  console.log("  VerifierAdapter: ", adapterAddress);
  console.log("\nUse VerifierAdapter address for new MixerPool deployments.");
  console.log("========================================");

  return {
    groth16Verifier: groth16Address,
    verifierAdapter: adapterAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

