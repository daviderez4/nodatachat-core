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
import { parseEnvFile, writeEnvFile, isEncrypted, detectSecrets, backupEnvFile, findEnvFile, countV1Entries } from './env';
import { encryptValue, decryptValue, createApiKey, sendHeartbeat, getFeatureStatus, registerIdentity, loginIdentity, verifyBindings, issueReceipt, verifyContent, buildSidecar, licenseVerify, licenseRevoke, licenseHeartbeat, type NodataSigV1 } from './api';
import { runDoctor } from './doctor';
import { buildTreeManifest, verifyTreeManifest, readTreeSidecar, writeTreeSidecar } from './sign-tree';
import { findRegionSpans, verifyAllRegions, upsertRegionSidecar, type SignedRegion } from './sign-region';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execFileSync } from 'child_process';

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      let input = '';
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === '\n' || c === '\r') {
          if (stdin.setRawMode) stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (c === '\u007f' || c === '\b') {
          if (input.length > 0) { input = input.slice(0, -1); process.stdout.write('\b \b'); }
        } else if (c === '\u0003') {
          process.exit(0);
        } else {
          input += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

const VERSION = '1.9.0';
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

// Print a one-line upgrade hint if the nearest .env still has v1 entries.
// Suppressed in CI / scripts via NODATA_NO_NUDGE=1. Never throws.
function showUpgradeNudge() {
  if (process.env.NODATA_NO_NUDGE) return;
  try {
    const filePath = findEnvFile();
    if (!filePath) return;
    const count = countV1Entries(filePath);
    if (count === 0) return;
    const word = count === 1 ? 'secret' : 'secrets';
    log('');
    log(`${DIM}ℹ  ${count} ${word} still use v1 format (key bundled in .env). Upgrade → ${RESET}${CYAN}nodata encrypt --upgrade${RESET}${DIM}  (seconds, auto-backup)${RESET}`);
  } catch { /* nudges are best-effort */ }
}

function banner() {
  log('');
  log(`${GREEN}╔══════════════════════════════════════╗${RESET}`);
  log(`${GREEN}║${RESET}  ${BOLD}NoData CLI${RESET} v${VERSION}                  ${GREEN}║${RESET}`);
  log(`${GREEN}║${RESET}  ${DIM}Your secrets never touch disk.${RESET}      ${GREEN}║${RESET}`);
  log(`${GREEN}╚══════════════════════════════════════╝${RESET}`);
  log('');
}

// ── INIT: Register identity + create API key ──
async function cmdInit() {
  banner();

  const config = loadConfig();

  if (config.nickname && config.api_key) {
    ok(`Already registered as ${BOLD}${config.nickname}${RESET}`);
    ok(`API key: ${config.api_key.slice(0, 16)}...`);
    ok(`Tier: ${config.tier || 'ghost'}`);
    log('');
    log(`${DIM}  To reset: delete ~/.nodata/config.json${RESET}`);
    log(`${DIM}  To login on another machine: nodata login${RESET}`);
    return;
  }

  log(`${CYAN}Register your identity${RESET}`);
  log(`${DIM}No email. No personal data. Just a nickname + 4-digit PIN.${RESET}`);
  log('');

  // Get nickname
  const nickname = await prompt(`  ${GREEN}Nickname:${RESET} `);
  if (!nickname.trim()) { err('Nickname is required.'); return; }

  // Get PIN
  const pin = await prompt(`  ${GREEN}4-digit PIN:${RESET} `, true);
  if (!/^\d{4}$/.test(pin)) { err('PIN must be exactly 4 digits.'); return; }

  const pinConfirm = await prompt(`  ${GREEN}Confirm PIN:${RESET} `, true);
  if (pin !== pinConfirm) { err('PINs do not match.'); return; }

  // Generate device ID
  const deviceId = config.device_id || crypto.randomUUID();

  log('');
  log(`${CYAN}Registering...${RESET}`);

  try {
    const result = await registerIdentity(nickname.trim(), pin, deviceId, config.server);

    const newConfig: NoDataConfig = {
      nickname: result.identity.nickname,
      device_id: deviceId,
      tier: result.identity.tier,
      server: config.server,
      api_key: result.api_key?.full_key || config.api_key,
    };
    saveConfig(newConfig);

    log('');
    ok(`Registered as ${BOLD}${result.identity.nickname}${RESET}`);
    ok(`Tier: ${result.identity.tier}`);

    if (result.api_key) {
      log('');
      log(`${GREEN}${BOLD}  API Key: ${result.api_key.full_key}${RESET}`);
      log(`  ${DIM}Save this key — it won't be shown again.${RESET}`);
    }

    log('');
    log(`${CYAN}Next steps:${RESET}`);
    log(`  ${GREEN}nodata encrypt .env${RESET}        ${DIM}# Encrypt your secrets${RESET}`);
    log(`  ${GREEN}nodata run -- node app.js${RESET}   ${DIM}# Run with decrypted env${RESET}`);
    log(`  ${GREEN}nodata status${RESET}              ${DIM}# See your identity + bindings${RESET}`);
    log('');
    log(`${DIM}Anything not working? Run: ${RESET}${GREEN}nodata doctor${RESET}${DIM} — 9 checks + tells you the next command.${RESET}`);
    log(`${DIM}On another machine? Run: nodata login${RESET}`);
  } catch (e: any) {
    if (e.message.includes('taken') || e.message.includes('Nickname')) {
      err(`Nickname "${nickname}" is already taken. Choose another.`);
    } else {
      err(`Registration failed: ${e.message}`);
    }
  }
}

// ── LOGIN: Connect existing identity on new machine ──
async function cmdLogin() {
  banner();

  const config = loadConfig();

  if (config.nickname && config.api_key) {
    ok(`Already logged in as ${BOLD}${config.nickname}${RESET}`);
    log(`${DIM}  To switch: delete ~/.nodata/config.json and run nodata login${RESET}`);
    return;
  }

  log(`${CYAN}Login with your nickname + PIN${RESET}`);
  log('');

  const nickname = await prompt(`  ${GREEN}Nickname:${RESET} `);
  if (!nickname.trim()) { err('Nickname is required.'); return; }

  const pin = await prompt(`  ${GREEN}PIN:${RESET} `, true);
  if (!/^\d{4}$/.test(pin)) { err('PIN must be 4 digits.'); return; }

  const deviceId = config.device_id || crypto.randomUUID();

  log('');
  log(`${CYAN}Logging in...${RESET}`);

  try {
    const result = await loginIdentity(nickname.trim(), pin, deviceId, config.server);

    const newConfig: NoDataConfig = {
      nickname: result.identity.nickname,
      device_id: deviceId,
      tier: result.identity.tier,
      server: config.server,
      api_key: config.api_key, // keep existing key if any
    };
    saveConfig(newConfig);

    log('');
    ok(`Welcome back, ${BOLD}${result.identity.nickname}${RESET}!`);
    ok(`Tier: ${result.identity.tier}`);
    ok(`Devices: ${result.identity.device_count}`);

    if (!newConfig.api_key) {
      log('');
      log(`${YELLOW}No API key on this machine.${RESET}`);
      log(`${DIM}  Ask your admin for an activation link, or run:${RESET}`);
      log(`  ${GREEN}nodata activate <token>${RESET}`);
    }

    log('');
  } catch (e: any) {
    err(`Login failed: ${e.message}`);
    log(`${DIM}  Check your nickname and PIN.${RESET}`);
    log(`${DIM}  First time? Run: nodata init${RESET}`);
  }
}

// ── ACTIVATE: Bind device via activation token ──
async function cmdActivate(token?: string) {
  banner();

  if (!token) { err('Usage: nodata activate <token>'); return; }

  const config = loadConfig();
  const deviceId = config.device_id || crypto.randomUUID();
  if (!config.device_id) { config.device_id = deviceId; saveConfig(config); }

  log(`${CYAN}Activating...${RESET}`);

  try {
    const { createHash } = await import('crypto');
    const server = config.server || 'https://www.nodatacapsule.com';

    // Call activate endpoint
    const body = JSON.stringify({ token, device_id: deviceId, device_fields: { source: 'cli', nickname: config.nickname } });
    const res = await new Promise<any>((resolve, reject) => {
      const parsed = new URL(`${server}/api/activate`);
      const https = require(parsed.protocol === 'https:' ? 'https' : 'http');
      const req = https.request({
        hostname: parsed.hostname, port: parsed.port || 443, path: parsed.pathname,
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (r: any) => {
        let raw = ''; r.on('data', (c: string) => { raw += c; }); r.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error(raw)); } });
      });
      req.on('error', reject); req.write(body); req.end();
    });

    if (!res.success) { err(res.error || 'Activation failed'); return; }

    // Save key + tier
    if (res.api_key?.full_key) { config.api_key = res.api_key.full_key; }
    if (res.entitlement?.grants?.tier) { config.tier = res.entitlement.grants.tier; }
    saveConfig(config);

    log('');
    ok(`Bound to ${BOLD}${res.entitlement.name}${RESET}`);
    ok(`Type: ${res.entitlement.type}`);
    ok(`Tier: ${res.entitlement.grants?.tier || 'ghost'}`);
    ok(`Slot: ${res.binding.slot} (${res.binding.slots_remaining} remaining)`);

    if (res.api_key?.full_key) {
      log('');
      log(`${GREEN}${BOLD}  API Key: ${res.api_key.full_key}${RESET}`);
      log(`  ${DIM}Saved to ~/.nodata/config.json${RESET}`);
    }

    log('');
    ok(`Proof: ${res.binding.proof.slice(0, 24)}...`);
  } catch (e: any) {
    err(`Activation failed: ${e.message}`);
  }
}

