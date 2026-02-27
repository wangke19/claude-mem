#!/usr/bin/env bun
/**
 * Credential Migration Script
 *
 * Migrates plaintext API keys from settings.json to secure OS credential storage.
 * Run this after upgrading to ensure existing API keys are protected.
 *
 * Usage:
 *   bun scripts/migrate-credentials.ts
 */

import { CredentialManager } from '../src/shared/CredentialManager.js';
import { SettingsDefaultsManager } from '../src/shared/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from '../src/shared/paths.js';

async function migrateCredentials() {
  console.log('🔐 Claude-Mem Credential Migration Tool');
  console.log('========================================\n');

  console.log(`Settings file: ${USER_SETTINGS_PATH}\n`);

  try {
    // Load current settings
    console.log('📖 Loading current settings...');
    const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);

    // Check for plaintext credentials
    const secureKeys = CredentialManager.getSecureCredentialKeys();
    const plaintextKeys: string[] = [];

    for (const key of secureKeys) {
      const value = settings[key];
      if (value && typeof value === 'string' && value.length > 0) {
        // Check if it's not already migrated
        if (!value.startsWith('keytar:') && !value.startsWith('encrypted:')) {
          plaintextKeys.push(key);
        }
      }
    }

    if (plaintextKeys.length === 0) {
      console.log('✅ No plaintext credentials found - all API keys are already secure!');
      return;
    }

    console.log(`⚠️  Found ${plaintextKeys.length} plaintext credential(s):`);
    plaintextKeys.forEach(key => console.log(`   - ${key}`));
    console.log();

    // Perform migration
    console.log('🔄 Migrating credentials to secure storage...');
    await CredentialManager.migrateFromPlaintext(settings as any);

    // Save updated settings
    console.log('💾 Updating settings file...');
    await SettingsDefaultsManager.saveToFileSecure(USER_SETTINGS_PATH, settings);

    console.log('\n✅ Migration complete! Your API keys are now stored securely.');
    console.log('\nWhat happened:');
    console.log('  • API keys moved to OS credential manager (Keychain/Credential Manager)');
    console.log('  • Settings file updated with migration markers');
    console.log('  • File permissions set to 0600 (owner read/write only)');
    console.log('\nYour API keys will now be loaded automatically from secure storage.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nPlease check:');
    console.error('  • Settings file exists and is readable');
    console.error('  • You have write permissions to the settings directory');
    console.error('  • keytar is properly installed (npm install keytar)');
    process.exit(1);
  }
}

// Run migration
migrateCredentials().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
