# FuryPipe 0.16.1

FuryPipe 0.16.1 is intended as the first successfully published public release
of the 0.16 line. The earlier `v0.16.0` tag remains preserved, but was never
published to npm: its tag-triggered release workflow lacked FFmpeg, required by
the package's `prepublishOnly` video tests.

## Highlights

- FORGE 03 brand identity across the active product.
- Local-first Studio with Ollama support and governed capability composition.
- Mission Control and Fury Trace for run, worker, receipt and proof inspection.
- Skills, MCP, agent, memory and recovery infrastructure.
- Graphify and FuryEval workflows.
- Browser and coding runtimes, CLI/headless operation, and media-host boundaries.

## Release verification

The tag-triggered workflow installs and verifies FFmpeg before running the
unchanged `prepublishOnly` checks. Publication uses npm Trusted Publishing via
GitHub OIDC and provenance; no npm token is used.

## Limitations

- Screen-reader validation remains `MANUAL_REQUIRED`.
- External media providers require configuration.
- Optional integrations can remain `NOT_CONFIGURED`.
- Mission Control FuryJudge can correctly return `UNPROVEN`.
