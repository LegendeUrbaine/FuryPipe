# SKILLS — inventaire réel

Inventaire de `~/.claude/skills`, `~/.claude/plugins` et `.claude/` (projet) dans ce conteneur.

| Skill | Disponible | Utilisé | Note |
|-------|-----------|---------|------|
| ECC (everything-claude-code) | NO | NO | non installé ici |
| Karpathy skills | NO | NO | non installé ici ; pratiques appliquées manuellement (diff minimal, lecture avant modif, test ciblé) |
| Superpowers | NO | NO | non installé ici ; méthode appliquée : bug reproduit → test rouge → fix → test vert |
| Graphify | NO | NO | non installé ici ; Studio expose un indexeur natif (fallback) |
| session-start-hook, code-review, security-review, simplify | YES (Claude Code) | NO | non nécessaires pour ces diffs courts ; revues bots (Codex, CodeRabbit, Greptile) traitées sur chaque PR |

Les installations n'ont pas été tentées : elles modifieraient la configuration globale, ce qui exige
l'accord du propriétaire. La procédure peut être proposée sur demande.
