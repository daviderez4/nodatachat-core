// ═══════════════════════════════════════════════════════════
// NoData Region Signer — sign a span of code inside one file.
//
// A "region" is the text between two markers in a source file:
//
//   // @nodata-sign-begin payment-flow
//   function processPayment() { ... }
//   // @nodata-sign-end payment-flow
//
// Markers are recognized in three comment styles:
//   //   — JS / TS / C / Go / Rust / Java / Kotlin / Swift / etc.
//   #    — Python / shell / Ruby / YAML / TOML / Dockerfile
//   --   — SQL / Lua / Haskell
//
// The hashed content is everything BETWEEN the marker lines,
// exclusive — the markers themselves can be reformatted without
// breaking the signature (e.g. linter wraps them).
//
// Sidecars sit in `<file>.nodatasig.regions` (separate from the
// whole-file `.nodatasig` so the two surfaces never collide).
// ═══════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export interface RegionSpan {
  id: string;
  begin_line: number;     // 1-based, the line containing the begin marker
  end_line: number;       // 1-based, the line containing the end marker
  content_hash: string;   // sha256 hex of the text between begin+1 and end-1 inclusive
  line_count: number;     // end_line - begin_line - 1
}

export interface SignedRegion {
  id: string;
  begin_line: number;
  end_line: number;
  content_hash: string;
  line_count: number;
  signer_nickname: string;
  signed_at: string;
  receipt_id: string;
  chain_index: number;
  prev_receipt_id: string | null;
  chain_hmac: string;
  event_hash: string;
}

export interface RegionSidecar {
  schema: 'nodataregions-v1';
  filename: string;
  regions: SignedRegion[];
}

const MARKER_PATTERNS: RegExp[] = [
  // JS/TS/C/Go/Rust/Java: //
  /^\s*\/\/\s*@nodata-sign-(begin|end)\s+(\S+)\s*$/,
  // Python/shell/Ruby/YAML: #
  /^\s*#\s*@nodata-sign-(begin|end)\s+(\S+)\s*$/,
  // SQL/Lua: --
  /^\s*--\s*@nodata-sign-(begin|end)\s+(\S+)\s*$/,
  // Block-comment style for CSS/HTML: /* ... */ on a single line
  /^\s*\/\*\s*@nodata-sign-(begin|end)\s+(\S+)\s*\*\/\s*$/,
  /^\s*<!--\s*@nodata-sign-(begin|end)\s+(\S+)\s*-->\s*$/,
];

interface RawMarker {
  kind: 'begin' | 'end';
  id: string;
  line: number;     // 1-based
}

function findMarkers(lines: string[]): RawMarker[] {
  const out: RawMarker[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    for (const pat of MARKER_PATTERNS) {
      const m = ln.match(pat);
      if (m) {
        out.push({ kind: m[1] as 'begin' | 'end', id: m[2], line: i + 1 });
        break;
      }
    }
  }
  return out;
}

/**
 * Scan a file and return all complete (begin → end) regions.
 * Throws if a begin has no matching end, or end without matching begin,
 * or if regions overlap (same id used twice without closing).
 */
export function findRegionSpans(filePath: string): RegionSpan[] {
  const abs = path.resolve(filePath);
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split(/\r?\n/);

  const markers = findMarkers(lines);
  const open = new Map<string, RawMarker>();   // id → begin marker
  const spans: RegionSpan[] = [];

  for (const m of markers) {
    if (m.kind === 'begin') {
      if (open.has(m.id)) {
        throw new Error(
          `Region "${m.id}" opened at line ${open.get(m.id)!.line} was reopened at line ${m.line} without closing`,
        );
      }
      open.set(m.id, m);
    } else {
      const begin = open.get(m.id);
      if (!begin) {
        throw new Error(`Region "${m.id}" has @nodata-sign-end at line ${m.line} with no matching begin`);
      }
      open.delete(m.id);
      const innerStart = begin.line; // 0-based array index = line - 1; we want lines AFTER begin
      const innerEndExclusive = m.line - 1; // we want lines BEFORE end
      const inner = lines.slice(innerStart, innerEndExclusive); // begin.line is 1-based, slice arg is 0-based start; lines[begin.line] is the line AFTER begin marker
      const content = inner.join('\n');
      const sha = createHash('sha256').update(content).digest('hex');
      spans.push({
        id: m.id,
        begin_line: begin.line,
        end_line: m.line,
        content_hash: sha,
        line_count: inner.length,
      });
    }
  }

  if (open.size > 0) {
    const ids = [...open.keys()].join(', ');
    throw new Error(`Unclosed region(s): ${ids}`);
  }

  return spans;
}