// ── UPGRADE: Re-encrypt v1 entries as v2 (in-place, with backup) ──
async function cmdEncryptUpgrade(envPath?: string) {
  banner();

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); return; }

  const filePath = envPath || findEnvFile();
  if (!filePath) { err('No .env file found.'); return; }

  log(`${CYAN}Upgrading v1 entries → v2 in: ${filePath}${RESET}`);
  log('');

  const { entries } = parseEnvFile(filePath);
  const v1Entries = entries.filter(
    (e) => e.value && e.value.startsWith('aes256gcm:v1:'),
  );
  const v2Entries = entries.filter(
    (e) => e.value && e.value.startsWith('aes256gcm:v2:'),
  );
  const plaintextSecrets = detectSecrets(entries);

  if (v1Entries.length === 0) {
    ok('No v1 entries to upgrade.');
    if (v2Entries.length > 0) log(`${DIM}  ${v2Entries.length} entries already on v2.${RESET}`);
    if (plaintextSecrets.length > 0) {
      log(`${DIM}  ${plaintextSecrets.length} unencrypted secrets — run \`nodata encrypt\` to protect them.${RESET}`);
    }
    return;
  }

  log(`Found ${BOLD}${v1Entries.length}${RESET} v1 entries to upgrade:`);
  for (const e of v1Entries) log(`  ${YELLOW}→${RESET} ${e.key}`);
  log('');

  // Mandatory backup BEFORE we touch anything
  const backupPath = `${filePath}.backup.upgrade.${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  log(`${DIM}Backup: ${backupPath}${RESET}`);

  const opts = { apiKey, server: config.server };
  const upgradedValues = new Map<string, string>();

  // Decrypt+re-encrypt each v1 entry, ABORT on first failure
  for (const entry of v1Entries) {
    try {
      process.stdout.write(`  ${entry.key}: decrypting v1... `);
      const plain = await decryptValue(entry.key, entry.value, opts);
      process.stdout.write('encrypting v2... ');
      const v2Cipher = await encryptValue(entry.key, plain, opts, 2);
      upgradedValues.set(entry.key, v2Cipher);
      log(`${GREEN}✓${RESET}`);
    } catch (e: any) {
      log(`${RED}✗ ${e.message}${RESET}`);
      err('Upgrade aborted. .env left unchanged (no entries were rewritten yet).');
      log(`${DIM}  Backup remains at: ${backupPath}${RESET}`);
      return;
    }
  }

  // All decrypts+encrypts succeeded — now apply in one atomic pass
  for (const entry of entries) {
    const newVal = upgradedValues.get(entry.key);
    if (newVal) entry.value = newVal;
  }
  writeEnvFile(filePath, entries);

  log('');
  ok(
    `${upgradedValues.size} v1 entries upgraded to v2, ` +
      `${v2Entries.length} already-v2 entries unchanged, ` +
      `${plaintextSecrets.length} plaintext entries skipped.`,
  );
  if (plaintextSecrets.length > 0) {
    log(`${DIM}Run \`nodata encrypt\` to protect the remaining plaintext secrets.${RESET}`);
  }

  // Issue a signed receipt so the user has public proof of the upgrade.
  // Payload is minimum-metadata: count only. Field names are the user's
  // business, not ours — see feedback_nodata_minimal_metadata.md.
  const receipt = await issueReceipt(
    'upgrade_v1_v2',
    { count: upgradedValues.size },
    opts,
  );
  if (receipt) {
    log('');
    log(`${CYAN}Signed receipt:${RESET}`);
    log(`  ${BOLD}${receipt.id}${RESET}  ${DIM}(event #${receipt.chain_index} on your chain)${RESET}`);
    log(`  ${GREEN}${receipt.proof_url}${RESET}`);
    log(`  ${DIM}Share this URL — it proves your .env is now server-wrapped.${RESET}`);
  }
}

