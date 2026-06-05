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
  prev_receipt_id?: string | null;
  chain_hmac?: string;
}

export async function issueReceipt(
  eventType: 'upgrade_v1_v2' | 'encrypt' | 'binding' | 'decrypt_batch' | 'kek_rotation' | 'content_signed',
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
      const r = res.receipt as {
        id: string;
        chain_index: number;
        event_hash: string;
        created_at: string;
        prev_receipt_id?: string | null;
        chain_hmac?: string;
      };
      return {
        id: r.id,
        chain_index: r.chain_index,
        event_hash: r.event_hash,
        created_at: r.created_at,
        nickname: res.nickname as string,
        proof_url: res.proof_url as string,
        prev_receipt_id: r.prev_receipt_id ?? null,
        chain_hmac: r.chain_hmac,
      };
    }
    return null;
  } catch {
    // Receipt is a bonus; if the server is old (no /api/v1/receipt) or the
    // network blinks, don't fail the actual upgrade the user cares about.
    return null;
  }
}

// ── Standalone content-signing: content_signed event + .nodatasig sidecar ──

export interface NodataSigV1 {
  schema: 'nodatasig-v1';
  content_hash: string;          // "sha256:<hex>"
  signer_nickname: string;
  signed_at: string;
  receipt_id: string;
  chain_index: number;
  prev_receipt_id: string | null;
  chain_hmac: string;
  event_hash: string;
  signing_version: 1;
  label?: string;
  filename?: string;
}

export interface VerifyChecks {
  content_hash_match: boolean;
  event_hash_match: boolean;
  chain_hmac_match: boolean;
  sidecar: Record<string, boolean> | null;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  receipt_id?: string;
  event_type?: string;
  signer_nickname?: string;
  signed_at?: string;
  chain_index?: number;
  checks?: VerifyChecks;
  proof_url?: string;
}

/**
 * Verify a content hash + optional sidecar/receipt_id against the public
 * /api/verify endpoint. No auth. Returns the structured result; callers
 * typically branch on `result.valid`.
 */
