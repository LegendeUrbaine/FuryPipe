# FuryLocal model fabric and Harness Hub

Code: `src/fury-local-fabric.ts`, `src/fury-harness-hub.ts` · tests: `tests/fury-local-fabric.test.ts`, `tests/fury-harness-hub.test.ts`

## Local inference discovery

Default endpoints (loopback): Ollama `:11434` (native `/api/tags`, optional `/api/ps` loaded-model state, `/api/version`; OpenAI-compatible; Anthropic-compatible from 0.14), LM Studio `:1234` (native `/api/v0/models` with modality, context, quantization, loaded state), llama.cpp `:8080`, vLLM `:8000`, SGLang `:30000`, Jan `:1337` (OpenAI-compatible `/v1/models`). Configured `openai-compatible` and `anthropic-compatible` endpoints are also supported.

Boundary: loopback only by default. LAN only when explicitly allowed, and only private IP literals (RFC 1918, CGNAT, ULA/link-local IPv6); DNS names, public IPs and metadata addresses are refused. GET only, redirects never followed, 1 MiB body cap, timeouts.

Hardware (`discoverFuryHardware`): CPU, RAM, unified memory (Apple silicon) and NVIDIA GPUs via `nvidia-smi` (no shell, 3 s timeout). It stays in-process.

Fit (`classifyFuryModelFit`) is a conservative estimate, not a runtime guarantee. It requires a positive safe-integer model size and valid current free-RAM telemetry. Unloaded models estimate weights plus 50% for context/runtime overhead; confirmed-loaded models estimate incremental overhead only, because their weights already reduce reported free memory. CPU/RAM fit reserves 2 GiB of host RAM first, then keeps 20% of the remaining usable capacity as headroom. NVIDIA discovery records both total and currently free VRAM; blank free-memory fields remain unknown, not zero. FITS requires a known memory pool with the estimate inside that margin; MAY_BE_SLOW means CPU/RAM offload may be possible but is not eligible for automatic Composer selection; DOES_NOT_FIT means observed capacity is insufficient; UNKNOWN means size or required telemetry is unavailable/invalid. GPU pools are not summed, so multi-GPU capacity is intentionally not assumed.

The Capability Composer selects only reachable `openai-chat` models classified FITS. Each new plan performs fresh local-backend and hardware discovery (not the Studio dashboard cache), then records the resource fit and observation timestamp; execution rejects plans without this evidence, plans older than five minutes, and revalidates the exact backend/model and current resources immediately before inference. Composer executions are serialized within one Studio API instance to prevent simultaneous confirmations from both relying on the same resource snapshot. This reduces, but cannot eliminate, resource races from other processes after revalidation.

`FURYPIPE_MODELS` remains scoped to the Visual Engine image-compression policy documented by the Studio dashboard; it is not repurposed as a Composer allowlist. The Composer keeps its local-only discovery boundary and still requires explicit `confirm: true`. Older persisted plans without resource evidence require a new plan and are never upgraded automatically.

Measurement (`measureFuryLocalModel`): streams one short completion from a local endpoint and reports TTFT and streamed chunks/s. Chunks are not claimed to be exact tokens.

## Harness Hub

The registry covers FuryPipe Native, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, OpenHands, Goose and Kilo. Each entry records its integration path (ACP/official protocol > official SDK/API > A2A > structured CLI > PTY, per master §15), its protocols, its skills directories, and how it reaches a local model (e.g. Claude Code via an Anthropic-compatible base URL, Codex via `--oss`). Each entry also carries an evidence level and source.

Discovery resolves executables on absolute PATH entries only and runs `--version` with a timeout, no shell and a minimal environment; provider keys are not forwarded. Windows `.cmd` shims go through the hardened FuryLink `cmd.exe` boundary. Authentication is never probed.
