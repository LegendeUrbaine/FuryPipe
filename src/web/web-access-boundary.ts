export const FURYPIPE_WEB_ACCESS_PLAN_FORMAT = 'furypipe-web-access-plan/v1' as const;

export type FuryPipeWebConnectionMode = 'local-bridge' | 'remote-gateway';
export type FuryPipeWebActionClass = 'read' | 'stream' | 'write' | 'execute';

export type FuryPipeWebScope =
  | 'studio:read'
  | 'chat:send'
  | 'artifacts:read'
  | 'artifacts:write'
  | 'memory:read'
  | 'code:plan'
  | 'browser:plan'
  | 'media:plan'
  | 'workflow:read'
  | 'diagnostics:read';

export type FuryPipeWebAccessRejectionCode =
  | 'INVALID_ORIGIN'
  | 'LOCAL_BRIDGE_REQUIRES_LOOPBACK'
  | 'REMOTE_GATEWAY_REQUIRES_HTTPS'
  | 'SERVER_SESSION_REQUIRED'
  | 'UNSUPPORTED_SCOPE';

export interface PlanFuryPipeWebAccessInput {
  mode: FuryPipeWebConnectionMode;
  origin: string;
  actionClass: FuryPipeWebActionClass;
  requestedScopes: readonly FuryPipeWebScope[];
  serverSessionEstablished: boolean;
}

export interface FuryPipeWebAccessPlan {
  format: typeof FURYPIPE_WEB_ACCESS_PLAN_FORMAT;
  mode: FuryPipeWebConnectionMode;
  origin: string;
  actionClass: FuryPipeWebActionClass;
  requestedScopes: readonly FuryPipeWebScope[];
  allowed: boolean;
  rejectionCode?: FuryPipeWebAccessRejectionCode;
  transportSecurity: 'LOOPBACK_HTTP_OR_HTTPS' | 'HTTPS_REQUIRED';
  requiresServerSession: true;
  requiresOperatorApproval: boolean;
  browserReceivesProviderSecrets: false;
  browserReceivesRuntimeAuthority: false;
  executionAuthorized: false;
}

const SUPPORTED_SCOPES: ReadonlySet<string> = new Set<FuryPipeWebScope>([
  'studio:read',
  'chat:send',
  'artifacts:read',
  'artifacts:write',
  'memory:read',
  'code:plan',
  'browser:plan',
  'media:plan',
  'workflow:read',
  'diagnostics:read',
]);

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function normalizeScopes(scopes: readonly FuryPipeWebScope[]): readonly FuryPipeWebScope[] {
  return Object.freeze([...new Set(scopes)].sort()) as readonly FuryPipeWebScope[];
}

function createPlan(
  input: PlanFuryPipeWebAccessInput,
  normalizedOrigin: string,
  requestedScopes: readonly FuryPipeWebScope[],
  allowed: boolean,
  rejectionCode?: FuryPipeWebAccessRejectionCode,
): FuryPipeWebAccessPlan {
  const base = {
    format: FURYPIPE_WEB_ACCESS_PLAN_FORMAT,
    mode: input.mode,
    origin: normalizedOrigin,
    actionClass: input.actionClass,
    requestedScopes,
    allowed,
    transportSecurity:
      input.mode === 'remote-gateway' ? ('HTTPS_REQUIRED' as const) : ('LOOPBACK_HTTP_OR_HTTPS' as const),
    requiresServerSession: true as const,
    requiresOperatorApproval: input.actionClass === 'write' || input.actionClass === 'execute',
    browserReceivesProviderSecrets: false as const,
    browserReceivesRuntimeAuthority: false as const,
    executionAuthorized: false as const,
  };

  return Object.freeze(rejectionCode === undefined ? base : { ...base, rejectionCode });
}

export function planFuryPipeWebAccess(input: PlanFuryPipeWebAccessInput): FuryPipeWebAccessPlan {
  const requestedScopes = normalizeScopes(input.requestedScopes);

  let parsed: URL;
  try {
    parsed = new URL(input.origin);
  } catch {
    return createPlan(input, input.origin, requestedScopes, false, 'INVALID_ORIGIN');
  }

  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username !== '' || parsed.password !== '') {
    return createPlan(input, parsed.origin, requestedScopes, false, 'INVALID_ORIGIN');
  }

  if (input.mode === 'local-bridge' && !LOOPBACK_HOSTS.has(parsed.hostname)) {
    return createPlan(input, parsed.origin, requestedScopes, false, 'LOCAL_BRIDGE_REQUIRES_LOOPBACK');
  }

  if (input.mode === 'remote-gateway' && parsed.protocol !== 'https:') {
    return createPlan(input, parsed.origin, requestedScopes, false, 'REMOTE_GATEWAY_REQUIRES_HTTPS');
  }

  if (!input.serverSessionEstablished) {
    return createPlan(input, parsed.origin, requestedScopes, false, 'SERVER_SESSION_REQUIRED');
  }

  if (requestedScopes.some((scope) => !SUPPORTED_SCOPES.has(scope))) {
    return createPlan(input, parsed.origin, requestedScopes, false, 'UNSUPPORTED_SCOPE');
  }

  return createPlan(input, parsed.origin, requestedScopes, true);
}
