import { classifyFuryModelFit, type FuryHardwareProfile, type FuryLocalBackendStatus, type FuryLocalModel, type FuryModelFit } from './fury-local-fabric.js';

export type FuryLocalModelReadinessState = 'READY' | 'RESOURCE_CONSTRAINED' | 'RESOURCE_UNKNOWN' | 'UNAVAILABLE';

export interface FuryLocalModelReadiness {
  readonly backend: FuryLocalBackendStatus;
  readonly model: FuryLocalModel;
  readonly resourceFit: FuryModelFit;
  readonly executionPolicy: 'local-discovery-confirm-required';
  readonly state: FuryLocalModelReadinessState;
  readonly observedAt: string;
  readonly reason: string;
}

/**
 * One deterministic, local-only eligibility decision shared by planning and
 * execution. FURYPIPE_MODELS intentionally is not consumed here: its existing
 * documented scope is Visual Engine image compression, not local Composer
 * authorization. Composer retains local discovery plus explicit confirmation.
 */
export function assessFuryLocalModelReadiness(
  backends: readonly FuryLocalBackendStatus[],
  hardware: FuryHardwareProfile,
  options: { readonly now?: number } = {},
): readonly FuryLocalModelReadiness[] {
  const candidates = backends.flatMap((backend) => backend.models
    .filter((model) => model.modality !== 'embeddings')
    .map((model) => ({ backend, model })));
  const observedAt = new Date(options.now ?? Date.now()).toISOString();

  return Object.freeze(candidates.map(({ backend, model }) => {
    const resourceFit = classifyFuryModelFit(model, hardware);
    let state: FuryLocalModelReadinessState;
    let reason: string;
    if (!backend.reachable || !backend.protocols.includes('openai-chat')) {
      state = 'UNAVAILABLE';
      reason = 'The local backend is not reachable through the Composer chat protocol.';
    } else if (resourceFit === 'FITS') {
      state = 'READY';
      reason = 'The model fits the conservative estimate using currently free memory with reserved headroom.';
    } else if (resourceFit === 'UNKNOWN') {
      state = 'RESOURCE_UNKNOWN';
      reason = 'Local resource telemetry or model size is insufficient to establish a safe fit.';
    } else {
      state = 'RESOURCE_CONSTRAINED';
      reason = resourceFit === 'MAY_BE_SLOW'
        ? 'GPU memory is insufficient; CPU/RAM offload may work but is not auto-selected.'
        : 'Currently free local memory is insufficient for safe automatic Composer selection.';
    }
    return Object.freeze({ backend, model, resourceFit, executionPolicy: 'local-discovery-confirm-required' as const, state, observedAt, reason });
  }));
}
