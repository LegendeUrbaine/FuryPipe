import type { StudioRoute } from '../studio/studio-api.js';
import {
  planFuryPipeWebAccess,
  type FuryPipeWebActionClass,
  type FuryPipeWebConnectionMode,
  type FuryPipeWebScope,
} from './web-access-boundary.js';

export const FURYPIPE_WEB_API_FORMAT = 'furypipe-web-api/v1' as const;
export const FURYPIPE_WEB_API_PREFIX = '/api/web/v1/' as const;
export const FURYPIPE_WEB_API_MAX_BODY_BYTES = 256 * 1024;

export interface FuryPipeWebServerSession {
  readonly id: string;
  readonly mode: FuryPipeWebConnectionMode;
  readonly origin: string;
  readonly grantedScopes: readonly FuryPipeWebScope[];
}

export interface FuryPipeWebRequestContext {
  /**
   * A server-resolved session. The browser must never be allowed to construct
   * or self-assert this object as proof of authorization.
   */
  readonly session?: FuryPipeWebServerSession;
  /**
   * Trusted server-side approval result for the current request. Browser
   * payloads and headers are not approval evidence.
   */
  readonly operatorApproved?: boolean;
}

export interface FuryPipeWebStudioHandler {
  handle(route: StudioRoute, request: Request): Promise<Response>;
}

export interface FuryPipeWebApiRouteDescriptor {
  readonly webPath: string;
  readonly method: 'GET' | 'POST';
  readonly studioPath: string;
  readonly studioRoute: StudioRoute;
  readonly scope: FuryPipeWebScope;
  readonly actionClass: FuryPipeWebActionClass;
}

const ROUTES = Object.freeze([
  {
    webPath: '/api/web/v1/models',
    method: 'GET',
    studioPath: '/api/studio/models.json',
    studioRoute: 'models',
    scope: 'studio:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/support',
    method: 'GET',
    studioPath: '/api/studio/support.json',
    studioRoute: 'support',
    scope: 'diagnostics:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/artifacts',
    method: 'GET',
    studioPath: '/api/studio/artifacts.json',
    studioRoute: 'artifacts',
    scope: 'artifacts:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/artifacts/search',
    method: 'POST',
    studioPath: '/api/studio/artifacts/search',
    studioRoute: 'artifact-search',
    scope: 'artifacts:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/artifacts/create',
    method: 'POST',
    studioPath: '/api/studio/artifacts/create',
    studioRoute: 'artifact-create',
    scope: 'artifacts:write',
    actionClass: 'write',
  },
  {
    webPath: '/api/web/v1/memory',
    method: 'GET',
    studioPath: '/api/studio/memory.json',
    studioRoute: 'memory',
    scope: 'memory:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/memory/search',
    method: 'POST',
    studioPath: '/api/studio/memory/search',
    studioRoute: 'memory-search',
    scope: 'memory:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/media',
    method: 'GET',
    studioPath: '/api/studio/media.json',
    studioRoute: 'media',
    scope: 'media:plan',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/media/preview',
    method: 'POST',
    studioPath: '/api/studio/media/preview',
    studioRoute: 'media-preview',
    scope: 'media:plan',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/media/timeline/preview',
    method: 'POST',
    studioPath: '/api/studio/media/timeline/preview',
    studioRoute: 'media-timeline-preview',
    scope: 'media:plan',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/observability',
    method: 'GET',
    studioPath: '/api/studio/observability.json',
    studioRoute: 'observability',
    scope: 'diagnostics:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/code/edit/plan',
    method: 'POST',
    studioPath: '/api/studio/code/edit/plan',
    studioRoute: 'code-edit-plan',
    scope: 'code:plan',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/code/script/plan',
    method: 'POST',
    studioPath: '/api/studio/code/script/plan',
    studioRoute: 'code-script-plan',
    scope: 'code:plan',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/workflows/preview',
    method: 'POST',
    studioPath: '/api/studio/flow-preview',
    studioRoute: 'flow-preview',
    scope: 'workflow:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/workflows/automation-preview',
    method: 'POST',
    studioPath: '/api/studio/flow-automation-preview',
    studioRoute: 'flow-automation-preview',
    scope: 'workflow:read',
    actionClass: 'read',
  },
  {
    webPath: '/api/web/v1/chat',
    method: 'POST',
    studioPath: '/api/studio/chat',
    studioRoute: 'chat',
    scope: 'chat:send',
    actionClass: 'stream',
  },
] satisfies readonly FuryPipeWebApiRouteDescriptor[]);

