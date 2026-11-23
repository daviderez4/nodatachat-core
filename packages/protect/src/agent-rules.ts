// The public classification rules for what an AI agent does: one source for the
// open agent-check (agent-history.ts) and for NoData's read gate, which imports
// this file. Part of @nodatachat/protect (Apache-2.0).
//
// WHAT THIS IS, AND WHAT IT IS NOT
//   A transparent, basic layer: which files hold logins, which commands print a
//   credential, which variable names hold secrets, which searches look for them,
//   and what a provider key looks like. Patterns of the kind every secret scanner
//   publishes. It is NOT the security boundary and NOT a list of everything the
//   gate refuses: the gate also reads the content of what an agent asks for,
//   applies the organisation's policy, asks a person, and signs a receipt, none of
//   which is here. Knowing these patterns gives no way past that.
//
// Pure functions and constants only: no file system, no network, no state.
// A change here changes the gate and agent-check together; the parity tests in
// both packages hold them to it.

/** Bump when a rule changes, so a report can say which rules produced it. */
export const AGENT_RULES_VERSION = "2";

// ── Files ────────────────────────────────────────────────────────────────

/** Env-style files: .env, .env.production, prod.env, app.env.local … (the scanner's rule). */
export const ENV_FILE = /(^|\/)(\.env(\.[\w.-]+)?|[\w.-]+\.env(\.[\w.-]+)?)$/i;

/**
 * Where CLIs keep their login: reading one of these shows the token. Matched on a /-separated path.
 * The AI agents' own settings are here too (23.11.2026): ~/.claude.json, Claude Desktop's config,
 * Codex's config.toml and Cursor's mcp.json hold the tokens of the MCP servers they run. One read
 * of ~/.claude.json put a Supabase access token, which opens every project of the account, into
 * an agent's context, and no rule knew the file held keys.
 */
export const CREDENTIAL_STORE =
  /(?:(?:^|[\\/])\.claude\.json(?![\w.])|claude_desktop_config\.json|\.codex[\\/]+config\.toml|\.cursor[\\/]+mcp\.json|\.aws[\\/]+credentials|\.npmrc|\.yarnrc\.yml|\.pypirc|[._]netrc|\.git-credentials|\.pgpass|\.docker[\\/]+config\.json|\.kube[\\/]+config|gh[\\/]+hosts\.yml|\.supabase[\\/]+access-token|application_default_credentials\.json|gcloud[\\/]+(?:credentials|access_tokens)\.db|\.azure[\\/]+(?:msal_token_cache|accessTokens)|com\.vercel\.cli[\\/]+auth\.json|\.ssh[\\/]+id_(?:rsa|ed25519|ecdsa|dsa)(?![\w.]))/i;

/** A file that holds keys: an env file or a CLI's saved login. */
export function isKeyFile(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  const name = p.slice(p.lastIndexOf("/") + 1).toLowerCase();
  return ENV_FILE.test(name) || CREDENTIAL_STORE.test(p);
}

/**
 * Files of record by type alone: tables, databases, dumps, office documents.
 * agent-check counts these. The gate does more: it reads what is in a file
 * when the agent asks for it, and decides by the personal data it finds.
 */
export const RECORD_FILE = /\.(csv|tsv|xlsx|xlsm|xlsb|xls|ods|parquet|feather|sqlite3?|db|mdb|accdb|dump|bak|sql|docx?|pdf)$/i;

// ── Commands that print a credential ─────────────────────────────────────

/** A variable name that holds a credential. */
export const SECRET_VAR = /(?:TOKEN|SECRET|PASSW(?:OR)?D|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY|CREDENTIAL|SERVICE_ROLE|_KEY$)/i;

export const SECRETS_CLI = "the vault's secrets, outside nodata_run's per-command approval";
/** Any JS launcher anywhere in the segment, with a vault subcommand after it (the common spellings, not every one). */
const LAUNCHER_THEN_SECRETS =
  /(?:^|[^\w.@-])(?:npx|pnpx|bunx|npm|pnpm|yarn|bun|node|nodejs|deno|nodata-mcp)(?:\.cmd|\.exe|\.ps1|\.js)?(?![\w-])[\s\S]*?(?<![\w-])secrets-(?:run|login|set|import|share)(?![\w-])/i;

