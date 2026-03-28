// ═══════════════════════════════════════════════════════════
// .env file parser and writer
// Handles reading, encrypting, and decrypting .env files
// ═══════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';

export interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
  isEmpty?: boolean;
}

const NODATA_PREFIX = 'ndc_enc_';
const NODATA_AES_PREFIX = 'aes256gcm:v1:';

/**
 * Parse a .env file into entries (preserves comments and empty lines).
 */
export function parseEnvFile(filePath: string): { entries: EnvEntry[]; raw: string } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');
  const entries: EnvEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      entries.push({ key: '', value: '', isEmpty: true });
      continue;
    }

    // Comment
    if (trimmed.startsWith('#')) {
      entries.push({ key: '', value: '', comment: trimmed });
      continue;
    }

    // KEY=VALUE
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      entries.push({ key: '', value: '', comment: trimmed });
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    entries.push({ key, value });
  }

  return { entries, raw };
}

/**
 * Write entries back to a .env file.
 */
export function writeEnvFile(filePath: string, entries: EnvEntry[]): void {
  const lines: string[] = [];

  for (const entry of entries) {
    if (entry.isEmpty) { lines.push(''); continue; }
    if (entry.comment) { lines.push(entry.comment); continue; }
    // Quote values that contain spaces or special chars
    const needsQuotes = entry.value.includes(' ') || entry.value.includes('#') || entry.value.includes('\n');
    const val = needsQuotes ? `"${entry.value}"` : entry.value;
    lines.push(`${entry.key}=${val}`);
  }

  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

/**
 * Check if a value is already encrypted by NoData.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(NODATA_PREFIX) || value.startsWith(NODATA_AES_PREFIX);
}

/**
 * Detect which keys look like secrets (should be encrypted).
 */
export function detectSecrets(entries: EnvEntry[]): EnvEntry[] {
  const SECRET_PATTERNS = [
    /key/i, /secret/i, /password/i, /token/i, /credential/i,
    /api_key/i, /apikey/i, /private/i, /auth/i,
    /database_url/i, /db_url/i, /redis_url/i, /mongo/i,
    /stripe/i, /twilio/i, /sendgrid/i, /aws/i,
    /openai/i, /anthropic/i, /claude/i, /gemini/i,
    /ssh/i, /cert/i, /signing/i, /encryption/i,
    /smtp/i, /webhook.*secret/i,
  ];

  return entries.filter(e => {
    if (!e.key || !e.value || e.comment || e.isEmpty) return false;
    if (isEncrypted(e.value)) return false; // Already encrypted
    return SECRET_PATTERNS.some(p => p.test(e.key));
  });
}

/**
 * Create a backup of the .env file before modifying.
 */
export function backupEnvFile(filePath: string): string {
  const backupPath = filePath + '.backup.' + Date.now();
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Find the .env file in the current or parent directories.
 */
export function findEnvFile(startDir?: string): string | null {
  let dir = startDir || process.cwd();

  for (let i = 0; i < 5; i++) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) return envPath;

    const envLocal = path.join(dir, '.env.local');
    if (fs.existsSync(envLocal)) return envLocal;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}
