// FuryGraph — provider-neutral project graph.
//
// FuryGraph is structure and relations only (not memory, not RAG, not the
// epistemic graph). Providers:
//   - Graphify: reads the real graphify-out/ files produced by `graphify`
//     (graph.json with nodes/links and EXTRACTED/INFERRED confidence,
//     manifest.json for staleness, GRAPH_REPORT.md and graph.html). FuryPipe
//     never runs Graphify implicitly; refreshing is an explicit action.
//   - Native: FuryPipe's own codegraph indexer, used when Graphify is absent.
// Consumers get file-level coupling (for graph-aware dispatch) and blast
// radius (reverse traversal over dependency relations).
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, sep } from 'node:path';

import { buildCodeGraph } from './codegraph.js';

export const FURY_GRAPH_FORMAT = 'furypipe-graph/v1' as const;

export type FuryGraphConfidence = 'EXTRACTED' | 'INFERRED' | 'OBSERVED' | 'VERIFIED' | 'STALE' | 'UNKNOWN';
export type FuryGraphNodeKind = 'file' | 'symbol' | 'concept' | 'rationale' | 'external';

export interface FuryGraphNode {
  readonly id: string;
  readonly label: string;
  readonly kind: FuryGraphNodeKind;
  readonly file?: string;
  readonly line?: number;
  readonly community?: number;
}

export interface FuryGraphEdge {
  readonly source: string;
  readonly target: string;
  readonly relation: string;
  readonly confidence: FuryGraphConfidence;
}

export interface FuryGraph {
  readonly format: typeof FURY_GRAPH_FORMAT;
  readonly provider: string;
  readonly root: string;
  readonly nodes: readonly FuryGraphNode[];
  readonly edges: readonly FuryGraphEdge[];
  readonly stale: boolean;
  readonly staleFiles: readonly string[];
  readonly outputs: Readonly<Record<string, string>>;
}

export interface FuryGraphDetection {
  readonly provider: string;
  readonly available: boolean;
  readonly detail: string;
}

export interface FuryGraphProvider {
  readonly id: string;
  detect(root: string): Promise<FuryGraphDetection>;
  load(root: string): Promise<FuryGraph>;
}

export class FuryGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuryGraphError';
  }
}

/** Relations that make the source depend on the target (same set Graphify's `affected` walks). */
export const FURY_DEPENDENCY_RELATIONS: ReadonlySet<string> = new Set([
  'calls', 'indirect_call', 'references', 'imports', 'imports_from', 'dynamic_import',
  're_exports', 'inherits', 'extends', 'implements', 'uses', 'mixes_in', 'embeds', 'requires',
]);

const MAX_GRAPH_BYTES = 128 * 1024 * 1024;
const MAX_NODES = 500_000;
const MAX_EDGES = 2_000_000;

function relFile(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024 || value.includes('\0')) return undefined;
  const posix = value.replaceAll('\\', '/');
  if (posix.startsWith('/') || /^[A-Za-z]:/u.test(posix) || posix.split('/').includes('..')) return undefined;
  return posix;
}

function lineOf(value: unknown): number | undefined {
  const match = typeof value === 'string' ? /^L(\d{1,7})$/u.exec(value) : null;
  return match ? Number(match[1]) : undefined;
}

