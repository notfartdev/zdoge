/**
 * Deploy MixerPoolNative for native DOGE (no wrapping needed)
 * 
 * This creates pools that accept native DOGE directly,
 * similar to how Tornado Cash handled ETH.
 */

import { ethers } from 'hardhat';

// Native DOGE pool configuration
const DOGE_POOLS = {
  amounts: [1, 10, 100, 1000], // DOGE denominations
  decimals: 18,
};

// Existing infrastructure
const HASHER_ADDRESS = '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D';
const VERIFIER_ADDRESS = '0xE8Ef2495F741467D746E27548BF71948A0554Ad6';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying Native DOGE pools with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  const MixerPoolNative = await ethers.getContractFactory('MixerPoolNative');
  
  const deployedPools: Record<string, string> = {};

  console.log('\n========== Deploying Native DOGE Pools ==========');
  console.log('These pools accept native DOGE directly (no wDOGE wrapping)');
  console.log('Amounts: 1, 10, 100, 1000 DOGE\n');

  for (const amount of DOGE_POOLS.amounts) {
    const denomination = ethers.parseUnits(amount.toString(), DOGE_POOLS.decimals);
    
    console.log(`\nDeploying ${amount} DOGE pool...`);
    console.log(`  Denomination: ${denomination.toString()} wei`);

    try {
      const pool = await MixerPoolNative.deploy(
        VERIFIER_ADDRESS,
        HASHER_ADDRESS,
        denomination,
        { gasLimit: 5000000 } // Explicit gas limit
      );
      console.log(`  TX submitted, waiting for confirmation...`);
      await pool.waitForDeployment();
      const poolAddress = await pool.getAddress();
      
      deployedPools[amount.toString()] = poolAddress;
      console.log(`  ✓ Deployed to: ${poolAddress}`);
      
      // Wait 3 seconds between deployments to avoid nonce issues
      console.log(`  Waiting 3 seconds before next deployment...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error: any) {
      console.error(`  ✗ Failed to deploy: ${error.message}`);
      if (error.reason) console.error(`  Reason: ${error.reason}`);
      if (error.data) console.error(`  Data: ${error.data}`);
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE - NATIVE DOGE POOLS');
  console.log('========================================');
  console.log('\nThese pools accept native DOGE directly!');
  console.log('No wDOGE wrapping required.\n');
  
  console.log('// Frontend (lib/dogeos-config.ts) - DOGE pools:');
  console.log('DOGE: {');
  console.log('  token: tokens.DOGE,');
  console.log('  amounts: [1, 10, 100, 1000],');
  console.log('  pools: {');
  for (const [amount, address] of Object.entries(deployedPools)) {
    console.log(`    '${amount}': '${address}',`);
  }
  console.log('  },');
  console.log('  isNative: true, // Flag for native DOGE pools');
  console.log('},');
  
  console.log('\n// Backend (backend/src/config.ts):');
  for (const [amount, address] of Object.entries(deployedPools)) {
    console.log(`'doge-${amount}': '${address}',`);
  }

  console.log('\n========================================');
  console.log('IMPORTANT: Update deposit-interface.tsx to');
  console.log('send native DOGE (msg.value) instead of');
  console.log('using DogeRouter for these pools!');
  console.log('========================================');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

