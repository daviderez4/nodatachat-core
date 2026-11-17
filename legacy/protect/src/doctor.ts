// ═══════════════════════════════════════════════════════════
// NoData Doctor — comprehensive self-diagnostic
//
// Runs 9 checks and prints what works, what's broken, and the
// exact command to fix each broken thing. Built so an end user
// who runs `nodata doctor` can self-resolve every common gotcha
// without opening a support ticket.
//
// Checks (in order, fast-fail-friendly):
//   1. Config directory  ~/.nodata/config.json — exists + parseable
//   2. Device ID         present in config (auto-creates if missing)
//   3. API key           checks 5 sources in order
//   4. Nickname          registered (or ghost mode)
//   5. Network           server reachable (status endpoint)
//   6. Heartbeat         live signed exchange with server
//   7. Tier + features   what plan, what's enabled / blocked
//   8. Device binding    server confirms this device is linked
//   9. .env detection    nearest .env, encrypted vs plaintext
// ═══════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, getApiKey, type NoDataConfig } from './config';
import { sendHeartbeat, getFeatureStatus, verifyBindings } from './api';
import { findEnvFile, parseEnvFile, isEncrypted, detectSecrets } from './env';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const CONFIG_DIR = path.join(os.homedir(), '.nodata');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const LICENSE_KEY_ENVS = [
  'NODATA_API_KEY',
  'NDC_LICENSE',
  'NODATA_LICENSE_KEY',
  'NDC_API_KEY',
] as const;

type Status = 'ok' | 'warn' | 'fail' | 'skip';

interface Check {
  name: string;
  status: Status;
  detail?: string;
  hint?: string;
}

const ICON: Record<Status, string> = {
  ok: `${GREEN}✓${RESET}`,
  warn: `${YELLOW}⚠${RESET}`,
  fail: `${RED}✗${RESET}`,
  skip: `${DIM}—${RESET}`,
};

function printCheck(c: Check) {
  const label = c.name.padEnd(28);
  console.log(`  ${ICON[c.status]} ${label}${c.detail ? `${DIM}${c.detail}${RESET}` : ''}`);
  if (c.hint) {
    console.log(`     ${DIM}→ ${c.hint}${RESET}`);
  }
}

