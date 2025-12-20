/**
 * Deploy Dogenado with circomlibjs-compatible MiMCSponge
 * 
 * This deploys:
 * 1. MiMCSponge (from circomlibjs bytecode)
 * 2. HasherAdapter (wraps MiMCSponge to match IHasher interface)
 * 3. Verifier (from circuits)
 * 4. MixerPool (100 USDC and 1000 USDC pools)
 */

import { ethers } from 'hardhat';
// @ts-ignore
import { mimcSpongecontract } from 'circomlibjs';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  // USDC token on DogeOS Testnet
  const USDC_ADDRESS = '0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925';

  // Step 1: Deploy MiMCSponge from circomlibjs bytecode
  console.log('\n1. Deploying MiMCSponge (circomlibjs)...');
  const MiMCSpongeFactory = new ethers.ContractFactory(
    mimcSpongecontract.abi,
    mimcSpongecontract.createCode('mimcsponge', 220),
    deployer
  );
  const mimcSponge = await MiMCSpongeFactory.deploy();
  await mimcSponge.waitForDeployment();
  const mimcSpongeAddress = await mimcSponge.getAddress();
  console.log('   MiMCSponge deployed to:', mimcSpongeAddress);

  // Step 2: Deploy HasherAdapter
  console.log('\n2. Deploying HasherAdapter...');
  const HasherAdapter = await ethers.getContractFactory('HasherAdapter');
  const hasherAdapter = await HasherAdapter.deploy(mimcSpongeAddress);
  await hasherAdapter.waitForDeployment();
  const hasherAddress = await hasherAdapter.getAddress();
  console.log('   HasherAdapter deployed to:', hasherAddress);

  // Step 3: Deploy Verifier (Groth16Verifier from circuits)
  console.log('\n3. Deploying Groth16Verifier...');
  const Verifier = await ethers.getContractFactory('Groth16Verifier');
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const groth16Address = await verifier.getAddress();
  console.log('   Groth16Verifier deployed to:', groth16Address);

  // Step 4: Deploy VerifierAdapter
  console.log('\n4. Deploying VerifierAdapter...');
  const VerifierAdapter = await ethers.getContractFactory('VerifierAdapter');
  const verifierAdapter = await VerifierAdapter.deploy(groth16Address);
  await verifierAdapter.waitForDeployment();
  const verifierAddress = await verifierAdapter.getAddress();
  console.log('   VerifierAdapter deployed to:', verifierAddress);

  // Step 5: Deploy MixerPool for 100 USDC
  // Constructor order: (verifier, hasher, token, denomination)
  console.log('\n5. Deploying MixerPool (100 USDC)...');
  const MixerPool = await ethers.getContractFactory('MixerPool');
  const denomination100 = ethers.parseUnits('100', 6); // 100 USDC (6 decimals)
  const pool100 = await MixerPool.deploy(
    verifierAddress,  // verifier first!
    hasherAddress,    // hasher second!
    USDC_ADDRESS,
    denomination100
  );
  await pool100.waitForDeployment();
  const pool100Address = await pool100.getAddress();
  console.log('   MixerPool 100 USDC deployed to:', pool100Address);

  // Step 6: Deploy MixerPool for 1000 USDC
  console.log('\n6. Deploying MixerPool (1000 USDC)...');
  const denomination1000 = ethers.parseUnits('1000', 6); // 1000 USDC
  const pool1000 = await MixerPool.deploy(
    verifierAddress,  // verifier first!
    hasherAddress,    // hasher second!
    USDC_ADDRESS,
    denomination1000
  );
  await pool1000.waitForDeployment();
  const pool1000Address = await pool1000.getAddress();
  console.log('   MixerPool 1000 USDC deployed to:', pool1000Address);

  // Summary
  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('MiMCSponge (circomlibjs):', mimcSpongeAddress);
  console.log('HasherAdapter:           ', hasherAddress);
  console.log('Groth16Verifier:         ', groth16Address);
  console.log('VerifierAdapter:         ', verifierAddress);
  console.log('MixerPool 100 USDC:      ', pool100Address);
  console.log('MixerPool 1000 USDC:     ', pool1000Address);
  console.log('========================================');
  console.log('\nUpdate these addresses in:');
  console.log('- backend/src/config.ts');
  console.log('- lib/dogeos-config.ts');
  console.log('========================================');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

