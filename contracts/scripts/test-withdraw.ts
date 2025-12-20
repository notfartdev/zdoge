import { ethers } from "hardhat";

/**
 * Test withdrawal on DogeOS testnet
 * Uses mock verifier (accepts any valid-looking proof)
 */
async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("=".repeat(70));
  console.log("DOGENADO - Test Withdrawal");
  console.log("=".repeat(70));
  
  // Contract addresses
  const POOL_100_USDC = "0xb0c3e393841f494F3b8A2fBeB730FA7Da197B95D";
  const USDC_ADDRESS = "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925";

  // Get contract instances
  const pool = await ethers.getContractAt("MixerPool", POOL_100_USDC);
  
  // Get current pool state
  const poolInfo = await pool.getPoolInfo();
  const currentRoot = poolInfo[3];
  
  console.log("\n=== Pool State ===");
  console.log("Deposits:", poolInfo[2].toString());
  console.log("Current Root:", currentRoot);

  // Generate a fresh recipient address (random wallet for privacy)
  const recipientWallet = ethers.Wallet.createRandom();
  const recipient = recipientWallet.address;
  
  console.log("\n=== Withdrawal Setup ===");
  console.log("Depositor (on-chain):", signer.address);
  console.log("Recipient (fresh addr):", recipient);
  console.log("^ These addresses have NO on-chain connection!");

  // Generate nullifier hash (unique per withdrawal)
  const nullifierHash = ethers.keccak256(ethers.randomBytes(32));
  console.log("Nullifier Hash:", nullifierHash);

  // Check recipient USDC balance before
  const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const recipientBalanceBefore = await usdc.balanceOf(recipient);
  console.log("\nRecipient USDC before:", ethers.formatUnits(recipientBalanceBefore, 6));

  // Generate mock proof (works with mock verifier)
  const mockProof: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
    BigInt("0x1111111111111111111111111111111111111111111111111111111111111111"),
    BigInt("0x2222222222222222222222222222222222222222222222222222222222222222"),
    BigInt("0x3333333333333333333333333333333333333333333333333333333333333333"),
    BigInt("0x4444444444444444444444444444444444444444444444444444444444444444"),
    BigInt("0x5555555555555555555555555555555555555555555555555555555555555555"),
    BigInt("0x6666666666666666666666666666666666666666666666666666666666666666"),
    BigInt("0x7777777777777777777777777777777777777777777777777777777777777777"),
    BigInt("0x8888888888888888888888888888888888888888888888888888888888888888"),
  ];

  console.log("\n=== Submitting Withdrawal ===");
  
  const tx = await pool.withdraw(
    mockProof,
    currentRoot,
    nullifierHash,
    recipient,
    ethers.ZeroAddress, // No relayer
    0n // No fee
  );
  
  console.log("Withdrawal TX:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt?.blockNumber);

  // Check recipient balance after
  const recipientBalanceAfter = await usdc.balanceOf(recipient);
  console.log("\nRecipient USDC after:", ethers.formatUnits(recipientBalanceAfter, 6));

  // Check nullifier is spent
  const isSpent = await pool.nullifierHashes(nullifierHash);
  console.log("Nullifier spent:", isSpent);

  console.log("\n" + "=".repeat(70));
  console.log("✅ WITHDRAWAL SUCCESSFUL!");
  console.log("=".repeat(70));
  
  console.log("\n🔐 PRIVACY ANALYSIS:");
  console.log("Looking at the blockchain, an observer sees:");
  console.log("  - Deposit TX: From " + signer.address.slice(0,10) + "... with commitment");
  console.log("  - Withdraw TX: To " + recipient.slice(0,10) + "... with nullifier");
  console.log("");
  console.log("  ❌ There is NO on-chain link between these addresses!");
  console.log("  ❌ Observer cannot tell which deposit was withdrawn");
  console.log("  ❌ Observer cannot link depositor to recipient");
  
  console.log("\n📊 View transactions:");
  console.log("  Withdrawal: https://blockscout.testnet.dogeos.com/tx/" + tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

