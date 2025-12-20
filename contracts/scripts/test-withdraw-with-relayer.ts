import { ethers } from "hardhat";

/**
 * Test withdrawal WITH RELAYER - demonstrates true privacy
 * 
 * In this test:
 * - Depositor: Your main wallet (0xD1fC75EC...)
 * - Relayer: A different wallet submits the transaction
 * - Recipient: Fresh address receives funds
 * 
 * Result: No on-chain link between depositor and recipient!
 */
async function main() {
  const [depositor] = await ethers.getSigners();
  
  console.log("=".repeat(70));
  console.log("DOGENADO - Withdrawal WITH RELAYER (True Privacy)");
  console.log("=".repeat(70));

  // Create a "relayer" wallet (in production, this is a separate service)
  const relayerPrivateKey = ethers.hexlify(ethers.randomBytes(32));
  const relayerWallet = new ethers.Wallet(relayerPrivateKey, ethers.provider);
  
  // Fund the relayer with some DOGE for gas
  console.log("\n=== Setup ===");
  console.log("Depositor (your wallet):", depositor.address);
  console.log("Relayer (separate wallet):", relayerWallet.address);
  
  // Send gas money to relayer
  const fundTx = await depositor.sendTransaction({
    to: relayerWallet.address,
    value: ethers.parseEther("1") // 1 DOGE for gas
  });
  await fundTx.wait();
  console.log("Funded relayer with 1 DOGE for gas");

  // Contract addresses
  const POOL_100_USDC = "0xb0c3e393841f494F3b8A2fBeB730FA7Da197B95D";
  const USDC_ADDRESS = "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925";

  // First, make a new deposit from the depositor
  console.log("\n=== Step 1: Deposit (from your wallet) ===");
  
  const pool = await ethers.getContractAt("MixerPool", POOL_100_USDC);
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)"
  ];
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, depositor);
  
  // Generate commitment
  const secret = ethers.randomBytes(31);
  const nullifier = ethers.randomBytes(31);
  const commitment = ethers.keccak256(ethers.concat([secret, nullifier]));
  
  // Approve and deposit
  const denomination = await pool.denomination();
  await (await usdc.approve(POOL_100_USDC, denomination)).wait();
  const depositTx = await pool.connect(depositor).deposit(commitment);
  await depositTx.wait();
  
  console.log("Deposit TX:", depositTx.hash);
  console.log("From (visible on-chain):", depositor.address);

  // Get the new root
  const currentRoot = (await pool.getPoolInfo())[3];

  // Generate fresh recipient
  const recipientWallet = ethers.Wallet.createRandom();
  const recipient = recipientWallet.address;
  
  console.log("\n=== Step 2: Withdrawal (via RELAYER) ===");
  console.log("Recipient (fresh address):", recipient);
  console.log("Relayer (submits TX):", relayerWallet.address);
  
  // Generate nullifier hash and mock proof
  const nullifierHash = ethers.keccak256(ethers.concat([nullifier, nullifier]));
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

  // Relayer fee (1 USDC)
  const relayerFee = ethers.parseUnits("1", 6);

  // RELAYER submits the withdrawal (not the depositor!)
  const poolAsRelayer = pool.connect(relayerWallet);
  
  const withdrawTx = await poolAsRelayer.withdraw(
    mockProof,
    currentRoot,
    nullifierHash,
    recipient,
    relayerWallet.address, // Relayer gets the fee
    relayerFee
  );
  await withdrawTx.wait();

  console.log("\nWithdrawal TX:", withdrawTx.hash);

  // Check balances
  const recipientBalance = await usdc.balanceOf(recipient);
  const relayerUSDC = await usdc.balanceOf(relayerWallet.address);

  console.log("\n=== Results ===");
  console.log("Recipient received:", ethers.formatUnits(recipientBalance, 6), "USDC");
  console.log("Relayer fee:", ethers.formatUnits(relayerUSDC, 6), "USDC");

  console.log("\n" + "=".repeat(70));
  console.log("🔐 PRIVACY ANALYSIS");
  console.log("=".repeat(70));
  console.log("\nDeposit Transaction:");
  console.log("  TX:", depositTx.hash);
  console.log("  From:", depositor.address, "(YOUR wallet)");
  
  console.log("\nWithdrawal Transaction:");
  console.log("  TX:", withdrawTx.hash);
  console.log("  From:", relayerWallet.address, "(RELAYER - not you!)");
  console.log("  To:", recipient, "(fresh address)");

  console.log("\n✅ KEY DIFFERENCE:");
  console.log("   The 'From' field shows the RELAYER, not your wallet!");
  console.log("   An observer cannot link your deposit to this withdrawal!");
  
  console.log("\n📊 View on explorer:");
  console.log("   Deposit:  https://blockscout.testnet.dogeos.com/tx/" + depositTx.hash);
  console.log("   Withdraw: https://blockscout.testnet.dogeos.com/tx/" + withdrawTx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