export async function verifyContent(
  contentHash: string,
  opts: { server?: string; receiptId?: string; sidecar?: NodataSigV1 | Record<string, unknown> },
): Promise<VerifyResult> {
  const server = opts.server || DEFAULT_SERVER;
  const body: Record<string, unknown> = { content_hash: contentHash };
  if (opts.receiptId) body.receipt_id = opts.receiptId;
  if (opts.sidecar) body.sidecar = opts.sidecar;

  // /api/verify uses standard NoData response shape (not the /api/v1
  // API-key-auth shape). It does not require the Authorization header,
  // but the helper below sets one; empty key is accepted by the route.
  const parsed = new URL(`${server}/api/verify`);
  const isHttps = parsed.protocol === 'https:';
  const mod = isHttps ? https : http;
  const bodyStr = JSON.stringify(body);

  return new Promise<VerifyResult>((resolve, reject) => {
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'nodata-cli/sign-verify',
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw) as VerifyResult & { success?: boolean; error?: string };
          resolve(parsed);
        } catch {
          reject(new Error(`Invalid verify response: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Build a .nodatasig sidecar from an issued receipt. Mirrors the shape
 * returned by /api/sign (web UI) so both surfaces produce identical sidecars.
 */
export function buildSidecar(params: {
  contentHash: string;       // 64-hex, no prefix
  receipt: IssuedReceipt;
  label?: string;
  filename?: string;
}): NodataSigV1 {
  const { contentHash, receipt, label, filename } = params;
  return {
    schema: 'nodatasig-v1',
    content_hash: `sha256:${contentHash}`,
    signer_nickname: receipt.nickname,
    signed_at: receipt.created_at,
    receipt_id: receipt.id,
    chain_index: receipt.chain_index,
    prev_receipt_id: receipt.prev_receipt_id ?? null,
    chain_hmac: receipt.chain_hmac ?? '',
    event_hash: receipt.event_hash,
    signing_version: 1,
    ...(label ? { label } : {}),
    ...(filename ? { filename } : {}),
  };
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
  has_entitlement_binding: boolean;
  has_identity_link: boolean;
  identity_nickname: string | null;
  identity_tier: string | null;
  bindings: Array<{ name: string; type: string; grants: Record<string, unknown>; slot: number }>;
}> {
  const s = server || DEFAULT_SERVER;
  const res = await requestNoAuth(`${s}/api/verify-binding`, { device_id: deviceId });
  return {
    has_binding: !!res.has_binding,
    has_entitlement_binding: !!res.has_entitlement_binding,
    has_identity_link: !!res.has_identity_link,
    identity_nickname: (res.identity_nickname as string) || null,
    identity_tier: (res.identity_tier as string) || null,
    bindings: (res.bindings as any[]) || [],
  };
}

// ── License capability — plan 07 Track 2 §2B ──────────────────────────
//
// nodata license verify         → wraps POST /api/license/verify
// nodata license revoke <id>    → wraps POST /api/license/revoke
//
// Both require a Bearer API key (loaded by the CLI from ~/.nodata/config.json).

export interface LicenseVerifyResult {
  has_binding: boolean;
  device_id: string;
  bindings: Array<{
    entitlement_id: string;
    name: string;
    type: string;
    grants: Record<string, unknown>;
    slot: number;
    binding_proof: string;
    bound_at: string;
    expires_at: string | null;
  }>;
  checked_at: string;
}

export async function licenseVerify(
  opts: ApiOptions & { type?: string; license_id?: string },
): Promise<LicenseVerifyResult> {
  const s = opts.server || DEFAULT_SERVER;
  const res = await request(
    `${s}/api/license/verify`,
    { type: opts.type, license_id: opts.license_id },
    opts.apiKey,
  );
  if (!res.success) throw new Error((res.error as string) || 'License verify failed');
  return {
    has_binding: !!res.has_binding,
    device_id: (res.device_id as string) || '',
    bindings: (res.bindings as LicenseVerifyResult['bindings']) || [],
    checked_at: (res.checked_at as string) || new Date().toISOString(),
  };
}

export interface LicenseHeartbeatResult {
  state: 'active' | 'grace' | 'none';
  has_active: boolean;
  has_grace: boolean;
  device_id: string;
  bindings: Array<{
    binding_id: string;
    entitlement_id: string;
    name: string;
    type: string;
    grants: Record<string, unknown>;
    slot: number;
    bound_at: string;
    expires_at: string | null;
    revoked_at: string | null;
    grace_until: string | null;
    grace_period_seconds: number;
    state: 'active' | 'grace' | 'expired' | 'revoked';
  }>;
  checked_at: string;
}

export async function licenseHeartbeat(
  opts: ApiOptions & { type?: string },
): Promise<LicenseHeartbeatResult> {
  const s = opts.server || DEFAULT_SERVER;
  const res = await request(
    `${s}/api/license/heartbeat`,
    { type: opts.type },
    opts.apiKey,
  );
  if (!res.success) throw new Error((res.error as string) || 'License heartbeat failed');
  return {
    state: (res.state as LicenseHeartbeatResult['state']) || 'none',
    has_active: !!res.has_active,
    has_grace: !!res.has_grace,
    device_id: (res.device_id as string) || '',
    bindings: (res.bindings as LicenseHeartbeatResult['bindings']) || [],
    checked_at: (res.checked_at as string) || new Date().toISOString(),
  };
}

export interface LicenseRevokeResult {
  mode: 'bulk' | 'single_binding';
  license_id: string;
  binding_id?: string;
  bindings_revoked?: number;
  revoked_device_id?: string;
  entitlement_name: string;
  receipt: { id: string; chain_index: number } | null;
}

export async function licenseRevoke(
  opts: ApiOptions & { license_id?: string; binding_id?: string; reason?: string },
): Promise<LicenseRevokeResult> {
  const s = opts.server || DEFAULT_SERVER;
  const res = await request(
    `${s}/api/license/revoke`,
    {
      license_id: opts.license_id,
      binding_id: opts.binding_id,
      reason: opts.reason,
    },
    opts.apiKey,
  );
  if (!res.success) throw new Error((res.error as string) || 'License revoke failed');
  return {
    mode: (res.mode as LicenseRevokeResult['mode']) || 'bulk',
    license_id: (res.license_id as string) || '',
    binding_id: res.binding_id as string | undefined,
    bindings_revoked: res.bindings_revoked as number | undefined,
    revoked_device_id: res.revoked_device_id as string | undefined,
    entitlement_name: (res.entitlement_name as string) || '',
    receipt: (res.receipt as LicenseRevokeResult['receipt']) || null,
  };
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
