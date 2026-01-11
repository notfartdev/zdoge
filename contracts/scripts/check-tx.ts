import { ethers } from "hardhat";

const txHashes = [
  "0x3f7b0914221829bd2e3bb5df3d546043d65f99ab8d5216c0b75e6e1200064944", // Swap USDC -> DOGE
  "0x4c45dcc2f7d224a1d6964e49a907d140594ec3d80a892246f82b9db9802ff27a", // Unshield DOGE
];

async function checkTransaction(txHash: string, description: string) {
  console.log(`\n${"=".repeat(65)}`);
  console.log(`  ${description}`);
  console.log(`${"=".repeat(65)}\n`);
  console.log("Transaction Hash:", txHash);
  
  const tx = await ethers.provider.getTransaction(txHash);
  if (!tx) {
    console.log("❌ Transaction not found");
    return;
  }
  
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  
  console.log("Block Number:", receipt.blockNumber);
  console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
  console.log("Gas Used:", receipt.gasUsed.toString());
  console.log("From:", receipt.from);
  console.log("To:", receipt.to);
  
  // Get the contract instance to parse events
  const poolAddress = "0x2e93EC915E439920a770e5c9d8c207A6160929a8";
  const ShieldedPoolABI = [
    "event Swap(bytes32 indexed inputNullifier, bytes32 outputCommitment1, bytes32 outputCommitment2, address indexed tokenIn, address indexed tokenOut, uint256 swapAmount, uint256 outputAmount, uint256 timestamp)",
    "event Shield(bytes32 indexed commitment, uint256 indexed leafIndex, address indexed token, uint256 amount, uint256 timestamp)",
    "event Unshield(bytes32 indexed nullifierHash, address indexed recipient, address indexed token, uint256 amount, address relayer, uint256 fee, uint256 timestamp)",
  ];
  
  const pool = new ethers.Contract(poolAddress, ShieldedPoolABI, ethers.provider);
  
  console.log("\n📋 Events:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("Total logs:", receipt.logs.length);
  
  // Also check raw logs
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`\nLog ${i}:`);
    console.log("  Address:", log.address);
    console.log("  Topics:", log.topics.length);
    if (log.topics.length > 0) {
      console.log("  Topic 0 (event sig):", log.topics[0]);
    }
  }
  
  // Decode Swap event manually
  const SWAP_EVENT_SIG = "0xf4d2554b7b46a47f5c2d60c3467b4aeda71e2b0d76a308b044dd63596bb785c6";
  const UNSHIELD_EVENT_SIG = "0x67a09057b6d0c1b147347dafc527e5cfac7d1964c4c116a07915861f767ec53a";
  
  for (const log of receipt.logs) {
    try {
      // Only process logs from the pool contract
      if (log.address.toLowerCase() !== poolAddress.toLowerCase()) continue;
      
      // Check if this is the Swap event
      if (log.topics[0] === SWAP_EVENT_SIG) {
        // Swap event: Swap(bytes32 indexed inputNullifier, bytes32 outputCommitment1, bytes32 outputCommitment2, address indexed tokenIn, address indexed tokenOut, uint256 swapAmount, uint256 amountOut, bytes encryptedMemo, uint256 timestamp)
        // Topics: [eventSig, inputNullifier, tokenIn, tokenOut]
        // Data: [outputCommitment1, outputCommitment2, swapAmount, amountOut, encryptedMemo, timestamp]
        
        const inputNullifier = log.topics[1];
        const tokenIn = log.topics[2];
        const tokenOut = log.topics[3];
        
        // Decode data (ABI encoded)
        const dataDecoder = new ethers.AbiCoder();
        const decoded = dataDecoder.decode(
          ["bytes32", "bytes32", "uint256", "uint256", "bytes", "uint256"],
          log.data
        );
        
        const [outputCommitment1, outputCommitment2, swapAmount, outputAmount] = decoded;
        
        console.log("\n🔄 SWAP EVENT:");
        console.log("   Input Nullifier:", inputNullifier);
        console.log("   Token In:", tokenIn === ethers.ZeroAddress ? "DOGE (Native)" : tokenIn);
        console.log("   Token Out:", tokenOut);
        console.log("   Swap Amount:", ethers.formatEther(swapAmount), "DOGE");
        console.log("   Output Amount:", ethers.formatEther(outputAmount), "USDC");
        console.log("   Output Commitment 1:", outputCommitment1);
        if (outputCommitment2 && outputCommitment2 !== ethers.ZeroHash) {
          console.log("   Output Commitment 2 (Change):", outputCommitment2);
        } else {
          console.log("   Output Commitment 2 (Change): None (full swap)");
        }
        continue;
      }
      
      // Check if this is the Unshield event
      if (log.topics[0] === UNSHIELD_EVENT_SIG) {
        // Unshield event: Unshield(bytes32 indexed nullifierHash, address indexed recipient, address indexed token, uint256 amount, address relayer, uint256 fee, uint256 timestamp)
        // Topics: [eventSig, nullifierHash, recipient, token]
        // Data: [amount, relayer, fee, timestamp]
        
        const nullifierHash = log.topics[1];
        const recipient = log.topics[2];
        const token = log.topics[3];
        
        // Decode data
        const dataDecoder = new ethers.AbiCoder();
        const decoded = dataDecoder.decode(
          ["uint256", "address", "uint256", "uint256"],
          log.data
        );
        
        const [amount, relayer, fee] = decoded;
        
        console.log("\n🔓 UNSHIELD EVENT:");
        console.log("   Nullifier Hash:", nullifierHash);
        console.log("   Token:", token === ethers.ZeroAddress ? "DOGE (Native)" : token);
        console.log("   Recipient:", recipient);
        console.log("   Amount:", ethers.formatEther(amount));
        console.log("   Relayer:", relayer);
        console.log("   Fee:", ethers.formatEther(fee));
        continue;
      }
      
      let parsed;
      try {
        parsed = pool.interface.parseLog(log);
      } catch (e) {
        continue;
      }
      
      if (parsed) {
        if (parsed.name === "Swap") {
          const [inputNullifier, outputCommitment1, outputCommitment2, tokenIn, tokenOut, swapAmount, outputAmount] = parsed.args;
          console.log("\n🔄 SWAP EVENT:");
          console.log("   Input Nullifier:", inputNullifier);
          console.log("   Token In:", tokenIn === ethers.ZeroAddress ? "DOGE (Native)" : tokenIn);
          console.log("   Token Out:", tokenOut);
          console.log("   Swap Amount:", ethers.formatEther(swapAmount), "DOGE");
          console.log("   Output Amount:", ethers.formatEther(outputAmount), "USDC");
          console.log("   Output Commitment 1:", outputCommitment1);
          if (outputCommitment2 && outputCommitment2 !== ethers.ZeroHash) {
            console.log("   Output Commitment 2 (Change):", outputCommitment2);
          } else {
            console.log("   Output Commitment 2 (Change): None (full swap)");
          }
        } else if (parsed.name === "Shield") {
          const [commitment, leafIndex, token, amount] = parsed.args;
          console.log("\n🛡️  SHIELD EVENT:");
          console.log("   Commitment:", commitment);
          console.log("   Leaf Index:", leafIndex.toString());
          console.log("   Token:", token === ethers.ZeroAddress ? "DOGE (Native)" : token);
          console.log("   Amount:", ethers.formatEther(amount));
        } else if (parsed.name === "Unshield") {
          const [nullifierHash, recipient, token, amount, relayer, fee] = parsed.args;
          console.log("\n🔓 UNSHIELD EVENT:");
          console.log("   Nullifier Hash:", nullifierHash);
          console.log("   Token:", token === ethers.ZeroAddress ? "DOGE (Native)" : token);
          console.log("   Recipient:", recipient);
          console.log("   Amount:", ethers.formatEther(amount));
          console.log("   Relayer:", relayer);
          console.log("   Fee:", ethers.formatEther(fee));
        }
      }
    } catch (e) {
      // Try to manually decode if automatic parsing fails
      if (log.topics.length > 0) {
        const eventSig = log.topics[0];
        console.log(`\n⚠️  Could not parse event with signature: ${eventSig}`);
        console.log("   Topics:", log.topics.length);
        console.log("   Data length:", log.data.length);
      }
    }
  }
  
  console.log(`\n${"=".repeat(65)}\n`);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("              TRANSACTION VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════════");
  
  await checkTransaction(txHashes[0], "SWAP: USDC → DOGE");
  await checkTransaction(txHashes[1], "UNSHIELD: DOGE");
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    VERIFICATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
