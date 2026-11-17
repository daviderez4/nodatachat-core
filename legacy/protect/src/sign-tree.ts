// ═══════════════════════════════════════════════════════════
// NoData Tree Signer — sign a whole folder with one receipt.
//
// Walks the directory respecting .gitignore + custom excludes,
// hashes every file, derives a Merkle-style root (flat hash of
// sorted "<path>|<sha256>" lines for v1), and writes a single
// .nodata-tree.sig sidecar at the root.
//
// One server receipt anchors the entire tree. Verify re-walks
// and compares — any modified, added, or removed file breaks
// the tree hash and surfaces the specific delta.
// ═══════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export interface TreeFile {
  path: string;     // relative to root, forward-slash separated
  size: number;
  sha256: string;
}

export interface TreeManifest {
  schema: 'nodatatree-v1';
  root_basename: string;      // last segment of rootDir (informational)
  files: TreeFile[];
  file_count: number;
  total_bytes: number;
  merkle_root: string;        // sha256 of "<path>|<sha256>\n" joined, sorted
  excludes_applied: string[];
  created_at: string;
}

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.cache',
  '.vercel',
  '.DS_Store',
  '.nodata-tree.sig',         // never sign the sidecar itself
];

function isExcluded(relPath: string, excludes: string[]): boolean {
  // First-segment match (e.g. "node_modules") OR any path segment match
  const segments = relPath.split(/[/\\]/);
  for (const e of excludes) {
    // Plain name match against any segment
    if (segments.includes(e)) return true;
    // Glob-ish: trailing /** or *
    if (e.endsWith('/**') && relPath.startsWith(e.slice(0, -3))) return true;
    if (e === segments[0]) return true;
  }
  return false;
}

function readGitignoreExcludes(rootDir: string): string[] {
  const giPath = path.join(rootDir, '.gitignore');
  if (!fs.existsSync(giPath)) return [];
  try {
    return fs
      .readFileSync(giPath, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.replace(/^\//, '').replace(/\/$/, ''));
  } catch {
    return [];
  }
}

function walkFiles(rootDir: string, excludes: string[]): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(rootDir, full).replace(/\\/g, '/');
      if (isExcluded(rel, excludes)) continue;
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        results.push(rel);
      }
    }
  }
  walk(rootDir);
  return results.sort(); // deterministic order is critical for the merkle root
}

function hashFile(absPath: string): { sha256: string; size: number } {
  const buf = fs.readFileSync(absPath);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return { sha256, size: buf.length };
}

/**
 * Build a TreeManifest by walking rootDir.
 *
 * The Merkle root is sha256 of the canonical text:
 *   "<rel-path>|<sha256-hex>\n"  (one per file, sorted by path)
 *
 * v2 may upgrade to a true binary Merkle tree for partial-verify;
 * v1's flat hash is sufficient for the "all-or-nothing" use case
 * the CLI exposes today.
 */
export function buildTreeManifest(
  rootDir: string,
  opts: { exclude?: string[]; includeGitignore?: boolean } = {},
): TreeManifest {
  const absRoot = path.resolve(rootDir);
  if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
    throw new Error(`Not a directory: ${absRoot}`);
  }

  const excludes = [
    ...DEFAULT_EXCLUDES,
    ...(opts.includeGitignore !== false ? readGitignoreExcludes(absRoot) : []),
    ...(opts.exclude ?? []),
  ];

  const relPaths = walkFiles(absRoot, excludes);

  const files: TreeFile[] = [];
  let totalBytes = 0;
  for (const rel of relPaths) {
    const { sha256, size } = hashFile(path.join(absRoot, rel));
    files.push({ path: rel, size, sha256 });
    totalBytes += size;
  }

  const canonical = files.map((f) => `${f.path}|${f.sha256}`).join('\n') + '\n';
  const merkleRoot = createHash('sha256').update(canonical).digest('hex');

  return {
    schema: 'nodatatree-v1',
    root_basename: path.basename(absRoot),
    files,
    file_count: files.length,
    total_bytes: totalBytes,
    merkle_root: merkleRoot,
    excludes_applied: excludes,
    created_at: new Date().toISOString(),
  };
}

export interface VerifyTreeResult {
  ok: boolean;
  added: string[];        // files present now but not in manifest
  removed: string[];      // files in manifest but missing now
  modified: string[];     // files present in both, hash differs
  unchanged: number;
  expected_merkle_root: string;
  actual_merkle_root: string;
}

/**
 * Compare a stored manifest against the current state of rootDir.
 * Returns a structured diff so the CLI can show actionable detail.
 */
export function verifyTreeManifest(rootDir: string, manifest: TreeManifest): VerifyTreeResult {
  const current = buildTreeManifest(rootDir, { exclude: manifest.excludes_applied });

  const expectedByPath = new Map(manifest.files.map((f) => [f.path, f.sha256] as const));
  const currentByPath = new Map(current.files.map((f) => [f.path, f.sha256] as const));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  let unchanged = 0;

  for (const [p, hash] of currentByPath) {
    const expected = expectedByPath.get(p);
    if (expected === undefined) {
      added.push(p);
    } else if (expected !== hash) {
      modified.push(p);
    } else {
      unchanged += 1;
    }
  }
  for (const [p] of expectedByPath) {
    if (!currentByPath.has(p)) removed.push(p);
  }

  return {
    ok: added.length === 0 && removed.length === 0 && modified.length === 0,
    added,
    removed,
    modified,
    unchanged,
    expected_merkle_root: manifest.merkle_root,
    actual_merkle_root: current.merkle_root,
  };
}

/**
 * Read a stored manifest from `<rootDir>/.nodata-tree.sig`.
 * The on-disk shape wraps the manifest with the receipt block — this
 * helper extracts the manifest portion (other fields handled in cli.ts).
 */
export function readTreeSidecar(rootDir: string): { manifest: TreeManifest; sidecar: Record<string, unknown> } | null {
  const p = path.join(path.resolve(rootDir), '.nodata-tree.sig');
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
    const manifest = raw.manifest as TreeManifest | undefined;
    if (!manifest || manifest.schema !== 'nodatatree-v1') return null;
    return { manifest, sidecar: raw };
  } catch {
    return null;
  }
}

export function writeTreeSidecar(rootDir: string, payload: Record<string, unknown>): string {
  const p = path.join(path.resolve(rootDir), '.nodata-tree.sig');
  fs.writeFileSync(p, JSON.stringify(payload, null, 2), 'utf8');
  return p;
}
