import { lookup } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';

import type { Browser, BrowserContext, Page, Request as PlaywrightRequest, Route } from 'playwright';

import {
  BrowserRuntimeError,
  createManagedBrowserRuntime,
  validateBrowserUrl,
  type BrowserHost,
  type BrowserHostDownload,
  type BrowserHostNavigationResult,
  type BrowserPolicy,
  type BrowserRuntime,
  type BrowserWaitCondition,
} from './browser-runtime.js';

export const FURY_PLAYWRIGHT_BROWSER_HOST_FORMAT = 'furypipe-playwright-browser-host/v1' as const;
export const FURY_BROWSER_PINNED_TRANSPORT_FORMAT = 'furypipe-browser-pinned-transport/v1' as const;

export interface BrowserPinnedTransportRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
  readonly resolvedAddresses?: readonly string[];
  readonly signal: AbortSignal;
}

export interface BrowserPinnedTransportResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly url: string;
  readonly address: string;
}

export interface BrowserPinnedNetworkTransport {
  readonly format: typeof FURY_BROWSER_PINNED_TRANSPORT_FORMAT;
  request(input: BrowserPinnedTransportRequest): Promise<BrowserPinnedTransportResponse>;
}

export interface BrowserPinnedNetworkTransportOptions {
  readonly allowedOrigins: readonly string[];
  readonly resolveHostname?: (hostname: string) => Promise<readonly string[]>;
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
  readonly userAgent?: string;
}

export interface PlaywrightBrowserHostOptions {
  readonly allowedOrigins: readonly string[];
  readonly resolveHostname?: (hostname: string) => Promise<readonly string[]>;
  readonly networkTransport?: BrowserPinnedNetworkTransport;
  readonly headless?: boolean;
  readonly actionTimeoutMs?: number;
  readonly navigationTimeoutMs?: number;
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
  readonly userAgent?: string;
}

export interface ManagedPlaywrightBrowserRuntimeOptions extends Omit<Parameters<typeof createManagedBrowserRuntime>[0], 'host' | 'policy' | 'resolveHostname'> {
  readonly policy: BrowserPolicy & { readonly allowedOrigins: readonly string[] };
  readonly resolveHostname?: (hostname: string) => Promise<readonly string[]>;
  readonly playwright?: Omit<PlaywrightBrowserHostOptions, 'allowedOrigins' | 'resolveHostname'>;
}

interface NavigationGuard {
  readonly signal: AbortSignal;
  readonly onRedirect: (url: string) => Promise<void>;
  readonly redirects: string[];
  readonly initialUrl?: string;
  readonly initialAddresses?: readonly string[];
  initialConsumed: boolean;
  seenNavigation: boolean;
  failure?: Error;
}

interface PageBinding {
  readonly page: Page;
  guard?: NavigationGuard;
}

interface SessionBinding {
  readonly context: BrowserContext;
  readonly pages: Map<string, PageBinding>;
}

const MAX_HEADER_VALUE_BYTES = 64 * 1024;
const MAX_USER_AGENT_BYTES = 512;
const DEFAULT_MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const DEFAULT_ACTION_TIMEOUT_MS = 20_000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

function bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) {
    throw new BrowserRuntimeError('invalid-request', label + ' is outside its supported bound');
  }
  return resolved;
}

function normalizeOrigins(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 64) {
    throw new BrowserRuntimeError('invalid-request', 'Playwright host requires 1..64 explicit allowed origins');
  }
  const origins = values.map((value) => {
    if (typeof value !== 'string' || value.length < 1 || value.length > 2048 || value.includes('\0')) {
      throw new BrowserRuntimeError('invalid-request', 'Playwright allowed origin is invalid');
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BrowserRuntimeError('invalid-request', 'Playwright allowed origin is not an absolute URL');
    }
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password || url.hash) {
      throw new BrowserRuntimeError('invalid-request', 'Playwright allowed origin must be HTTP(S) without credentials or fragments');
    }
    if (url.port && url.port !== '80' && url.port !== '443') {
      throw new BrowserRuntimeError('invalid-request', 'Playwright allowed origin uses a non-default port');
    }
    return url.origin;
  });
  const unique = [...new Set(origins)].sort();
  if (unique.length !== origins.length) throw new BrowserRuntimeError('invalid-request', 'Playwright allowed origins contain duplicates');
  return Object.freeze(unique);
}

