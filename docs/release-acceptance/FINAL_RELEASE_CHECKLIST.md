# FuryPipe 0.16.0 — final release checklist

## Identité candidate

| Champ | Valeur |
|---|---|
| Version | 0.16.0 |
| Base prévue | codex/furypipe-final-completion |
| Head final | supplied by the exact RC artifact; current candidate was checked in PR #238 |
| Branch | codex/furypipe-production-finalization-2026 |
| Draft PR | #238 OPEN/DRAFT |
| Worktree | canonical GitHub branch; no unverified local checkout is used |

## Gates techniques

Chaque statut doit être lié à une commande, une evidence et au head final.
PASS local ne doit pas être promu en preuve hosted, provider, client ou
production.

| Gate | Statut attendu | Evidence |
|---|---|---|
| Package furypipe-0.16.0.tgz | PASS | RC artifact is source-bound; digest is read from the exact run |
| Automatable blockers | PASS | CI/security matrix green; external gates remain separate |
| Upgrade 0.15.0 → 0.16.0 | PASS | clean-room package lifecycle |
| Rollback 0.16.0 → 0.15.0 | PASS | clean-room package/config/reinstall |
| Recovery/restart | PASS | evidence recovery liée au SHA |
| Clean-room matrix | PASS | Ubuntu 24.04/macOS 14/Windows 2025 × Node 22/24/26 |
| Self-host | PASS | package installé uniquement, HOME/config/data/port isolés |
| Gateway | PASS | start/health/stop/restart et frontière externe |
| MCP local/contract | PASS | contrats locaux et limitation hosted explicite |
| Provider contract | PASS | transports locaux/fake fetch, sans claim live |
| OAuth contract | PASS | contrat local, OIDC réel séparé |
| FuryBench | PASS | baseline exacte et seuil documenté |
| Accessibility automated | PASS | automation liée au SHA |
| Browser QA | PASS | exact-candidate autonomous browser matrices |
| Security | PASS within verified scope | audit, secrets, actions, SBOM |
| SBOM | PASS | SPDX 2.3 et vérification |
| Provenance preparation | PASS | RC evidence, tarball et workflow |

## External and manual gates

Évaluer E1–E8 avec
[EXTERNAL_VALIDATION_INVENTORY.md](EXTERNAL_VALIDATION_INVENTORY.md).

- E1 provider live : OPTIONAL_NOT_LIVE_VERIFIED sauf claim/provider déclaré.
- E2 OIDC réel : OPTIONAL_NOT_LIVE_VERIFIED sauf scope OAuth déclaré.
- E3 MCP tiers : OPTIONAL_NOT_LIVE_VERIFIED sauf endpoint tiers déclaré.
- E4 OpenClaw externe : OPTIONAL_NOT_LIVE_VERIFIED sauf gateway déclarée.
- E5 screen reader : MANUAL_REQUIRED pour la claim d’accessibilité.
- E6 visual review : MANUAL_REQUIRED pour la claim visuelle.
- E7 provenance signée : REQUIRED pour la publication, préparation PR
  seulement avant l’événement autorisé.
- E8 autorité : AUTHORIZATION_REQUIRED dans tous les cas.

## Autorité et actions interdites dans ce track

    MERGE       = NOT_EXECUTED
    RELEASE     = NOT_EXECUTED
    TAG         = NOT_EXECUTED
    NPM PUBLISH = NOT_EXECUTED
    DEPLOY      = NOT_EXECUTED

Technical closure is declared only if:

    FURYPIPE_0_16_0_CODE_COMPLETE=YES
    FURYPIPE_0_16_0_AUTOMATED_RELEASE_GATES=PASS
    P0=0
    P1=0
    P2_CODE=0
    AUTOMATABLE_BLOCKERS=0
    VERSION_COLLISION=0

Ces variables sont des critères de rapport, pas une autorisation de contourner
un gate. Toute preuve manquante reste BLOCKED, MANUAL_REQUIRED,
OPTIONAL_NOT_LIVE_VERIFIED ou AUTHORIZATION_REQUIRED selon sa classe.
