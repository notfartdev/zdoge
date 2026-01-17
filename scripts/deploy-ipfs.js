#!/usr/bin/env node
/**
 * IPFS Deployment Script for zDoge Frontend
 * 
 * Deploys the Next.js static export to IPFS for immutable, 
 * verifiable frontend hosting.
 * 
 * Prerequisites:
 *   npm install -g ipfs-car
 *   # Or use web3.storage / Pinata API
 * 
 * Usage:
 *   npm run build:static
 *   node scripts/deploy-ipfs.js
 * 
 * Environment variables:
 *   WEB3_STORAGE_TOKEN - web3.storage API token
 *   PINATA_JWT - Pinata JWT token
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const OUT_DIR = path.join(__dirname, '..', 'out');
const IPFS_HASHES_FILE = path.join(__dirname, '..', 'public', 'ipfs-hashes.json');

/**
 * Calculate directory hash for verification
 */
function calculateDirHash(dir) {
  const hash = crypto.createHash('sha256');
  
  function processDir(currentDir) {
    const items = fs.readdirSync(currentDir).sort();
    
    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        processDir(itemPath);
      } else {
        const content = fs.readFileSync(itemPath);
        hash.update(content);
      }
    }
  }
  
  processDir(dir);
  return hash.digest('hex');
}

async function deployToIPFS() {
  console.log('🌐 zDoge IPFS Deployment\n');
  
  // Check if out directory exists
  if (!fs.existsSync(OUT_DIR)) {
    console.log('❌ Build output not found. Run `npm run build:static` first.');
    console.log('\nTo enable static export, add this to next.config.mjs:');
    console.log('  output: "export"');
    process.exit(1);
  }
  
  // Calculate local hash before upload
  console.log('📊 Calculating local build hash...');
  const localHash = calculateDirHash(OUT_DIR);
  console.log(`   Local hash: ${localHash}\n`);
  
  const ipfsInfo = {
    generated: new Date().toISOString(),
    localBuildHash: localHash,
    deployments: []
  };
  
  // Try different IPFS deployment methods
  
  // Method 1: ipfs-car (if installed)
  try {
    console.log('🔄 Attempting ipfs-car deployment...');
    
    // Create CAR file
    const carFile = path.join(__dirname, '..', 'zdoge-frontend.car');
    execSync(`ipfs-car pack ${OUT_DIR} --output ${carFile}`, { stdio: 'pipe' });
    
    // Get CID
    const cidOutput = execSync(`ipfs-car roots ${carFile}`, { encoding: 'utf-8' });
    const cid = cidOutput.trim();
    
    console.log(`✅ CAR file created: ${carFile}`);
    console.log(`📍 IPFS CID: ${cid}`);
    
    ipfsInfo.deployments.push({
      method: 'ipfs-car',
      cid: cid,
      carFile: 'zdoge-frontend.car'
    });
    
    console.log('\n📋 To pin this on IPFS:');
    console.log(`   ipfs pin add ${cid}`);
    console.log(`   # Or upload CAR file to web3.storage / Pinata\n`);
    
  } catch (e) {
    console.log('⚠️  ipfs-car not available. Install with: npm install -g ipfs-car\n');
  }
  
  // Method 2: Web3.storage API
  if (process.env.WEB3_STORAGE_TOKEN) {
    console.log('🔄 Deploying to web3.storage...');
    // Implementation would use fetch to web3.storage API
    console.log('   (web3.storage deployment requires additional setup)\n');
  }
  
  // Method 3: Pinata API
  if (process.env.PINATA_JWT) {
    console.log('🔄 Deploying to Pinata...');
    // Implementation would use fetch to Pinata API
    console.log('   (Pinata deployment requires additional setup)\n');
  }
  
  // Save IPFS info
  fs.writeFileSync(IPFS_HASHES_FILE, JSON.stringify(ipfsInfo, null, 2));
  console.log(`📄 IPFS deployment info saved to: ${IPFS_HASHES_FILE}`);
  
  // Print manual instructions
  console.log('\n' + '='.repeat(60));
  console.log('📋 MANUAL IPFS DEPLOYMENT OPTIONS');
  console.log('='.repeat(60));
  console.log('\n1. Pinata (https://pinata.cloud):');
  console.log('   - Upload the `out` folder');
  console.log('   - Get the CID and publish it');
  console.log('\n2. web3.storage (https://web3.storage):');
  console.log('   - Upload the `out` folder');
  console.log('   - Get the CID and publish it');
  console.log('\n3. Fleek (https://fleek.co):');
  console.log('   - Connect your GitHub repo');
  console.log('   - Enable IPFS deployment');
  console.log('\n4. Local IPFS node:');
  console.log('   ipfs add -r out/');
  console.log('\n' + '='.repeat(60));
  console.log('🔑 PUBLISH THE CID SO USERS CAN VERIFY');
  console.log('='.repeat(60));
  console.log('\nAdd the IPFS CID to:');
  console.log('- README.md');
  console.log('- docs.zdoge.cash');
  console.log('- Twitter/social media');
  console.log('\nUsers can access via:');
  console.log('- https://<cid>.ipfs.dweb.link');
  console.log('- https://ipfs.io/ipfs/<cid>');
  console.log('- ipfs://<cid> (in Brave browser)');
  
  return ipfsInfo;
}

deployToIPFS().catch(console.error);
