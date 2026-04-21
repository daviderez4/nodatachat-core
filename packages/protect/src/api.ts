// ═══════════════════════════════════════════════════════════
// NoData API Client — calls the NoData server to encrypt/decrypt
// ═══════════════════════════════════════════════════════════

import * as https from 'https';
import * as http from 'http';

const DEFAULT_SERVER = 'https://www.nodatacapsule.com';

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

export async function encryptValue(
  field: string,
  value: string,
  opts: ApiOptions,
  version: 1 | 2 = 2,
): Promise<string> {
  const server = opts.server || DEFAULT_SERVER;
  const body: Record<string, unknown> = { field, value };
  if (version === 2) body.version = 2;
  const res = await request(`${server}/api/v1/encrypt`, body, opts.apiKey);
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

export interface IssuedReceipt {
  id: string;
  chain_index: number;
  event_hash: string;
  created_at: string;
  nickname: string;
  proof_url: string;
}

export async function issueReceipt(
  eventType: 'upgrade_v1_v2' | 'encrypt' | 'binding' | 'decrypt_batch' | 'kek_rotation',
  payload: Record<string, unknown>,
  opts: ApiOptions,
): Promise<IssuedReceipt | null> {
  const server = opts.server || DEFAULT_SERVER;
  try {
    const res = await request(
      `${server}/api/v1/receipt`,
      { event_type: eventType, payload },
      opts.apiKey,
    );
    if (res.success && res.receipt && res.nickname && res.proof_url) {
      const r = res.receipt as { id: string; chain_index: number; event_hash: string; created_at: string };
      return {
        id: r.id,
        chain_index: r.chain_index,
        event_hash: r.event_hash,
        created_at: r.created_at,
        nickname: res.nickname as string,
        proof_url: res.proof_url as string,
      };
    }
    return null;
  } catch {
    // Receipt is a bonus; if the server is old (no /api/v1/receipt) or the
    // network blinks, don't fail the actual upgrade the user cares about.
    return null;
  }
}

// ── Integration endpoints ──────────────────────────────────

export async function sendHeartbeat(opts: ApiOptions & {
  sdkVersion: string;
  nodeVersion: string;
  features: string[];
}): Promise<ApiResponse> {
  const server = opts.server || DEFAULT_SERVER;
  return request(`${server}/api/integrations/heartbeat`, {
    api_key: opts.apiKey,
    sdk_version: opts.sdkVersion,
    node_version: opts.nodeVersion,
    features: opts.features,
    status: 'ok',
  }, opts.apiKey);
}

export async function getFeatureStatus(opts: ApiOptions): Promise<ApiResponse> {
  const server = opts.server || DEFAULT_SERVER;
  return request(`${server}/api/integrations/status`, {
    api_key: opts.apiKey,
  }, opts.apiKey);
}

export async function createApiKey(deviceId: string, label: string, server?: string): Promise<{ full_key: string; tier: string }> {
  const s = server || DEFAULT_SERVER;
  const res = await request(`${s}/api/keys/create`, { device_id: deviceId, label }, '');
  if (res.full_key) return { full_key: res.full_key as string, tier: (res.tier as string) || 'free' };
  throw new Error(res.error || 'Key creation failed');
}

// ── Identity: register + login with nickname + PIN ────────

/** Hash PIN client-side before sending (same as web) */
async function hashPinForTransport(pin: string, nickname: string): Promise<string> {
  const { createHash } = await import('crypto');
  const input = `nodatachat:site-pin:client:${nickname.toLowerCase()}:${pin}`;
  return createHash('sha256').update(input).digest('hex');
}

export async function registerIdentity(nickname: string, pin: string, deviceId: string, server?: string): Promise<{
  identity: { id: string; nickname: string; tier: string };
  api_key?: { full_key: string; prefix: string };
}> {
  const s = server || DEFAULT_SERVER;
  const pinHash = await hashPinForTransport(pin, nickname);
  const res = await requestNoAuth(`${s}/api/identity/pin-register`, {
    nickname: nickname.trim(),
    pin_hash: pinHash,
    device_id: deviceId,
    tier: 'ghost',
  });
  if (res.success) return res as any;
  throw new Error((res.error as string) || 'Registration failed');
}

export async function loginIdentity(nickname: string, pin: string, deviceId: string, server?: string): Promise<{
  identity: { id: string; nickname: string; tier: string; device_count: number };
}> {
  const s = server || DEFAULT_SERVER;
  const pinHash = await hashPinForTransport(pin, nickname);
  const res = await requestNoAuth(`${s}/api/identity/pin-login`, {
    nickname: nickname.trim(),
    pin_hash: pinHash,
    device_id: deviceId,
  });
  if (res.success) return res as any;
  throw new Error((res.error as string) || 'Login failed');
}

export async function verifyBindings(deviceId: string, server?: string): Promise<{
  has_binding: boolean;
  bindings: Array<{ name: string; type: string; grants: Record<string, unknown>; slot: number }>;
}> {
  const s = server || DEFAULT_SERVER;
  const res = await requestNoAuth(`${s}/api/verify-binding`, { device_id: deviceId });
  return { has_binding: !!res.has_binding, bindings: (res.bindings as any[]) || [] };
}

/** Request without auth header (for public endpoints) */
function requestNoAuth(url: string, data: Record<string, unknown>): Promise<ApiResponse> {
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