// ── ENCRYPT: Encrypt secrets in .env ──
async function cmdEncrypt(envPath?: string, flags: { legacy?: boolean } = {}) {
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

  const version: 1 | 2 = flags.legacy ? 1 : 2;

  log(`${CYAN}Encrypting: ${filePath}${RESET}  ${DIM}(format: aes256gcm:v${version})${RESET}`);
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
      const enc = await encryptValue(entry.key, entry.value, opts, version);
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
  if (version === 2) {
    ok(`${encrypted} secrets encrypted (v2 — server-held KEK), ${failed} failed.`);
  } else {
    log(`${YELLOW}⚠${RESET} ${encrypted} secrets encrypted (${BOLD}v1 — legacy mode, key bundled in file${RESET}), ${failed} failed.`);
  }
  if (encrypted > 0) {
    log('');
    if (version === 2) {
      log(`${CYAN}Your .env is now in NoData v2 format. A stolen file alone is useless ciphertext.${RESET}`);
      log(`${DIM}The AES key is wrapped under our server-held KEK and only your device can request unwrap.${RESET}`);
    } else {
      log(`${CYAN}Your .env is now in NoData v1 (legacy) format.${RESET}`);
      log(`${DIM}Scraper bots skip it, but the AES key is bundled in the file. Run without --legacy for v2.${RESET}`);
    }
    log('');
    log(`${CYAN}To run your app with decrypted env:${RESET}`);
    log(`  ${GREEN}nodata run -- node server.js${RESET}`);
    log(`  ${GREEN}nodata run -- npm start${RESET}`);
    log(`  ${GREEN}nodata run -- python app.py${RESET}`);

    // Mint a signed receipt for this encrypt batch. Best-effort — never
    // fail the encrypt the user just ran because the proof API is down.
    // Payload is minimum-metadata: count + version only. Field names are
    // the user's business — see feedback_nodata_minimal_metadata.md.
    const receipt = await issueReceipt(
      'encrypt',
      { count: encrypted, version },
      opts,
    );
    if (receipt) {
      log('');
      log(`${CYAN}Signed receipt:${RESET}`);
      log(`  ${BOLD}${receipt.id}${RESET}  ${DIM}(event #${receipt.chain_index} on your chain)${RESET}`);
      log(`  ${GREEN}${receipt.proof_url}${RESET}`);
      log(`  ${DIM}Share this URL — it proves this encryption happened.${RESET}`);
    }
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

// ── STATUS: Show current config + identity + bindings ──
async function cmdStatus() {
  banner();

  const config = loadConfig();
  const filePath = findEnvFile();

  log(`${CYAN}Identity:${RESET}`);
  log(`  Nickname:  ${config.nickname ? `${GREEN}${BOLD}${config.nickname}${RESET}` : `${RED}Not registered${RESET} — run nodata init`}`);
  log(`  Tier:      ${config.tier || 'ghost'}`);
  log(`  API Key:   ${config.api_key ? `${GREEN}${config.api_key.slice(0, 16)}...${RESET}` : `${RED}Not set${RESET}`}`);
  log(`  Server:    ${config.server || 'https://www.nodatacapsule.com'}`);
  log(`  Device:    ${config.device_id || 'Not set'}`);
  log(`  Config:    ~/.nodata/config.json`);

  // Show bindings
  if (config.device_id) {
    try {
      const result = await verifyBindings(config.device_id, config.server);
      if (result.has_binding && result.bindings.length > 0) {
        log('');
        log(`${CYAN}Entitlements:${RESET}`);
        for (const b of result.bindings) {
          const tier = (b.grants as any)?.tier || '';
          log(`  ${GREEN}●${RESET} ${b.name} ${DIM}(${b.type}, slot ${b.slot}${tier ? `, ${tier}` : ''})${RESET}`);
        }
      }
    } catch { /* offline */ }
  }
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

// ── CONNECT: Register project with integrations hub ──
async function cmdConnect() {
  banner();

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); return; }

  log(`${CYAN}Connecting to NoData Hub...${RESET}`);
  log('');

  try {
    const res = await sendHeartbeat({
      apiKey,
      server: config.server,
      sdkVersion: VERSION,
      nodeVersion: process.version,
      features: [],
    });

    if (res.received && res.project) {
      const proj = res.project as { name: string; tier: string; installed_features?: { id: string; status: string }[] };
      ok(`Connected to project: ${BOLD}${proj.name}${RESET}`);
      log(`  Tier: ${proj.tier}`);
      const features = proj.installed_features || [];
      if (features.length > 0) {
        log(`  Active features: ${features.map((f: { id: string }) => f.id).join(', ')}`);
      } else {
        log(`  No features installed yet.`);
      }
      log('');
      log(`${CYAN}Next:${RESET}`);
      log(`  ${GREEN}nodata features${RESET}   See available features`);
      log(`  ${GREEN}nodata check${RESET}      Verify connection health`);
    } else {
      warn('Project not found in Hub.');
      log(`${DIM}  Ask your admin to add this project at /admin/integrations${RESET}`);
      log(`${DIM}  and link your API key.${RESET}`);
    }
  } catch (e: any) {
    err(`Connection failed: ${e.message}`);
  }
}

// ── FEATURES: Show available and installed features ──
async function cmdFeatures() {
  banner();

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); return; }

  log(`${CYAN}Checking features...${RESET}`);
  log('');

  try {
    const res = await getFeatureStatus({ apiKey, server: config.server });

    if (res.project) {
      const proj = res.project as { name: string; slug: string; tier: string; environment: string };
      log(`  Project: ${BOLD}${proj.name}${RESET} (${proj.slug})`);
      log(`  Tier: ${proj.tier} | Environment: ${proj.environment}`);
      log('');
    }

    const features = (res.features || []) as Array<{
      id: string; name: string; description: string; category: string;
      tier_required: string; installed: boolean; status: string | null; version: string | null;
    }>;

    if (features.length === 0) {
      warn('No features catalog available.');
      return;
    }

    // Table header
    log(`  ${'Feature'.padEnd(16)} ${'Status'.padEnd(12)} ${'Tier'.padEnd(12)} Description`);
    log(`  ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(30)}`);

    for (const f of features) {
      let statusStr: string;
      if (f.installed && f.status === 'active') {
        statusStr = `${GREEN}● active${RESET}    `;
      } else if (f.installed && f.status === 'disabled') {
        statusStr = `${YELLOW}○ disabled${RESET}  `;
      } else {
        statusStr = `${DIM}○ available${RESET} `;
      }

      const tierStr = f.tier_required.padEnd(12);
      const desc = f.description.length > 35 ? f.description.slice(0, 32) + '...' : f.description;

      log(`  ${f.id.padEnd(16)} ${statusStr} ${tierStr} ${DIM}${desc}${RESET}`);
    }

    log('');
    const installed = features.filter(f => f.installed).length;
    const available = features.length - installed;
    log(`  ${GREEN}${installed}${RESET} installed, ${available} available`);
    log('');
    log(`${DIM}  To install features, ask your admin at /admin/integrations${RESET}`);
  } catch (e: any) {
    err(`Failed to fetch features: ${e.message}`);
  }
}

