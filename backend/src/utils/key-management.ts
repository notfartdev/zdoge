/**
 * Key Management Service
 * 
 * Provides abstraction for private key management.
 * Supports multiple backends:
 * - Environment variable (development/testnet)
 * - AWS KMS (production)
 * - HashiCorp Vault (production)
 * 
 * For production, switch KEY_PROVIDER to 'aws-kms' or 'vault'
 */

import { type Address, type Hash } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

// ============ Configuration ============

export type KeyProvider = 'env' | 'aws-kms' | 'vault' | 'encrypted-file';

interface KeyManagementConfig {
  provider: KeyProvider;
  // AWS KMS config
  awsRegion?: string;
  awsKmsKeyId?: string;
  // Vault config
  vaultAddress?: string;
  vaultPath?: string;
  // Encrypted file config
  encryptedKeyPath?: string;
}

const config: KeyManagementConfig = {
  provider: (process.env.KEY_PROVIDER as KeyProvider) || 'env',
  awsRegion: process.env.AWS_REGION,
  awsKmsKeyId: process.env.AWS_KMS_KEY_ID,
  vaultAddress: process.env.VAULT_ADDR,
  vaultPath: process.env.VAULT_KEY_PATH,
  encryptedKeyPath: process.env.ENCRYPTED_KEY_PATH,
};

// ============ Security Validation ============

export interface SecurityValidation {
  isSecure: boolean;
  warnings: string[];
  errors: string[];
  recommendation: string;
}

export function validateKeyConfiguration(): SecurityValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const isProduction = process.env.NODE_ENV === 'production';
  const provider = config.provider;
  
  // Check provider security for production
  if (isProduction && provider === 'env') {
    warnings.push('Using environment variable for private key in production is not recommended');
    warnings.push('Consider migrating to AWS KMS or HashiCorp Vault');
  }
  
  // Check if private key is set
  if (provider === 'env' && !process.env.RELAYER_PRIVATE_KEY) {
    errors.push('RELAYER_PRIVATE_KEY environment variable is not set');
  }
  
  // Check key format
  if (provider === 'env' && process.env.RELAYER_PRIVATE_KEY) {
    const key = process.env.RELAYER_PRIVATE_KEY;
    const cleanKey = key.startsWith('0x') ? key : `0x${key}`;
    
    if (!/^0x[0-9a-fA-F]{64}$/.test(cleanKey)) {
      errors.push('RELAYER_PRIVATE_KEY has invalid format (expected 64 hex characters)');
    }
    
    // Check for common test keys (should never be used in production)
    const KNOWN_TEST_KEYS = [
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Hardhat account 0
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Hardhat account 1
    ];
    
    if (isProduction && KNOWN_TEST_KEYS.includes(cleanKey.toLowerCase())) {
      errors.push('CRITICAL: Using a known test private key in production!');
    }
  }
  
  // Check AWS KMS configuration
  if (provider === 'aws-kms') {
    if (!config.awsRegion) errors.push('AWS_REGION not set for KMS provider');
    if (!config.awsKmsKeyId) errors.push('AWS_KMS_KEY_ID not set for KMS provider');
  }
  
  // Check Vault configuration
  if (provider === 'vault') {
    if (!config.vaultAddress) errors.push('VAULT_ADDR not set for Vault provider');
    if (!config.vaultPath) errors.push('VAULT_KEY_PATH not set for Vault provider');
  }
  
  // Generate recommendation
  let recommendation = '';
  if (errors.length > 0) {
    recommendation = 'Fix the configuration errors before starting the service';
  } else if (isProduction && provider === 'env') {
    recommendation = 'Migrate to AWS KMS or HashiCorp Vault for production key management';
  } else if (!isProduction) {
    recommendation = 'Current setup is acceptable for development/testnet';
  } else {
    recommendation = 'Key management configuration looks secure';
  }
  
  return {
    isSecure: errors.length === 0 && (provider !== 'env' || !isProduction),
    warnings,
    errors,
    recommendation,
  };
}

// ============ Key Loading ============

/**
 * Load private key from configured provider
 * For production, implement AWS KMS / Vault integration
 */
