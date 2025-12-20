/**
 * Deploy MixerPoolV2 contracts with timelock functionality
 * 
 * Uses existing Hasher and Verifier contracts
 */

import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying MixerPoolV2 with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  // Existing contract addresses
  const HASHER_ADDRESS = '0x1931f2D78930f5c3b0ce65d27F56F35Fa4fdA67D';
  const VERIFIER_ADDRESS = '0xE8Ef2495F741467D746E27548BF71948A0554Ad6';
  const USDC_ADDRESS = '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925';

  console.log('\nUsing existing contracts:');
  console.log('Hasher:', HASHER_ADDRESS);
  console.log('Verifier:', VERIFIER_ADDRESS);
  console.log('USDC:', USDC_ADDRESS);

  const MixerPoolV2 = await ethers.getContractFactory('MixerPoolV2');

  // Deploy 1 USDC V2 Pool
  console.log('\n1. Deploying MixerPoolV2 (1 USDC)...');
  const denomination1 = ethers.parseUnits('1', 6);
  const pool1 = await MixerPoolV2.deploy(
    VERIFIER_ADDRESS,
    HASHER_ADDRESS,
    USDC_ADDRESS,
    denomination1
  );
  await pool1.waitForDeployment();
  const pool1Address = await pool1.getAddress();
  console.log('   MixerPoolV2 1 USDC deployed to:', pool1Address);

  // Deploy 10 USDC V2 Pool
  console.log('\n2. Deploying MixerPoolV2 (10 USDC)...');
  const denomination10 = ethers.parseUnits('10', 6);
  const pool10 = await MixerPoolV2.deploy(
    VERIFIER_ADDRESS,
    HASHER_ADDRESS,
    USDC_ADDRESS,
    denomination10
  );
  await pool10.waitForDeployment();
  const pool10Address = await pool10.getAddress();
  console.log('   MixerPoolV2 10 USDC deployed to:', pool10Address);

  // Deploy 100 USDC V2 Pool
  console.log('\n3. Deploying MixerPoolV2 (100 USDC)...');
  const denomination100 = ethers.parseUnits('100', 6);
  const pool100 = await MixerPoolV2.deploy(
    VERIFIER_ADDRESS,
    HASHER_ADDRESS,
    USDC_ADDRESS,
    denomination100
  );
  await pool100.waitForDeployment();
  const pool100Address = await pool100.getAddress();
  console.log('   MixerPoolV2 100 USDC deployed to:', pool100Address);

  // Deploy 1000 USDC V2 Pool
  console.log('\n4. Deploying MixerPoolV2 (1000 USDC)...');
  const denomination1000 = ethers.parseUnits('1000', 6);
  const pool1000 = await MixerPoolV2.deploy(
    VERIFIER_ADDRESS,
    HASHER_ADDRESS,
    USDC_ADDRESS,
    denomination1000
  );
  await pool1000.waitForDeployment();
  const pool1000Address = await pool1000.getAddress();
  console.log('   MixerPoolV2 1000 USDC deployed to:', pool1000Address);

  // Summary
  console.log('\n========================================');
  console.log('MIXERPOOL V2 DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('MixerPoolV2 1 USDC:    ', pool1Address);
  console.log('MixerPoolV2 10 USDC:   ', pool10Address);
  console.log('MixerPoolV2 100 USDC:  ', pool100Address);
  console.log('MixerPoolV2 1000 USDC: ', pool1000Address);
  console.log('========================================');
  console.log('\nFeatures:');
  console.log('- Instant withdrawals (same as V1)');
  console.log('- Scheduled withdrawals with 1h - 7d delay');
  console.log('- Two-step process: schedule → execute');
  console.log('========================================');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

