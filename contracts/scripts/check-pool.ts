import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=".repeat(60));
  console.log("DOGENADO - Pool Status Check");
  console.log("=".repeat(60));
  console.log("\nWallet:", signer.address);
  console.log("DOGE Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "DOGE");

  // Contract addresses
  const POOL_100_USDC = "0xb0c3e393841f494F3b8A2fBeB730FA7Da197B95D";
  const POOL_1000_USDC = "0x840E60C22850f9865075aE0Cf23393d9045ca214";
  const USDC_ADDRESS = "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925";

  // Get contract instances
  const pool100 = await ethers.getContractAt("MixerPool", POOL_100_USDC);
  const pool1000 = await ethers.getContractAt("MixerPool", POOL_1000_USDC);
  
  // Check USDC balance
  const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const usdcBalance = await usdc.balanceOf(signer.address);

  console.log("USDC Balance:", ethers.formatUnits(usdcBalance, 6), "USDC");

  // Check pools
  console.log("\n--- 100 USDC Pool ---");
  console.log("Address:", POOL_100_USDC);
  const info100 = await pool100.getPoolInfo();
  console.log("Deposits:", info100[2].toString());
  console.log("Current Root:", info100[3].slice(0, 20) + "...");

  console.log("\n--- 1000 USDC Pool ---");
  console.log("Address:", POOL_1000_USDC);
  const info1000 = await pool1000.getPoolInfo();
  console.log("Deposits:", info1000[2].toString());
  console.log("Current Root:", info1000[3].slice(0, 20) + "...");

  console.log("\n" + "=".repeat(60));
  console.log("Explorer: https://blockscout.testnet.dogeos.com");
  console.log("Faucet:   https://faucet.testnet.dogeos.com");
  console.log("=".repeat(60));

  if (usdcBalance === 0n) {
    console.log("\n⚠️  You need USDC to test deposits!");
    console.log("   Get testnet USDC from the faucet above.");
  } else {
    console.log("\n✅ You have USDC! Ready to test deposits.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

