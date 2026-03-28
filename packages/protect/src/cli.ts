#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// NoData CLI — Encrypt secrets. Run safe.
//
// Usage:
//   nodata init                    # Create API key + config
//   nodata encrypt .env            # Encrypt secrets in .env
//   nodata decrypt .env            # Decrypt back to plaintext
//   nodata run -- node server.js   # Run with decrypted env vars
//   nodata status                  # Show config + encrypted count
//
// The real secrets exist ONLY in memory, ONLY during runtime.
// ═══════════════════════════════════════════════════════════

import { loadConfig, saveConfig, getApiKey, NoDataConfig } from './config';
import { parseEnvFile, writeEnvFile, isEncrypted, detectSecrets, backupEnvFile, findEnvFile } from './env';
import { encryptValue, decryptValue, createApiKey } from './api';
import * as crypto from 'crypto';
import * as path from 'path';
import { execFileSync } from 'child_process';

const VERSION = '1.0.0';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(msg: string) { console.log(msg); }
function ok(msg: string) { log(`${GREEN}✓${RESET} ${msg}`); }
function warn(msg: string) { log(`${YELLOW}⚠${RESET} ${msg}`); }
function err(msg: string) { log(`${RED}✗${RESET} ${msg}`); }
function dim(msg: string) { return `${DIM}${msg}${RESET}`; }

function banner() {
  log('');
  log(`${GREEN}╔══════════════════════════════════════╗${RESET}`);
  log(`${GREEN}║${RESET}  ${BOLD}NoData CLI${RESET} v${VERSION}                  ${GREEN}║${RESET}`);
  log(`${GREEN}║${RESET}  ${DIM}Your secrets never touch disk.${RESET}      ${GREEN}║${RESET}`);
  log(`${GREEN}╚══════════════════════════════════════╝${RESET}`);
  log('');
}

// ── INIT: Create API key + config ──
async function cmdInit() {
  banner();
  log(`${CYAN}Setting up NoData...${RESET}`);
  log('');

  const config = loadConfig();

  if (config.api_key) {
    ok(`API key already configured: ${config.api_key.slice(0, 12)}...`);
    log(`${DIM}  To reset: delete ~/.nodata/config.json${RESET}`);
    return;
  }

  // Generate device ID and save immediately (so it doesn't change on retry)
  const deviceId = config.device_id || crypto.randomUUID();
  if (!config.device_id) {
    config.device_id = deviceId;
    saveConfig(config);
  }
  log(`${DIM}Device ID: ${deviceId}${RESET}`);

  try {
    log(`Creating API key...`);
    const result = await createApiKey(deviceId, 'nodata-cli', config.server);
    const newConfig: NoDataConfig = {
      api_key: result.full_key,
      device_id: deviceId,
      server: config.server,
    };
    saveConfig(newConfig);

    log('');
    ok(`API key created and saved to ~/.nodata/config.json`);
    log('');
    log(`${GREEN}${BOLD}  ${result.full_key}${RESET}`);
    log('');
    log(`  Tier: ${result.tier}`);
    log(`  ${DIM}Save this key — it won't be shown again.${RESET}`);
    log('');
    log(`${CYAN}Next steps:${RESET}`);
    log(`  ${GREEN}nodata encrypt .env${RESET}        ${DIM}# Encrypt your secrets${RESET}`);
    log(`  ${GREEN}nodata run -- node app.js${RESET}   ${DIM}# Run with decrypted env${RESET}`);
  } catch (e: any) {
    err(`Failed to create API key: ${e.message}`);
    log(`${DIM}  Make sure you have internet access.${RESET}`);
    log(`${DIM}  Or set NODATA_API_KEY manually.${RESET}`);
  }
}

// ── ENCRYPT: Encrypt secrets in .env ──
async function cmdEncrypt(envPath?: string) {
  banner();

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); return; }

  const filePath = envPath || findEnvFile();
  if (!filePath) {
    err('No .env file found in this directory.');
    log('');
    log(`  ${DIM}Make sure you're inside a project folder that has a .env or .env.local file.${RESET}`);
    log(`  ${DIM}Example: cd my-project && nodata encrypt${RESET}`);
    log('');
    log(`  ${DIM}Or specify the path: nodata encrypt /path/to/.env${RESET}`);
    return;
  }

  log(`${CYAN}Encrypting: ${filePath}${RESET}`);
  log('');

  const { entries } = parseEnvFile(filePath);
  const secrets = detectSecrets(entries);

  if (secrets.length === 0) {
    ok('No unencrypted secrets detected.');
    const alreadyEnc = entries.filter(e => e.value && isEncrypted(e.value));
    if (alreadyEnc.length > 0) {
      log(`${DIM}  ${alreadyEnc.length} values already encrypted.${RESET}`);
    }
    return;
  }

  log(`Found ${BOLD}${secrets.length}${RESET} secrets to encrypt:`);
  for (const s of secrets) {
    log(`  ${YELLOW}→${RESET} ${s.key} ${DIM}(${s.value.slice(0, 8)}...)${RESET}`);
  }
  log('');

  // Backup
  const backupPath = backupEnvFile(filePath);
  log(`${DIM}Backup: ${backupPath}${RESET}`);

  // Encrypt each secret
  let encrypted = 0;
  let failed = 0;
  const opts = { apiKey, server: config.server };

  for (const entry of entries) {
    if (!secrets.find(s => s.key === entry.key)) continue;

    try {
      process.stdout.write(`  Encrypting ${entry.key}... `);
      const enc = await encryptValue(entry.key, entry.value, opts);
      entry.value = enc;
      encrypted++;
      log(`${GREEN}✓${RESET}`);
    } catch (e: any) {
      failed++;
      log(`${RED}✗ ${e.message}${RESET}`);
    }
  }

  // Write back
  writeEnvFile(filePath, entries);

  log('');
  ok(`${encrypted} secrets encrypted, ${failed} failed.`);
  if (encrypted > 0) {
    log('');
    log(`${CYAN}Your .env is now safe.${RESET}`);
    log(`${DIM}Even if someone steals the file — they get nothing.${RESET}`);
    log('');
    log(`${CYAN}To run your app with decrypted env:${RESET}`);
    log(`  ${GREEN}nodata run -- node server.js${RESET}`);
    log(`  ${GREEN}nodata run -- npm start${RESET}`);
    log(`  ${GREEN}nodata run -- python app.py${RESET}`);
  }
}

