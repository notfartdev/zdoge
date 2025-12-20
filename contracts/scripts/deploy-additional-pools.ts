/**
 * Deploy additional MixerPool contracts (1 USDC and 10 USDC)
 * 
 * Uses existing Hasher and Verifier contracts
 */

import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  // Existing contract addresses (from previous deployment)
  const HASHER_ADDRESS = '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D';
  const VERIFIER_ADDRESS = '0xE8Ef2495F741467D746E27548BF71948A0554Ad6';
  const USDC_ADDRESS = '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925';

  console.log('\nUsing existing contracts:');
  console.log('Hasher:', HASHER_ADDRESS);
  console.log('Verifier:', VERIFIER_ADDRESS);
  console.log('USDC:', USDC_ADDRESS);

  const MixerPool = await ethers.getContractFactory('MixerPool');

  // Deploy 1 USDC Pool
  console.log('\n1. Deploying MixerPool (1 USDC)...');
  const denomination1 = ethers.parseUnits('1', 6); // 1 USDC (6 decimals)
  const pool1 = await MixerPool.deploy(
    VERIFIER_ADDRESS,
    HASHER_ADDRESS,
    USDC_ADDRESS,
    denomination1
  );
  await pool1.waitForDeployment();
  const pool1Address = await pool1.getAddress();
  console.log('   MixerPool 1 USDC deployed to:', pool1Address);

  // Deploy 10 USDC Pool
  console.log('\n2. Deploying MixerPool (10 USDC)...');
  const denomination10 = ethers.parseUnits('10', 6); // 10 USDC
  const pool10 = await MixerPool.deploy(
    VERIFIER_ADDRESS,
    HASHER_ADDRESS,
    USDC_ADDRESS,
    denomination10
  );
  await pool10.waitForDeployment();
  const pool10Address = await pool10.getAddress();
  console.log('   MixerPool 10 USDC deployed to:', pool10Address);

  // Summary
  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('MixerPool 1 USDC:   ', pool1Address);
  console.log('MixerPool 10 USDC:  ', pool10Address);
  console.log('========================================');
  console.log('\nUpdate these addresses in:');
  console.log('- lib/dogeos-config.ts (pools.USDC_1.address and pools.USDC_10.address)');
  console.log('- backend/src/config.ts');
  console.log('========================================');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

