import { describe, expect, it } from 'vitest';

import {
  FURYPIPE_WEB_API_FORMAT,
  FURYPIPE_WEB_API_MAX_BODY_BYTES,
  createFuryPipeWebApi,
  listFuryPipeWebApiRoutes,
  type FuryPipeWebServerSession,
  type FuryPipeWebStudioHandler,
} from '../src/web/web-api.js';

function session(overrides: Partial<FuryPipeWebServerSession> = {}): FuryPipeWebServerSession {
  return {
    id: 'session-1',
    mode: 'local-bridge',
    origin: 'http://127.0.0.1:4317',
    grantedScopes: [
      'studio:read',
      'chat:send',
      'artifacts:read',
      'artifacts:write',
      'memory:read',
      'code:plan',
      'media:plan',
      'workflow:read',
      'diagnostics:read',
    ],
    ...overrides,
  };
}

function request(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', 'http://127.0.0.1:4317');
  return new Request(`http://127.0.0.1:4317${path}`, { ...init, headers });
}

describe('FuryPipe shared Web API boundary', () => {
  it('forwards an allowlisted read route to the shared Studio handler without ambient credentials', async () => {
    const seen: Array<{ route: string; url: string; authorization: string | null; cookie: string | null }> = [];
    const studio: FuryPipeWebStudioHandler = {
      async handle(route, forwarded) {
        seen.push({
          route,
          url: forwarded.url,
          authorization: forwarded.headers.get('authorization'),
          cookie: forwarded.headers.get('cookie'),
        });
        return new Response(JSON.stringify({ models: [] }), {
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'provider=secret',
            'x-provider-secret': 'do-not-forward',
          },
        });
      },
    };
    const api = createFuryPipeWebApi(studio);

    const response = await api.handle(request('/api/web/v1/models?view=compact', {
      headers: {
        origin: 'http://127.0.0.1:4317',
        authorization: 'Bearer browser-secret',
        cookie: 'session=ambient',
        accept: 'application/json',
      },
    }), { session: session() });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-furypipe-web-api')).toBe(FURYPIPE_WEB_API_FORMAT);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-provider-secret')).toBeNull();
    expect(seen).toEqual([{
      route: 'models',
      url: 'http://127.0.0.1/api/studio/models.json?view=compact',
      authorization: null,
      cookie: null,
    }]);
  });

  it('requires a server-resolved session', async () => {
    let called = false;
    const api = createFuryPipeWebApi({
      async handle() {
        called = true;
        return new Response('unexpected');
      },
    });

    const response = await api.handle(request('/api/web/v1/models'), {});

    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  it('fails closed when the request origin does not match the server session', async () => {
    let called = false;
    const api = createFuryPipeWebApi({
      async handle() {
        called = true;
        return new Response('unexpected');
      },
    });

    const response = await api.handle(request('/api/web/v1/models', {
      headers: { origin: 'http://localhost:4317' },
    }), { session: session() });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'origin-mismatch' } });
    expect(called).toBe(false);
  });

  it('requires the route scope to be granted by the server session', async () => {
    let called = false;
    const api = createFuryPipeWebApi({
      async handle() {
        called = true;
        return new Response('unexpected');
      },
    });

    const response = await api.handle(request('/api/web/v1/media'), {
      session: session({ grantedScopes: ['studio:read'] }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'scope-denied' } });
    expect(called).toBe(false);
  });

  it('enforces HTTPS for remote gateway sessions through the shared access planner', async () => {
    let called = false;
    const api = createFuryPipeWebApi({
      async handle() {
        called = true;
        return new Response('unexpected');
      },
    });

    const response = await api.handle(new Request('http://app.example.test/api/web/v1/models', {
      headers: { origin: 'http://app.example.test' },
    }), {
      session: session({
        mode: 'remote-gateway',
        origin: 'http://app.example.test',
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'web-access-denied' } });
    expect(called).toBe(false);
  });

  it('requires trusted server-side approval before forwarding a write route', async () => {
    let calls = 0;
    const api = createFuryPipeWebApi({
      async handle(route) {
        calls += 1;
        return new Response(JSON.stringify({ route }), { headers: { 'content-type': 'application/json' } });
      },
    });

    const denied = await api.handle(request('/api/web/v1/artifacts/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'text', title: 'draft', content: 'hello' }),
    }), { session: session(), operatorApproved: false });

    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: { code: 'operator-approval-required' } });
    expect(calls).toBe(0);

    const allowed = await api.handle(request('/api/web/v1/artifacts/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'text', title: 'draft', content: 'hello' }),
    }), { session: session(), operatorApproved: true });

    expect(allowed.status).toBe(200);
    expect(calls).toBe(1);
  });

  it('rejects non-JSON POST requests before the Studio handler', async () => {
    let called = false;
    const api = createFuryPipeWebApi({
      async handle() {
        called = true;
        return new Response('unexpected');
      },
    });

    const response = await api.handle(request('/api/web/v1/chat', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    }), { session: session() });

    expect(response.status).toBe(415);
    expect(called).toBe(false);
  });

  it('bounds request bodies before forwarding them', async () => {
    let called = false;
    const api = createFuryPipeWebApi({
      async handle() {
        called = true;
        return new Response('unexpected');
      },
    });

    const response = await api.handle(request('/api/web/v1/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x'.repeat(FURYPIPE_WEB_API_MAX_BODY_BYTES + 1) }),
    }), { session: session() });

    expect(response.status).toBe(413);
    expect(called).toBe(false);
  });

  it('fails closed for unknown routes and wrong methods', async () => {
    const api = createFuryPipeWebApi({
      async handle() {
        return new Response('unexpected');
      },
    });

    const missing = await api.handle(request('/api/web/v1/mcp/direct'), { session: session() });
    const wrongMethod = await api.handle(request('/api/web/v1/chat'), { session: session() });

    expect(missing.status).toBe(404);
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('POST');
  });

  it('exposes no direct execute-class route', () => {
    const routes = listFuryPipeWebApiRoutes();

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => route.actionClass !== 'execute')).toBe(true);
    expect(routes.some((route) => route.webPath.includes('/mcp'))).toBe(false);
    expect(routes.some((route) => route.webPath.includes('/shell'))).toBe(false);
    expect(routes.some((route) => route.webPath.includes('/provider'))).toBe(false);
  });
});
