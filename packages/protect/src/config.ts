// ═══════════════════════════════════════════════════════════
// NoData CLI Config — stored in ~/.nodata/config.json
// ═══════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface NoDataConfig {
  api_key?: string;
  server?: string;
  device_id?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.nodata');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): NoDataConfig {
  // Priority: env vars → config file
  const config: NoDataConfig = {};

  // From file
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      Object.assign(config, data);
    } catch { /* ignore */ }
  }

  // Env vars override file
  if (process.env.NODATA_API_KEY) config.api_key = process.env.NODATA_API_KEY;
  if (process.env.NODATA_SERVER) config.server = process.env.NODATA_SERVER;
  if (process.env.NODATA_DEVICE_ID) config.device_id = process.env.NODATA_DEVICE_ID;

  return config;
}

export function saveConfig(config: NoDataConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
  // Restrict permissions
  try { fs.chmodSync(CONFIG_FILE, 0o600); } catch { /* Windows doesn't support chmod */ }
}

export function getApiKey(config: NoDataConfig): string | null {
  return config.api_key || process.env.NODATA_API_KEY || null;
}