// ── CHECK: Verify connection health ──
async function cmdCheck() {
  banner();

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); return; }

  log(`${CYAN}Running health check...${RESET}`);
  log('');

  // 1. Config
  ok(`API Key: ${apiKey.slice(0, 12)}...`);
  ok(`Server: ${config.server || 'https://www.nodatacapsule.com'}`);

  // 2. Heartbeat
  const start = Date.now();
  try {
    const res = await sendHeartbeat({
      apiKey,
      server: config.server,
      sdkVersion: VERSION,
      nodeVersion: process.version,
      features: [],
    });
    const latency = Date.now() - start;

    if (res.received) {
      ok(`Heartbeat: ${GREEN}${latency}ms${RESET}`);
      const proj = res.project as { name: string; tier: string } | undefined;
      if (proj) {
        ok(`Project: ${proj.name} (${proj.tier})`);
      }
    } else {
      warn('Heartbeat sent but project not linked.');
    }
  } catch (e: any) {
    err(`Heartbeat failed: ${e.message}`);
  }

  // 3. .env status
  const filePath = findEnvFile();
  if (filePath) {
    const { entries } = parseEnvFile(filePath);
    const enc = entries.filter(e => e.value && isEncrypted(e.value)).length;
    const secrets = detectSecrets(entries);
    if (secrets.length === 0 && enc > 0) {
      ok(`Secrets: All ${enc} encrypted`);
    } else if (secrets.length > 0) {
      warn(`Secrets: ${RED}${secrets.length} unencrypted${RESET} — run ${GREEN}nodata encrypt${RESET}`);
    } else {
      ok('No secrets detected in .env');
    }
  }

  log('');
}

// ── SIGN: Standalone content signing (writes .nodatasig sidecar) ──

async function cmdSign(filePath?: string, flags: { label?: string; dir?: boolean; region?: string; exclude?: string[] } = {}) {
  // Branch: --dir <path>  → sign whole folder (Merkle)
  if (flags.dir) {
    await cmdSignTree(filePath, flags.exclude);
    return;
  }
  // Branch: --region <id> → sign one region inside the file
  if (flags.region) {
    await cmdSignRegion(filePath, flags.region, flags.label);
    return;
  }

  if (!filePath) {
    err('Usage: nodata sign <file> [--label "short label"]');
    err('       nodata sign --dir <path> [--exclude=patterns]');
    err('       nodata sign <file> --region <id>');
    return;
  }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    err(`File not found: ${abs}`);
    return;
  }

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) {
    err('No API key. Run `nodata init` or `nodata login` first.');
    return;
  }

  log(`${CYAN}Hashing${RESET} ${dim(abs)}`);
  const buf = fs.readFileSync(abs);
  const contentHash = crypto.createHash('sha256').update(buf).digest('hex');
  log(`  ${DIM}sha256: ${contentHash}${RESET}`);

  log(`${CYAN}Signing...${RESET}`);
  const receipt = await issueReceipt(
    'content_signed',
    {
      content_hash: contentHash,
      has_label: Boolean(flags.label),
      ...(flags.label ? { label: flags.label } : {}),
      filename: path.basename(abs).slice(0, 120),
      size_bytes: buf.length,
    },
    { apiKey, server: config.server },
  );

  if (!receipt) {
    err('Signing failed — server returned no receipt. Check your connection and that your device is bound.');
    return;
  }

  if (!receipt.chain_hmac) {
    warn('Server response missing chain_hmac — sidecar will lack a full HMAC anchor.');
    warn('Upgrade your server to the latest release to fix this.');
  }

  const sidecar = buildSidecar({
    contentHash,
    receipt,
    label: flags.label,
    filename: path.basename(abs),
  });

  const sidecarPath = `${abs}.nodatasig`;
  fs.writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf8');

  log('');
  ok(`Signed by ${BOLD}${receipt.nickname}${RESET}`);
  log(`  ${DIM}Chain position:${RESET} #${receipt.chain_index}`);
  log(`  ${DIM}Receipt ID:    ${RESET} ${receipt.id}`);
  log(`  ${DIM}Sidecar:       ${RESET} ${sidecarPath}`);
  log(`  ${DIM}Proof page:    ${RESET} ${receipt.proof_url}`);
  log('');
  log(`${DIM}Share both <file> and <file>.nodatasig together; verify with:${RESET}`);
  log(`  ${GREEN}nodata verify ${path.basename(abs)}${RESET}`);
  log('');
}

// ── SIGN TREE: walk a folder, hash every file, anchor with one receipt ──

