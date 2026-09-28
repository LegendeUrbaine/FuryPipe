import { describe, expect, it } from 'vitest';

import {
  FURYPIPE_WEB_ACCESS_PLAN_FORMAT,
  planFuryPipeWebAccess,
  type FuryPipeWebScope,
} from '../src/web/web-access-boundary.js';

describe('FuryPipe Web access boundary', () => {
  it('allows a loopback local bridge session without granting runtime authority', () => {
    const plan = planFuryPipeWebAccess({
      mode: 'local-bridge',
      origin: 'http://127.0.0.1:4317',
      actionClass: 'read',
      requestedScopes: ['studio:read', 'artifacts:read'],
      serverSessionEstablished: true,
    });

    expect(plan.format).toBe(FURYPIPE_WEB_ACCESS_PLAN_FORMAT);
    expect(plan.allowed).toBe(true);
    expect(plan.transportSecurity).toBe('LOOPBACK_HTTP_OR_HTTPS');
    expect(plan.browserReceivesProviderSecrets).toBe(false);
    expect(plan.browserReceivesRuntimeAuthority).toBe(false);
    expect(plan.executionAuthorized).toBe(false);
  });

  it('rejects a non-loopback local bridge origin', () => {
    const plan = planFuryPipeWebAccess({
      mode: 'local-bridge',
      origin: 'http://192.168.1.20:4317',
      actionClass: 'read',
      requestedScopes: ['studio:read'],
      serverSessionEstablished: true,
    });

    expect(plan.allowed).toBe(false);
    expect(plan.rejectionCode).toBe('LOCAL_BRIDGE_REQUIRES_LOOPBACK');
  });

  it('requires HTTPS for remote gateway mode', () => {
    const plan = planFuryPipeWebAccess({
      mode: 'remote-gateway',
      origin: 'http://app.example.test',
      actionClass: 'stream',
      requestedScopes: ['studio:read'],
      serverSessionEstablished: true,
    });

    expect(plan.allowed).toBe(false);
    expect(plan.rejectionCode).toBe('REMOTE_GATEWAY_REQUIRES_HTTPS');
    expect(plan.transportSecurity).toBe('HTTPS_REQUIRED');
  });

  it('accepts an HTTPS remote gateway but still grants no execution authority', () => {
    const plan = planFuryPipeWebAccess({
      mode: 'remote-gateway',
      origin: 'https://app.example.test/workspace',
      actionClass: 'execute',
      requestedScopes: ['browser:plan', 'code:plan'],
      serverSessionEstablished: true,
    });

    expect(plan.allowed).toBe(true);
    expect(plan.origin).toBe('https://app.example.test');
    expect(plan.requiresOperatorApproval).toBe(true);
    expect(plan.executionAuthorized).toBe(false);
    expect(plan.browserReceivesRuntimeAuthority).toBe(false);
  });

  it('fails closed when the server session is absent', () => {
    const plan = planFuryPipeWebAccess({
      mode: 'remote-gateway',
      origin: 'https://app.example.test',
      actionClass: 'read',
      requestedScopes: ['diagnostics:read'],
      serverSessionEstablished: false,
    });

    expect(plan.allowed).toBe(false);
    expect(plan.rejectionCode).toBe('SERVER_SESSION_REQUIRED');
  });

  it('fails closed for invalid origins and embedded credentials', () => {
    const malformed = planFuryPipeWebAccess({
      mode: 'remote-gateway',
      origin: 'not-an-origin',
      actionClass: 'read',
      requestedScopes: ['studio:read'],
      serverSessionEstablished: true,
    });
    const embeddedCredentials = planFuryPipeWebAccess({
      mode: 'remote-gateway',
      origin: 'https://user:pass@app.example.test',
      actionClass: 'read',
      requestedScopes: ['studio:read'],
      serverSessionEstablished: true,
    });

    expect(malformed.rejectionCode).toBe('INVALID_ORIGIN');
    expect(embeddedCredentials.rejectionCode).toBe('INVALID_ORIGIN');
  });

  it('rejects unknown scopes at runtime', () => {
    const unknown = 'provider-secret' as FuryPipeWebScope;
    const plan = planFuryPipeWebAccess({
      mode: 'remote-gateway',
      origin: 'https://app.example.test',
      actionClass: 'read',
      requestedScopes: ['studio:read', unknown],
      serverSessionEstablished: true,
    });

    expect(plan.allowed).toBe(false);
    expect(plan.rejectionCode).toBe('UNSUPPORTED_SCOPE');
    expect(plan.executionAuthorized).toBe(false);
  });

  it('deduplicates scopes deterministically and marks writes for approval', () => {
    const plan = planFuryPipeWebAccess({
      mode: 'local-bridge',
      origin: 'https://localhost:4317/path',
      actionClass: 'write',
      requestedScopes: ['artifacts:write', 'studio:read', 'artifacts:write'],
      serverSessionEstablished: true,
    });

    expect(plan.allowed).toBe(true);
    expect(plan.requestedScopes).toEqual(['artifacts:write', 'studio:read']);
    expect(plan.requiresOperatorApproval).toBe(true);
    expect(plan.executionAuthorized).toBe(false);
  });
});
