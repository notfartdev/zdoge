/**
 * Generate a new relayer wallet for Dogenado
 */

const { Wallet } = require('ethers');

const wallet = Wallet.createRandom();

console.log('========================================');
console.log('🔐 NEW RELAYER WALLET');
console.log('========================================');
console.log('');
console.log('Address:', wallet.address);
console.log('');
console.log('Private Key:', wallet.privateKey);
console.log('');
console.log('========================================');
console.log('');
console.log('⚠️  SAVE THIS PRIVATE KEY SECURELY!');
console.log('');
console.log('Next steps:');
console.log('1. Go to faucet: https://faucet.testnet.dogeos.com');
console.log('2. Request DOGE for address:', wallet.address);
console.log('3. Add RELAYER_PRIVATE_KEY to Render:');
console.log('   https://dashboard.render.com/web/srv-d5345uruibrs73fj933g');
console.log('4. Rebuild the backend');
console.log('========================================');

