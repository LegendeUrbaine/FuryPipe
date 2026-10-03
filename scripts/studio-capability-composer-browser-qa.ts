import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium, firefox, webkit, type BrowserType, type Page } from 'playwright';

import { FURY_HARNESS_REGISTRY, type FuryHarnessDiscovery } from '../src/fury-harness-hub.js';
import type { FuryLocalBackendStatus } from '../src/fury-local-fabric.js';
import { createFuryMcpHub } from '../src/fury-mcp-hub.js';
import { createFurySkillHub } from '../src/fury-skill-hub.js';
import { createStudioApi, studioApiRoute } from '../src/studio/studio-api.js';
import { studioHtmlResponse } from '../src/studio/studio-page.js';

const HOST = '127.0.0.1';
const OUT = path.resolve(process.env.FURYPIPE_COMPOSER_QA_OUTPUT_DIR?.trim() || 'artifacts/studio-capability-composer-browser-qa');
const LIVE_MODEL = process.env.FURYPIPE_OLLAMA_MODEL?.trim() || 'qwen3.5:latest';
const LIVE_BASE_URL = (process.env.FURYPIPE_OLLAMA_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/u, '');
const EXPECTED_OUTPUT = `Local Composer inference reached ${LIVE_MODEL}.`;
const OBJECTIVE = `Reply with exactly this one sentence and nothing else: ${EXPECTED_OUTPUT}`;

type JsonRecord = Record<string, unknown>;

interface ComposerQaServer {
  readonly server: Server;
  readonly origin: string;
}

const harnesses: FuryHarnessDiscovery = {
  format: 'furypipe-harness-discovery/v1',
  platform: process.platform,
  harnesses: FURY_HARNESS_REGISTRY.map((definition) => ({
    id: definition.id,
    displayName: definition.displayName,
    authentication: 'not-probed' as const,
    definition,
    installed: definition.id === 'furypipe-native',
    versionStatus: definition.id === 'furypipe-native' ? 'builtin' as const : 'not-installed' as const,
  })),
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): JsonRecord {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'expected JSON object');
  return value as JsonRecord;
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, HOST, resolve));
  return (server.address() as { port: number }).port;
}

async function toNode(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  if (response.body) {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}

function toWeb(req: IncomingMessage, origin: string): Request {
  const chunks: Buffer[] = [];
  const body = new Promise<Buffer>((resolve) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
  return new Request(new URL(req.url ?? '/', origin), {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : []) as [string, string][],
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : new ReadableStream({ async start(controller) { controller.enqueue(new Uint8Array(await body)); controller.close(); } }),
    // @ts-expect-error Node fetch requires duplex for streamed bodies.
    duplex: 'half',
  });
}

async function ollamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${LIVE_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return false;
    const payload = asRecord(await response.json());
    return Array.isArray(payload.models) && payload.models.some((model) => {
      const candidate = asRecord(model);
      return candidate.name === LIVE_MODEL || candidate.model === LIVE_MODEL;
    });
  } catch {
    return false;
  }
}

async function startStudio(mode: 'live' | 'empty', projectRoot: string, stateDir: string): Promise<ComposerQaServer> {
  const backend: FuryLocalBackendStatus = {
    kind: 'ollama',
    baseUrl: LIVE_BASE_URL,
    reachable: mode === 'live',
    version: 'live-browser-qa',
    protocols: mode === 'live' ? ['native', 'openai-chat'] : [],
    models: mode === 'live' ? [{ backend: 'ollama', baseUrl: LIVE_BASE_URL, id: LIVE_MODEL, modality: 'text' }] : [],
    ...(mode === 'empty' ? { error: 'unreachable' } : {}),
  };
  const api = createStudioApi({
    projectRoot,
    composerDir: path.join(stateDir, 'composer'),
    discoverHarnesses: async () => harnesses,
    discoverLocal: async () => ({ backends: mode === 'live' ? [backend] : [] }),
    skillHub: createFurySkillHub({ projectRoot, homeDir: path.join(stateDir, 'home'), stateDir: path.join(stateDir, 'skill-hub'), projectTrustedForInstructions: true }),
    mcpHub: createFuryMcpHub({ projectRoot, homeDir: path.join(stateDir, 'home'), stateDir: path.join(stateDir, 'mcp-hub') }),
  });
  let origin = '';
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', origin);
      if (url.pathname === '/') return toNode(studioHtmlResponse(), res);
      const match = studioApiRoute(url.pathname);
      if (match && req.method === match.method) return toNode(await api.handle(match.route, toWeb(req, origin)), res);
      res.writeHead(404).end();
    })().catch((error: unknown) => {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : String(error));
    });
  });
  origin = `http://${HOST}:${await listen(server)}`;
  return { server, origin };
}

