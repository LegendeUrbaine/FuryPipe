# FuryPipe Video Provider and License Matrix

Status date: 2026-10-01. This is an integration gate, not legal advice.

FuryPipe uses the host FFmpeg/FFprobe installation for the local render path. It does not bundle a native binary in the TypeScript package. A distribution that bundles a specific FFmpeg build must re-run the build/codec license review.

| Component | Version observed | Role | Source/license evidence | Commercial / redistribution | FuryPipe state |
| --- | --- | --- | --- | --- | --- |
| FFmpeg + FFprobe | system | render, transcode, decode | [ffmpeg.org](https://ffmpeg.org) — license is build/codec dependent | host use: review; bundled redistribution: not cleared | PASS for host runtime; distribution review required |
| FuryPipe native caption planner | 1 | deterministic captions | local code, MIT project | yes / yes | DEFAULT |
| faster-whisper | 1.1.0 observed in MPT 1.3.7 | optional local ASR | [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — MIT code; model terms vary | model-specific | OPTIONAL, not installed |
| WhisperX | current upstream | optional word timestamps | [m-bain/whisperX](https://github.com/m-bain/whisperX) — BSD-2-Clause code; alignment/model terms vary | model-specific | OPTIONAL, not installed |
| PySceneDetect | v0.7.1 observed upstream | optional scene detection | [Breakthrough/PySceneDetect](https://github.com/Breakthrough/PySceneDetect) — BSD-3-Clause; dependencies vary | review dependency set | OPTIONAL, not installed |
| Chatterbox Multilingual V3 | current upstream | French TTS candidate | [ResembleAI/chatterbox](https://github.com/resemble-ai/chatterbox) documents French/multilingual use, but the current repository does not provide sufficiently clear redistribution terms for FuryPipe defaults | unknown / unknown | LICENSE_BLOCKED |
| ACE-Step | current upstream | optional local music | [ace-step/ACE-Step](https://github.com/ace-step/ACE-Step) — Apache-2.0 code; checkpoint and dependency terms still require per-install review | unknown / unknown | OPTIONAL, not installed |
| MoneyPrinterTurbo | `1.3.7`, commit `2e1b30396e059e55939cc802c60faac2061e4d41` | optional isolated adapter | [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) — MIT repository; its runtime pulls a broad provider/model dependency surface | unknown / unknown until dependency/model review | OPTIONAL, not a runtime dependency |
| RIFE / Real-ESRGAN | not installed | interpolation/upscale | candidate only; no license/build review recorded here | unknown / unknown | NOT_DEFAULT |

## Decision

The default production-proven local path is:

`source assets → FFprobe manifest → explicit technical analysis → deterministic storyboard → SRT captions → FFmpeg portrait render → decode/QC → recipe/provenance/receipt artifacts`

External model providers are never silently enabled. A provider with unknown model or checkpoint terms cannot be routed as the default commercial distribution component. `moneyprinterturbo` remains an adapter boundary; FuryPipe does not import its WebUI, queue, or full Python dependency graph.