function safeUserAgent(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!value.trim() || value.includes('\0') || /[\r\n]/u.test(value) || bytes(value) > MAX_USER_AGENT_BYTES) {
    throw new BrowserRuntimeError('invalid-request', 'Playwright user agent is invalid');
  }
  return value;
}

function safeMethod(value: string): string {
  if (!/^[A-Z]{3,16}$/u.test(value)) throw new BrowserRuntimeError('invalid-request', 'browser network method is invalid');
  return value;
}

function safeHeaders(input: Readonly<Record<string, string>>, userAgent: string | undefined, bodyBytes: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(input)) {
    const name = rawName.toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]{1,128}$/u.test(name) || HOP_BY_HOP.has(name) || name === 'host' || name === 'content-length' || name === 'accept-encoding') continue;
    if (typeof rawValue !== 'string' || /[\r\n\0]/u.test(rawValue) || bytes(rawValue) > MAX_HEADER_VALUE_BYTES) {
      throw new BrowserRuntimeError('invalid-request', 'browser network header value is invalid');
    }
    out[name] = rawValue;
  }
  out['accept-encoding'] = 'identity';
  if (userAgent !== undefined) out['user-agent'] = userAgent;
  if (bodyBytes > 0) out['content-length'] = String(bodyBytes);
  return out;
}

function responseHeaders(rawHeaders: readonly string[]): Readonly<Record<string, string>> {
  const grouped = new Map<string, string[]>();
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    const rawName = rawHeaders[index] ?? '';
    const rawValue = rawHeaders[index + 1] ?? '';
    const name = rawName.toLowerCase();
    if (!name || HOP_BY_HOP.has(name) || /[\r\n\0]/u.test(rawValue)) continue;
    const values = grouped.get(name) ?? [];
    values.push(rawValue);
    grouped.set(name, values);
  }
  const out: Record<string, string> = {};
  for (const [name, values] of grouped) {
    out[name] = name === 'set-cookie' ? values.join('\n') : values.join(', ');
  }
  return Object.freeze(out);
}

async function defaultResolveHostname(hostname: string): Promise<readonly string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return Object.freeze(records.map((record) => record.address));
}

function httpRequestPinned(input: {
  readonly checkedUrl: string;
  readonly address: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
  readonly maxResponseBytes: number;
  readonly signal: AbortSignal;
}): Promise<BrowserPinnedTransportResponse> {
  const url = new URL(input.checkedUrl);
  const secure = url.protocol === 'https:';
  const originalHostname = url.hostname.startsWith('[') && url.hostname.endsWith(']') ? url.hostname.slice(1, -1) : url.hostname;
  const requestFn = secure ? https.request : http.request;
  return new Promise((resolve, reject) => {
    const req = requestFn({
      protocol: url.protocol,
      hostname: input.address,
      port: secure ? 443 : 80,
      path: url.pathname + url.search,
      method: input.method,
      headers: { ...input.headers, host: url.host },
      family: isIP(input.address) === 6 ? 6 : 4,
      agent: false,
      signal: input.signal,
      ...(secure ? {
        servername: isIP(originalHostname) === 0 ? originalHostname : undefined,
        rejectUnauthorized: true,
      } : {}),
    }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let settled = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        req.destroy();
        reject(error);
      };
      res.on('data', (chunk: Buffer) => {
        if (settled) return;
        total += chunk.byteLength;
        if (total > input.maxResponseBytes) {
          fail(new BrowserRuntimeError('host-failed', 'browser network response exceeded the host byte limit'));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      res.on('error', (error) => fail(error));
      res.on('end', () => {
        if (settled) return;
        settled = true;
        resolve(Object.freeze({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: responseHeaders(res.rawHeaders),
          body: new Uint8Array(Buffer.concat(chunks)),
          url: input.checkedUrl,
          address: input.address,
        }));
      });
    });
    req.on('error', (error) => reject(error));
    if (input.body !== undefined && input.body.byteLength > 0) req.write(input.body);
    req.end();
  });
}

export function createPinnedBrowserNetworkTransport(options: BrowserPinnedNetworkTransportOptions): BrowserPinnedNetworkTransport {
  const allowedOrigins = normalizeOrigins(options.allowedOrigins);
  const resolveHostname = options.resolveHostname ?? defaultResolveHostname;
  const maxRequestBytes = boundedInteger(options.maxRequestBytes, DEFAULT_MAX_REQUEST_BYTES, 1, 256 * 1024 * 1024, 'maxRequestBytes');
  const maxResponseBytes = boundedInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1, 256 * 1024 * 1024, 'maxResponseBytes');
  const userAgent = safeUserAgent(options.userAgent);

  return Object.freeze({
    format: FURY_BROWSER_PINNED_TRANSPORT_FORMAT,
    async request(input: BrowserPinnedTransportRequest): Promise<BrowserPinnedTransportResponse> {
      if (!input || typeof input !== 'object') throw new BrowserRuntimeError('invalid-request', 'browser network request is required');
      const method = safeMethod(input.method);
      const body = input.body === undefined ? undefined : new Uint8Array(input.body);
      if ((body?.byteLength ?? 0) > maxRequestBytes) throw new BrowserRuntimeError('host-failed', 'browser network request exceeded the host byte limit');
      const supplied = input.resolvedAddresses;
      if (supplied !== undefined && (!Array.isArray(supplied) || supplied.length < 1 || supplied.length > 64)) {
        throw new BrowserRuntimeError('invalid-request', 'browser pinned address set is invalid');
      }
      const checked = await validateBrowserUrl(input.url, {
        allowedOrigins,
        resolveHostname: supplied === undefined ? resolveHostname : async () => Object.freeze([...supplied]),
      });
      const address = checked.addresses[0];
      if (!address) throw new BrowserRuntimeError('url-invalid', 'browser URL has no validated address');
      const headers = safeHeaders(input.headers, userAgent, body?.byteLength ?? 0);
      try {
        return await httpRequestPinned({
          checkedUrl: checked.url,
          address,
          method,
          headers,
          ...(body === undefined ? {} : { body }),
          maxResponseBytes,
          signal: input.signal,
        });
      } catch (error) {
        if (error instanceof BrowserRuntimeError) throw error;
        if (input.signal.aborted) throw new BrowserRuntimeError('cancelled', 'browser pinned request was cancelled');
        throw new BrowserRuntimeError('host-failed', 'browser pinned request failed');
      }
    },
  });
}

