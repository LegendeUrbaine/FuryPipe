# Video Studio Operations

## Local-first workflow

1. The user creates a project with explicit source paths and an execution approval.
2. FuryPipe validates bounded relative paths, copies source bytes into a private project workspace, and records hashes plus technical media metadata.
3. FFprobe analysis records what was actually measured. If semantic inspection is not installed, the analysis says so and uses `null` for visual scores.
4. The workflow creates a storyboard, a reproducible video/caption timeline, three distinct hook variants, a provider view, a reusable recipe, and public-content policy evidence.
5. FFmpeg normalizes and concatenates multiple immutable sources when supplied, then renders a portrait MP4 with a real audio stream. Captions are written as SRT and can be burned into the render.
6. QC probes and fully decodes the output. A successful workflow persists a receipt, QC report, storyboard, timeline, hook variants, recipe, and provenance.

Project sources remain immutable. Project state is resumable: an existing project can be reopened and a render can be retried without recreating the source manifest.

## Approval boundary

Project creation and rendering require `confirm: true` in the Studio API, CLI, and headless request. Doctor, ingest, analysis, storyboard inspection, QC, and artifact listing remain read/inspection operations.

## Honest capability boundary

The built-in engine is a real deterministic editor and renderer. It does not claim to understand scene semantics when no semantic model is installed. ASR, TTS, music generation, scene detection, interpolation, and upscale are provider slots with explicit health and license states; they are optional and unavailable until installed and cleared.

## Recovery

Long-running child processes use `shell: false`, bounded stdout/stderr, timeouts, and `AbortSignal` cancellation. A cancelled or failed render leaves the project and prior artifacts in place. The next attempt can run the render stage again.

## Public FuryCraft policy

The FuryCraft profile checks titles, scripts, captions, overlays, CTA, and descriptions. Internal plugin/backend names and unverified claims fail the workflow before final render. Player-facing replacements are stored in the profile, not scattered through the renderer.