async function boundedJson(path: string): Promise<unknown> {
  const info = await lstat(path);
  if (!info.isFile()) throw new FuryGraphError(`${path} is not a regular file`);
  if (info.size > MAX_GRAPH_BYTES) throw new FuryGraphError(`${path} exceeds the graph byte bound`);
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

export function createGraphifyProvider(options: { readonly outDir?: string } = {}): FuryGraphProvider {
  const outDirName = options.outDir ?? 'graphify-out';
  if (outDirName.includes('..') || isAbsolute(outDirName)) throw new FuryGraphError('Graphify outDir must be a relative directory name');
  return Object.freeze({
    id: 'graphify',
    async detect(root: string) {
      const graphPath = join(root, outDirName, 'graph.json');
      const ok = await exists(graphPath);
      return Object.freeze({ provider: 'graphify', available: ok, detail: ok ? `${outDirName}/graph.json present` : `${outDirName}/graph.json not found; run \`graphify update .\`` });
    },
    async load(root: string) {
      const out = join(root, outDirName);
      const raw = await boundedJson(join(out, 'graph.json')) as { nodes?: unknown; links?: unknown; edges?: unknown };
      const rawNodes = raw?.nodes;
      const rawLinks = raw?.links ?? raw?.edges;
      if (!Array.isArray(rawNodes) || !Array.isArray(rawLinks)) throw new FuryGraphError('graph.json lacks nodes/links arrays');
      if (rawNodes.length > MAX_NODES || rawLinks.length > MAX_EDGES) throw new FuryGraphError('graph.json exceeds node/edge bounds');

      const nodes: FuryGraphNode[] = [];
      const ids = new Set<string>();
      for (const entry of rawNodes) {
        const n = entry as Record<string, unknown>;
        if (typeof n.id !== 'string' || n.id.length > 512 || ids.has(n.id)) continue;
        const file = relFile(n.source_file);
        const label = typeof n.label === 'string' ? n.label.slice(0, 256) : n.id;
        const kind: FuryGraphNodeKind = n.file_type === 'concept' ? 'concept'
          : n.file_type === 'rationale' ? 'rationale'
            : !file ? 'external'
              : label === file.split('/').pop() ? 'file' : 'symbol';
        ids.add(n.id);
        nodes.push(Object.freeze({
          id: n.id, label, kind,
          ...(file ? { file } : {}),
          ...(lineOf(n.source_location) !== undefined ? { line: lineOf(n.source_location)! } : {}),
          ...(typeof n.community === 'number' && Number.isSafeInteger(n.community) ? { community: n.community } : {}),
        }));
      }
      const edges: FuryGraphEdge[] = [];
      for (const entry of rawLinks) {
        const l = entry as Record<string, unknown>;
        if (typeof l.source !== 'string' || typeof l.target !== 'string' || !ids.has(l.source) || !ids.has(l.target)) continue;
        const relation = typeof l.relation === 'string' && /^[a-z_]{1,64}$/u.test(l.relation) ? l.relation : 'related';
        const confidence: FuryGraphConfidence = l.confidence === 'EXTRACTED' || l.confidence === 'INFERRED' ? l.confidence : 'UNKNOWN';
        edges.push(Object.freeze({ source: l.source, target: l.target, relation, confidence }));
      }

      // Staleness: a source file newer than (or missing since) the manifest.
      const staleFiles: string[] = [];
      try {
        const manifest = await boundedJson(join(out, 'manifest.json')) as Record<string, { mtime?: unknown }>;
        for (const [file, meta] of Object.entries(manifest ?? {}).slice(0, MAX_NODES)) {
          const rel = relFile(file);
          if (!rel) continue;
          try {
            const current = (await stat(join(root, rel))).mtimeMs / 1000;
            if (typeof meta?.mtime !== 'number' || current > meta.mtime + 1e-3) staleFiles.push(rel);
          } catch {
            staleFiles.push(rel);
          }
        }
      } catch {
        // No manifest: staleness unknown; reported as not stale but flagged below.
      }
      const outputs: Record<string, string> = {};
      for (const name of ['graph.json', 'manifest.json', 'GRAPH_REPORT.md', 'graph.html']) {
        if (await exists(join(out, name))) outputs[name] = `${outDirName}/${name}`;
      }
      return Object.freeze({
        format: FURY_GRAPH_FORMAT, provider: 'graphify', root,
        nodes: Object.freeze(nodes), edges: Object.freeze(edges),
        stale: staleFiles.length > 0, staleFiles: Object.freeze(staleFiles.sort()),
        outputs: Object.freeze(outputs),
      });
    },
  });
}

export function createNativeGraphProvider(): FuryGraphProvider {
  return Object.freeze({
    id: 'native-codegraph',
    async detect() {
      return Object.freeze({ provider: 'native-codegraph', available: true, detail: 'built-in structural indexer' });
    },
    async load(root: string) {
      const index = await buildCodeGraph(root);
      const nodes = new Map<string, FuryGraphNode>();
      const fileNode = (path: string) => {
        const id = `file:${path}`;
        if (!nodes.has(id)) nodes.set(id, Object.freeze({ id, label: path.split('/').pop() ?? path, kind: 'file' as const, file: path }));
        return id;
      };
      for (const f of index.files) fileNode(f.path);
      const edges: FuryGraphEdge[] = [];
      for (const imp of index.imports) {
        if (!imp.resolvedPath) continue;
        edges.push(Object.freeze({
          source: fileNode(imp.filePath), target: fileNode(imp.resolvedPath), relation: 'imports_from',
          confidence: imp.confidence === 'structural' ? 'EXTRACTED' as const : imp.confidence === 'heuristic' ? 'INFERRED' as const : 'UNKNOWN' as const,
        }));
      }
      for (const t of index.tests) {
        if (!t.targetFile) continue;
        edges.push(Object.freeze({ source: fileNode(t.testFile), target: fileNode(t.targetFile), relation: 'tests', confidence: t.confidence === 'structural' ? 'EXTRACTED' as const : 'INFERRED' as const }));
      }
      return Object.freeze({
        format: FURY_GRAPH_FORMAT, provider: 'native-codegraph', root,
        nodes: Object.freeze([...nodes.values()]), edges: Object.freeze(edges),
        stale: false, staleFiles: Object.freeze([]), outputs: Object.freeze({}),
      });
    },
  });
}

/** Load from the first available provider (Graphify first, native fallback). */
export async function loadFuryGraph(root: string, providers: readonly FuryGraphProvider[] = [createGraphifyProvider(), createNativeGraphProvider()]): Promise<{ readonly graph: FuryGraph; readonly detections: readonly FuryGraphDetection[] }> {
  const detections: FuryGraphDetection[] = [];
  for (const provider of providers) {
    const detection = await provider.detect(root);
    detections.push(detection);
    if (detection.available) return Object.freeze({ graph: await provider.load(root), detections: Object.freeze(detections) });
  }
  throw new FuryGraphError('no graph provider is available');
}

/** Aggregate symbol-level edges to file → file dependency counts. */
export function furyFileDependencies(graph: FuryGraph): ReadonlyMap<string, ReadonlyMap<string, number>> {
  const fileOf = new Map(graph.nodes.filter((n) => n.file).map((n) => [n.id, n.file!]));
  const out = new Map<string, Map<string, number>>();
  for (const e of graph.edges) {
    if (!FURY_DEPENDENCY_RELATIONS.has(e.relation) && e.relation !== 'tests') continue;
    const from = fileOf.get(e.source);
    const to = fileOf.get(e.target);
    if (!from || !to || from === to) continue;
    const row = out.get(from) ?? new Map<string, number>();
    row.set(to, (row.get(to) ?? 0) + 1);
    out.set(from, row);
  }
  return out;
}

/** Files that (transitively, up to depth) depend on any of the changed files. */
export function furyBlastRadius(graph: FuryGraph, changedFiles: readonly string[], depth = 2): { readonly changed: readonly string[]; readonly affected: readonly string[]; readonly affectedTests: readonly string[] } {
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > 16) throw new FuryGraphError('depth must be 1..16');
  const deps = furyFileDependencies(graph);
  const reverse = new Map<string, Set<string>>();
  for (const [from, row] of deps) for (const to of row.keys()) {
    const set = reverse.get(to) ?? new Set<string>();
    set.add(from);
    reverse.set(to, set);
  }
  const changed = [...new Set(changedFiles.map((f) => relFile(f)).filter((f): f is string => Boolean(f)))].sort();
  const seen = new Set(changed);
  let frontier = changed;
  for (let d = 0; d < depth && frontier.length > 0; d += 1) {
    const next: string[] = [];
    for (const f of frontier) for (const dependent of reverse.get(f) ?? []) {
      if (!seen.has(dependent)) {
        seen.add(dependent);
        next.push(dependent);
      }
    }
    frontier = next;
  }
  const affected = [...seen].filter((f) => !changed.includes(f)).sort();
  const isTest = (f: string) => /(^|\/)(tests?|__tests__)\//u.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/u.test(f);
  return Object.freeze({ changed: Object.freeze(changed), affected: Object.freeze(affected), affectedTests: Object.freeze(affected.filter(isTest)) });
}