/**
 * Recompute a single region's hash by id (returns null if not found).
 */
export function rehashRegion(filePath: string, id: string): RegionSpan | null {
  const all = findRegionSpans(filePath);
  return all.find((r) => r.id === id) ?? null;
}

// ── Sidecar I/O ─────────────────────────────────────────────

function sidecarPathFor(filePath: string): string {
  return `${path.resolve(filePath)}.nodatasig.regions`;
}

export function readRegionSidecar(filePath: string): RegionSidecar | null {
  const p = sidecarPathFor(filePath);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as RegionSidecar;
    if (raw.schema !== 'nodataregions-v1') return null;
    return raw;
  } catch {
    return null;
  }
}

export function upsertRegionSidecar(filePath: string, signed: SignedRegion): string {
  const p = sidecarPathFor(filePath);
  const existing = readRegionSidecar(filePath) ?? {
    schema: 'nodataregions-v1' as const,
    filename: path.basename(filePath),
    regions: [],
  };
  // Replace if same id, else append
  const idx = existing.regions.findIndex((r) => r.id === signed.id);
  if (idx >= 0) existing.regions[idx] = signed;
  else existing.regions.push(signed);
  fs.writeFileSync(p, JSON.stringify(existing, null, 2), 'utf8');
  return p;
}

// ── Verification ────────────────────────────────────────────

export interface VerifyRegionResult {
  id: string;
  status: 'unchanged' | 'modified' | 'missing_in_file' | 'missing_in_sidecar';
  expected_hash?: string;
  actual_hash?: string;
  begin_line?: number;
  end_line?: number;
}

/**
 * Verify every region in the sidecar against the current file state.
 * Also flags regions in the file that aren't in the sidecar (added but unsigned).
 */
export function verifyAllRegions(filePath: string): VerifyRegionResult[] {
  const sidecar = readRegionSidecar(filePath);
  if (!sidecar) return [];

  const liveSpans = findRegionSpans(filePath);
  const liveById = new Map(liveSpans.map((s) => [s.id, s] as const));
  const signedById = new Map(sidecar.regions.map((r) => [r.id, r] as const));

  const results: VerifyRegionResult[] = [];

  for (const r of sidecar.regions) {
    const live = liveById.get(r.id);
    if (!live) {
      results.push({
        id: r.id,
        status: 'missing_in_file',
        expected_hash: r.content_hash,
      });
      continue;
    }
    if (live.content_hash !== r.content_hash) {
      results.push({
        id: r.id,
        status: 'modified',
        expected_hash: r.content_hash,
        actual_hash: live.content_hash,
        begin_line: live.begin_line,
        end_line: live.end_line,
      });
    } else {
      results.push({
        id: r.id,
        status: 'unchanged',
        expected_hash: r.content_hash,
        actual_hash: live.content_hash,
        begin_line: live.begin_line,
        end_line: live.end_line,
      });
    }
  }

  // Live regions not in sidecar = unsigned (informational)
  for (const live of liveSpans) {
    if (!signedById.has(live.id)) {
      results.push({
        id: live.id,
        status: 'missing_in_sidecar',
        actual_hash: live.content_hash,
        begin_line: live.begin_line,
        end_line: live.end_line,
      });
    }
  }

  return results;
}
