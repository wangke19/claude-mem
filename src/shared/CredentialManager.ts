/**
 * CredentialManager - Secure API Key Storage
 *
 * Uses OS-level credential managers for secure storage of sensitive data:
 * - Windows: Credential Manager
 * - macOS: Keychain
 * - Linux: Secret Service (libsecret)
 *
 * Falls back to encrypted file storage if keytar is unavailable.
 *
 * Security Features:
 * - OS-level encryption at rest
 * - No plaintext API keys in settings.json
 * - Automatic migration from plaintext to secure storage
 */

import * as keytar from 'keytar';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Service name for keytar (used in Keychain/Credential Manager)
const SERVICE_NAME = 'claude-mem';

// Credential keys that should be stored securely
const SECURE_CREDENTIAL_KEYS = [
  'CLAUDE_MEM_GEMINI_API_KEY',
  'CLAUDE_MEM_OPENROUTER_API_KEY',
  'CLAUDE_MEM_CHROMA_API_KEY',
] as const;

type SecureCredentialKey = typeof SECURE_CREDENTIAL_KEYS[number];

/**
 * Get machine-specific encryption key
 * Used as fallback when keytar is unavailable
 */
function getMachineKey(): string {
  // Use machine-specific data to derive encryption key
  const machineId = `${homedir()}-${process.platform}-${process.arch}`;
  return createHash('sha256').update(machineId).digest('hex');
}

/**
 * Encrypt a value using AES-256-GCM
 * Used for fallback file-based storage
 */
