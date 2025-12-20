import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy Hasher
  console.log("\n1. Deploying Hasher...");
  const Hasher = await ethers.getContractFactory("Hasher");
  const hasher = await Hasher.deploy();
  await hasher.waitForDeployment();
  const hasherAddress = await hasher.getAddress();
  console.log("   Hasher deployed to:", hasherAddress);

  // Deploy Verifier (mock for now)
  console.log("\n2. Deploying Verifier (mock)...");
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("   Verifier deployed to:", verifierAddress);

  // Token addresses on DogeOS testnet
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925";
  const WDOGE_ADDRESS = process.env.WDOGE_ADDRESS || "0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE";

  // Pool denominations (USDC has 6 decimals on most chains)
  const USDC_DECIMALS = 6;
  const DENOMINATION_100 = BigInt(100) * BigInt(10 ** USDC_DECIMALS);  // 100 USDC
  const DENOMINATION_1000 = BigInt(1000) * BigInt(10 ** USDC_DECIMALS); // 1000 USDC

  // Deploy 100 USDC Pool
  console.log("\n3. Deploying MixerPool (100 USDC)...");
  const MixerPool = await ethers.getContractFactory("MixerPool");
  const pool100 = await MixerPool.deploy(
    verifierAddress,
    hasherAddress,
    USDC_ADDRESS,
    DENOMINATION_100
  );
  await pool100.waitForDeployment();
  const pool100Address = await pool100.getAddress();
  console.log("   MixerPool (100 USDC) deployed to:", pool100Address);

  // Deploy 1000 USDC Pool
  console.log("\n4. Deploying MixerPool (1000 USDC)...");
  const pool1000 = await MixerPool.deploy(
    verifierAddress,
    hasherAddress,
    USDC_ADDRESS,
    DENOMINATION_1000
  );
  await pool1000.waitForDeployment();
  const pool1000Address = await pool1000.getAddress();
  console.log("   MixerPool (1000 USDC) deployed to:", pool1000Address);

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("\nContract Addresses:");
  console.log("  Hasher:              ", hasherAddress);
  console.log("  Verifier:            ", verifierAddress);
  console.log("  MixerPool (100 USDC):", pool100Address);
  console.log("  MixerPool (1000 USDC):", pool1000Address);
  console.log("\nToken Addresses:");
  console.log("  USDC:", USDC_ADDRESS);
  console.log("  WDOGE:", WDOGE_ADDRESS);
  console.log("\n========================================");

  // Return addresses for verification
  return {
    hasher: hasherAddress,
    verifier: verifierAddress,
    pool100: pool100Address,
    pool1000: pool1000Address,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

