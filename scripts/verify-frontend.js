#!/usr/bin/env node
/**
 * Frontend Verification Script for zDoge
 * 
 * This script allows users to verify the integrity of the frontend
 * by comparing local hashes with published hashes.
 * 
 * Usage:
 *   node scripts/verify-frontend.js [url]
 * 
 * Example:
 *   node scripts/verify-frontend.js https://zdoge.cash
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const EXPECTED_ROOT_HASH = process.env.ZDOGE_ROOT_HASH || null;

/**
 * Fetch JSON from URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch and hash a file
 */
function fetchAndHash(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      const hash = crypto.createHash('sha384');
      res.on('data', chunk => hash.update(chunk));
      res.on('end', () => {
        resolve(`sha384-${hash.digest('base64')}`);
      });
    }).on('error', reject);
  });
}

async function verifyFrontend(baseUrl = 'https://zdoge.cash') {
  console.log('🔐 zDoge Frontend Verification Tool\n');
  console.log(`Verifying: ${baseUrl}\n`);
  
  try {
    // Fetch build verification data
    const verificationUrl = `${baseUrl}/build-hash.json`;
    console.log(`📥 Fetching verification data from ${verificationUrl}...`);
    
    const verification = await fetchJson(verificationUrl);
    
    console.log(`\n📦 Build ID: ${verification.buildId}`);
    console.log(`📅 Generated: ${verification.generated}`);
    console.log(`🔑 Root Hash: ${verification.rootHash}`);
    
    // Check against expected hash if provided
    if (EXPECTED_ROOT_HASH) {
      if (verification.rootHash === EXPECTED_ROOT_HASH) {
        console.log('\n✅ ROOT HASH MATCHES EXPECTED VALUE');
      } else {
        console.log('\n❌ WARNING: ROOT HASH DOES NOT MATCH!');
        console.log(`   Expected: ${EXPECTED_ROOT_HASH}`);
        console.log(`   Got: ${verification.rootHash}`);
        process.exit(1);
      }
    }
    
    // Verify circuit files (most critical)
    if (verification.circuitHashes) {
      console.log('\n🔄 Verifying ZK circuit files...\n');
      
      let allValid = true;
      
      for (const [filename, expectedHash] of Object.entries(verification.circuitHashes)) {
        const circuitUrl = `${baseUrl}/circuits/shielded/${filename}`;
        
        try {
          const actualHash = await fetchAndHash(circuitUrl);
          
          if (actualHash === expectedHash) {
            console.log(`  ✅ ${filename}`);
          } else {
            console.log(`  ❌ ${filename} - HASH MISMATCH!`);
            console.log(`     Expected: ${expectedHash}`);
            console.log(`     Got: ${actualHash}`);
            allValid = false;
          }
        } catch (e) {
          console.log(`  ⚠️  ${filename} - Could not fetch`);
        }
      }
      
      if (allValid) {
        console.log('\n✅ All circuit files verified successfully!');
      } else {
        console.log('\n❌ Some circuit files failed verification!');
        console.log('   DO NOT USE THIS FRONTEND - IT MAY BE COMPROMISED');
        process.exit(1);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ FRONTEND VERIFICATION COMPLETE');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error(`\n❌ Verification failed: ${error.message}`);
    process.exit(1);
  }
}

// Get URL from command line or use default
const url = process.argv[2] || 'https://zdoge.cash';
verifyFrontend(url);