const ROUTE_BY_PATH = new Map(ROUTES.map((route) => [route.webPath, route] as const));

function problem(status: number, code: string, detail: string, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({
    format: FURYPIPE_WEB_API_FORMAT,
    error: Object.freeze({ code, detail }),
  }), {
    status,
    headers: {
      'content-type': 'application/problem+json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

function canonicalOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      || parsed.username !== ''
      || parsed.password !== '') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function safeForwardHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ['content-type', 'accept', 'accept-language']) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

function safeResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  for (const name of ['content-type', 'content-disposition', 'etag', 'last-modified']) {
    const value = response.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-furypipe-web-api', FURYPIPE_WEB_API_FORMAT);
  return headers;
}

async function readBoundedBody(request: Request): Promise<ArrayBuffer | undefined> {
  if (request.body === null) return undefined;

  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const parsed = Number(declared);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > FURYPIPE_WEB_API_MAX_BODY_BYTES) {
      throw Object.assign(new Error('request body is too large'), { code: 'BODY_TOO_LARGE' });
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > FURYPIPE_WEB_API_MAX_BODY_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error('request body is too large'), { code: 'BODY_TOO_LARGE' });
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new ArrayBuffer(total);
  const bytes = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function listFuryPipeWebApiRoutes(): readonly FuryPipeWebApiRouteDescriptor[] {
  return ROUTES;
}

export function furyPipeWebApiRoute(pathname: string): FuryPipeWebApiRouteDescriptor | null {
  return ROUTE_BY_PATH.get(pathname) ?? null;
}

export function createFuryPipeWebApi(studio: FuryPipeWebStudioHandler) {
  return Object.freeze({
    async handle(request: Request, context: FuryPipeWebRequestContext): Promise<Response> {
      const url = new URL(request.url);
      const route = furyPipeWebApiRoute(url.pathname);
      if (!route) return problem(404, 'route-not-found', 'web api route is not exposed');

      if (request.method !== route.method) {
        return problem(405, 'method-not-allowed', `expected ${route.method}`, { allow: route.method });
      }

      const session = context.session;
      if (!session) return problem(401, 'server-session-required', 'a server-resolved FuryPipe Web session is required');

      const requestOrigin = request.headers.get('origin');
      if (!requestOrigin) return problem(403, 'origin-required', 'browser origin is required');

      const sessionOrigin = canonicalOrigin(session.origin);
      const incomingOrigin = canonicalOrigin(requestOrigin);
      if (!sessionOrigin || !incomingOrigin || sessionOrigin !== incomingOrigin) {
        return problem(403, 'origin-mismatch', 'request origin does not match the server session');
      }

      if (!session.grantedScopes.includes(route.scope)) {
        return problem(403, 'scope-denied', 'server session does not grant the required web scope');
      }

      const access = planFuryPipeWebAccess({
        mode: session.mode,
        origin: incomingOrigin,
        actionClass: route.actionClass,
        requestedScopes: [route.scope],
        serverSessionEstablished: true,
      });
      if (!access.allowed) {
        return problem(403, 'web-access-denied', access.rejectionCode ?? 'web access denied');
      }

      if (access.requiresOperatorApproval && context.operatorApproved !== true) {
        return problem(403, 'operator-approval-required', 'this web action requires trusted server-side operator approval');
      }

      let body: ArrayBuffer | undefined;
      if (route.method === 'POST') {
        const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
        if (mediaType !== 'application/json') {
          return problem(415, 'json-required', 'web api POST requests require application/json');
        }
        try {
          body = await readBoundedBody(request);
        } catch (error) {
          if ((error as { code?: string }).code === 'BODY_TOO_LARGE') {
            return problem(413, 'body-too-large', `request body exceeds ${FURYPIPE_WEB_API_MAX_BODY_BYTES} bytes`);
          }
          throw error;
        }
      }

      const studioUrl = new URL(route.studioPath, 'http://127.0.0.1');
      studioUrl.search = url.search;
      const forwarded = new Request(studioUrl, {
        method: route.method,
        headers: safeForwardHeaders(request),
        ...(body === undefined ? {} : { body }),
      });

      const response = await studio.handle(route.studioRoute, forwarded);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: safeResponseHeaders(response),
      });
    },
  });
}