function inScope(file: string, scope: string): boolean {
  const s = scope.replace(/\*+$/u, '').replace(/\/+$/u, '');
  return s === '' || file === s || file.startsWith(`${s}/`);
}

/**
 * Coupling between two write scopes: number of dependency edges crossing
 * between files in scope A and files in scope B (both directions). Used by
 * graph-aware dispatch to keep strongly coupled writers sequential.
 */
export function furyScopeCoupling(graph: FuryGraph, scopeA: readonly string[], scopeB: readonly string[]): number {
  const deps = furyFileDependencies(graph);
  const inA = (f: string) => scopeA.some((s) => inScope(f, s));
  const inB = (f: string) => scopeB.some((s) => inScope(f, s));
  let crossing = 0;
  for (const [from, row] of deps) for (const [to, count] of row) {
    if ((inA(from) && inB(to)) || (inB(from) && inA(to))) crossing += count;
  }
  return crossing;
}

export interface FuryGraphLifecyclePlan {
  readonly format: 'furypipe-graph-lifecycle/v1';
  readonly provider: string;
  readonly action: 'NONE' | 'RECOMMEND_REFRESH' | 'USE_NATIVE_FALLBACK';
  readonly changedFiles: readonly string[];
  readonly relevantChangedFiles: readonly string[];
  readonly staleFiles: readonly string[];
  readonly reason: string;
  readonly executionAuthorized: false;
}