function encrypt(value: string, key: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a value using AES-256-GCM
 * Used for fallback file-based storage
 */
function decrypt(encryptedValue: string, key: string): string {
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Fallback encrypted file storage path
 */
function getEncryptedStoragePath(): string {
  return join(homedir(), '.claude-mem', '.credentials');
}

/**
 * Check if keytar is available
 */
async function isKeytarAvailable(): Promise<boolean> {
  try {
    await keytar.findCredentials(SERVICE_NAME);
    return true;
  } catch (error) {
    console.warn('[CREDENTIALS] keytar unavailable, using fallback encryption:', error);
    return false;
  }
}

/**
 * Credential Manager - Secure API Key Storage
 */
export class CredentialManager {
  private static useKeytar: boolean | null = null;

  /**
   * Initialize credential manager
   * Determines if keytar is available
   */
  static async initialize(): Promise<void> {
    if (this.useKeytar === null) {
      this.useKeytar = await isKeytarAvailable();
      if (this.useKeytar) {
        console.log('[CREDENTIALS] Using OS credential manager (keytar)');
      } else {
        console.log('[CREDENTIALS] Using fallback encrypted file storage');
      }
    }
  }

  /**
   * Store a credential securely
   */
  static async setCredential(key: SecureCredentialKey, value: string): Promise<void> {
    await this.initialize();

    if (!value) {
      // Delete credential if value is empty
      return this.deleteCredential(key);
    }

    if (this.useKeytar) {
      // Use OS credential manager
      try {
        await keytar.setPassword(SERVICE_NAME, key, value);
        console.log(`[CREDENTIALS] Stored ${key} in OS credential manager`);
      } catch (error) {
        console.error(`[CREDENTIALS] Failed to store ${key} in keytar:`, error);
        // Fallback to encrypted file
        this.setCredentialFallback(key, value);
      }
    } else {
      // Use encrypted file storage
      this.setCredentialFallback(key, value);
    }
  }

  /**
   * Retrieve a credential securely
   */
  static async getCredential(key: SecureCredentialKey): Promise<string | null> {
    await this.initialize();

    if (this.useKeytar) {
      try {
        const value = await keytar.getPassword(SERVICE_NAME, key);
        return value;
      } catch (error) {
        console.warn(`[CREDENTIALS] Failed to retrieve ${key} from keytar:`, error);
        // Fallback to encrypted file
        return this.getCredentialFallback(key);
      }
    } else {
      return this.getCredentialFallback(key);
    }
  }

  /**
   * Delete a credential
   */
  static async deleteCredential(key: SecureCredentialKey): Promise<void> {
    await this.initialize();

    if (this.useKeytar) {
      try {
        await keytar.deletePassword(SERVICE_NAME, key);
        console.log(`[CREDENTIALS] Deleted ${key} from OS credential manager`);
      } catch (error) {
        console.warn(`[CREDENTIALS] Failed to delete ${key} from keytar:`, error);
      }
    }

    // Also delete from fallback storage if it exists
    this.deleteCredentialFallback(key);
  }

  /**
   * Migrate plaintext credentials from settings.json to secure storage
   */
  static async migrateFromPlaintext(settings: Record<string, any>): Promise<void> {
    let migrated = false;

    for (const key of SECURE_CREDENTIAL_KEYS) {
      const value = settings[key];
      if (value && typeof value === 'string' && value.length > 0) {
        // Check if it's not already a migration marker
        if (!value.startsWith('keytar:') && !value.startsWith('encrypted:')) {
          await this.setCredential(key, value);
          settings[key] = `keytar:${key}`; // Migration marker
          migrated = true;
          console.log(`[CREDENTIALS] Migrated ${key} to secure storage`);
        }
      }
    }

    if (migrated) {
      console.log('[CREDENTIALS] Migration complete - API keys now stored securely');
    }
  }

  /**
   * Load credentials into settings object
   * Replaces migration markers with actual values
   */
  static async loadIntoSettings(settings: Record<string, any>): Promise<void> {
    for (const key of SECURE_CREDENTIAL_KEYS) {
      const settingValue = settings[key];

      // If value is a migration marker, load from secure storage
      if (settingValue && typeof settingValue === 'string') {
        if (settingValue.startsWith('keytar:') || settingValue.startsWith('encrypted:')) {
          const actualValue = await this.getCredential(key);
          settings[key] = actualValue || '';
        }
      }
      // If value is empty but we have a stored credential, use it
      else if (!settingValue || settingValue === '') {
        const actualValue = await this.getCredential(key);
        if (actualValue) {
          settings[key] = actualValue;
        }
      }
    }
  }

  /**
   * Fallback: Store credential in encrypted file
   */
  private static setCredentialFallback(key: SecureCredentialKey, value: string): void {
    try {
      const storagePath = getEncryptedStoragePath();
      const machineKey = getMachineKey();

      // Load existing credentials
      let credentials: Record<string, string> = {};
      if (existsSync(storagePath)) {
        const encryptedData = readFileSync(storagePath, 'utf-8');
        try {
          const decryptedData = decrypt(encryptedData, machineKey);
          credentials = JSON.parse(decryptedData);
        } catch {
          // If decryption fails, start fresh
          credentials = {};
        }
      }

      // Update credential
      credentials[key] = value;

      // Encrypt and save
      const encryptedData = encrypt(JSON.stringify(credentials), machineKey);
      writeFileSync(storagePath, encryptedData, 'utf-8');

      // Set restrictive permissions (owner read/write only)
      try {
        chmodSync(storagePath, 0o600);
      } catch (error) {
        console.warn('[CREDENTIALS] Failed to set file permissions:', error);
      }

      console.log(`[CREDENTIALS] Stored ${key} in encrypted file`);
    } catch (error) {
      console.error(`[CREDENTIALS] Failed to store ${key} in fallback storage:`, error);
    }
  }

  /**
   * Fallback: Retrieve credential from encrypted file
   */
  private static getCredentialFallback(key: SecureCredentialKey): string | null {
    try {
      const storagePath = getEncryptedStoragePath();
      if (!existsSync(storagePath)) {
        return null;
      }

      const machineKey = getMachineKey();
      const encryptedData = readFileSync(storagePath, 'utf-8');
      const decryptedData = decrypt(encryptedData, machineKey);
      const credentials = JSON.parse(decryptedData);

      return credentials[key] || null;
    } catch (error) {
      console.error(`[CREDENTIALS] Failed to retrieve ${key} from fallback storage:`, error);
      return null;
    }
  }

  /**
   * Fallback: Delete credential from encrypted file
   */
  private static deleteCredentialFallback(key: SecureCredentialKey): void {
    try {
      const storagePath = getEncryptedStoragePath();
      if (!existsSync(storagePath)) {
        return;
      }

      const machineKey = getMachineKey();
      const encryptedData = readFileSync(storagePath, 'utf-8');
      const decryptedData = decrypt(encryptedData, machineKey);
      const credentials = JSON.parse(decryptedData);

      delete credentials[key];

      // Re-encrypt and save
      const newEncryptedData = encrypt(JSON.stringify(credentials), machineKey);
      writeFileSync(storagePath, newEncryptedData, 'utf-8');
      chmodSync(storagePath, 0o600);

      console.log(`[CREDENTIALS] Deleted ${key} from encrypted file`);
    } catch (error) {
      console.error(`[CREDENTIALS] Failed to delete ${key} from fallback storage:`, error);
    }
  }

  /**
   * Check if a key is a secure credential key
   */
  static isSecureCredential(key: string): key is SecureCredentialKey {
    return SECURE_CREDENTIAL_KEYS.includes(key as SecureCredentialKey);
  }

  /**
   * Get list of secure credential keys
   */
  static getSecureCredentialKeys(): readonly SecureCredentialKey[] {
    return SECURE_CREDENTIAL_KEYS;
  }
}