function headerFilename(value: string | undefined, fallbackUrl: string): string {
  if (value) {
    const utf8 = /filename\*=UTF-8''([^;]+)/iu.exec(value)?.[1];
    if (utf8) {
      try { return decodeURIComponent(utf8); } catch { /* fall through */ }
    }
    const plain = /filename="?([^";]+)"?/iu.exec(value)?.[1];
    if (plain) return plain;
  }
  const path = new URL(fallbackUrl).pathname.split('/').filter(Boolean).at(-1);
  return path || 'download.bin';
}

async function loadPlaywrightBrowser(headless: boolean): Promise<Browser> {
  let playwright: typeof import('playwright');
  try {
    playwright = await import('playwright');
  } catch {
    throw new BrowserRuntimeError('host-failed', 'Playwright is not installed; install playwright 1.63.x to use the browser host');
  }
  try {
    return await playwright.chromium.launch({
      headless,
      args: [
        '--disable-quic',
        '--disable-webrtc',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--no-proxy-server',
      ],
    });
  } catch {
    throw new BrowserRuntimeError('host-failed', 'Playwright Chromium could not be launched');
  }
}

function navigationResult(page: Page, guard: NavigationGuard, before: string, always: boolean): BrowserHostNavigationResult | undefined {
  const finalUrl = page.url();
  if (!always && finalUrl === before && guard.redirects.length === 0) return undefined;
  return Object.freeze({
    finalUrl,
    redirects: Object.freeze([...guard.redirects]),
  });
}

async function abortable<T>(page: Page, signal: AbortSignal, operation: Promise<T>): Promise<T> {
  if (signal.aborted) {
    await page.close().catch(() => undefined);
    throw new BrowserRuntimeError('cancelled', 'browser action was cancelled');
  }
  let listener: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    listener = () => {
      void page.close().catch(() => undefined);
      reject(new BrowserRuntimeError('cancelled', 'browser action was cancelled'));
    };
    signal.addEventListener('abort', listener, { once: true });
  });
  try {
    return await Promise.race([operation, aborted]);
  } finally {
    if (listener) signal.removeEventListener('abort', listener);
  }
}

async function settleNavigation(page: Page, guard: NavigationGuard, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  if (!guard.seenNavigation) return;
  await page.waitForLoadState('domcontentloaded', { timeout: Math.min(timeoutMs, 5_000) }).catch(() => undefined);
  await new Promise<void>((resolve) => setImmediate(resolve));
}