export const FURY_GRAPH_REFRESH_PLAN_FORMAT = 'furypipe-graph-refresh-plan/v1' as const;
export const FURY_GRAPH_REFRESH_RECEIPT_FORMAT = 'furypipe-graph-refresh-receipt/v1' as const;

export interface FuryGraphRefreshPlan {
  readonly format: typeof FURY_GRAPH_REFRESH_PLAN_FORMAT;
  readonly root: string;
  readonly executable: string;
  readonly timeoutMs: number;
  readonly command: readonly string[];
  readonly requiresExplicitApproval: true;
  readonly executionAuthorized: false;
}

export interface FuryGraphRefreshReceipt {
  readonly format: typeof FURY_GRAPH_REFRESH_RECEIPT_FORMAT;
  readonly receiptId: string;
  readonly planDigestSha256: string;
  readonly commandDigestSha256: string;
  readonly root: string;
  readonly outcome: 'SUCCEEDED' | 'FAILED';
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly durationMs: number;
  readonly operatorApproved: true;
  readonly executionAuthorized: true;
  readonly error?: string;
}

const GRAPH_RELEVANT_FILE_RE = /(?:^|\/)(?:[^/]+\.)?(?:ts|tsx|js|jsx|mjs|cjs|java|kt|kts|py|rs|go|cs|cpp|cc|cxx|c|h|hpp|php|rb|swift|scala|vue|svelte)$/iu;

export function planGraphifyLifecycle(input: {
  readonly graph: FuryGraph;
  readonly detections: readonly FuryGraphDetection[];
  readonly changedFiles?: readonly string[];
}): FuryGraphLifecyclePlan {
  if (!input || typeof input !== 'object' || !input.graph || !Array.isArray(input.detections)) {
    throw new FuryGraphError('graph lifecycle input is invalid');
  }
  const changedFiles = Object.freeze([...new Set((input.changedFiles ?? [])
    .map((file) => relFile(file))
    .filter((file): file is string => Boolean(file)))].sort());
  const relevantChangedFiles = Object.freeze(changedFiles.filter((file) => GRAPH_RELEVANT_FILE_RE.test(file)));
  const graphify = input.detections.find((detection) => detection.provider === 'graphify');
  const graphifyAvailable = graphify?.available === true;

  let action: FuryGraphLifecyclePlan['action'] = 'NONE';
  let reason = 'Current graph does not require a Graphify refresh.';
  if (!graphifyAvailable) {
    action = 'USE_NATIVE_FALLBACK';
    reason = 'Graphify output is unavailable; keep using the native codegraph fallback.';
  } else if (input.graph.provider === 'graphify' && input.graph.stale) {
    action = 'RECOMMEND_REFRESH';
    reason = 'Graphify reports stale source files; an explicit refresh is recommended.';
  } else if (relevantChangedFiles.length > 0) {
    action = 'RECOMMEND_REFRESH';
    reason = 'Relevant repository source files changed after the current graph snapshot; an explicit refresh is recommended.';
  }

  return Object.freeze({
    format: 'furypipe-graph-lifecycle/v1',
    provider: input.graph.provider,
    action,
    changedFiles,
    relevantChangedFiles,
    staleFiles: Object.freeze([...input.graph.staleFiles]),
    reason,
    executionAuthorized: false,
  });
}