function header(version: string) {
  console.log('');
  console.log(`${GREEN}╔══════════════════════════════════════════╗${RESET}`);
  console.log(`${GREEN}║${RESET}  ${BOLD}nodata doctor${RESET} ${DIM}v${version}${RESET}                    ${GREEN}║${RESET}`);
  console.log(`${GREEN}║${RESET}  ${DIM}Self-diagnose. No surprises.${RESET}            ${GREEN}║${RESET}`);
  console.log(`${GREEN}╚══════════════════════════════════════════╝${RESET}`);
  console.log('');
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race<T | null>([
    p,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// 1. Config directory health
function checkConfigDir(): Check {
  if (!fs.existsSync(CONFIG_DIR)) {
    return {
      name: 'Config dir',
      status: 'warn',
      detail: '~/.nodata/ missing',
      hint: 'Will be auto-created on first command.',
    };
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      name: 'Config dir',
      status: 'warn',
      detail: '~/.nodata/ exists, no config.json',
      hint: 'Run: nodata init',
    };
  }
  try {
    JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    return { name: 'Config dir', status: 'ok', detail: '~/.nodata/config.json' };
  } catch {
    return {
      name: 'Config dir',
      status: 'fail',
      detail: 'config.json is corrupted',
      hint: 'Delete the file and run: nodata init',
    };
  }
}

// 2. Device ID
function checkDeviceId(config: NoDataConfig): Check {
  if (config.device_id) {
    return { name: 'Device ID', status: 'ok', detail: `${config.device_id.slice(0, 8)}…` };
  }
  return {
    name: 'Device ID',
    status: 'warn',
    detail: 'not set',
    hint: 'Run: nodata init  (will auto-generate one)',
  };
}

// 3. API key — try 5 sources
function checkApiKey(config: NoDataConfig): { check: Check; key: string | null; source: string | null } {
  const sources: Array<{ name: string; value: string | undefined }> = [
    { name: 'config.api_key', value: config.api_key },
  ];
  for (const e of LICENSE_KEY_ENVS) {
    sources.push({ name: `$${e}`, value: process.env[e] });
  }

  const found = sources.find((s) => s.value && s.value.length > 0);
  if (!found) {
    return {
      check: {
        name: 'API key',
        status: 'fail',
        detail: 'no key found in 5 sources',
        hint: 'Run: nodata init  — or set $NODATA_API_KEY.',
      },
      key: null,
      source: null,
    };
  }

  // Mask: keep prefix + last 4
  const masked =
    found.value!.length > 16
      ? `${found.value!.slice(0, 8)}…${found.value!.slice(-4)}`
      : `${found.value!.slice(0, 4)}…`;
  return {
    check: { name: 'API key', status: 'ok', detail: `${masked} via ${found.name}` },
    key: found.value!,
    source: found.name,
  };
}

// 4. Nickname (registered identity vs ghost)
function checkNickname(config: NoDataConfig): Check {
  if (config.nickname) {
    return { name: 'Nickname', status: 'ok', detail: config.nickname };
  }
  return {
    name: 'Nickname',
    status: 'warn',
    detail: 'ghost (anonymous)',
    hint: 'Optional. Run: nodata login  — to claim a public proof URL.',
  };
}

// 5. Network — server reachable
async function checkNetwork(server: string): Promise<Check> {
  // /api/health is the canonical GET-friendly liveness endpoint. Returns 200
  // when Supabase is reachable, 503 when env vars or DB are down — both are
  // useful signals for the doctor (treated as warn rather than fail).
  // Previously hit /api/integrations/status which is POST-only and always
  // returned 405 Method Not Allowed → false-positive warning every run.
  const url = `${server.replace(/\/$/, '')}/api/health`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const start = Date.now();
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;
    if (res.ok || res.status === 401) {
      // 401 means we reached the server, just unauthenticated — fine for ping
      return { name: 'Network', status: 'ok', detail: `${server} reachable (${latency}ms)` };
    }
    return {
      name: 'Network',
      status: 'warn',
      detail: `server returned ${res.status} (${latency}ms)`,
      hint: 'Server reachable but odd status. Try again, then: nodata doctor',
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown';
    return {
      name: 'Network',
      status: 'fail',
      detail: `cannot reach ${server}`,
      hint: `Network or DNS issue (${reason}). Check connection. CLI will fall back to offline mode where supported.`,
    };
  }
}

// 6. Heartbeat — signed exchange
async function checkHeartbeat(apiKey: string, server: string, version: string): Promise<{ check: Check; tier?: string; features?: string[] }> {
  try {
    const start = Date.now();
    const res = await withTimeout(
      sendHeartbeat({ apiKey, server, sdkVersion: version, nodeVersion: process.version, features: [] }),
      8000,
    );
    const latency = Date.now() - start;
    if (!res) {
      return { check: { name: 'Heartbeat', status: 'fail', detail: 'timeout (8s)', hint: 'Server slow or down. Retry in a minute.' } };
    }
    if (res.received) {
      const proj = (res.project as { name?: string; tier?: string }) || {};
      const tier = proj.tier || (res.tier as string) || undefined;
      const detail = `${latency}ms${tier ? ` · tier=${tier}` : ''}`;
      return {
        check: { name: 'Heartbeat', status: 'ok', detail },
        tier,
        features: (res.features as string[]) || undefined,
      };
    }
    return {
      check: {
        name: 'Heartbeat',
        status: 'warn',
        detail: 'sent but project not linked',
        hint: 'Run: nodata connect  — to link this device to a workspace.',
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return {
      check: {
        name: 'Heartbeat',
        status: 'fail',
        detail: msg.slice(0, 60),
        hint: 'API key may be revoked. Try: nodata init  — to issue a fresh one.',
      },
    };
  }
}

// 7. Tier + features  (uses /api/integrations/status with auth)
async function checkFeatures(apiKey: string, server: string): Promise<Check> {
  try {
    const res = await withTimeout(getFeatureStatus({ apiKey, server }), 8000);
    if (!res) {
      return { name: 'Tier + features', status: 'warn', detail: 'feature endpoint timed out', hint: 'Heartbeat already covered tier — non-blocking.' };
    }
    const tier = (res.tier as string) || 'unknown';
    const features = (res.features as string[]) || [];
    const blocked = (res.blocked_features as string[]) || [];
    const summary =
      features.length > 0
        ? `${features.length} enabled, ${blocked.length} gated`
        : `tier=${tier}`;
    const hint =
      blocked.length > 0
        ? `Gated: ${blocked.slice(0, 3).join(', ')}${blocked.length > 3 ? '…' : ''}. See: nodatacapsule.com/pricing`
        : undefined;
    return { name: 'Tier + features', status: 'ok', detail: summary, hint };
  } catch (e) {
    return {
      name: 'Tier + features',
      status: 'warn',
      detail: 'unable to fetch features',
      hint: 'Non-critical. Use: nodata features  — for full list.',
    };
  }
}

// 8. Device binding — server says this device is properly linked.
// `has_binding` is true when the device is linked at the identity layer
// (device_ids[]) OR holds an active entitlement binding. Either is enough
// to consider the device "bound" for free + paid tiers alike. Previously
// this check probed `res.bound` which doesn't exist on the response and
// always evaluated false, so even fully-bound free users saw a warning.
async function checkDeviceBinding(deviceId: string | undefined, server: string): Promise<Check> {
  if (!deviceId) {
    return { name: 'Device binding', status: 'skip', detail: 'no device id yet', hint: 'Run: nodata init' };
  }
  try {
    const res = await withTimeout(verifyBindings(deviceId, server), 6000) as {
      has_binding?: boolean;
      has_identity_link?: boolean;
      has_entitlement_binding?: boolean;
      identity_nickname?: string | null;
      bindings?: unknown[];
    } | null;
    if (!res) {
      return { name: 'Device binding', status: 'warn', detail: 'verify timed out (non-blocking)' };
    }
    if (res.has_binding) {
      const parts: string[] = [];
      if (res.identity_nickname) parts.push(`identity=${res.identity_nickname}`);
      if (res.has_entitlement_binding) {
        const n = Array.isArray(res.bindings) ? res.bindings.length : 0;
        parts.push(`${n} entitlement${n === 1 ? '' : 's'}`);
      }
      const detail = parts.length > 0 ? parts.join(' · ') : 'linked to server identity';
      return { name: 'Device binding', status: 'ok', detail };
    }
    return {
      name: 'Device binding',
      status: 'warn',
      detail: 'device not bound on server',
      hint: 'Run: nodata connect  — to bind this device to your account.',
    };
  } catch {
    return { name: 'Device binding', status: 'warn', detail: 'check failed (non-blocking)' };
  }
}

// 9. .env detection
function checkEnv(): Check {
  const filePath = findEnvFile();
  if (!filePath) {
    return { name: '.env detection', status: 'skip', detail: 'no .env in current dir tree' };
  }
  try {
    const { entries } = parseEnvFile(filePath);
    const enc = entries.filter((e) => e.value && isEncrypted(e.value)).length;
    const secrets = detectSecrets(entries);
    const total = entries.length;
    if (secrets.length === 0 && enc > 0) {
      return { name: '.env detection', status: 'ok', detail: `${enc}/${total} encrypted at ${path.basename(filePath)}` };
    }
    if (secrets.length > 0) {
      return {
        name: '.env detection',
        status: 'warn',
        detail: `${secrets.length} unencrypted secret${secrets.length > 1 ? 's' : ''} in ${path.basename(filePath)}`,
        hint: 'Run: nodata encrypt  — to seal them.',
      };
    }
    return { name: '.env detection', status: 'ok', detail: `${total} entries, no secrets detected` };
  } catch {
    return { name: '.env detection', status: 'warn', detail: `could not parse ${path.basename(filePath)}` };
  }
}

// ── Command catalog — every command + when it's the right answer ──
// Doctor uses this to suggest the 3 most-relevant commands for the
// current state. The catalog is also the canonical mapping a user
// can browse to know "what can I even do here?".
interface CommandSpec {
  cmd: string;
  oneLine: string;
  // Returns true when this command is appropriate to suggest right now.
  shouldSuggest: (state: DoctorState) => boolean;
  // Lower number = higher priority among matched candidates.
  priority: number;
}

interface DoctorState {
  hasConfigDir: boolean;
  hasDeviceId: boolean;
  hasApiKey: boolean;
  hasNickname: boolean;
  networkOk: boolean;
  heartbeatOk: boolean;
  deviceBound: boolean | null; // null = unknown
  envHasUnencrypted: boolean;
  envExists: boolean;
}

const COMMAND_CATALOG: CommandSpec[] = [
  {
    cmd: 'nodata init',
    oneLine: 'create API key + bootstrap config (run this first on a new machine)',
    shouldSuggest: (s) => !s.hasApiKey || !s.hasDeviceId,
    priority: 1,
  },
  {
    cmd: 'nodata login',
    oneLine: 'claim a public nickname + PIN — gets you a personal proof URL',
    shouldSuggest: (s) => s.hasApiKey && !s.hasNickname,
    priority: 2,
  },
  {
    cmd: 'nodata connect',
    oneLine: 'bind this device to your account (link CI / second laptop)',
    shouldSuggest: (s) => s.hasApiKey && s.deviceBound === false,
    priority: 2,
  },
  {
    cmd: 'nodata encrypt',
    oneLine: 'seal secrets in .env so a stolen file alone is useless',
    shouldSuggest: (s) => s.envHasUnencrypted,
    priority: 1,
  },
  {
    cmd: 'nodata decrypt',
    oneLine: 'temporarily decrypt to plaintext (in-memory by default — disk only with --to-disk)',
    shouldSuggest: (s) => s.envExists && !s.envHasUnencrypted,
    priority: 4,
  },
  {
    cmd: 'nodata run -- <cmd>',
    oneLine: 'run any command with decrypted secrets injected only into its memory',
    shouldSuggest: (s) => s.envExists && !s.envHasUnencrypted,
    priority: 3,
  },
  {
    cmd: 'nodata status',
    oneLine: 'show config, encrypted count, server tier — quick read-only snapshot',
    shouldSuggest: () => true,
    priority: 5,
  },
  {
    cmd: 'nodata features',
    oneLine: 'list every feature your tier unlocks vs. what is gated',
    shouldSuggest: (s) => s.hasApiKey && s.heartbeatOk,
    priority: 6,
  },
  {
    cmd: 'nodata check',
    oneLine: 'lighter health check (heartbeat + .env scan only)',
    shouldSuggest: () => false, // Doctor supersedes check; only show on --verbose
    priority: 7,
  },
  {
    cmd: 'nodata sign <file>',
    oneLine: 'sign any file (writes a .nodatasig sidecar — proof of authorship)',
    shouldSuggest: () => false,
    priority: 8,
  },
  {
    cmd: 'nodata sign --dir <path>',
    oneLine: 'sign a whole folder (Merkle tree) — one sidecar protects the entire codebase',
    shouldSuggest: () => false,
    priority: 8,
  },
  {
    cmd: 'nodata sign <file> --region <id>',
    oneLine: 'sign a marked region inside a file (// @nodata-sign-begin/end <id>)',
    shouldSuggest: () => false,
    priority: 8,
  },
  {
    cmd: 'nodata verify <file>',
    oneLine: 'verify a .nodatasig sidecar — confirms the file was not altered',
    shouldSuggest: () => false,
    priority: 9,
  },
  {
    cmd: 'nodata verify --dir <path>',
    oneLine: 'verify a folder against its tree manifest — flags every added/removed/modified file',
    shouldSuggest: () => false,
    priority: 9,
  },
  {
    cmd: 'nodata verify <file> --region <id|all>',
    oneLine: 'verify region(s) inside a file — surfaces any silent AI edits',
    shouldSuggest: () => false,
    priority: 9,
  },
  {
    cmd: 'nodata help',
    oneLine: 'full command reference',
    shouldSuggest: () => true,
    priority: 99,
  },
];

function buildState(args: {
  config: NoDataConfig;
  apiKey: string | null;
  networkOk: boolean;
  heartbeatOk: boolean;
  deviceBoundCheck: Check | undefined;
  envCheck: Check;
}): DoctorState {
  return {
    hasConfigDir: fs.existsSync(CONFIG_FILE),
    hasDeviceId: Boolean(args.config.device_id),
    hasApiKey: Boolean(args.apiKey),
    hasNickname: Boolean(args.config.nickname),
    networkOk: args.networkOk,
    heartbeatOk: args.heartbeatOk,
    deviceBound:
      args.deviceBoundCheck?.status === 'ok'
        ? true
        : args.deviceBoundCheck?.status === 'warn' && args.deviceBoundCheck.detail?.includes('not bound')
          ? false
          : null,
    envHasUnencrypted: args.envCheck.status === 'warn' && Boolean(args.envCheck.detail?.includes('unencrypted')),
    envExists: args.envCheck.status !== 'skip',
  };
}

function suggestNext(state: DoctorState, verbose: boolean): CommandSpec[] {
  const matched = COMMAND_CATALOG.filter((c) => c.shouldSuggest(state)).sort((a, b) => a.priority - b.priority);
  if (verbose) return COMMAND_CATALOG.slice().sort((a, b) => a.priority - b.priority);
  return matched.slice(0, 4);
}

function printSuggestions(suggestions: CommandSpec[], verbose: boolean) {
  if (suggestions.length === 0) return;
  console.log(`  ${BOLD}${verbose ? 'All available commands:' : 'Suggested next steps:'}${RESET}`);
  for (const s of suggestions) {
    console.log(`    ${CYAN}${s.cmd.padEnd(28)}${RESET}${DIM}${s.oneLine}${RESET}`);
  }
  if (!verbose) {
    console.log(`    ${DIM}(${suggestions.length === 0 ? 'no specific suggestions — run' : 'see all:'} ${RESET}${CYAN}nodata doctor --verbose${RESET}${DIM} or ${RESET}${CYAN}nodata help${DIM})${RESET}`);
  }
  console.log('');
}

function printPrivacyFooter() {
  console.log(`  ${DIM}Privacy note:${RESET}`);
  console.log(`    ${DIM}• Doctor reads only: config metadata, .env entry names + lengths, network reachability.${RESET}`);
  console.log(`    ${DIM}• Doctor never reads: secret values, decrypted plaintext, .env file contents beyond keys.${RESET}`);
  console.log(`    ${DIM}• Doctor sends to nodatacapsule.com: your API key prefix + device_id (already linked).${RESET}`);
  console.log(`    ${DIM}• Doctor sends to anyone else: nothing.${RESET}`);
  console.log('');
}

// ── Main ──

export async function runDoctor(version: string, opts: { verbose?: boolean } = {}): Promise<void> {
  header(version);

  const verbose = opts.verbose === true;
  const config = loadConfig();
  const server = config.server || 'https://www.nodatacapsule.com';
  const checks: Check[] = [];
  let heartbeatOk = false;
  let deviceBoundCheck: Check | undefined;

  // Synchronous checks first (cheap)
  checks.push(checkConfigDir());
  checks.push(checkDeviceId(config));

  const apiKeyResult = checkApiKey(config);
  checks.push(apiKeyResult.check);

  checks.push(checkNickname(config));

  // Network check
  const networkCheck = await checkNetwork(server);
  checks.push(networkCheck);

  // The next 3 checks need network + key. Skip gracefully if either is missing.
  if (apiKeyResult.key && networkCheck.status === 'ok') {
    const hb = await checkHeartbeat(apiKeyResult.key, server, version);
    checks.push(hb.check);
    heartbeatOk = hb.check.status === 'ok';

    const ft = await checkFeatures(apiKeyResult.key, server);
    checks.push(ft);

    const db = await checkDeviceBinding(config.device_id, server);
    checks.push(db);
    deviceBoundCheck = db;
  } else {
    const reason = !apiKeyResult.key ? 'no API key' : 'network unreachable';
    for (const name of ['Heartbeat', 'Tier + features', 'Device binding']) {
      checks.push({ name, status: 'skip', detail: `skipped (${reason})` });
    }
  }

  const envCheck = checkEnv();
  checks.push(envCheck);

  // Print all
  for (const c of checks) printCheck(c);

  // Summary
  console.log('');
  const okCount = checks.filter((c) => c.status === 'ok').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const skipCount = checks.filter((c) => c.status === 'skip').length;

  if (failCount === 0 && warnCount === 0) {
    console.log(`  ${GREEN}${BOLD}All systems operational.${RESET} ${DIM}${okCount}/${checks.length} green${RESET}`);
  } else if (failCount === 0) {
    console.log(
      `  ${YELLOW}${BOLD}${warnCount} warning${warnCount > 1 ? 's' : ''}${RESET}, ${okCount} green, ${skipCount} skipped. ${DIM}Non-blocking — read hints above.${RESET}`,
    );
  } else {
    console.log(
      `  ${RED}${BOLD}${failCount} blocking issue${failCount > 1 ? 's' : ''}${RESET} · ${warnCount} warning${warnCount === 1 ? '' : 's'} · ${okCount} green`,
    );
    console.log(`  ${DIM}Fix the${RESET} ${RED}✗${RESET} ${DIM}lines first, then re-run:${RESET} ${CYAN}nodata doctor${RESET}`);
  }
  console.log('');

  // Suggestions — what should the user do next?
  const state = buildState({
    config,
    apiKey: apiKeyResult.key,
    networkOk: networkCheck.status === 'ok',
    heartbeatOk,
    deviceBoundCheck,
    envCheck,
  });
  const suggestions = suggestNext(state, verbose);
  printSuggestions(suggestions, verbose);

  // Privacy footer — always shown so user can verify what doctor touched
  printPrivacyFooter();
}