export function createPlaywrightBrowserHost(options: PlaywrightBrowserHostOptions): BrowserHost {
  const allowedOrigins = normalizeOrigins(options.allowedOrigins);
  const resolveHostname = options.resolveHostname ?? defaultResolveHostname;
  const transport = options.networkTransport ?? createPinnedBrowserNetworkTransport({
    allowedOrigins,
    resolveHostname,
    maxRequestBytes: options.maxRequestBytes,
    maxResponseBytes: options.maxResponseBytes,
    userAgent: options.userAgent,
  });
  if (transport.format !== FURY_BROWSER_PINNED_TRANSPORT_FORMAT) {
    throw new BrowserRuntimeError('invalid-request', 'browser network transport format is invalid');
  }
  const actionTimeoutMs = boundedInteger(options.actionTimeoutMs, DEFAULT_ACTION_TIMEOUT_MS, 100, 10 * 60_000, 'actionTimeoutMs');
  const navigationTimeoutMs = boundedInteger(options.navigationTimeoutMs, DEFAULT_NAVIGATION_TIMEOUT_MS, 100, 10 * 60_000, 'navigationTimeoutMs');
  const userAgent = safeUserAgent(options.userAgent);
  const sessions = new Map<string, SessionBinding>();
  let browser: Browser | undefined;
  let browserPromise: Promise<Browser> | undefined;

  const ensureBrowser = async (): Promise<Browser> => {
    if (browser?.isConnected()) return browser;
    browserPromise ??= loadPlaywrightBrowser(options.headless !== false);
    browser = await browserPromise;
    browserPromise = undefined;
    return browser;
  };

  const session = (sessionId: string): SessionBinding => {
    const value = sessions.get(sessionId);
    if (!value) throw new BrowserRuntimeError('invalid-session', 'Playwright session does not exist');
    return value;
  };

  const binding = (sessionId: string, pageId: string): PageBinding => {
    const value = session(sessionId).pages.get(pageId);
    if (!value || value.page.isClosed()) throw new BrowserRuntimeError('invalid-page', 'Playwright page does not exist');
    return value;
  };

  const installNetworkGate = async (pageBinding: PageBinding): Promise<void> => {
    const page = pageBinding.page;
    await page.route('**/*', async (route: Route, request: PlaywrightRequest) => {
      const url = request.url();
      if (!/^https?:/iu.test(url)) {
        await route.abort('blockedbyclient').catch(() => undefined);
        return;
      }
      const guard = pageBinding.guard;
      if (!guard) {
        await route.abort('blockedbyclient').catch(() => undefined);
        return;
      }
      let pinned: readonly string[] | undefined;
      const mainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
      if (mainNavigation) {
        guard.seenNavigation = true;
        if (!guard.initialConsumed && guard.initialUrl === url && guard.initialAddresses !== undefined) {
          guard.initialConsumed = true;
          pinned = guard.initialAddresses;
        } else {
          try {
            await guard.onRedirect(url);
            guard.redirects.push(url);
          } catch (error) {
            guard.failure = error instanceof Error ? error : new BrowserRuntimeError('policy-denied', 'browser redirect was rejected');
            await route.abort('blockedbyclient').catch(() => undefined);
            return;
          }
        }
      }
      try {
        const checked = await validateBrowserUrl(url, {
          allowedOrigins,
          resolveHostname: pinned === undefined ? resolveHostname : async () => Object.freeze([...pinned!]),
        });
        const body = request.postDataBuffer();
        const response = await transport.request({
          url: checked.url,
          method: request.method().toUpperCase(),
          headers: request.headers(),
          ...(body === null ? {} : { body: new Uint8Array(body) }),
          resolvedAddresses: checked.addresses,
          signal: guard.signal,
        });
        await route.fulfill({
          status: response.status,
          headers: { ...response.headers },
          body: Buffer.from(response.body),
        });
      } catch (error) {
        guard.failure = error instanceof Error ? error : new BrowserRuntimeError('host-failed', 'browser network gate failed');
        await route.abort('failed').catch(() => undefined);
      }
    });
    await page.routeWebSocket('**/*', async (socket) => {
      try {
        await socket.close({ code: 1008, reason: 'FuryPipe browser network policy' });
      } catch {
        // Socket is already closed.
      }
    });
    await page.addInitScript(() => {
      const deny = (name: string): void => {
        try {
          Object.defineProperty(globalThis, name, {
            configurable: false,
            writable: false,
            value: class {
              constructor() { throw new Error(name + ' is disabled by FuryPipe browser policy'); }
            },
          });
        } catch {
          // Browser built-ins can be non-configurable. Playwright route gates remain authoritative.
        }
      };
      deny('WebSocket');
      deny('WebTransport');
      deny('EventSource');
      deny('RTCPeerConnection');
      deny('webkitRTCPeerConnection');
      try {
        Object.defineProperty(globalThis, 'open', { configurable: false, writable: false, value: () => null });
      } catch {
        // Popups are also closed at the Playwright page boundary.
      }
    });
    page.setDefaultTimeout(actionTimeoutMs);
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    page.on('dialog', (dialog) => { void dialog.dismiss().catch(() => undefined); });
    page.on('popup', (popup) => { void popup.close().catch(() => undefined); });
  };

  const withNavigationGuard = async <T>(
    pageBinding: PageBinding,
    signal: AbortSignal,
    onRedirect: (url: string) => Promise<void>,
    operation: () => Promise<T>,
    initial?: { readonly url: string; readonly addresses: readonly string[] },
  ): Promise<{ readonly value: T; readonly navigation?: BrowserHostNavigationResult }> => {
    if (pageBinding.guard) throw new BrowserRuntimeError('host-failed', 'concurrent Playwright actions on one page are not allowed');
    const before = pageBinding.page.url();
    const guard: NavigationGuard = {
      signal,
      onRedirect,
      redirects: [],
      ...(initial === undefined ? {} : { initialUrl: initial.url, initialAddresses: initial.addresses }),
      initialConsumed: false,
      seenNavigation: false,
    };
    pageBinding.guard = guard;
    try {
      const value = await abortable(pageBinding.page, signal, operation());
      await settleNavigation(pageBinding.page, guard, navigationTimeoutMs);
      if (guard.failure) throw guard.failure;
      return Object.freeze({
        value,
        ...(navigationResult(pageBinding.page, guard, before, initial !== undefined) === undefined
          ? {}
          : { navigation: navigationResult(pageBinding.page, guard, before, initial !== undefined)! }),
      });
    } finally {
      pageBinding.guard = undefined;
    }
  };

  const noRedirect = async (): Promise<void> => {
    throw new BrowserRuntimeError('policy-denied', 'unexpected top-level navigation is not authorized');
  };

  const host: BrowserHost = {

    async createSession(input): Promise<void> {
      if (sessions.has(input.sessionId)) throw new BrowserRuntimeError('invalid-session', 'Playwright session already exists');
      if (input.signal.aborted) throw new BrowserRuntimeError('cancelled', 'browser session creation was cancelled');
      const activeBrowser = await ensureBrowser();
      const context = await activeBrowser.newContext({
        acceptDownloads: false,
        serviceWorkers: 'block',
        ignoreHTTPSErrors: false,
        bypassCSP: false,
        javaScriptEnabled: true,
        ...(userAgent === undefined ? {} : { userAgent }),
      });
      await context.clearPermissions();
      const value: SessionBinding = { context, pages: new Map() };
      sessions.set(input.sessionId, value);
      if (input.signal.aborted) {
        sessions.delete(input.sessionId);
        await context.close().catch(() => undefined);
        throw new BrowserRuntimeError('cancelled', 'browser session creation was cancelled');
      }
    },

    async closeSession(input): Promise<void> {
      const value = sessions.get(input.sessionId);
      if (!value) return;
      sessions.delete(input.sessionId);
      await value.context.close().catch(() => undefined);
      if (sessions.size === 0 && browser) {
        const closing = browser;
        browser = undefined;
        await closing.close().catch(() => undefined);
      }
    },

    async createPage(input): Promise<void> {
      const value = session(input.sessionId);
      if (value.pages.has(input.pageId)) throw new BrowserRuntimeError('invalid-page', 'Playwright page already exists');
      const page = await value.context.newPage();
      const pageBinding: PageBinding = { page };
      value.pages.set(input.pageId, pageBinding);
      try {
        await installNetworkGate(pageBinding);
      } catch (error) {
        value.pages.delete(input.pageId);
        await page.close().catch(() => undefined);
        throw error;
      }
      if (input.signal.aborted) {
        value.pages.delete(input.pageId);
        await page.close().catch(() => undefined);
        throw new BrowserRuntimeError('cancelled', 'browser page creation was cancelled');
      }
    },

    async closePage(input): Promise<void> {
      const value = sessions.get(input.sessionId);
      const pageBinding = value?.pages.get(input.pageId);
      if (!value || !pageBinding) return;
      value.pages.delete(input.pageId);
      await pageBinding.page.close().catch(() => undefined);
    },

    async navigate(input): Promise<BrowserHostNavigationResult> {
      const pageBinding = binding(input.sessionId, input.pageId);
      const result = await withNavigationGuard(
        pageBinding,
        input.signal,
        input.onRedirect,
        () => pageBinding.page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs }).then(() => undefined),
        { url: input.url, addresses: input.resolvedAddresses },
      );
      if (!result.navigation) throw new BrowserRuntimeError('host-failed', 'Playwright navigation produced no final URL');
      return Object.freeze({ ...result.navigation, title: await pageBinding.page.title().catch(() => '') });
    },

    async click(input): Promise<void | BrowserHostNavigationResult> {
      const pageBinding = binding(input.sessionId, input.pageId);
      const result = await withNavigationGuard(pageBinding, input.signal, input.onRedirect ?? noRedirect, () =>
        pageBinding.page.locator(input.selector).click({ timeout: actionTimeoutMs }));
      return result.navigation;
    },

    async fill(input): Promise<void | BrowserHostNavigationResult> {
      const pageBinding = binding(input.sessionId, input.pageId);
      const result = await withNavigationGuard(pageBinding, input.signal, input.onRedirect ?? noRedirect, () =>
        pageBinding.page.locator(input.selector).fill(input.value, { timeout: actionTimeoutMs }));
      return result.navigation;
    },

    async select(input): Promise<void | BrowserHostNavigationResult> {
      const pageBinding = binding(input.sessionId, input.pageId);
      const result = await withNavigationGuard(pageBinding, input.signal, input.onRedirect ?? noRedirect, () =>
        pageBinding.page.locator(input.selector).selectOption(input.value, { timeout: actionTimeoutMs }).then(() => undefined));
      return result.navigation;
    },

    async keyboard(input): Promise<void | BrowserHostNavigationResult> {
      const pageBinding = binding(input.sessionId, input.pageId);
      const result = await withNavigationGuard(pageBinding, input.signal, input.onRedirect ?? noRedirect, () =>
        pageBinding.page.keyboard.press(input.key).then(() => undefined));
      return result.navigation;
    },

    async submit(input): Promise<BrowserHostNavigationResult> {
      const pageBinding = binding(input.sessionId, input.pageId);
      const result = await withNavigationGuard(pageBinding, input.signal, input.onRedirect, async () => {
        const form = pageBinding.page.locator(input.formScope);
        const submitter = form.locator('button[type="submit"],input[type="submit"]').first();
        if (await submitter.count()) await submitter.click({ timeout: actionTimeoutMs });
        else await form.press('Enter', { timeout: actionTimeoutMs });
      });
      return result.navigation ?? Object.freeze({ finalUrl: pageBinding.page.url(), redirects: Object.freeze([]) });
    },

    async upload(input): Promise<void | BrowserHostNavigationResult> {
      const pageBinding = binding(input.sessionId, input.pageId);
      if (new URL(pageBinding.page.url()).origin !== input.destinationOrigin) {
        throw new BrowserRuntimeError('policy-denied', 'upload destination origin does not match the active page');
      }
      const file = await readFile(input.filePath);
      const scope = pageBinding.page.locator(input.formScope);
      const target = (await scope.getAttribute('type'))?.toLowerCase() === 'file'
        ? scope
        : scope.locator('input[type="file"]').first();
      if (await target.count() === 0) throw new BrowserRuntimeError('upload-invalid', 'upload form scope contains no file input');
      const result = await withNavigationGuard(pageBinding, input.signal, input.onRedirect ?? noRedirect, () =>
        target.setInputFiles({
          name: input.filePath.split(/[\\/]/u).at(-1) ?? 'upload.bin',
          mimeType: 'application/octet-stream',
          buffer: file,
        }, { timeout: actionTimeoutMs }));
      return result.navigation;
    },

    async download(input): Promise<BrowserHostDownload> {
      const pageBinding = binding(input.sessionId, input.pageId);
      let current = input.url ?? pageBinding.page.url();
      let pinned = input.resolvedAddresses;
      const cookies = await pageBinding.page.context().cookies(current);
      const cookieHeader = cookies.map((cookie) => cookie.name + '=' + cookie.value).join('; ');
      for (let redirectCount = 0; redirectCount <= 10; redirectCount += 1) {
        const checkedCurrent = await validateBrowserUrl(current, {
          allowedOrigins,
          resolveHostname: pinned === undefined ? resolveHostname : async () => Object.freeze([...pinned!]),
        });
        const response = await transport.request({
          url: checkedCurrent.url,
          method: 'GET',
          headers: cookieHeader ? { cookie: cookieHeader } : {},
          resolvedAddresses: checkedCurrent.addresses,
          signal: input.signal,
        });
        const location = response.headers.location;
        if (location && response.status >= 300 && response.status < 400) {
          if (redirectCount === 10) throw new BrowserRuntimeError('download-invalid', 'download redirect limit exceeded');
          const next = new URL(location, current).toString();
          await (input.onRedirect ?? noRedirect)(next);
          const checked = await validateBrowserUrl(next, { allowedOrigins, resolveHostname });
          current = checked.url;
          pinned = checked.addresses;
          continue;
        }
        if (response.status < 200 || response.status >= 300) throw new BrowserRuntimeError('download-invalid', 'download returned a non-success status');
        return Object.freeze({
          filename: headerFilename(response.headers['content-disposition'], current),
          mediaType: response.headers['content-type'] ?? 'application/octet-stream',
          bytes: new Uint8Array(response.body),
          sourceUrl: current,
        });
      }
      throw new BrowserRuntimeError('download-invalid', 'download did not complete');
    },

    async screenshot(input): Promise<Uint8Array> {
      const pageBinding = binding(input.sessionId, input.pageId);
      return new Uint8Array(await abortable(pageBinding.page, input.signal, pageBinding.page.screenshot({
        type: 'png',
        fullPage: false,
        animations: 'disabled',
      })));
    },

    async extractText(input): Promise<string> {
      const pageBinding = binding(input.sessionId, input.pageId);
      return abortable(pageBinding.page, input.signal, pageBinding.page.locator('body').innerText({ timeout: actionTimeoutMs }));
    },

    async accessibilitySnapshot(input): Promise<unknown> {
      const pageBinding = binding(input.sessionId, input.pageId);
      return abortable(pageBinding.page, input.signal, pageBinding.page.locator('body').ariaSnapshot({ timeout: actionTimeoutMs }));
    },

    async wait(input): Promise<void> {
      const pageBinding = binding(input.sessionId, input.pageId);
      await withNavigationGuard(pageBinding, input.signal, input.onRedirect ?? noRedirect, async () => {
        const condition: BrowserWaitCondition = input.condition;
        if (condition === 'dom-content-loaded') {
          await pageBinding.page.waitForLoadState('domcontentloaded', { timeout: navigationTimeoutMs });
        } else if (condition === 'load') {
          await pageBinding.page.waitForLoadState('load', { timeout: navigationTimeoutMs });
        } else if (condition === 'network-idle') {
          await pageBinding.page.waitForLoadState('networkidle', { timeout: navigationTimeoutMs });
        } else {
          await pageBinding.page.waitForEvent('framenavigated', {
            timeout: navigationTimeoutMs,
            predicate: (frame) => frame === pageBinding.page.mainFrame(),
          });
        }
      });
    },

    async inspectUrl(input): Promise<string> {
      const pageBinding = binding(input.sessionId, input.pageId);
      if (input.signal.aborted) throw new BrowserRuntimeError('cancelled', 'browser URL inspection was cancelled');
      return pageBinding.page.url();
    },
  };
  return Object.freeze(host);
}

export function createManagedPlaywrightBrowserRuntime(options: ManagedPlaywrightBrowserRuntimeOptions): BrowserRuntime {
  const allowedOrigins = normalizeOrigins(options.policy.allowedOrigins);
  const resolveHostname = options.resolveHostname ?? defaultResolveHostname;
  const host = createPlaywrightBrowserHost({
    allowedOrigins,
    resolveHostname,
    ...(options.playwright ?? {}),
  });
  return createManagedBrowserRuntime({
    ...options,
    host,
    policy: Object.freeze({ ...options.policy, allowedOrigins }),
    resolveHostname,
  });
}