async function setMode(page: Page, mode: 'simple' | 'expert'): Promise<void> {
  await page.locator('#mode-button').click();
  await page.locator(`#mode-menu [role=menuitemradio][data-mode="${mode}"]`).click();
  await page.waitForFunction((expected) => document.body.dataset.mode === expected, mode);
}

async function fillObjective(page: Page): Promise<void> {
  await page.locator('#capability-composer-objective').fill(OBJECTIVE);
}

async function submitAndReadPlan(page: Page): Promise<JsonRecord> {
  await page.locator('#capability-composer-form button[type="submit"]').click();
  await page.locator('#capability-composer-stages').waitFor({ state: 'visible', timeout: 30_000 });
  const raw = await page.locator('#capability-composer-expert-evidence pre').textContent();
  return JSON.parse(raw ?? '{}') as JsonRecord;
}

async function fillAndPlan(page: Page): Promise<JsonRecord> {
  await fillObjective(page);
  return submitAndReadPlan(page);
}

async function screenshot(page: Page, filename: string, locator?: string): Promise<void> {
  const target = locator ? page.locator(locator) : page;
  await target.screenshot({ path: path.join(OUT, 'screens', filename) });
}

async function runEngine(name: string, type: BrowserType, normal: ComposerQaServer, empty: ComposerQaServer, capture: boolean): Promise<JsonRecord> {
  const browser = await type.launch();
  const consoleErrors: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // The no-confirmation probe deliberately exercises the governed HTTP 400.
      if (message.text() === 'Failed to load resource: the server responded with a status of 400 (Bad Request)') return;
      consoleErrors.push(message.text());
    });
    await page.goto(`${normal.origin}/#/autopilot`, { waitUntil: 'load' });
    await page.locator('#capability-composer-form').waitFor();
    assert(await page.locator('#capability-composer-objective').isVisible(), `${name}: Composer missing in Simple mode`);
    assert(await page.locator('#capability-composer-objective').isEditable(), `${name}: Simple objective input inaccessible`);
    if (capture) await screenshot(page, '01-composer-initial-simple-1440.png');

    await setMode(page, 'expert');
    if (capture) await screenshot(page, '02-composer-initial-expert-1440.png');
    await fillObjective(page);
    if (capture) await screenshot(page, '03-composer-request-entered.png');
    const planBefore = await submitAndReadPlan(page);
    assert(planBefore.state === 'READY_FOR_CONFIRMATION', `${name}: expected live plan READY_FOR_CONFIRMATION, got ${String(planBefore.state)}`);
    if (capture) await screenshot(page, '04-composer-generated-plan.png');
    if (capture) await screenshot(page, '05-composer-selected-local-model.png', '#capability-composer-runtime');
    if (capture) await screenshot(page, '06-composer-skill-mcp-advisory.png', '#capability-composer-capabilities');
    if (capture) await screenshot(page, '07-composer-compatibility-authority.png', '#capability-composer-stages');
    if (capture) await screenshot(page, '08-composer-capability-explanation.png', '#capability-composer-capabilities');
    const checkbox = page.locator('#capability-composer-runtime input[type="checkbox"]');
    const execute = page.locator('#capability-composer-runtime button').last();
    assert(await checkbox.isVisible() && !(await checkbox.isChecked()), `${name}: confirmation checkbox state invalid`);
    assert(await execute.isDisabled(), `${name}: execute control was not gated before confirmation`);
    if (capture) await screenshot(page, '09-composer-confirmation-required.png', '#capability-composer-runtime');

    await execute.evaluate((element) => { const button = element as HTMLButtonElement; button.disabled = false; button.click(); });
    await page.locator('#capability-composer-runtime .bad').filter({ hasText: 'Local execution refused' }).waitFor({ timeout: 30_000 });
    if (capture) await screenshot(page, '10-composer-execution-denied-without-confirmation.png', '#capability-composer-runtime');

    await checkbox.check();
    await execute.click();
    await page.locator('#capability-composer-execution-proof').waitFor({ timeout: 300_000 });
    const execution = JSON.parse((await page.locator('#capability-composer-execution-proof').textContent()) ?? '{}') as JsonRecord;
    assert(execution.status === 'COMPLETED', `${name}: live Composer execution was not COMPLETED`);
    assert(execution.output === EXPECTED_OUTPUT, `${name}: live Composer output was not the bounded acceptance result`);
    if (capture) await screenshot(page, '11-composer-confirmed-local-execution.png');
    if (capture) await screenshot(page, '12-composer-real-result-proof-receipts.png', '#capability-composer-execution-proof');

    const missingContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-US', reducedMotion: 'reduce' });
    const missingPage = await missingContext.newPage();
    await missingPage.goto(`${empty.origin}/#/autopilot`, { waitUntil: 'load' });
    await missingPage.locator('#capability-composer-objective').fill(OBJECTIVE);
    await missingPage.locator('#capability-composer-form button[type="submit"]').click();
    await missingPage.locator('#capability-composer-stages').waitFor({ state: 'visible', timeout: 30_000 });
    const missingRaw = await missingPage.locator('#capability-composer-expert-evidence pre').textContent();
    const missingPlan = JSON.parse(missingRaw ?? '{}') as JsonRecord;
    assert(missingPlan.state === 'NOT_CONFIGURED', `${name}: missing provider state was ${String(missingPlan.state)}`);
    if (capture) await screenshot(missingPage, '13-composer-not-configured.png');
    await missingContext.close();

    if (capture) {
      await page.locator('#capability-composer-stages').scrollIntoViewIfNeeded();
      await screenshot(page, '14-composer-dark-1440.png');
      const lightContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'en-US', reducedMotion: 'reduce' });
      const lightPage = await lightContext.newPage();
      await lightPage.goto(`${normal.origin}/#/settings`, { waitUntil: 'load' });
      await lightPage.evaluate(() => localStorage.setItem('furypipe.studio.theme', 'system'));
      await lightPage.reload({ waitUntil: 'load' });
      await lightPage.goto(`${normal.origin}/#/autopilot`, { waitUntil: 'load' });
      await fillAndPlan(lightPage);
      await lightPage.locator('#capability-composer-stages').scrollIntoViewIfNeeded();
      await screenshot(lightPage, '15-composer-light-1440.png');
      await lightContext.close();

      const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'en-US', reducedMotion: 'reduce' });
      const mobilePage = await mobileContext.newPage();
      await mobilePage.goto(`${normal.origin}/#/autopilot`, { waitUntil: 'load' });
      await fillAndPlan(mobilePage);
      assert(await mobilePage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1), 'Composer mobile page has horizontal overflow');
      await mobilePage.locator('#capability-composer-stages').scrollIntoViewIfNeeded();
      await screenshot(mobilePage, '16-composer-mobile-390.png');
      await mobilePage.locator('#capability-composer-expert-evidence summary').click();
      await mobilePage.locator('#capability-composer-expert-evidence').scrollIntoViewIfNeeded();
      await screenshot(mobilePage, '17-composer-mobile-details-expanded-390.png');
      await mobileContext.close();
    }
    assert(consoleErrors.length === 0, `${name}: console errors: ${consoleErrors.join(' | ')}`);
    return { engine: name, status: 'PASS', consoleErrors: 0, liveModel: LIVE_MODEL, planState: planBefore.state, executionStatus: execution.status };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(path.join(OUT, 'screens'), { recursive: true });
  rmSync(path.join(OUT, 'screens'), { recursive: true, force: true });
  mkdirSync(path.join(OUT, 'screens'), { recursive: true });
  if (!(await ollamaAvailable())) {
    const evidence = { format: 'furypipe-studio-capability-composer-browser-qa/v1', status: 'NOT_EXECUTED', sourceCommit: process.env.FURYPIPE_SOURCE_COMMIT ?? 'not-bound', liveModel: LIVE_MODEL, reason: 'Ollama or required model unavailable; no fixture substituted.' };
    writeFileSync(path.join(OUT, 'browser-qa.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify(evidence, null, 2));
    return;
  }

  const projectRoot = mkdtempSync(path.join(tmpdir(), 'furypipe-composer-browser-qa-'));
  const servers: ComposerQaServer[] = [];
  const types: Record<string, BrowserType> = { chromium, firefox, webkit };
  const engines = (process.env.FURYPIPE_COMPOSER_QA_ENGINES?.trim() || 'chromium,firefox,webkit').split(',').map((value) => value.trim()).filter(Boolean);
  const results: JsonRecord[] = [];
  try {
    for (const [index, engine] of engines.entries()) {
      const type = types[engine];
      assert(type, `unknown browser engine: ${engine}`);
      const normal = await startStudio('live', projectRoot, path.join(OUT, `state-${engine}-${index}`));
      const empty = await startStudio('empty', projectRoot, path.join(OUT, `empty-state-${engine}-${index}`));
      servers.push(normal, empty);
      results.push(await runEngine(engine, type, normal, empty, engine === 'chromium'));
      console.log(`✓ composer ${engine}`);
    }
  } finally {
    for (const entry of servers) await new Promise<void>((resolve) => entry.server.close(() => resolve()));
    rmSync(projectRoot, { recursive: true, force: true });
  }
  const evidence = {
    format: 'furypipe-studio-capability-composer-browser-qa/v1',
    status: 'PASS',
    sourceCommit: process.env.FURYPIPE_SOURCE_COMMIT ?? 'not-bound',
    liveModel: LIVE_MODEL,
    captures: 17,
    screenshotDirectory: path.join(OUT, 'screens'),
    engines: results,
    fixtureEvidence: 'SEPARATE: tests/fury-capability-composer.test.ts',
    humanVisualGate: 'MANUAL_REQUIRED',
    screenReader: 'MANUAL_REQUIRED',
  };
  writeFileSync(path.join(OUT, 'browser-qa.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
