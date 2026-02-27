#!/usr/bin/env node
/**
 * Post-Install Check for keytar availability
 *
 * Tests if keytar (OS credential storage) installed successfully.
 * Provides helpful guidance if installation failed.
 */

console.log('\n🔐 Checking credential storage setup...\n');

let keytarAvailable = false;

try {
  require('keytar');
  keytarAvailable = true;
  console.log('✅ keytar installed successfully');
  console.log('   Using OS credential manager for API key storage');
  console.log('   - Windows: Credential Manager');
  console.log('   - macOS: Keychain');
  console.log('   - Linux: Secret Service\n');
} catch (error) {
  console.log('⚠️  keytar installation failed');
  console.log('   Falling back to encrypted file storage (AES-256-GCM)');
  console.log('   Your API keys will still be secure.\n');

  console.log('📝 To enable OS credential storage, install build tools:\n');

  const platform = process.platform;

  if (platform === 'win32') {
    console.log('   Windows:');
    console.log('   npm install -g windows-build-tools');
    console.log('   (or install Visual Studio Build Tools)\n');
  } else if (platform === 'darwin') {
    console.log('   macOS:');
    console.log('   xcode-select --install\n');
  } else if (platform === 'linux') {
    console.log('   Linux (Debian/Ubuntu):');
    console.log('   sudo apt-get install build-essential python3\n');
    console.log('   Linux (RHEL/CentOS/Fedora):');
    console.log('   sudo yum groupinstall "Development Tools"\n');
  } else {
    console.log('   Install build tools for your platform\n');
  }

  console.log('   Then reinstall: npm install\n');
}

// Check if we're in a CI/containerized environment
const isCI = process.env.CI === 'true' ||
             process.env.DOCKER === 'true' ||
             process.env.CONTAINER === 'true';

if (isCI && !keytarAvailable) {
  console.log('ℹ️  Running in CI/container environment');
  console.log('   Encrypted file fallback is appropriate for this environment.\n');
}

process.exit(0); // Always succeed - keytar is optional