/** True when one command segment launches NoData's vault CLI (secrets-run / -login / -set / -import / -share). */
export function launchesSecretsCli(seg: string): boolean {
  return LAUNCHER_THEN_SECRETS.test(seg);
}

/** One command (no chaining) that prints credentials, with what it shows. */
export const PRINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:env|set|export\s+-p|declare\s+-x|get-childitem\s+env:\S*|gci\s+env:\S*|dir\s+env:\S*|ls\s+env:\S*)\s*$/i, "every environment variable"],
  [/^gh\s+auth\s+(?:token\b|status\b.*(?:\s-t\b|--show-token))/i, "the GitHub login token"],
  [/^gcloud\s+auth\s+(?:application-default\s+)?print-(?:access|identity)-token\b/i, "a Google Cloud access token"],
  [/^az\s+account\s+get-access-token\b/i, "an Azure access token"],
  [/^aws\s+(?:configure\s+(?:get\s+\S*(?:secret|token)\S*|export-credentials)|sts\s+get-session-token|ecr\s+get-login-password)\b/i, "AWS credentials"],
  [/^supabase\s+projects\s+api-keys\b/i, "the project's Supabase keys (incl. service_role)"],
  [/^heroku\s+auth:token\b/i, "the Heroku login token"],
  [/^op\s+(?:read|item\s+get)\b/i, "a 1Password secret"],
  [/^vault\s+(?:kv\s+get|read)\b/i, "a Vault secret"],
  [/^doppler\s+secrets\b/i, "Doppler secrets"],
  [/^security\s+find-(?:generic|internet)-password\b.*\s-w\b/i, "a keychain password"],
  [/^git\s+credential\s+fill\b/i, "a saved Git password"],
  [/^node\s+\S*nodata-pull\.mjs\b/i, SECRETS_CLI],
  [/^kubectl\s+get\s+secrets?\b.*\s-o\b/i, "Kubernetes secrets"],
];

