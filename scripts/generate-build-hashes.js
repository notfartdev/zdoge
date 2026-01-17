#!/usr/bin/env node
/**
 * Build Hash Generator for zDoge Frontend
 * 
 * Generates SHA-384 hashes for all build files for:
 * - Subresource Integrity (SRI) verification
 * - Frontend integrity verification by users
 * - IPFS deployment verification
 * 
 * Run after `npm run build`:
 *   node scripts/generate-build-hashes.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUILD_DIR = path.join(__dirname, '..', '.next');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'build-verification.json');
const CIRCUITS_DIR = path.join(PUBLIC_DIR, 'circuits', 'shielded');

/**
 * Generate SHA-384 hash for a file
 */
function generateHash(filePath) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

/**
 * Get all files in directory recursively
 */
function getAllFiles(dir, fileList = [], relativeTo = dir) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList, relativeTo);
    } else {
      fileList.push({
        path: path.relative(relativeTo, filePath).replace(/\\/g, '/'),
        fullPath: filePath
      });
    }
  }
  
  return fileList;
}

/**
 * Main function to generate hashes
 */
async function generateBuildHashes() {
  console.log('🔐 Generating build hashes for frontend verification...\n');
  
  const verification = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    buildId: null,
    hashes: {
      // Critical JS chunks
      javascript: {},
      // CSS files
      css: {},
      // ZK circuit files (critical for proof generation)
      circuits: {},
      // Static assets
      static: {}
    },
    // Combined hash of all critical files
    rootHash: null
  };
  
  // Get build ID
  const buildIdPath = path.join(BUILD_DIR, 'BUILD_ID');
  if (fs.existsSync(buildIdPath)) {
    verification.buildId = fs.readFileSync(buildIdPath, 'utf-8').trim();
    console.log(`📦 Build ID: ${verification.buildId}`);
  }
  
  // Hash static chunks (.next/static)
  const staticDir = path.join(BUILD_DIR, 'static');
  if (fs.existsSync(staticDir)) {
    const staticFiles = getAllFiles(staticDir, [], staticDir);
    
    for (const file of staticFiles) {
      const hash = generateHash(file.fullPath);
      
      if (file.path.endsWith('.js')) {
        verification.hashes.javascript[file.path] = hash;
      } else if (file.path.endsWith('.css')) {
        verification.hashes.css[file.path] = hash;
      } else {
        verification.hashes.static[file.path] = hash;
      }
    }
    
    console.log(`✅ Hashed ${Object.keys(verification.hashes.javascript).length} JavaScript files`);
    console.log(`✅ Hashed ${Object.keys(verification.hashes.css).length} CSS files`);
  }
  
  // Hash ZK circuit files (CRITICAL - these must not be tampered with)
  if (fs.existsSync(CIRCUITS_DIR)) {
    const circuitFiles = fs.readdirSync(CIRCUITS_DIR).filter(f => 
      f.endsWith('.wasm') || f.endsWith('.zkey') || f.endsWith('.json')
    );
    
    for (const file of circuitFiles) {
      const filePath = path.join(CIRCUITS_DIR, file);
      verification.hashes.circuits[file] = generateHash(filePath);
    }
    
    console.log(`✅ Hashed ${Object.keys(verification.hashes.circuits).length} circuit files`);
  }
  
  // Generate root hash (hash of all hashes)
  const allHashes = [
    ...Object.values(verification.hashes.javascript),
    ...Object.values(verification.hashes.css),
    ...Object.values(verification.hashes.circuits)
  ].sort().join('');
  
  verification.rootHash = crypto.createHash('sha384')
    .update(allHashes)
    .digest('hex');
  
  console.log(`\n🔑 Root Hash: ${verification.rootHash}`);
  
  // Write verification file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(verification, null, 2));
  console.log(`\n📄 Verification file written to: ${OUTPUT_FILE}`);
  
  // Also write a minimal version for quick verification
  const quickVerify = {
    buildId: verification.buildId,
    generated: verification.generated,
    rootHash: verification.rootHash,
    circuitHashes: verification.hashes.circuits
  };
  
  const quickVerifyPath = path.join(__dirname, '..', 'public', 'build-hash.json');
  fs.writeFileSync(quickVerifyPath, JSON.stringify(quickVerify, null, 2));
  console.log(`📄 Quick verification file written to: ${quickVerifyPath}`);
  
  // Print verification instructions
  console.log('\n' + '='.repeat(60));
  console.log('📋 VERIFICATION INSTRUCTIONS FOR USERS');
  console.log('='.repeat(60));
  console.log('\n1. Visit: https://zdoge.cash/build-hash.json');
  console.log('2. Compare rootHash with published hash');
  console.log('3. For circuit verification, compare circuit hashes');
  console.log('\nPublish this hash publicly:');
  console.log(`\n  ROOT HASH: ${verification.rootHash}\n`);
  
  return verification;
}

// Run
generateBuildHashes().catch(console.error);
