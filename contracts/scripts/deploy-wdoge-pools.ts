/**
 * Deploy new WDOGE pools with 1, 10, 100, 1000 DOGE denominations
 */

import { ethers } from 'hardhat';

// wDOGE token configuration
const WDOGE = {
  address: '0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE',
  decimals: 18,
  amounts: [1, 10, 100, 1000], // New smaller denominations
};

// Existing infrastructure
const HASHER_ADDRESS = '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D';
const VERIFIER_ADDRESS = '0xE8Ef2495F741467D746E27548BF71948A0554Ad6';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying WDOGE pools with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  const MixerPoolV2 = await ethers.getContractFactory('MixerPoolV2');
  
  const deployedPools: Record<string, string> = {};

  console.log('\n========== Deploying WDOGE pools ==========');
  console.log('Amounts: 1, 10, 100, 1000 DOGE');

  for (const amount of WDOGE.amounts) {
    const denomination = ethers.parseUnits(amount.toString(), WDOGE.decimals);
    
    console.log(`\nDeploying ${amount} WDOGE pool...`);
    console.log(`  Token: ${WDOGE.address}`);
    console.log(`  Denomination: ${denomination.toString()}`);

    try {
      const pool = await MixerPoolV2.deploy(
        VERIFIER_ADDRESS,
        HASHER_ADDRESS,
        WDOGE.address,
        denomination
      );
      await pool.waitForDeployment();
      const poolAddress = await pool.getAddress();
      
      deployedPools[amount.toString()] = poolAddress;
      console.log(`  ✓ Deployed to: ${poolAddress}`);
    } catch (error: any) {
      console.error(`  ✗ Failed to deploy: ${error.message}`);
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE - NEW WDOGE POOLS');
  console.log('========================================');
  console.log('\nCopy these to your config files:\n');
  
  console.log('// Frontend (lib/dogeos-config.ts) - DOGE and WDOGE pools:');
  console.log('pools: {');
  for (const [amount, address] of Object.entries(deployedPools)) {
    console.log(`  '${amount}': '${address}',`);
  }
  console.log('},');
  
  console.log('\n// Backend (backend/src/config.ts):');
  for (const [amount, address] of Object.entries(deployedPools)) {
    console.log(`'wdoge-${amount}': '${address}',`);
  }

  console.log('\n// DogeRouter needs to be updated with these new pools!');
  console.log('// Run: npx hardhat run scripts/update-doge-router.ts --network dogeos');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