async function cmdSignTree(rootDir?: string, exclude?: string[]) {
  const target = rootDir || '.';
  const abs = path.resolve(target);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    err(`Not a directory: ${abs}`);
    return;
  }

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) {
    err('No API key. Run `nodata init` or `nodata login` first.');
    return;
  }

  log(`${CYAN}Walking${RESET} ${dim(abs)}`);
  let manifest;
  try {
    manifest = buildTreeManifest(abs, { exclude });
  } catch (e) {
    err(`Tree walk failed: ${e instanceof Error ? e.message : e}`);
    return;
  }

  log(`  ${DIM}Files:        ${RESET} ${manifest.file_count.toLocaleString()}`);
  log(`  ${DIM}Total bytes:  ${RESET} ${manifest.total_bytes.toLocaleString()}`);
  log(`  ${DIM}Merkle root:  ${RESET} ${manifest.merkle_root.slice(0, 32)}…`);
  log(`  ${DIM}Excludes:     ${RESET} ${manifest.excludes_applied.length} patterns`);

  log(`${CYAN}Signing tree...${RESET}`);
  const receipt = await issueReceipt(
    'content_signed',
    {
      content_hash: manifest.merkle_root,
      kind: 'tree',
      file_count: manifest.file_count,
      total_bytes: manifest.total_bytes,
      root_basename: manifest.root_basename,
    },
    { apiKey, server: config.server },
  );

  if (!receipt) {
    err('Tree signing failed — server returned no receipt.');
    return;
  }

  const sidecarPayload = {
    schema: 'nodatatree-v1',
    manifest,
    receipt: {
      receipt_id: receipt.id,
      chain_index: receipt.chain_index,
      prev_receipt_id: receipt.prev_receipt_id ?? null,
      chain_hmac: receipt.chain_hmac ?? '',
      event_hash: receipt.event_hash,
      signer_nickname: receipt.nickname,
      signed_at: receipt.created_at,
      proof_url: receipt.proof_url,
    },
  };

  const sidecarPath = writeTreeSidecar(abs, sidecarPayload);

  log('');
  ok(`Tree signed by ${BOLD}${receipt.nickname}${RESET}`);
  log(`  ${DIM}Files signed:  ${RESET} ${manifest.file_count.toLocaleString()}`);
  log(`  ${DIM}Chain position:${RESET} #${receipt.chain_index}`);
  log(`  ${DIM}Sidecar:       ${RESET} ${sidecarPath}`);
  log(`  ${DIM}Proof page:    ${RESET} ${receipt.proof_url}`);
  log('');
  log(`${DIM}Verify with:${RESET} ${GREEN}nodata verify --dir ${path.basename(abs)}${RESET}`);
  log('');
}

// ── SIGN REGION: sign a marked span inside one file ──

async function cmdSignRegion(filePath?: string, regionId?: string, label?: string) {
  if (!filePath || !regionId) {
    err('Usage: nodata sign <file> --region <id>');
    err('  Mark the region in the file with:');
    err('    // @nodata-sign-begin <id>');
    err('    ... your code ...');
    err('    // @nodata-sign-end <id>');
    return;
  }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    err(`File not found: ${abs}`);
    return;
  }

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) {
    err('No API key. Run `nodata init` or `nodata login` first.');
    return;
  }

  let spans;
  try {
    spans = findRegionSpans(abs);
  } catch (e) {
    err(`Region scan failed: ${e instanceof Error ? e.message : e}`);
    return;
  }

  const target = spans.find((s) => s.id === regionId);
  if (!target) {
    err(`Region "${regionId}" not found in ${path.basename(abs)}.`);
    if (spans.length > 0) {
      log(`${DIM}  Found regions: ${spans.map((s) => s.id).join(', ')}${RESET}`);
    } else {
      log(`${DIM}  No @nodata-sign-* markers in this file.${RESET}`);
    }
    return;
  }

  log(`${CYAN}Hashing region${RESET} ${BOLD}${target.id}${RESET} (${target.line_count} lines, ${dim(`L${target.begin_line}–L${target.end_line}`)})`);
  log(`  ${DIM}sha256: ${target.content_hash}${RESET}`);

  log(`${CYAN}Signing...${RESET}`);
  const receipt = await issueReceipt(
    'content_signed',
    {
      content_hash: target.content_hash,
      kind: 'region',
      region_id: target.id,
      filename: path.basename(abs).slice(0, 120),
      line_count: target.line_count,
      ...(label ? { label } : {}),
    },
    { apiKey, server: config.server },
  );

  if (!receipt) {
    err('Region signing failed — server returned no receipt.');
    return;
  }

  const signed: SignedRegion = {
    id: target.id,
    begin_line: target.begin_line,
    end_line: target.end_line,
    content_hash: target.content_hash,
    line_count: target.line_count,
    signer_nickname: receipt.nickname,
    signed_at: receipt.created_at,
    receipt_id: receipt.id,
    chain_index: receipt.chain_index,
    prev_receipt_id: receipt.prev_receipt_id ?? null,
    chain_hmac: receipt.chain_hmac ?? '',
    event_hash: receipt.event_hash,
  };

  const sidecarPath = upsertRegionSidecar(abs, signed);

  log('');
  ok(`Region ${BOLD}${target.id}${RESET} signed by ${BOLD}${receipt.nickname}${RESET}`);
  log(`  ${DIM}Chain position:${RESET} #${receipt.chain_index}`);
  log(`  ${DIM}Sidecar:       ${RESET} ${sidecarPath}`);
  log(`  ${DIM}Proof page:    ${RESET} ${receipt.proof_url}`);
  log('');
  log(`${DIM}Verify with:${RESET} ${GREEN}nodata verify ${path.basename(abs)} --region ${target.id}${RESET}`);
  log('');
}

// ── VERIFY: Public verification via /api/verify (no auth required) ──

