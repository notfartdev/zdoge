import { ethers } from "hardhat";

/**
 * Deploy contracts to local Hardhat network for testing
 * Includes mock ERC20 token deployment
 */
async function main() {
  const [deployer, user1, user2, relayer] = await ethers.getSigners();
  
  console.log("Deploying to local network...");
  console.log("Deployer:", deployer.address);

  // Deploy Mock USDC
  console.log("\n1. Deploying Mock USDC...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("   Mock USDC deployed to:", mockUSDCAddress);

  // Mint tokens to test accounts
  const mintAmount = BigInt(100000) * BigInt(10 ** 6); // 100,000 USDC
  await mockUSDC.mint(user1.address, mintAmount);
  await mockUSDC.mint(user2.address, mintAmount);
  console.log("   Minted 100,000 USDC to user1 and user2");

  // Deploy Hasher
  console.log("\n2. Deploying Hasher...");
  const Hasher = await ethers.getContractFactory("Hasher");
  const hasher = await Hasher.deploy();
  await hasher.waitForDeployment();
  const hasherAddress = await hasher.getAddress();
  console.log("   Hasher deployed to:", hasherAddress);

  // Deploy Verifier (mock)
  console.log("\n3. Deploying Verifier (mock)...");
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("   Verifier deployed to:", verifierAddress);

  // Deploy MixerPool (100 USDC)
  console.log("\n4. Deploying MixerPool (100 USDC)...");
  const DENOMINATION = BigInt(100) * BigInt(10 ** 6);
  const MixerPool = await ethers.getContractFactory("MixerPool");
  const pool = await MixerPool.deploy(
    verifierAddress,
    hasherAddress,
    mockUSDCAddress,
    DENOMINATION
  );
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("   MixerPool deployed to:", poolAddress);

  // Summary
  console.log("\n========================================");
  console.log("LOCAL DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("\nAddresses:");
  console.log("  MockUSDC:", mockUSDCAddress);
  console.log("  Hasher:  ", hasherAddress);
  console.log("  Verifier:", verifierAddress);
  console.log("  Pool:    ", poolAddress);
  console.log("\nTest Accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  User1:   ", user1.address);
  console.log("  User2:   ", user2.address);
  console.log("  Relayer: ", relayer.address);
  console.log("\n========================================");

  return {
    mockUSDC: mockUSDCAddress,
    hasher: hasherAddress,
    verifier: verifierAddress,
    pool: poolAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