const ECHO = /^(?:echo|printf|print|write-output|write-host|say)\b/i;
/** A command that shows a file's content (the file itself, or a script that opens it). */
export const READS = /^(?:cat|type|get-content|gc|more|less|head|tail|bat|nl|strings|xxd|od|hexdump|grep|egrep|rg|select-string|sls|awk|sed|jq|yq|python\d*|py|node|ruby|perl)\b/i;
const VAR_REF = /\$\{?env:([A-Za-z_][\w]*)|\$\{?([A-Za-z_][\w]*)|%([A-Za-z_][\w]*)%|GetEnvironmentVariable\(\s*['"]([^'"]+)['"]/g;

/**
 * What a call would show that is a credential, or null. Content-free: it names
 * what, never a value. `absPath` is the Read/Grep path already made absolute by
 * the caller (the gate knows the working folder; history keeps the path as given).
 */
export function credentialPrintIn(tool: string, input: Record<string, unknown>, absPath = ""): string | null {
  if (absPath && (tool === "Read" || tool === "Grep") && CREDENTIAL_STORE.test(absPath.replace(/\\/g, "/"))) {
    return `a saved login (${absPath.replace(/\\/g, "/").split("/").pop()})`;
  }
  if ((tool !== "Bash" && tool !== "PowerShell") || typeof input.command !== "string") return null;
  // Split on chaining, keeping the operator: a value piped INTO a command
  // (`echo $GH_TOKEN | gh auth login --with-token`) is handed over, not shown.
  const parts = input.command.split(/(\|\||&&|[;|\n])/);
  for (let i = 0; i < parts.length; i += 2) {
    const pipedOn = parts[i + 1] === "|";
    const seg = parts[i].trim().replace(/^(?:sudo\s+|cmd(?:\.exe)?\s+\/c\s+|powershell(?:\.exe)?\s+(?:-command\s+)?|pwsh\s+(?:-c(?:ommand)?\s+)?)+/i, "").replace(/^["']|["']$/g, "");
    if (READS.test(seg) && CREDENTIAL_STORE.test(seg)) return "a saved login file";
    if (launchesSecretsCli(seg)) return SECRETS_CLI;
    for (const [re, what] of PRINTS) if (re.test(seg)) return what;
    const pe = seg.match(/^printenv(?:\s+(\S+))?\s*$/i);
    if (pe && (!pe[1] || SECRET_VAR.test(pe[1]))) return pe[1] ? `the variable ${pe[1]}` : "every environment variable";
    if (!pipedOn && (ECHO.test(seg) || /GetEnvironmentVariable/i.test(seg))) {
      for (const m of seg.matchAll(VAR_REF)) {
        const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
        if (SECRET_VAR.test(name)) return `the variable ${name}`;
      }
    }
  }
  return null;
}

// ── Searches for a secret ────────────────────────────────────────────────

/** A program that searches text. */
export const SEARCHES = /^(?:grep|egrep|fgrep|rg|ag|ack|git\s+grep|findstr|select-string|sls)\b/i;
// A lone & is the background operator only when it is not part of a redirection (2>&1, >&2, &>file, <&3).
const LONE_AMP = String.raw`(?<![<>&|])&(?![&>])`;
/** Statement separators. */
export const STATEMENT_SPLIT = new RegExp(String.raw`\|\||&&|[;\n]|${LONE_AMP}`);
/** Stage separators (|& is bash's pipe of stdout and stderr). */
export const STAGE_SPLIT = new RegExp(String.raw`\|\||\|&|&&|[;|\n]|${LONE_AMP}`);
/** A stage as its program starts: without the & a |& or a background leaves in front. */
export const stageText = (raw: string) => raw.trim().replace(/^&\s*/, "").replace(/^(?:sudo\s+|xargs\s+(?:-\S+\s+)*)/i, "");

/** Does this search text look for a secret by name (a credential variable, or an env file)? */
export function searchesBySecretName(aim: string): boolean {
  return SECRET_VAR.test(aim) || /\.env\b/i.test(aim);
}

/** The same, for the Grep tool's fields: its pattern, glob and type. */
export function grepSearchesBySecretName(input: Record<string, unknown>): boolean {
  const aim = [input.pattern, input.glob, input.type].filter((v) => typeof v === "string").join(" ");
  return SECRET_VAR.test(aim) || /\.env|env\b/i.test(String(input.glob ?? ""));
}

// ── Commands that send data out ──────────────────────────────────────────

/** Uploads: agent-check counts them. The gate governs where an agent may send through its site rules. */
export const OUTBOUND_DATA = new RegExp(
  [
    String.raw`\bcurl\b[^\n]*\s(-d|--data[\w-]*|-F|--form|-T|--upload-file)\b`,
    String.raw`\bwget\b[^\n]*--post-(data|file)\b`,
    String.raw`\b(Invoke-RestMethod|Invoke-WebRequest|irm|iwr)\b[^\n]*-(Method\s+(Post|Put)|Body|InFile)\b`,
    String.raw`\b(scp|rsync)\b[^\n]*\s[\w.-]+@[\w.-]+:`,
  ].join("|"),
  "i",
);

// ── What a provider key looks like (Gitleaks-style) ──────────────────────

export interface SecretPattern {
  id: string;
  name: string;
  pattern: RegExp;
  severity: "critical" | "high" | "medium";
}

/**
 * The scanner's provider-key patterns, the same list as
 * @nodatachat/folder-scan SECRET_PATTERNS (a parity test holds them equal).
 * The gate counts these in a tool's output after the call; agent-check counts
 * them in the history's tool results.
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  { id: "aws-access-key", name: "AWS Access Key", pattern: /(?:^|[^A-Z0-9])AKIA(?!X{16})[A-Z2-7]{16}(?:[^A-Z2-7]|$)/, severity: "critical" },
  { id: "aws-secret-key", name: "AWS Secret Key", pattern: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/, severity: "critical" },
  { id: "gcp-api-key", name: "GCP API Key", pattern: /AIza[0-9A-Za-z_-]{35}/, severity: "critical" },
  { id: "gcp-service-account", name: "GCP Service Account", pattern: /"type"\s*:\s*"service_account"/, severity: "critical" },
  { id: "github-token", name: "GitHub Token", pattern: /gh[pousr]_[0-9a-zA-Z]{36,}/, severity: "critical" },
  { id: "github-fine-grained", name: "GitHub Fine-Grained Token", pattern: /github_pat_[0-9a-zA-Z_]{22,}/, severity: "critical" },
  { id: "gitlab-token", name: "GitLab Token", pattern: /glpat-[0-9a-zA-Z_-]{20,}/, severity: "critical" },
  { id: "stripe-secret", name: "Stripe Secret Key", pattern: /sk_live_[0-9a-zA-Z]{24,}/, severity: "critical" },
  { id: "stripe-restricted", name: "Stripe Restricted Key", pattern: /rk_live_[0-9a-zA-Z]{24,}/, severity: "critical" },
  { id: "slack-token", name: "Slack Token", pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/, severity: "high" },
  { id: "slack-webhook", name: "Slack Webhook", pattern: /hooks\.slack\.com\/services\/T[0-9A-Z]{8,}\/B[0-9A-Z]{8,}\/[0-9a-zA-Z]{24}/, severity: "high" },
  { id: "twilio-api-key", name: "Twilio API Key", pattern: /SK[0-9a-fA-F]{32}/, severity: "high" },
  { id: "sendgrid-api-key", name: "SendGrid API Key", pattern: /SG\.[0-9a-zA-Z_-]{22}\.[0-9a-zA-Z_-]{43}/, severity: "critical" },
  { id: "postgres-uri", name: "PostgreSQL Connection String", pattern: /postgres(?:ql)?:\/\/[^\s'"]{10,}/, severity: "critical" },
  { id: "mongodb-uri", name: "MongoDB Connection String", pattern: /mongodb(?:\+srv)?:\/\/[^\s'"]{10,}/, severity: "critical" },
  { id: "redis-uri", name: "Redis Connection String", pattern: /redis(?:s)?:\/\/[^\s'"]{10,}/, severity: "high" },
  { id: "openai-key", name: "OpenAI API Key", pattern: /sk-[0-9a-zA-Z]{20,}T3BlbkFJ[0-9a-zA-Z]{20,}/, severity: "critical" },
  { id: "openai-project-key", name: "OpenAI API Key", pattern: /sk-(?:proj|svcacct|admin)-[0-9A-Za-z_-]{40,}/, severity: "critical" },
  { id: "anthropic-key", name: "Anthropic API Key", pattern: /sk-ant-[0-9a-zA-Z_-]{40,}/, severity: "critical" },
  { id: "firebase-key", name: "Firebase API Key", pattern: /AIza[0-9A-Za-z_-]{35}/, severity: "high" },
  { id: "supabase-key", name: "Supabase Service Key", pattern: /eyJ[0-9a-zA-Z_-]{100,}/, severity: "critical" },
  { id: "supabase-access-token", name: "Supabase Access Token", pattern: /\bsbp_[0-9a-f]{40}\b/, severity: "critical" },
  { id: "supabase-secret-key", name: "Supabase Secret Key", pattern: /\bsb_secret_[0-9A-Za-z_-]{20,}/, severity: "critical" },
  { id: "private-key", name: "Private Key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, severity: "critical" },
  { id: "jwt-secret", name: "JWT/Generic Secret", pattern: /(?:jwt_secret|JWT_SECRET|secret_key|SECRET_KEY|api_secret|API_SECRET)\s*[=:]\s*['"][^'"]{8,}['"]/, severity: "high" },
  { id: "password-in-code", name: "Password in Code", pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/, severity: "high" },
  { id: "bearer-token", name: "Bearer Token in Code", pattern: /['"]Bearer\s+[0-9a-zA-Z._-]{20,}['"]/, severity: "high" },
];

/** Provider keys in a text, counted by rule id. Never returns a value. */
export function countSecrets(text: string, patterns: ReadonlyArray<SecretPattern> = SECRET_PATTERNS): Record<string, number> {
  const found: Record<string, number> = {};
  if (!text) return found;
  const t = text.slice(0, 2 * 1024 * 1024);
  for (const p of patterns) {
    const re = new RegExp(p.pattern.source, p.pattern.flags.includes("g") ? p.pattern.flags : p.pattern.flags + "g");
    const n = (t.match(re) ?? []).length;
    if (n) found[p.id] = (found[p.id] ?? 0) + n;
  }
  return found;
}
