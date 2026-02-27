# Installation Troubleshooting Guide

## 🔧 Native Module Build Failures

### Symptom
Installation fails with errors like:
```
npm ERR! gyp ERR! build error
npm ERR! gyp ERR! stack Error: not found: make
npm ERR! Failed at keytar@7.9.0 install script
```

### Cause
The `keytar` module (used for secure API key storage) requires native compilation if prebuilt binaries aren't available.

### Solution

**The good news:** Installation will still succeed! Claude-mem automatically falls back to encrypted file storage if keytar fails to install.

**For best security** (OS credential manager), install build tools:

#### Windows
```bash
# Option 1: Install Visual Studio Build Tools
npm install -g windows-build-tools

# Option 2: Install Visual Studio Community
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++" workload
```

#### macOS
```bash
xcode-select --install
```

#### Linux (Debian/Ubuntu)
```bash
sudo apt-get update
sudo apt-get install build-essential python3
```

#### Linux (RHEL/CentOS/Fedora)
```bash
sudo yum groupinstall "Development Tools"
sudo yum install python3
```

#### Linux (Alpine)
```bash
apk add --no-cache make gcc g++ python3
```

After installing build tools, reinstall:
```bash
npm install
```

---

## 🐧 Linux: Secret Service Not Available

### Symptom
keytar installs but credentials aren't stored in system keyring.

### Cause
Linux requires `libsecret` for OS credential storage.

### Solution

#### Debian/Ubuntu
```bash
sudo apt-get install libsecret-1-dev
```

#### RHEL/CentOS/Fedora
```bash
sudo yum install libsecret-devel
```

#### Arch Linux
```bash
sudo pacman -S libsecret
```

**Headless servers:** Encrypted file fallback is automatically used (appropriate for this environment).

---

## 🪟 WSL (Windows Subsystem for Linux)

### Symptom
keytar installs but can't access Windows Credential Manager.

### Solution
This is expected behavior. WSL uses the Linux Secret Service (if available) or encrypted file fallback.

**Recommendation:** Use encrypted file fallback (automatic) or install libsecret:
```bash
sudo apt-get install libsecret-1-dev
```

---

## 🐳 Docker/Containers

### Symptom
keytar fails to install or can't access credential storage.

### Solution
This is expected. Containers typically don't have OS credential managers.

**Recommended approach:**
1. Use environment variables for API keys:
   ```bash
   export CLAUDE_MEM_GEMINI_API_KEY="your-key"
   ```

2. Or accept encrypted file fallback (automatic)

**Dockerfile example:**
```dockerfile
FROM node:18

# Install build tools (optional, for keytar prebuilds)
RUN apt-get update && apt-get install -y build-essential python3

# Your app...
```

---

## 🍎 macOS: Keychain Access Denied

### Symptom
keytar installs but can't save credentials to Keychain.

### Solution
Grant Terminal/iTerm2 access to Keychain:
1. Open **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Full Disk Access** (or **Accessibility**)
3. Add your terminal application
4. Restart the terminal

---

## 🔄 Check Installation Status

### Verify keytar installation:
```bash
node -e "try { require('keytar'); console.log('✅ keytar available'); } catch(e) { console.log('⚠️ keytar not available - using fallback'); }"
```

### Check credential storage method:
```bash
npm run migrate-credentials
```

Look for:
- `✅ Using OS credential manager (keytar)` - Best security
- `⚠️ Using fallback encrypted file storage` - Still secure

---

## 📊 Storage Methods Comparison

| Method | Security | Platforms | Requirements |
|--------|----------|-----------|--------------|
| **OS Credential Manager** | ⭐⭐⭐⭐⭐ Best | Windows, macOS, Linux Desktop | Build tools + OS services |
| **Encrypted File (AES-256-GCM)** | ⭐⭐⭐⭐ Very Good | All | None (automatic fallback) |
| **Environment Variables** | ⭐⭐⭐ Good | All | Manual setup |
| **Plaintext (legacy)** | ❌ Not Secure | Deprecated | N/A |

---

## 🚀 Claude Code Plugin Installation

### Symptom
Installation via `/plugin install claude-mem` fails.

### Common Causes

1. **Network issues**
   ```bash
   # Check connectivity
   ping registry.npmjs.org
   ```

2. **Cache directory permissions**
   ```bash
   # Fix permissions
   chmod -R u+w ~/.claude/plugins/
   ```

3. **Npm configuration**
   ```bash
   # Check npm config
   npm config get prefix
   ```

### Solution Steps

1. **Verify Claude Code installation:**
   ```bash
   claude --version
   ```

2. **Clear plugin cache:**
   ```bash
   rm -rf ~/.claude/plugins/marketplaces/thedotmack
   ```

3. **Reinstall plugin:**
   ```
   /plugin marketplace add thedotmack/claude-mem
   /plugin install claude-mem
   ```

4. **Check worker status:**
   ```bash
   cd ~/.claude/plugins/marketplaces/thedotmack
   npm run worker:status
   ```

---

## 🔍 Debug Information

When reporting issues, include:

```bash
# System information
node --version
npm --version
echo "Platform: $(uname -s)"
echo "Arch: $(uname -m)"

# keytar status
node -e "try { require('keytar'); console.log('keytar: OK'); } catch(e) { console.log('keytar:', e.message); }"

# Build tools check
which make gcc g++ python3

# Installation log
npm install --verbose 2>&1 | tee install.log
```

---

## 📞 Getting Help

1. **Check existing issues:**
   https://github.com/thedotmack/claude-mem/issues

2. **Security documentation:**
   See `docs/SECURITY.md` for credential storage details

3. **Create new issue:**
   Include debug information above

---

## ✅ Quick Checklist

- [ ] Node.js >= 18.0.0 installed
- [ ] npm working correctly
- [ ] Build tools installed (for best security)
- [ ] Check keytar availability: `node -e "require('keytar')"`
- [ ] Verify fallback works if keytar unavailable
- [ ] Environment variables set (if using that method)
- [ ] Claude Code plugin installed successfully
- [ ] Worker service running: `npm run worker:status`

---

**Remember:** Even if keytar fails to install, claude-mem will work perfectly with encrypted file storage. Your API keys remain secure!
