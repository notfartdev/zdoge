/**
 * Deploy DogeRouter for native DOGE deposits/withdrawals
 */

import { ethers } from 'hardhat';

// wDOGE token address on DogeOS Testnet
const WDOGE_ADDRESS = '0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE';

// wDOGE pool addresses (these are the valid pools the router can interact with)
const WDOGE_POOLS = [
  '0xAAbC0bF61d4c0C580f94133a2E905Ae3DB2C9689',  // 100 wDOGE
  '0xF09a1A994610E50e38FC9535d9151127F126dAbe',  // 1000 wDOGE
  '0x687c1566B204350C91aB25f8B43235bF59e6535d',  // 10000 wDOGE
  '0x7d1cF893E6B2192D3a34369a3D2742F572879E17',  // 100000 wDOGE
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying DogeRouter with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  console.log('\nConfiguration:');
  console.log('  wDOGE token:', WDOGE_ADDRESS);
  console.log('  Valid pools:', WDOGE_POOLS.length);
  WDOGE_POOLS.forEach((pool, i) => {
    const amounts = [100, 1000, 10000, 100000];
    console.log(`    ${amounts[i]} DOGE: ${pool}`);
  });

  console.log('\nDeploying DogeRouter...');
  const DogeRouter = await ethers.getContractFactory('DogeRouter');
  const router = await DogeRouter.deploy(WDOGE_ADDRESS, WDOGE_POOLS);
  await router.waitForDeployment();
  
  const routerAddress = await router.getAddress();
  console.log('\n✓ DogeRouter deployed to:', routerAddress);

  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE');
  console.log('========================================');
  console.log('DogeRouter:', routerAddress);
  console.log('\nUsers can now:');
  console.log('  1. depositDoge(pool, commitment) - Send native DOGE, auto-wrapped to wDOGE');
  console.log('  2. withdrawDoge(...) - Withdraw and receive native DOGE');
  console.log('\nAdd this address to your frontend config!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

