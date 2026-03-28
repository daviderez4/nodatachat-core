// ═══════════════════════════════════════════════════════════
// NoData API Client — calls the NoData server to encrypt/decrypt
// ═══════════════════════════════════════════════════════════

import * as https from 'https';
import * as http from 'http';

const DEFAULT_SERVER = 'https://www.nodatachat.com';

interface ApiOptions {
  apiKey: string;
  server?: string;
}

interface ApiResponse {
  success?: boolean;
  encrypted?: string;
  decrypted?: string;
  error?: string;
  [key: string]: unknown;
}

function request(url: string, data: Record<string, unknown>, apiKey: string): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'nodata-cli/1.0.0',
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Invalid response: ${raw.slice(0, 200)}`)); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function encryptValue(field: string, value: string, opts: ApiOptions): Promise<string> {
  const server = opts.server || DEFAULT_SERVER;
  const res = await request(`${server}/api/v1/encrypt`, { field, value }, opts.apiKey);
  // API returns 'ciphertext' field, not 'encrypted'
  const result = res.ciphertext || res.encrypted;
  if (result) return result as string;
  throw new Error(res.error || (res as any).message || `Encryption failed (${JSON.stringify(res).slice(0, 100)})`);
}

export async function decryptValue(field: string, encrypted: string, opts: ApiOptions): Promise<string> {
  const server = opts.server || DEFAULT_SERVER;
  const res = await request(`${server}/api/v1/decrypt`, { field, ciphertext: encrypted }, opts.apiKey);
  // API returns 'value' field, not 'decrypted'
  const result = res.value || res.decrypted;
  if (result) return result as string;
  throw new Error(res.error || (res as any).message || `Decryption failed (${JSON.stringify(res).slice(0, 100)})`);
}

export async function createApiKey(deviceId: string, label: string, server?: string): Promise<{ full_key: string; tier: string }> {
  const s = server || DEFAULT_SERVER;
  const res = await request(`${s}/api/keys/create`, { device_id: deviceId, label }, '');
  if (res.full_key) return { full_key: res.full_key as string, tier: (res.tier as string) || 'free' };
  throw new Error(res.error || 'Key creation failed');
}
