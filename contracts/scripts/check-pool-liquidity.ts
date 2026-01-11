/**
 * Check liquidity in ShieldedPoolMultiToken contract
 * 
 * Usage:
 *   npx hardhat run scripts/check-pool-liquidity.ts --network dogeosTestnet
 */

import { ethers } from "hardhat";

const POOL_ADDRESS = "0x2e93EC915E439920a770e5c9d8c207A6160929a8";

const TOKENS = {
  DOGE: { address: '0x0000000000000000000000000000000000000000', symbol: 'DOGE', decimals: 18, name: 'Native DOGE' },
  USDC: { address: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925', symbol: 'USDC', decimals: 18, name: 'USD Coin' },
  USDT: { address: '0xC81800b77D91391Ef03d7868cB81204E753093a9', symbol: 'USDT', decimals: 18, name: 'Tether USD' },
  USD1: { address: '0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F', symbol: 'USD1', decimals: 18, name: 'USD1' },
  WETH: { address: '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000', symbol: 'WETH', decimals: 18, name: 'Wrapped ETH' },
  LBTC: { address: '0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E', symbol: 'LBTC', decimals: 18, name: 'Liquid BTC' },
};

// ERC20 ABI - just the balanceOf function
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("        SHIELDED POOL LIQUIDITY CHECK");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("Pool Address:", POOL_ADDRESS);
  console.log("Network: DogeOS Testnet\n");

  // Check native DOGE balance
  const dogeBalance = await ethers.provider.getBalance(POOL_ADDRESS);
  console.log("📊 Native DOGE Balance:");
  console.log(`   ${ethers.formatEther(dogeBalance)} DOGE\n`);

  // Check ERC20 token balances
  console.log("📊 ERC20 Token Balances:");
  console.log("─────────────────────────────────────────────────────────────");

  const results = [];

  for (const [key, token] of Object.entries(TOKENS)) {
    if (token.address === ethers.ZeroAddress) continue; // Skip DOGE, already checked

    try {
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, ethers.provider);
      const balance = await tokenContract.balanceOf(POOL_ADDRESS);
      const formattedBalance = ethers.formatUnits(balance, token.decimals);
      
      const displayBalance = parseFloat(formattedBalance).toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
      });

      results.push({
        symbol: token.symbol,
        name: token.name,
        balance: formattedBalance,
        displayBalance,
        address: token.address
      });

      console.log(`   ${token.symbol.padEnd(6)} ${displayBalance.padStart(15)} ${token.name}`);
    } catch (error: any) {
      console.log(`   ${token.symbol.padEnd(6)} ERROR: ${error.message}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                        SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const totalTokens = results.length + 1; // +1 for DOGE
  const tokensWithBalance = results.filter(r => parseFloat(r.balance) > 0).length + 
                           (parseFloat(ethers.formatEther(dogeBalance)) > 0 ? 1 : 0);

  console.log(`Total Tokens Checked: ${totalTokens}`);
  console.log(`Tokens with Balance:  ${tokensWithBalance}\n`);

  if (tokensWithBalance > 0) {
    console.log("✅ Pool has liquidity!");
  } else {
    console.log("⚠️  Pool has no liquidity yet. Please add tokens to the pool address.");
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error checking liquidity:", error);
    process.exit(1);
  });
