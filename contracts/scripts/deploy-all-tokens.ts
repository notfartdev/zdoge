/**
 * Deploy MixerPoolV2 for all supported tokens
 */

import { ethers } from 'hardhat';

// Token configurations
// IMPORTANT: All tokens on DogeOS testnet use 18 decimals!
const TOKENS = {
  USDC: {
    address: '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925',
    decimals: 18, // DogeOS testnet USDC uses 18 decimals
    amounts: [1, 10, 100, 1000],
  },
  USDT: {
    address: '0xC81800b77D91391Ef03d7868cB81204E753093a9',
    decimals: 18, // DogeOS testnet USDT uses 18 decimals
    amounts: [1, 10, 100, 1000],
  },
  USD1: {
    address: '0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F',
    decimals: 18,
    amounts: [1, 10, 100, 1000],
  },
  // WDOGE and WETH are already correctly deployed - skip them
  // WDOGE: {
  //   address: '0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE',
  //   decimals: 18,
  //   amounts: [100, 1000, 10000, 100000],
  // },
  // WETH: {
  //   address: '0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000',
  //   decimals: 18,
  //   amounts: [0.01, 0.1, 1, 10],
  // },
  LBTC: {
    address: '0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E',
    decimals: 18, // DogeOS testnet LBTC uses 18 decimals
    amounts: [0.001, 0.01, 0.1, 1],
  },
};

// Existing infrastructure
const HASHER_ADDRESS = '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D';
const VERIFIER_ADDRESS = '0xE8Ef2495F741467D746E27548BF71948A0554Ad6';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  const MixerPoolV2 = await ethers.getContractFactory('MixerPoolV2');
  
  const deployedPools: Record<string, Record<string, string>> = {};

  for (const [tokenSymbol, config] of Object.entries(TOKENS)) {
    console.log(`\n========== Deploying ${tokenSymbol} pools ==========`);
    deployedPools[tokenSymbol] = {};

    for (const amount of config.amounts) {
      const denomination = ethers.parseUnits(amount.toString(), config.decimals);
      const amountLabel = amount >= 1 ? amount.toString() : amount.toString();
      
      console.log(`\nDeploying ${amount} ${tokenSymbol} pool...`);
      console.log(`  Token: ${config.address}`);
      console.log(`  Denomination: ${denomination.toString()}`);

      try {
        const pool = await MixerPoolV2.deploy(
          VERIFIER_ADDRESS,
          HASHER_ADDRESS,
          config.address,
          denomination
        );
        await pool.waitForDeployment();
        const poolAddress = await pool.getAddress();
        
        deployedPools[tokenSymbol][amountLabel] = poolAddress;
        console.log(`  ✓ Deployed to: ${poolAddress}`);
      } catch (error: any) {
        console.error(`  ✗ Failed: ${error.message}`);
      }
    }
  }

  // Print summary
  console.log('\n\n========================================');
  console.log('DEPLOYMENT SUMMARY');
  console.log('========================================');
  
  for (const [tokenSymbol, pools] of Object.entries(deployedPools)) {
    console.log(`\n${tokenSymbol}:`);
    for (const [amount, address] of Object.entries(pools)) {
      console.log(`  ${amount}: '${address}'`);
    }
  }

  console.log('\n========================================');
  console.log('Copy the addresses above to lib/dogeos-config.ts');
  console.log('========================================');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

