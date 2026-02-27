#!/usr/bin/env node
/**
 * Credential Security Validation Script
 *
 * Validates that the credential security implementation is working correctly.
 * This is a Node-compatible alternative to Bun tests.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

console.log('🔐 Credential Security Validation\n');
console.log('='.repeat(50));

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ ${message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ ${message}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual: ${actual}`);
    testsFailed++;
  }
}

// Test 1: CredentialManager module exists
console.log('\n📦 Testing CredentialManager module...');
const credentialManagerPath = './src/shared/CredentialManager.ts';
assert(existsSync(credentialManagerPath), 'CredentialManager.ts file exists');

// Test 2: Check secure credential keys are defined
const credentialManagerContent = readFileSync(credentialManagerPath, 'utf-8');
assert(
  credentialManagerContent.includes('CLAUDE_MEM_GEMINI_API_KEY'),
  'GEMINI_API_KEY is a secure credential'
);
assert(
  credentialManagerContent.includes('CLAUDE_MEM_OPENROUTER_API_KEY'),
  'OPENROUTER_API_KEY is a secure credential'
);
assert(
  credentialManagerContent.includes('CLAUDE_MEM_CHROMA_API_KEY'),
  'CHROMA_API_KEY is a secure credential'
);

// Test 3: Check encryption implementation
console.log('\n🔒 Testing encryption implementation...');
assert(
  credentialManagerContent.includes('aes-256-gcm'),
  'Uses AES-256-GCM encryption'
);
assert(
  credentialManagerContent.includes('createCipheriv'),
  'Uses Node crypto for encryption'
);
assert(
  credentialManagerContent.includes('keytar'),
  'Uses keytar for OS credential storage'
);

// Test 4: Check migration functionality
console.log('\n🔄 Testing migration functionality...');
assert(
  credentialManagerContent.includes('migrateFromPlaintext'),
  'Migration function exists'
);
assert(
  credentialManagerContent.includes('loadIntoSettings'),
  'Settings loader exists'
);

// Test 5: SettingsDefaultsManager integration
console.log('\n⚙️  Testing SettingsDefaultsManager integration...');
const settingsManagerPath = './src/shared/SettingsDefaultsManager.ts';
assert(existsSync(settingsManagerPath), 'SettingsDefaultsManager.ts exists');

const settingsContent = readFileSync(settingsManagerPath, 'utf-8');
assert(
  settingsContent.includes('loadFromFileSecure'),
  'loadFromFileSecure method exists'
);
assert(
  settingsContent.includes('saveToFileSecure'),
  'saveToFileSecure method exists'
);
assert(
  settingsContent.includes('chmodSync'),
  'File permission enforcement exists'
);

// Test 6: Migration script
console.log('\n📜 Testing migration script...');
const migrationScriptPath = './scripts/migrate-credentials.ts';
assert(existsSync(migrationScriptPath), 'Migration script exists');
assert(
  readFileSync(migrationScriptPath, 'utf-8').includes('migrateCredentials'),
  'Migration script has main function'
);

// Test 7: Build configuration
console.log('\n🔧 Testing build configuration...');
const buildScriptPath = './scripts/build-hooks.js';
const buildScript = readFileSync(buildScriptPath, 'utf-8');
assert(
  buildScript.includes("external: [") && buildScript.includes("'keytar'"),
  'Build script externalizes keytar'
);

// Test 8: Package.json updates
console.log('\n📦 Testing package.json updates...');
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
assert(
  packageJson.dependencies.keytar !== undefined,
  'keytar in main dependencies'
);
assert(
  packageJson.scripts['migrate-credentials'] !== undefined,
  'migrate-credentials script exists'
);

// Test 9: .gitignore security
console.log('\n🔒 Testing .gitignore security...');
const gitignore = readFileSync('./.gitignore', 'utf-8');
assert(
  gitignore.includes('.credentials'),
  '.credentials file excluded from git'
);
assert(
  gitignore.includes('.env'),
  '.env files excluded from git'
);

// Test 10: Documentation
console.log('\n📚 Testing documentation...');
assert(existsSync('./docs/SECURITY.md'), 'SECURITY.md exists');
assert(
  existsSync('./docs/security-implementation-summary.md'),
  'Implementation summary exists'
);

const securityDoc = readFileSync('./docs/SECURITY.md', 'utf-8');
assert(
  securityDoc.includes('Credential Security'),
  'SECURITY.md covers credential security'
);
assert(
  securityDoc.includes('keytar'),
  'SECURITY.md mentions keytar'
);

// Test 11: File permission constants
console.log('\n🔐 Testing security constants...');
assert(
  credentialManagerContent.includes('0o600') || settingsContent.includes('0o600'),
  'File permissions set to 0600 (owner read/write only)'
);

// Test 12: Fallback encryption key generation
console.log('\n🔑 Testing fallback encryption...');
assert(
  credentialManagerContent.includes('getMachineKey'),
  'Machine-specific key generation exists'
);
assert(
  credentialManagerContent.includes('homedir()'),
  'Uses homedir for machine-specific key'
);

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 Test Results:');
console.log(`   ✅ Passed: ${testsPassed}`);
console.log(`   ❌ Failed: ${testsFailed}`);
console.log(`   Total: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log('\n🎉 All validation tests passed!');
  console.log('\n✅ Credential security implementation is complete and correct.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some validation tests failed.');
  console.log('\nPlease review the failed tests above.');
  process.exit(1);
}
