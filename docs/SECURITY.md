# Security Guide

## Overview

Claude-Mem takes security seriously. This document outlines security features, best practices, and how we protect your data.

## 🔐 Credential Security

### Secure API Key Storage

**Starting in version 10.6.0**, API keys are stored securely using OS-level credential managers via the `keytar` library:

- **Windows**: Windows Credential Manager
- **macOS**: Keychain
- **Linux**: Secret Service (libsecret)

This ensures your API keys are:
- ✅ Encrypted at rest by the OS
- ✅ Never stored in plaintext files
- ✅ Protected by OS-level access controls
- ✅ Isolated from other applications

### Automatic Migration

When you upgrade to version 10.6.0+, existing plaintext API keys are automatically migrated to secure storage on first run.

To manually trigger migration:

```bash
npm run migrate-credentials
```

### Fallback Encryption

If the OS credential manager is unavailable, claude-mem uses AES-256-GCM encryption with a machine-specific key:
- Credentials encrypted in `~/.claude-mem/.credentials`
- File permissions set to `0600` (owner read/write only)
- Machine-specific encryption key prevents cross-machine credential theft

### Supported Credentials

The following API keys are automatically secured:
- `CLAUDE_MEM_GEMINI_API_KEY`
- `CLAUDE_MEM_OPENROUTER_API_KEY`
- `CLAUDE_MEM_CHROMA_API_KEY` (future)

## 🌐 Network Security

### Localhost-Only Binding

The worker service binds to `127.0.0.1` by default, ensuring:
- No remote network exposure
- Only local processes can connect
- Protected from network-based attacks

### CORS Protection

CORS is restricted to localhost origins only:
- `http://localhost:*`
- `http://127.0.0.1:*`

External origins are explicitly denied.

### Admin Endpoint Protection

Admin endpoints (`/api/admin/*`) use IP-based filtering:
- Only accessible from `127.0.0.1`, `::1`, or `::ffff:127.0.0.1`
- Returns HTTP 403 for non-localhost connections
- Prevents remote restart/shutdown attacks

## 🛡️ Data Protection

### SQL Injection Prevention

All database queries use parameterized statements:

```typescript
// ✅ Safe - parameterized query
const stmt = db.prepare('SELECT * FROM observations WHERE id = ?');
stmt.get(userId);

// ❌ Unsafe - never used in claude-mem
db.run(`SELECT * FROM observations WHERE id = ${userId}`);
```

### Path Traversal Protection

File access validates paths against allowed directories:

```typescript
const OPERATIONS_BASE_DIR = path.resolve(__dirname, '../skills/mem-search/operations');
const operationPath = path.resolve(OPERATIONS_BASE_DIR, `${operation}.md`);
if (!operationPath.startsWith(OPERATIONS_BASE_DIR + path.sep)) {
  return res.status(400).json({ error: 'Invalid request' });
}
```

### Privacy Tags

Control what gets stored using privacy tags:

```
<private>
This content will not be stored in memory
</private>
```

Privacy features:
- Tag stripping at hook layer (before storage)
- ReDoS protection (limits tag count to prevent regex attacks)
- User-controlled privacy boundaries

## 📁 File Permissions

Sensitive files are protected with restrictive permissions:

```bash
chmod 600 ~/.claude-mem/settings.json      # Owner read/write only
chmod 600 ~/.claude-mem/claude-mem.db       # Database file
chmod 600 ~/.claude-mem/.credentials        # Encrypted credentials
```

These permissions are automatically set by claude-mem.

## 🔍 Security Best Practices

### For Users

1. **Keep claude-mem updated**
   ```bash
   npm update -g claude-mem
   ```

2. **Run credential migration** after upgrading from pre-10.6.0 versions:
   ```bash
   npm run migrate-credentials
   ```

3. **Protect your home directory**
   - Ensure `~/.claude-mem/` has proper ownership
   - Don't share your settings file
   - Don't commit settings to version control

4. **Use environment variables** for temporary API keys:
   ```bash
   export CLAUDE_MEM_GEMINI_API_KEY="your-key-here"
   ```

5. **Monitor worker logs** for suspicious activity:
   ```bash
   npm run worker:logs
   ```

### For Developers

1. **Never hardcode credentials** in source files
2. **Always use parameterized queries** for database access
3. **Validate all user input** before processing
4. **Use `requireLocalhost` middleware** for admin endpoints
5. **Test security features** before releasing

## 🚨 Security Advisories

### Reporting Vulnerabilities

If you discover a security vulnerability, please email:
- **Email**: security@claude-mem.ai (or create private GitHub Security Advisory)
- **Response Time**: Within 48 hours
- **Disclosure**: Coordinated disclosure after fix is available

**Do not** open public issues for security vulnerabilities.

### Known Limitations

1. **Process Memory**: API keys exist in memory while worker is running
   - Mitigation: Worker runs as user process with OS memory protection

2. **Local Access**: Any process running as your user can access the worker API
   - Mitigation: localhost-only binding prevents remote access

3. **Keytar Availability**: Requires OS credential manager support
   - Mitigation: Fallback to AES-256-GCM encrypted file storage

## 🔒 Compliance

### Data Residency

- All data stored locally in `~/.claude-mem/`
- No cloud storage by default
- Vector database (Chroma) runs locally or connects to user-specified remote

### GDPR Considerations

- Users have full control over data (local storage)
- Data deletion: Delete `~/.claude-mem/` directory
- No third-party data sharing (except configured AI providers)

### AGPL-3.0 License

Claude-mem is licensed under AGPL-3.0:
- Source code fully available
- Network use triggers copyleft obligations
- See [LICENSE](../LICENSE) for full terms

## 📚 Security Checklist

Before deploying claude-mem:

- [ ] Updated to latest version
- [ ] Ran credential migration (`npm run migrate-credentials`)
- [ ] Verified file permissions on `~/.claude-mem/`
- [ ] Configured API keys via secure storage or environment variables
- [ ] Reviewed network bindings (default `127.0.0.1:37777`)
- [ ] Enabled database encryption if handling sensitive data
- [ ] Set up log rotation to prevent disk exhaustion
- [ ] Documented recovery procedures for credential loss

## 🔗 Resources

- [Security Evaluation Report](./security-evaluation.md)
- [Installation Guide](../README.md#installation)
- [Configuration Reference](https://docs.claude-mem.ai/configuration)
- [GitHub Security Advisories](https://github.com/thedotmack/claude-mem/security/advisories)

---

**Last Updated**: 2026-02-27
**Security Contact**: security@claude-mem.ai