function normalizeGraphifyRoot(root: string): string {
  if (typeof root !== 'string' || !root.trim()) throw new FuryGraphError('root must be an absolute path');
  const normalized = normalize(root);
  if (!isAbsolute(normalized) || relative(normalized, normalized) !== '' || normalized.split(sep).includes('..')) {
    throw new FuryGraphError('root must be an absolute path');
  }
  return normalized;
}

function graphifyExecutable(value: string | undefined): string {
  const executable = value ?? 'graphify';
  if (typeof executable !== 'string' || !executable.trim() || executable.length > 512 || /[\u0000-\u001f\u007f]/u.test(executable)) {
    throw new FuryGraphError('Graphify executable is invalid');
  }
  return executable;
}

function graphifyTimeout(value: number | undefined): number {
  const timeoutMs = value ?? 600_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000) throw new FuryGraphError('Graphify timeout must be 1..3600000ms');
  return timeoutMs;
}

function graphifyPlanDigest(plan: FuryGraphRefreshPlan): string {
  return createHash('sha256').update(JSON.stringify({ format: plan.format, root: plan.root, executable: plan.executable, timeoutMs: plan.timeoutMs, command: plan.command }), 'utf8').digest('hex');
}

export function planGraphifyRefresh(root: string, options: { readonly executable?: string; readonly timeoutMs?: number } = {}): FuryGraphRefreshPlan {
  const normalizedRoot = normalizeGraphifyRoot(root);
  const executable = graphifyExecutable(options.executable);
  const timeoutMs = graphifyTimeout(options.timeoutMs);
  return Object.freeze({
    format: FURY_GRAPH_REFRESH_PLAN_FORMAT,
    root: normalizedRoot,
    executable,
    timeoutMs,
    command: Object.freeze([executable, 'update', normalizedRoot]),
    requiresExplicitApproval: true,
    executionAuthorized: false,
  });
}

export function executeGraphifyRefresh(plan: FuryGraphRefreshPlan, options: { readonly confirm?: boolean; readonly now?: () => number } = {}): Promise<FuryGraphRefreshReceipt> {
  if (!plan || typeof plan !== 'object' || plan.format !== FURY_GRAPH_REFRESH_PLAN_FORMAT || plan.requiresExplicitApproval !== true || plan.executionAuthorized !== false) {
    return Promise.reject(new FuryGraphError('Graphify refresh plan is invalid'));
  }
  if (options.confirm !== true) return Promise.reject(new FuryGraphError('Graphify refresh requires confirm: true'));
  const normalizedRoot = normalizeGraphifyRoot(plan.root);
  const executable = graphifyExecutable(plan.executable);
  const timeoutMs = graphifyTimeout(plan.timeoutMs);
  const command = Object.freeze([executable, 'update', normalizedRoot]);
  if (JSON.stringify(command) !== JSON.stringify(plan.command)) return Promise.reject(new FuryGraphError('Graphify refresh command does not match its plan'));
  const clock = options.now ?? Date.now;
  const startedAt = clock();
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) return Promise.reject(new FuryGraphError('Graphify refresh start time is invalid'));
  const planDigestSha256 = graphifyPlanDigest(plan);
  const commandDigestSha256 = createHash('sha256').update(JSON.stringify(command), 'utf8').digest('hex');
  return new Promise((resolve) => {
    execFile(executable, ['update', normalizedRoot], {
      cwd: normalizedRoot,
      shell: false,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    }, (error) => {
      const finishedAt = clock();
      const safeFinishedAt = Number.isSafeInteger(finishedAt) && finishedAt >= startedAt ? finishedAt : startedAt;
      const errorText = error ? error.message.slice(0, 200) : undefined;
      const receiptId = `gfr-${createHash('sha256').update(`${planDigestSha256}\0${startedAt}\0${safeFinishedAt}\0${errorText ?? ''}`, 'utf8').digest('hex').slice(0, 48)}`;
      resolve(Object.freeze({
        format: FURY_GRAPH_REFRESH_RECEIPT_FORMAT,
        receiptId,
        planDigestSha256,
        commandDigestSha256,
        root: normalizedRoot,
        outcome: error ? 'FAILED' : 'SUCCEEDED',
        startedAt,
        finishedAt: safeFinishedAt,
        durationMs: safeFinishedAt - startedAt,
        operatorApproved: true,
        executionAuthorized: true,
        ...(errorText ? { error: errorText } : {}),
      }));
    });
  });
}