export async function loadPrivateKey(): Promise<`0x${string}` | null> {
  const provider = config.provider;
  
  switch (provider) {
    case 'env':
      return loadFromEnvironment();
      
    case 'aws-kms':
      // TODO: Implement AWS KMS integration
      // This would use @aws-sdk/client-kms to decrypt a stored key
      // or use KMS directly for signing (requires different transaction flow)
      console.error('AWS KMS provider not yet implemented');
      console.log('To implement: npm install @aws-sdk/client-kms');
      console.log(`
// Example AWS KMS implementation:
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

const client = new KMSClient({ region: '${config.awsRegion || 'us-east-1'}' });
const command = new DecryptCommand({
  KeyId: '${config.awsKmsKeyId || 'your-key-id'}',
  CiphertextBlob: encryptedKey,
});
const { Plaintext } = await client.send(command);
      `);
      return null;
      
    case 'vault':
      // TODO: Implement HashiCorp Vault integration
      console.error('HashiCorp Vault provider not yet implemented');
      console.log('To implement: npm install node-vault');
      console.log(`
// Example Vault implementation:
import vault from 'node-vault';

const client = vault({ 
  apiVersion: 'v1', 
  endpoint: '${config.vaultAddress || 'http://127.0.0.1:8200'}' 
});
const secret = await client.read('${config.vaultPath || 'secret/data/relayer'}');
const privateKey = secret.data.data.private_key;
      `);
      return null;
      
    case 'encrypted-file':
      // TODO: Implement encrypted file loading
      console.error('Encrypted file provider not yet implemented');
      return null;
      
    default:
      console.error(`Unknown key provider: ${provider}`);
      return null;
  }
}

function loadFromEnvironment(): `0x${string}` | null {
  const key = process.env.RELAYER_PRIVATE_KEY;
  
  if (!key) {
    return null;
  }
  
  const cleanKey = key.startsWith('0x') ? key : `0x${key}`;
  
  if (!/^0x[0-9a-fA-F]{64}$/.test(cleanKey)) {
    console.error('Invalid private key format');
    return null;
  }
  
  return cleanKey as `0x${string}`;
}

// ============ Account Creation ============

export async function createRelayerAccount(): Promise<PrivateKeyAccount | null> {
  const privateKey = await loadPrivateKey();
  
  if (!privateKey) {
    return null;
  }
  
  try {
    return privateKeyToAccount(privateKey);
  } catch (error: any) {
    console.error('Failed to create account from private key:', error.message);
    return null;
  }
}

// ============ Key Rotation Support ============

interface KeyRotationState {
  currentKeyId: string;
  rotationScheduled?: Date;
  lastRotation?: Date;
}

let keyRotationState: KeyRotationState | null = null;

export function getKeyRotationState(): KeyRotationState | null {
  return keyRotationState;
}

export function scheduleKeyRotation(scheduledDate: Date): void {
  if (config.provider !== 'aws-kms' && config.provider !== 'vault') {
    console.warn('Key rotation is only supported with AWS KMS or Vault providers');
    return;
  }
  
  keyRotationState = {
    currentKeyId: config.awsKmsKeyId || 'default',
    rotationScheduled: scheduledDate,
    lastRotation: keyRotationState?.lastRotation,
  };
  
  console.log(`Key rotation scheduled for: ${scheduledDate.toISOString()}`);
}

// ============ Startup Validation ============

export function runSecurityChecks(): boolean {
  console.log('\n🔐 Running security checks...\n');
  
  const validation = validateKeyConfiguration();
  
  // Log warnings
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  // Log errors
  if (validation.errors.length > 0) {
    console.log('❌ Errors:');
    validation.errors.forEach(e => console.log(`   - ${e}`));
  }
  
  // Log recommendation
  console.log(`\n📋 Recommendation: ${validation.recommendation}`);
  
  // Log provider info
  console.log(`\n🔑 Key Provider: ${config.provider.toUpperCase()}`);
  
  if (validation.isSecure) {
    console.log('✅ Security checks passed\n');
  } else if (validation.errors.length > 0) {
    console.log('❌ Security checks FAILED\n');
  } else {
    console.log('⚠️  Security checks passed with warnings\n');
  }
  
  // In production, fail on errors
  if (process.env.NODE_ENV === 'production' && validation.errors.length > 0) {
    console.error('Cannot start in production mode with security errors');
    return false;
  }
  
  return validation.errors.length === 0;
}