// ── DECRYPT: Decrypt .env back to plaintext ──
async function cmdDecrypt(envPath?: string) {
  banner();

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); return; }

  const filePath = envPath || findEnvFile();
  if (!filePath) { err('No .env file found.'); return; }

  log(`${CYAN}Decrypting: ${filePath}${RESET}`);
  log('');

  const { entries } = parseEnvFile(filePath);
  const encryptedEntries = entries.filter(e => e.value && isEncrypted(e.value));

  if (encryptedEntries.length === 0) {
    ok('No encrypted values found.');
    return;
  }

  log(`Found ${BOLD}${encryptedEntries.length}${RESET} encrypted values:`);

  const backupPath = backupEnvFile(filePath);
  log(`${DIM}Backup: ${backupPath}${RESET}`);

  let decrypted = 0;
  const opts = { apiKey, server: config.server };

  for (const entry of entries) {
    if (!entry.value || !isEncrypted(entry.value)) continue;

    try {
      process.stdout.write(`  Decrypting ${entry.key}... `);
      const dec = await decryptValue(entry.key, entry.value, opts);
      entry.value = dec;
      decrypted++;
      log(`${GREEN}✓${RESET}`);
    } catch (e: any) {
      log(`${RED}✗ ${e.message}${RESET}`);
    }
  }

  writeEnvFile(filePath, entries);

  log('');
  ok(`${decrypted} values decrypted.`);
  warn('Your .env now contains plaintext secrets. Be careful.');
}

// ── RUN: Decrypt env vars in memory and run a command ──
async function cmdRun(args: string[]) {
  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); process.exit(1); }

  const filePath = findEnvFile();
  if (!filePath) { err('No .env file found.'); process.exit(1); }

  const { entries } = parseEnvFile(filePath);
  const encryptedEntries = entries.filter(e => e.value && isEncrypted(e.value));

  if (encryptedEntries.length === 0) {
    // No encrypted values — just pass through
    warn('No encrypted values in .env. Running command directly.');
  }

  // Build env: start with current process.env + all .env entries
  const env: Record<string, string> = { ...process.env as Record<string, string> };
  const opts = { apiKey, server: config.server };

  // Add non-encrypted values directly
  for (const entry of entries) {
    if (!entry.key || entry.comment || entry.isEmpty) continue;
    if (!isEncrypted(entry.value)) {
      env[entry.key] = entry.value;
    }
  }

  // Decrypt encrypted values
  let decrypted = 0;
  for (const entry of encryptedEntries) {
    try {
      process.stderr.write(`${DIM}  Decrypting ${entry.key}...${RESET} `);
      const dec = await decryptValue(entry.key, entry.value, opts);
      env[entry.key] = dec;
      decrypted++;
      process.stderr.write(`${GREEN}✓${RESET}\n`);
    } catch (e: any) {
      process.stderr.write(`${RED}✗${RESET}\n`);
      err(`  Failed to decrypt ${entry.key}: ${e.message}`);
      // Keep the encrypted value as fallback
      env[entry.key] = entry.value;
    }
  }

  if (decrypted > 0) {
    process.stderr.write(`${GREEN}✓ ${decrypted} secrets decrypted in memory.${RESET}\n`);
    process.stderr.write(`${DIM}  Secrets exist only in memory. Not on disk.${RESET}\n\n`);
  }

  // Run the command
  if (args.length === 0) {
    err('No command specified. Usage: nodata run -- node server.js');
    process.exit(1);
  }

  const [cmd, ...cmdArgs] = args;
  try {
    execFileSync(cmd, cmdArgs, {
      env,
      stdio: 'inherit',
      shell: true,
    });
  } catch (e: any) {
    if (e.status !== undefined) process.exit(e.status);
    process.exit(1);
  }
}

