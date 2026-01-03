/**
 * Redeploy ShieldedPoolMultiToken with circomlibjs-compatible MiMC Hasher
 * 
 * The issue: Our circuits use circomlibjs MiMC, but the deployed Hasher uses custom round constants.
 * This causes Merkle root mismatch and proof verification failure.
 * 
 * Solution: Deploy real circomlibjs MiMCSponge + HasherAdapter, then redeploy ShieldedPoolMultiToken
 */

import { ethers } from 'hardhat';
const circomlibjs = require('circomlibjs');

// Token addresses on DogeOS Testnet
const TOKENS = {
  NATIVE: "0x0000000000000000000000000000000000000000",
  WDOGE: "0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE",
  USDC: "0xD19d2Ffb1c284668b7AFe72cddae1BAF3Bc03925",
  USDT: "0xC81800b77D91391Ef03d7868cB81204E753093a9",
  WETH: "0x1a6094Ac3ca3Fc9F1B4777941a5f4AAc16A72000",
  LBTC: "0x29789F5A3e4c3113e7165c33A7E3bc592CF6fE0E",
  USD1: "0x25D5E5375e01Ed39Dc856bDCA5040417fD45eA3F",
};

async function main() {
  console.log('\n========================================');
  console.log('REDEPLOY SHIELDED POOL WITH CIRCOMLIBJS MIMC');
  console.log('========================================\n');

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} DOGE\n`);

  // ============ Step 1: Deploy circomlibjs MiMCSponge ============
  console.log('1. Deploying circomlibjs MiMCSponge...');
  
  // Get the bytecode from circomlibjs
  const mimcSpongeABI = circomlibjs.mimcSpongecontract.abi;
  const mimcSpongeBytecode = circomlibjs.mimcSpongecontract.createCode("mimcsponge", 220);
  
  const MiMCSpongeFactory = new ethers.ContractFactory(mimcSpongeABI, mimcSpongeBytecode, deployer);
  const mimcSponge = await MiMCSpongeFactory.deploy();
  await mimcSponge.waitForDeployment();
  const mimcSpongeAddress = await mimcSponge.getAddress();
  console.log(`   MiMCSponge deployed to: ${mimcSpongeAddress}`);

  // ============ Step 2: Deploy HasherAdapter ============
  console.log('\n2. Deploying HasherAdapter...');
  const HasherAdapter = await ethers.getContractFactory('HasherAdapter');
  const hasherAdapter = await HasherAdapter.deploy(mimcSpongeAddress);
  await hasherAdapter.waitForDeployment();
  const hasherAddress = await hasherAdapter.getAddress();
  console.log(`   HasherAdapter deployed to: ${hasherAddress}`);

  // ============ Step 3: Deploy Verifiers ============
  console.log('\n3. Deploying Verifiers...');
  
  const ShieldVerifier = await ethers.getContractFactory('ShieldVerifier');
  const shieldVerifier = await ShieldVerifier.deploy();
  await shieldVerifier.waitForDeployment();
  console.log(`   ShieldVerifier: ${await shieldVerifier.getAddress()}`);
  
  const TransferVerifier = await ethers.getContractFactory('TransferVerifier');
  const transferVerifier = await TransferVerifier.deploy();
  await transferVerifier.waitForDeployment();
  console.log(`   TransferVerifier: ${await transferVerifier.getAddress()}`);
  
  const UnshieldVerifier = await ethers.getContractFactory('UnshieldVerifier');
  const unshieldVerifier = await UnshieldVerifier.deploy();
  await unshieldVerifier.waitForDeployment();
  console.log(`   UnshieldVerifier: ${await unshieldVerifier.getAddress()}`);
  
  const SwapVerifier = await ethers.getContractFactory('SwapVerifier');
  const swapVerifier = await SwapVerifier.deploy();
  await swapVerifier.waitForDeployment();
  console.log(`   SwapVerifier: ${await swapVerifier.getAddress()}`);

  // ============ Step 4: Deploy ShieldedPoolMultiToken ============
  console.log('\n4. Deploying ShieldedPoolMultiToken...');
  
  const ShieldedPool = await ethers.getContractFactory('ShieldedPoolMultiToken');
  const shieldedPool = await ShieldedPool.deploy(
    hasherAddress,
    await shieldVerifier.getAddress(),
    await transferVerifier.getAddress(),
    await unshieldVerifier.getAddress(),
    await swapVerifier.getAddress(),
    "0x0000000000000000000000000000000000000000", // No DEX router for now
    { gasLimit: 10000000 }
  );
  await shieldedPool.waitForDeployment();
  const poolAddress = await shieldedPool.getAddress();
  console.log(`   ShieldedPoolMultiToken: ${poolAddress}`);

  // ============ Step 5: Add Supported Tokens ============
  console.log('\n5. Adding supported tokens...');
  
  for (const [name, address] of Object.entries(TOKENS)) {
    if (address !== TOKENS.NATIVE) {
      try {
        const tx = await shieldedPool.addSupportedToken(address);
        await tx.wait();
        console.log(`   Added ${name}: ${address}`);
      } catch (e: any) {
        console.log(`   ${name} already supported or error: ${e.message?.slice(0, 50)}`);
      }
    }
  }

  // ============ Summary ============
  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE!');
  console.log('========================================');
  console.log(`
Deployed Contracts:
  MiMCSponge (circomlibjs): ${mimcSpongeAddress}
  HasherAdapter:           ${hasherAddress}
  ShieldVerifier:          ${await shieldVerifier.getAddress()}
  TransferVerifier:        ${await transferVerifier.getAddress()}
  UnshieldVerifier:        ${await unshieldVerifier.getAddress()}
  SwapVerifier:            ${await swapVerifier.getAddress()}
  ShieldedPoolMultiToken:  ${poolAddress}

UPDATE lib/dogeos-config.ts WITH:
  shieldedPool: {
    address: "${poolAddress}" as const,
    ...
  }
`);

  // Return addresses for verification
  return {
    mimcSponge: mimcSpongeAddress,
    hasher: hasherAddress,
    shieldVerifier: await shieldVerifier.getAddress(),
    transferVerifier: await transferVerifier.getAddress(),
    unshieldVerifier: await unshieldVerifier.getAddress(),
    swapVerifier: await swapVerifier.getAddress(),
    shieldedPool: poolAddress,
  };
}

main()
  .then((addresses) => {
    console.log('\nDeployment addresses:', addresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nDeployment failed:', error);
    process.exit(1);
  });

