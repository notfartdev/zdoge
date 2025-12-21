/**
 * Deploy DogeRouter for native DOGE deposits/withdrawals
 */

import { ethers } from 'hardhat';

// wDOGE token address on DogeOS Testnet
const WDOGE_ADDRESS = '0xF6BDB158A5ddF77F1B83bC9074F6a472c58D78aE';

// wDOGE pool addresses (NEW: 1, 10, 100, 1000 DOGE)
const WDOGE_POOLS = [
  '0xD9743cB4D6ab805b28215E78e26A9CefD0d971E5',  // 1 wDOGE
  '0x6fa72AF1E9CF420aE3a839eea9E3F9d6375028C0',  // 10 wDOGE
  '0xFB652Db6668d476f2a4Af2783F2e7259Eb8a1a86',  // 100 wDOGE
  '0xa9143916C4Bf99d94AdD2578162f53164307E7A6',  // 1000 wDOGE
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying DogeRouter with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'DOGE');

  console.log('\nConfiguration:');
  console.log('  wDOGE token:', WDOGE_ADDRESS);
  console.log('  Valid pools:', WDOGE_POOLS.length);
  WDOGE_POOLS.forEach((pool, i) => {
    const amounts = [1, 10, 100, 1000];
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