async function cmdVerify(filePath?: string, flags: { sidecar?: string; receiptId?: string; dir?: boolean; region?: string } = {}) {
  // Branch: --dir <path> → verify whole-folder Merkle manifest
  if (flags.dir) {
    cmdVerifyTree(filePath);
    return;
  }
  // Branch: --region <id> (or "all" / no id) → verify region(s) in file
  if (flags.region !== undefined) {
    cmdVerifyRegion(filePath, flags.region);
    return;
  }

  if (!filePath) {
    err('Usage: nodata verify <file> [--sidecar <file.nodatasig>] [--receipt-id <id>]');
    err('       nodata verify --dir <path>');
    err('       nodata verify <file> --region <id|all>');
    return;
  }

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    err(`File not found: ${abs}`);
    return;
  }

  const config = loadConfig();

  const buf = fs.readFileSync(abs);
  const contentHash = crypto.createHash('sha256').update(buf).digest('hex');

  // Locate the sidecar: explicit --sidecar flag wins; else look for <file>.nodatasig;
  // if neither found, require --receipt-id.
  let sidecar: NodataSigV1 | null = null;
  const sidecarPath = flags.sidecar
    ? path.resolve(flags.sidecar)
    : `${abs}.nodatasig`;

  if (fs.existsSync(sidecarPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) as NodataSigV1;
      if (parsed.schema !== 'nodatasig-v1') {
        err(`Sidecar ${sidecarPath} is not a nodatasig-v1 (found schema=${(parsed as { schema?: string }).schema})`);
        return;
      }
      sidecar = parsed;
    } catch (e) {
      err(`Failed to parse sidecar ${sidecarPath}: ${e instanceof Error ? e.message : e}`);
      return;
    }
  } else if (!flags.receiptId) {
    err(`No sidecar at ${sidecarPath} and no --receipt-id given.`);
    log(`${DIM}Run: nodata verify ${path.basename(abs)} --sidecar <path>${RESET}`);
    return;
  }

  log(`${CYAN}Hashing${RESET} ${dim(abs)}`);
  log(`  ${DIM}sha256: ${contentHash}${RESET}`);
  log(`${CYAN}Verifying...${RESET}`);

  try {
    const result = await verifyContent(contentHash, {
      server: config.server,
      receiptId: flags.receiptId || sidecar?.receipt_id,
      sidecar: sidecar ?? undefined,
    });

    log('');
    if (result.valid) {
      ok(`${BOLD}Signature is valid${RESET}`);
      log(`  ${DIM}Signer:        ${RESET} ${result.signer_nickname || '—'}`);
      log(`  ${DIM}Event type:    ${RESET} ${result.event_type || '—'}`);
      log(`  ${DIM}Signed at:     ${RESET} ${result.signed_at || '—'}`);
      log(`  ${DIM}Chain position:${RESET} #${result.chain_index ?? '—'}`);
      if (result.proof_url) log(`  ${DIM}Proof page:    ${RESET} ${config.server || 'https://www.nodatacapsule.com'}${result.proof_url}`);
    } else {
      err(`${BOLD}Signature is NOT valid${RESET}`);
      if (result.reason) log(`  ${DIM}Reason: ${result.reason}${RESET}`);
      if (result.checks) {
        log(`  ${DIM}Content hash match: ${result.checks.content_hash_match ? 'ok' : 'FAIL'}${RESET}`);
        log(`  ${DIM}Event hash match:   ${result.checks.event_hash_match ? 'ok' : 'FAIL'}${RESET}`);
        log(`  ${DIM}Chain HMAC match:   ${result.checks.chain_hmac_match ? 'ok' : 'FAIL'}${RESET}`);
        if (result.checks.sidecar) {
          for (const [k, v] of Object.entries(result.checks.sidecar)) {
            log(`  ${DIM}Sidecar ${k}: ${v ? 'ok' : 'FAIL'}${RESET}`);
          }
        }
      }
      process.exitCode = 2;
    }
    log('');
  } catch (e) {
    err(`Verification failed: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 3;
  }
}

// ── VERIFY TREE: walk a folder, compare against manifest in .nodata-tree.sig ──

function cmdVerifyTree(rootDir?: string) {
  const target = rootDir || '.';
  const abs = path.resolve(target);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    err(`Not a directory: ${abs}`);
    return;
  }

  const stored = readTreeSidecar(abs);
  if (!stored) {
    err(`No .nodata-tree.sig found in ${abs}`);
    log(`${DIM}  Sign the tree first: nodata sign --dir ${target}${RESET}`);
    return;
  }

  log(`${CYAN}Re-walking${RESET} ${dim(abs)}`);
  let result;
  try {
    result = verifyTreeManifest(abs, stored.manifest);
  } catch (e) {
    err(`Re-walk failed: ${e instanceof Error ? e.message : e}`);
    return;
  }

  log('');
  if (result.ok) {
    ok(`${BOLD}Tree integrity verified${RESET}`);
    log(`  ${DIM}Files unchanged: ${RESET} ${result.unchanged.toLocaleString()} / ${stored.manifest.file_count.toLocaleString()}`);
    log(`  ${DIM}Merkle root:    ${RESET} ${result.actual_merkle_root.slice(0, 32)}…`);
    const recv = stored.sidecar.receipt as { signer_nickname?: string; signed_at?: string; proof_url?: string } | undefined;
    if (recv?.signer_nickname) log(`  ${DIM}Signer:         ${RESET} ${recv.signer_nickname}`);
    if (recv?.signed_at) log(`  ${DIM}Signed at:      ${RESET} ${recv.signed_at}`);
    if (recv?.proof_url) log(`  ${DIM}Proof page:     ${RESET} ${recv.proof_url}`);
  } else {
    err(`${BOLD}Tree integrity FAILED${RESET}`);
    log(`  ${DIM}Expected root: ${RESET} ${result.expected_merkle_root.slice(0, 32)}…`);
    log(`  ${DIM}Actual root:   ${RESET} ${result.actual_merkle_root.slice(0, 32)}…`);
    if (result.modified.length > 0) {
      log('');
      log(`  ${RED}${result.modified.length} modified:${RESET}`);
      for (const p of result.modified.slice(0, 20)) log(`    ${RED}~${RESET} ${p}`);
      if (result.modified.length > 20) log(`    ${DIM}… and ${result.modified.length - 20} more${RESET}`);
    }
    if (result.added.length > 0) {
      log('');
      log(`  ${YELLOW}${result.added.length} added (unsigned):${RESET}`);
      for (const p of result.added.slice(0, 20)) log(`    ${YELLOW}+${RESET} ${p}`);
      if (result.added.length > 20) log(`    ${DIM}… and ${result.added.length - 20} more${RESET}`);
    }
    if (result.removed.length > 0) {
      log('');
      log(`  ${RED}${result.removed.length} removed (missing):${RESET}`);
      for (const p of result.removed.slice(0, 20)) log(`    ${RED}-${RESET} ${p}`);
      if (result.removed.length > 20) log(`    ${DIM}… and ${result.removed.length - 20} more${RESET}`);
    }
    process.exitCode = 2;
  }
  log('');
}

// ── VERIFY REGION: compare each region against its sidecar ──

function cmdVerifyRegion(filePath?: string, regionId?: string) {
  if (!filePath) {
    err('Usage: nodata verify <file> --region <id|all>');
    return;
  }
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    err(`File not found: ${abs}`);
    return;
  }

  let results;
  try {
    results = verifyAllRegions(abs);
  } catch (e) {
    err(`Region scan failed: ${e instanceof Error ? e.message : e}`);
    return;
  }

  if (results.length === 0) {
    err(`No region sidecar at ${abs}.nodatasig.regions and no @nodata-sign-* markers found.`);
    return;
  }

  const filtered = (regionId && regionId !== 'all') ? results.filter((r) => r.id === regionId) : results;
  if (filtered.length === 0) {
    err(`Region "${regionId}" not found in this file.`);
    log(`${DIM}  Found regions: ${results.map((r) => r.id).join(', ')}${RESET}`);
    return;
  }

  log(`${CYAN}Verifying regions in${RESET} ${dim(path.basename(abs))}`);
  log('');

  let modifiedCount = 0;
  let unsignedCount = 0;
  for (const r of filtered) {
    const tag = `${BOLD}${r.id}${RESET}`;
    if (r.status === 'unchanged') {
      ok(`${tag}  unchanged (L${r.begin_line}–L${r.end_line})`);
    } else if (r.status === 'modified') {
      err(`${tag}  ${RED}MODIFIED${RESET} (L${r.begin_line}–L${r.end_line})`);
      log(`     ${DIM}expected: ${r.expected_hash?.slice(0, 16)}…  actual: ${r.actual_hash?.slice(0, 16)}…${RESET}`);
      modifiedCount += 1;
    } else if (r.status === 'missing_in_file') {
      err(`${tag}  ${RED}MISSING from file${RESET} (signed but markers gone)`);
      modifiedCount += 1;
    } else if (r.status === 'missing_in_sidecar') {
      warn(`${tag}  unsigned region in file (L${r.begin_line}–L${r.end_line})`);
      log(`     ${DIM}Run: nodata sign ${path.basename(abs)} --region ${r.id}${RESET}`);
      unsignedCount += 1;
    }
  }

  log('');
  if (modifiedCount > 0) {
    err(`${modifiedCount} region${modifiedCount > 1 ? 's' : ''} failed integrity check.`);
    process.exitCode = 2;
  } else if (unsignedCount > 0) {
    log(`${YELLOW}${unsignedCount} region${unsignedCount > 1 ? 's' : ''} present in file but not yet signed.${RESET}`);
  } else {
    ok(`All ${filtered.length} region${filtered.length > 1 ? 's' : ''} verified.`);
  }
  log('');
}

// ── HELP ──
function cmdHelp() {
  banner();
  log(`${CYAN}Identity:${RESET}`);
  log(`  ${GREEN}nodata init${RESET}                     Register nickname + PIN → get API key`);
  log(`  ${GREEN}nodata login${RESET}                    Login on another machine with nickname + PIN`);
  log(`  ${GREEN}nodata activate <token>${RESET}          Bind device via activation link`);
  log('');
  log(`${CYAN}Tools:${RESET}`);
  log(`  ${GREEN}nodata encrypt${RESET} [.env]            Encrypt secrets in .env file`);
  log(`  ${GREEN}nodata decrypt${RESET} [.env]            Decrypt .env back to plaintext`);
  log(`  ${GREEN}nodata run -- <command>${RESET}          Run with decrypted env vars (in memory only)`);
  log(`  ${GREEN}nodata sign <file>${RESET}               Sign any file → writes <file>.nodatasig sidecar`);
  log(`  ${GREEN}nodata sign --dir <path>${RESET}         Sign a whole folder (Merkle) → writes .nodata-tree.sig at root`);
  log(`  ${GREEN}nodata sign <file> --region <id>${RESET} Sign a marked region inside a file (// @nodata-sign-begin/end <id>)`);
  log(`  ${GREEN}nodata verify <file>${RESET}             Verify a file against its .nodatasig sidecar`);
  log(`  ${GREEN}nodata verify --dir <path>${RESET}       Verify whole folder against .nodata-tree.sig`);
  log(`  ${GREEN}nodata verify <file> --region <id|all>${RESET} Verify region(s) in a file`);
  log(`  ${GREEN}nodata license verify${RESET}            Show active license bindings on this device`);
  log(`  ${GREEN}nodata license heartbeat${RESET}         Grace-aware enforcement check (active / grace / none)`);
  log(`  ${GREEN}nodata license revoke <id>${RESET}       Revoke a license you issued (bulk or per-binding)`);
  log('');
  log(`${CYAN}Info:${RESET}`);
  log(`  ${GREEN}nodata status${RESET}                   Show identity + bindings + encryption status`);
  log(`  ${GREEN}nodata connect${RESET}                  Connect project to NoData Hub`);
  log(`  ${GREEN}nodata features${RESET}                 Show available & installed features`);
  log(`  ${GREEN}nodata check${RESET}                    Verify connection health (lightweight)`);
  log(`  ${GREEN}nodata doctor${RESET}                   Full self-diagnostic — 9 checks + suggested next steps`);
  log(`  ${GREEN}nodata doctor --verbose${RESET}         Same, but list every available command`);
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
  log(`  2. The .env file on disk is now in an encrypted format — scraper bots + stealers skip it`);
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

// ── LICENSE: verify | revoke (plan 07 Track 2 §2B-CLI) ──
//
// Usage:
//   nodata license verify              — show all bindings on this device
//   nodata license verify <license_id> — narrow to one license
//   nodata license revoke <license_id> [--reason "<text>"] — bulk revoke
//   nodata license revoke --binding <binding_id> [--reason "..."]
async function cmdLicense(args: string[]) {
  banner();

  const sub = args[0];
  if (!sub || (sub !== 'verify' && sub !== 'revoke' && sub !== 'heartbeat')) {
    err('Usage: nodata license <verify|revoke|heartbeat> [args]');
    log(`  ${DIM}nodata license verify [<license_id>]${RESET}`);
    log(`  ${DIM}nodata license heartbeat${RESET}                    grace-aware enforcement check`);
    log(`  ${DIM}nodata license revoke <license_id> [--reason "..."]${RESET}`);
    log(`  ${DIM}nodata license revoke --binding <binding_id> [--reason "..."]${RESET}`);
    return;
  }

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) { err('No API key. Run: nodata init'); return; }

  if (sub === 'verify') {
    const licenseId = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
    try {
      const res = await licenseVerify({ apiKey, server: config.server, license_id: licenseId });
      if (!res.has_binding) {
        warn('No active bindings on this device.');
        return;
      }
      ok(`${res.bindings.length} active binding(s):`);
      log('');
      for (const b of res.bindings) {
        log(`  ${BOLD}${b.name}${RESET} ${dim('· ' + b.type + ' · slot #' + b.slot)}`);
        log(`    ${DIM}id: ${b.entitlement_id}${RESET}`);
        log(`    ${DIM}bound: ${b.bound_at}${RESET}`);
        if (b.expires_at) log(`    ${DIM}expires: ${b.expires_at}${RESET}`);
        log('');
      }
    } catch (e: any) {
      err(`Verify failed: ${e.message}`);
    }
    return;
  }

  if (sub === 'heartbeat') {
    try {
      const res = await licenseHeartbeat({ apiKey, server: config.server });
      const stateLabel =
        res.state === 'active' ? `${GREEN}active${RESET}` :
        res.state === 'grace' ? `${YELLOW}grace${RESET}` :
        `${DIM}none${RESET}`;
      log(`State: ${stateLabel}  (active=${res.has_active}, grace=${res.has_grace})`);
      log(`${DIM}Checked at: ${res.checked_at}${RESET}`);
      log('');
      if (res.bindings.length === 0) {
        warn('No bindings on this device.');
        return;
      }
      for (const b of res.bindings) {
        const tag =
          b.state === 'active' ? `${GREEN}● active${RESET}` :
          b.state === 'grace' ? `${YELLOW}● grace${RESET}` :
          b.state === 'expired' ? `${DIM}● expired${RESET}` :
          `${RED}● revoked${RESET}`;
        log(`  ${BOLD}${b.name}${RESET}  ${tag}  ${dim('slot #' + b.slot)}`);
        log(`    ${DIM}id: ${b.entitlement_id}${RESET}`);
        if (b.grace_until) log(`    ${DIM}grace_until: ${b.grace_until} (window: ${b.grace_period_seconds}s)${RESET}`);
        if (b.expires_at) log(`    ${DIM}expires: ${b.expires_at}${RESET}`);
        if (b.revoked_at) log(`    ${DIM}revoked: ${b.revoked_at}${RESET}`);
        log('');
      }
    } catch (e: any) {
      err(`Heartbeat failed: ${e.message}`);
    }
    return;
  }

  // revoke
  const reasonIdx = args.indexOf('--reason');
  const reason = reasonIdx >= 0 ? args[reasonIdx + 1] : undefined;
  const bindingIdx = args.indexOf('--binding');
  const bindingId = bindingIdx >= 0 ? args[bindingIdx + 1] : undefined;
  const licenseId = !bindingId && args[1] && !args[1].startsWith('--') ? args[1] : undefined;

  if (!licenseId && !bindingId) {
    err('Usage: nodata license revoke <license_id>  OR  nodata license revoke --binding <binding_id>');
    return;
  }

  try {
    const res = await licenseRevoke({
      apiKey, server: config.server,
      license_id: licenseId, binding_id: bindingId, reason,
    });
    if (res.mode === 'bulk') {
      ok(`Revoked license: ${BOLD}${res.entitlement_name}${RESET}`);
      ok(`Bindings revoked: ${res.bindings_revoked}`);
    } else {
      ok(`Revoked binding on ${BOLD}${res.entitlement_name}${RESET}`);
      ok(`Device: ${res.revoked_device_id}`);
    }
    if (res.receipt) {
      log(`${DIM}Receipt: ${res.receipt.id} (chain #${res.receipt.chain_index})${RESET}`);
    }
  } catch (e: any) {
    err(`Revoke failed: ${e.message}`);
  }
}

// ── MAIN ──
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await cmdInit();
      break;

    case 'encrypt': {
      const upgrade = args.includes('--upgrade');
      const flags = {
        legacy: args.includes('--legacy') || args.includes('--v1'),
      };
      const positional = args.slice(1).find((a) => !a.startsWith('--'));
      if (upgrade) {
        await cmdEncryptUpgrade(positional);
      } else {
        await cmdEncrypt(positional, flags);
      }
      break;
    }

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

    case 'login':
      await cmdLogin();
      break;

    case 'activate':
      await cmdActivate(args[1]);
      break;

    case 'status':
      await cmdStatus();
      break;

    case 'connect':
      await cmdConnect();
      break;

    case 'features':
      await cmdFeatures();
      break;

    case 'check':
      await cmdCheck();
      break;

    case 'doctor':
      await runDoctor(VERSION, { verbose: args.includes('--verbose') || args.includes('-v') });
      break;

    case 'sign': {
      const positional = args.slice(1).find((a) => !a.startsWith('--'));
      const labelIdx = args.indexOf('--label');
      const label = labelIdx >= 0 ? args[labelIdx + 1] : undefined;
      const dir = args.includes('--dir');
      const regionIdx = args.indexOf('--region');
      const region = regionIdx >= 0 ? args[regionIdx + 1] : undefined;
      const excludeIdx = args.indexOf('--exclude');
      const exclude =
        excludeIdx >= 0 && args[excludeIdx + 1]
          ? args[excludeIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;
      await cmdSign(positional, { label, dir, region, exclude });
      break;
    }

    case 'verify': {
      const positional = args.slice(1).find((a) => !a.startsWith('--'));
      const sidecarIdx = args.indexOf('--sidecar');
      const sidecar = sidecarIdx >= 0 ? args[sidecarIdx + 1] : undefined;
      const receiptIdx = args.indexOf('--receipt-id');
      const receiptId = receiptIdx >= 0 ? args[receiptIdx + 1] : undefined;
      const dir = args.includes('--dir');
      const regionIdx = args.indexOf('--region');
      // --region with no value defaults to "all"
      const region = regionIdx >= 0 ? (args[regionIdx + 1] && !args[regionIdx + 1].startsWith('--') ? args[regionIdx + 1] : 'all') : undefined;
      await cmdVerify(positional, { sidecar, receiptId, dir, region });
      break;
    }

    case 'license':
      await cmdLicense(args.slice(1));
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

// Commands where the nudge would be noisy or redundant.
const NUDGE_SKIP = new Set(['help', '--help', '-h', '--version', '-v']);

main()
  .then(() => {
    const args = process.argv.slice(2);
    const command = args[0];
    if (!command) return;
    if (NUDGE_SKIP.has(command)) return;
    // Don't nag during the very action that fixes the situation.
    if (command === 'encrypt' && args.includes('--upgrade')) return;
    showUpgradeNudge();
  })
  .catch((e) => {
    err(e.message);
    process.exit(1);
  });
