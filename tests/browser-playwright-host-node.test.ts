import { describe, expect, it } from 'vitest';

import {
  createManagedPlaywrightBrowserRuntime,
  createPinnedBrowserNetworkTransport,
  createPlaywrightBrowserHost,
  FURY_BROWSER_PINNED_TRANSPORT_FORMAT,
} from '../src/browser-playwright-host-node.js';

const signal = new AbortController().signal;

describe('Playwright browser host network governance', () => {
  it('rejects private DNS resolution before opening a socket', async () => {
    const transport = createPinnedBrowserNetworkTransport({
      allowedOrigins: ['https://example.test'],
      resolveHostname: async () => ['127.0.0.1'],
    });
    await expect(transport.request({
      url: 'https://example.test/',
      method: 'GET',
      headers: {},
      signal,
    })).rejects.toThrow(/private|loopback|metadata/u);
  });

  it('rejects a caller-supplied private pinned address even when normal DNS would be public', async () => {
    const transport = createPinnedBrowserNetworkTransport({
      allowedOrigins: ['https://example.test'],
      resolveHostname: async () => ['93.184.216.34'],
    });
    await expect(transport.request({
      url: 'https://example.test/',
      method: 'GET',
      headers: {},
      resolvedAddresses: ['10.0.0.8'],
      signal,
    })).rejects.toThrow(/private|loopback|metadata/u);
  });

  it('rejects network origins outside the explicit host allowlist', async () => {
    const transport = createPinnedBrowserNetworkTransport({
      allowedOrigins: ['https://example.test'],
      resolveHostname: async () => ['93.184.216.34'],
    });
    await expect(transport.request({
      url: 'https://other.test/',
      method: 'GET',
      headers: {},
      signal,
    })).rejects.toThrow(/allowlist/u);
  });

  it('requires explicit allowed origins and a pinned transport contract', () => {
    expect(() => createPlaywrightBrowserHost({ allowedOrigins: [] })).toThrow(/allowed origins/u);
    expect(() => createPlaywrightBrowserHost({
      allowedOrigins: ['https://example.test'],
      networkTransport: {
        format: 'wrong-format' as typeof FURY_BROWSER_PINNED_TRANSPORT_FORMAT,
        request: async () => {
          throw new Error('must not run');
        },
      },
    })).toThrow(/transport format/u);
  });

  it('constructs the managed runtime without launching Chromium until a session is created', () => {
    const runtime = createManagedPlaywrightBrowserRuntime({
      policy: {
        policyId: 'playwright-unit',
        allowedOrigins: ['https://example.test'],
        allowedActions: ['navigate', 'extract_text'],
      },
      resolveHostname: async () => ['93.184.216.34'],
      playwright: {
        networkTransport: {
          format: FURY_BROWSER_PINNED_TRANSPORT_FORMAT,
          request: async () => ({
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'text/html' },
            body: new TextEncoder().encode('<h1>unused</h1>'),
            url: 'https://example.test/',
            address: '93.184.216.34',
          }),
        },
      },
    });
    expect(runtime.format).toBe('furypipe-browser-runtime/v1');
  });
});
