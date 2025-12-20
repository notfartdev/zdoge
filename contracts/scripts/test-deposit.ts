import { ethers } from "hardhat";

/**
 * Test script to perform a real deposit on DogeOS testnet
 */
async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("Testing deposit with account:", signer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "DOGE");

  // Contract addresses
  const POOL_100_USDC = "0xb0c3e393841f494F3b8A2fBeB730FA7Da197B95D";
  const USDC_ADDRESS = "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925";

  // Get contract instances
  const pool = await ethers.getContractAt("MixerPool", POOL_100_USDC);
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

  // Check pool info
  console.log("\n=== Pool Info ===");
  const poolInfo = await pool.getPoolInfo();
  console.log("Token:", poolInfo[0]);
  console.log("Denomination:", ethers.formatUnits(poolInfo[1], 6), "USDC");
  console.log("Deposits count:", poolInfo[2].toString());
  console.log("Current root:", poolInfo[3]);

  // Check USDC balance
  const usdcBalance = await usdc.balanceOf(signer.address);
  console.log("\n=== Wallet ===");
  console.log("USDC Balance:", ethers.formatUnits(usdcBalance, 6), "USDC");

  if (usdcBalance < poolInfo[1]) {
    console.log("\n⚠️  Not enough USDC to deposit!");
    console.log("Get USDC from: https://faucet.testnet.dogeos.com");
    console.log("USDC address:", USDC_ADDRESS);
    return;
  }

  // Generate commitment
  console.log("\n=== Generating Deposit ===");
  const secret = ethers.randomBytes(31);
  const nullifier = ethers.randomBytes(31);
  const secretHex = ethers.hexlify(secret);
  const nullifierHex = ethers.hexlify(nullifier);
  
  // Commitment = keccak256(secret || nullifier)
  const commitment = ethers.keccak256(ethers.concat([secret, nullifier]));
  
  console.log("Secret:", secretHex);
  console.log("Nullifier:", nullifierHex);
  console.log("Commitment:", commitment);

  // Create note string
  const note = `dogenado-1-usdc100-${secretHex.slice(2)}-${nullifierHex.slice(2)}`;
  console.log("\n📝 YOUR SECRET NOTE (SAVE THIS!):");
  console.log("=".repeat(80));
  console.log(note);
  console.log("=".repeat(80));

  // Approve USDC
  console.log("\n=== Approving USDC ===");
  const approveTx = await usdc.approve(POOL_100_USDC, poolInfo[1]);
  console.log("Approve tx:", approveTx.hash);
  await approveTx.wait();
  console.log("Approved!");

  // Deposit
  console.log("\n=== Depositing ===");
  const depositTx = await pool.deposit(commitment);
  console.log("Deposit tx:", depositTx.hash);
  const receipt = await depositTx.wait();
  console.log("Deposit confirmed in block:", receipt?.blockNumber);

  // Check new pool state
  const newPoolInfo = await pool.getPoolInfo();
  console.log("\n=== Pool After Deposit ===");
  console.log("Deposits count:", newPoolInfo[2].toString());
  console.log("New root:", newPoolInfo[3]);

  console.log("\n✅ DEPOSIT SUCCESSFUL!");
  console.log("View on explorer: https://blockscout.testnet.dogeos.com/tx/" + depositTx.hash);
  console.log("\n⚠️  IMPORTANT: Save your note to withdraw later!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