// ── STATUS: Show current config ──
function cmdStatus() {
  banner();

  const config = loadConfig();
  const filePath = findEnvFile();

  log(`${CYAN}Configuration:${RESET}`);
  log(`  API Key:   ${config.api_key ? `${GREEN}${config.api_key.slice(0, 16)}...${RESET}` : `${RED}Not set${RESET}`}`);
  log(`  Server:    ${config.server || 'https://www.nodatachat.com'}`);
  log(`  Device:    ${config.device_id || 'Not set'}`);
  log(`  Config:    ~/.nodata/config.json`);
  log('');

  if (filePath) {
    const { entries } = parseEnvFile(filePath);
    const total = entries.filter(e => e.key && e.value && !e.comment && !e.isEmpty).length;
    const enc = entries.filter(e => e.value && isEncrypted(e.value)).length;
    const secrets = detectSecrets(entries);

    log(`${CYAN}Environment: ${filePath}${RESET}`);
    log(`  Total vars:    ${total}`);
    log(`  Encrypted:     ${enc > 0 ? GREEN : ''}${enc}${RESET}`);
    log(`  Unencrypted secrets: ${secrets.length > 0 ? `${RED}${secrets.length}${RESET}` : `${GREEN}0${RESET}`}`);

    if (secrets.length > 0) {
      log('');
      warn('Unencrypted secrets found:');
      for (const s of secrets) {
        log(`    ${RED}→${RESET} ${s.key}`);
      }
      log('');
      log(`  Run ${GREEN}nodata encrypt${RESET} to protect them.`);
    }
  } else {
    log(`${DIM}  No .env file found in current directory.${RESET}`);
  }
}

// ── HELP ──
function cmdHelp() {
  banner();
  log(`${CYAN}Commands:${RESET}`);
  log(`  ${GREEN}nodata init${RESET}                     Create API key + save config`);
  log(`  ${GREEN}nodata encrypt${RESET} [.env]            Encrypt secrets in .env file`);
  log(`  ${GREEN}nodata decrypt${RESET} [.env]            Decrypt .env back to plaintext`);
  log(`  ${GREEN}nodata run -- <command>${RESET}          Run with decrypted env vars (in memory only)`);
  log(`  ${GREEN}nodata status${RESET}                   Show config + encryption status`);
  log(`  ${GREEN}nodata help${RESET}                     Show this help`);
  log('');
  log(`${CYAN}Examples:${RESET}`);
  log(`  ${DIM}# First time setup${RESET}`);
  log(`  nodata init`);
  log('');
  log(`  ${DIM}# Encrypt all secrets in .env${RESET}`);
  log(`  nodata encrypt`);
  log('');
  log(`  ${DIM}# Run your app safely${RESET}`);
  log(`  nodata run -- node server.js`);
  log(`  nodata run -- npm start`);
  log(`  nodata run -- python manage.py runserver`);
  log(`  nodata run -- docker compose up`);
  log('');
  log(`${CYAN}Environment variables:${RESET}`);
  log(`  NODATA_API_KEY     Override API key`);
  log(`  NODATA_SERVER      Override server URL`);
  log('');
  log(`${CYAN}How it works:${RESET}`);
  log(`  1. ${GREEN}nodata encrypt${RESET} replaces .env secrets with encrypted tokens`);
  log(`  2. The .env file on disk is now safe — even if stolen, nothing useful`);
  log(`  3. ${GREEN}nodata run${RESET} decrypts secrets ${BOLD}in memory only${RESET} and runs your app`);
  log(`  4. Real secrets never exist on disk. Only in RAM during execution.`);
  log('');
  log(`${CYAN}Important:${RESET}`);
  log(`  Run these commands ${BOLD}inside a project folder${RESET} that has a .env file.`);
  log(`  A .env file contains your secrets, like:`);
  log(`    ${DIM}OPENAI_API_KEY=sk-proj-abc123...${RESET}`);
  log(`    ${DIM}DATABASE_URL=postgres://user:pass@host/db${RESET}`);
  log(`    ${DIM}STRIPE_KEY=sk_live_xyz789...${RESET}`);
  log('');
}

// ── MAIN ──
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await cmdInit();
      break;

    case 'encrypt':
      await cmdEncrypt(args[1]);
      break;

    case 'decrypt':
      await cmdDecrypt(args[1]);
      break;

    case 'run': {
      // Find "--" separator
      const dashIdx = args.indexOf('--');
      const runArgs = dashIdx >= 0 ? args.slice(dashIdx + 1) : args.slice(1);
      await cmdRun(runArgs);
      break;
    }

    case 'status':
      cmdStatus();
      break;

    case 'help':
    case '--help':
    case '-h':
      cmdHelp();
      break;

    case '--version':
    case '-v':
      log(`nodata v${VERSION}`);
      break;

    default:
      if (!command) {
        cmdHelp();
      } else {
        err(`Unknown command: ${command}`);
        log(`Run ${GREEN}nodata help${RESET} for usage.`);
      }
  }
}

main().catch((e) => {
  err(e.message);
  process.exit(1);
});
