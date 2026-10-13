# MCP — utilisation réelle (Claude Code)

| MCP | Connecté | Utilisé | Usage prouvé |
|-----|----------|---------|--------------|
| GitHub | YES | YES | lecture PR / checks / revues, création PR #264–#268, réponses + résolution des fils de revue, merge #263 |
| claude-code-remote | YES | YES | abonnement aux événements des PR #264–#268 |
| Vercel | YES | NO | hors périmètre (aucun déploiement autorisé) |
| Mintlify | YES | NO | hors périmètre (aucune publication de documentation) |
| 21st.dev | NO | NO | non connecté → NOT_CONFIGURED ; aucune génération payante |
| Playwright / Browser | (bibliothèque locale) | YES | Chromium headless : captures 1440/768/390, mesure de contraste, mesure de couverture FR |
| Context7 / Graphify MCP | NO | NO | absents |

Note : le QA navigateur du dépôt (`browser:webchat:qa`) attend `chromium-1243`, alors que le conteneur fournit
`1194` → NOT_EXECUTED en local. Il est couvert par les jobs CI `chromium` / `browser-engines` (verts).