/** Explicit, operator-requested refresh through the installed Graphify CLI (no LLM pass). */
export function refreshGraphify(root: string, options: { readonly executable?: string; readonly timeoutMs?: number } = {}): Promise<void> {
  const plan = planGraphifyRefresh(root, options);
  return executeGraphifyRefresh(plan, { confirm: true }).then((receipt) => {
    if (receipt.outcome === 'FAILED') throw new FuryGraphError(`graphify update failed: ${receipt.error ?? 'unknown error'}`);
  });
}

export interface FuryImpactDelta {
  readonly predictedChanged: readonly string[];
  readonly actualChanged: readonly string[];
  /** Files changed that were neither planned nor predicted to be affected. */
  readonly unexpectedChanges: readonly string[];
  /** Tests that depend on what actually changed. */
  readonly requiredTests: readonly string[];
  /** Required tests with no execution evidence yet. */
  readonly untestedNeighbours: readonly string[];
}

/**
 * Compare the blast radius predicted before a patch with the dependency
 * region the patch actually touched (master §47.5). The Judge turns
 * `untestedNeighbours` into TEST_RECEIPT requirements.
 */
export function furyImpactDelta(graph: FuryGraph, input: {
  readonly plannedFiles: readonly string[];
  readonly actualChangedFiles: readonly string[];
  readonly executedTests?: readonly string[];
  readonly depth?: number;
}): FuryImpactDelta {
  const depth = input.depth ?? 2;
  const predicted = furyBlastRadius(graph, input.plannedFiles, depth);
  const actual = furyBlastRadius(graph, input.actualChangedFiles, depth);
  const expected = new Set([...predicted.changed, ...predicted.affected]);
  const executed = new Set((input.executedTests ?? []).map((f) => relFile(f)).filter((f): f is string => Boolean(f)));
  const isTest = (f: string) => /(^|\/)(tests?|__tests__)\//u.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/u.test(f);
  const requiredTests = [...new Set([...actual.affectedTests, ...actual.changed.filter(isTest)])].sort();
  return Object.freeze({
    predictedChanged: predicted.changed,
    actualChanged: actual.changed,
    unexpectedChanges: Object.freeze(actual.changed.filter((f) => !expected.has(f))),
    requiredTests: Object.freeze(requiredTests),
    untestedNeighbours: Object.freeze(requiredTests.filter((f) => !executed.has(f))),
  });
}

/** Requirements FuryJudge must see satisfied for the tests around the actual blast radius. */
export function furyImpactRequirements(delta: FuryImpactDelta): readonly { readonly id: string; readonly level: 'MUST'; readonly description: string; readonly evidence: readonly { readonly kind: 'TEST_RECEIPT'; readonly subject: string }[] }[] {
  return Object.freeze(delta.requiredTests.map((file, index) => Object.freeze({
    id: `impact:test-${index + 1}`,
    level: 'MUST' as const,
    description: `test around the actual blast radius passes: ${file}`,
    evidence: Object.freeze([Object.freeze({ kind: 'TEST_RECEIPT' as const, subject: `test:${file}`.slice(0, 256) })]),
  })));
}
