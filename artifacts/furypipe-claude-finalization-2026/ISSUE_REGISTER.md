# ISSUE REGISTER

```text
ID        : FIN-001
COMPONENT : Gateway / tool bridge adapter
EXPECTED  : ré-exécuter une proposition déjà exécutée → refus "missing-or-expired"
ACTUAL    : refus "tool-transport-mismatch" (diagnostic faux ; refus quand même)
ROOT CAUSE: proposalTransport() = undefined pour une proposition consommée → requireCommandTransport
SEVERITY  : P3
FIX       : PR #264
STATUS    : FIXED (en attente de fusion)

ID        : FIN-002
COMPONENT : Fury Trace
EXPECTED  : bundle de preuve marqué VERIFIED seulement si son digest est recalculé
ACTUAL    : seul le format hex du digest était vérifié ; bundle réécrit → trace READY/VERIFIED.
            De plus, format et verdict affiché n'étaient pas liés au bundle scellé.
ROOT CAUSE: absence de reseal / comparaison
SEVERITY  : P2 (truth-state)
FIX       : PR #266
STATUS    : FIXED (en attente de fusion)

ID        : FIN-003
COMPONENT : Studio — carte "Choose a local model"
EXPECTED  : 3 choix lisibles et cohérents
ACTUAL    : bouton "Install Ollama" : sous-titre #9CA3AF + icône orange sur dégradé orange (~1.05:1)
ROOT CAUSE: règle globale `main button:not(...)` (spécificité 0,10,2) > `.setup .setup-choice` (0,2,0)
SEVERITY  : P2 (accessibilité)
FIX       : PR #267
STATUS    : FIXED (en attente de fusion)

ID        : FIN-004
COMPONENT : Studio i18n
EXPECTED  : navigateur FR → interface en français
ACTUAL    : 93 chaînes visibles restées en anglais sur 13 vues (dont la page d'accueil)
ROOT CAUSE: dictionnaire FR à correspondance exacte ; entrées manquantes ; clé du sous-titre de l'accueil
            désynchronisée ("local" → "governed")
SEVERITY  : P2
FIX       : PR #268. 93 → 9 mesuré à 1dcbf28 sur une partie des vues seulement. Recompte complet à c83573a (navigation + vue entière, 13 vues) : ~45 libellés encore en anglais (vue Workspace surtout), traduits par c56a014. Reste identique : noms de produits, termes techniques gardés, mots identiques en français, matériel, et le texte d'attente du lecteur de fichier (zone <pre> exclue). Re-mesuré à 1643ce9.
STATUS    : FIXED (en attente de fusion) ; compteurs dynamiques corrigés aussi (FIN-006)

ID        : FIN-005
COMPONENT : Memory — preuves
EXPECTED  : persistance prouvée après un vrai redémarrage
ACTUAL    : réouverture uniquement dans le même processus
ROOT CAUSE: trou de test, pas de bug produit
SEVERITY  : P2 (preuve manquante)
FIX       : PR #265
STATUS    : PROVEN (8/8)

ID        : FIN-006
COMPONENT : Studio i18n
EXPECTED  : compteurs traduits ("0 skill(s) discovered…", "2 runtime(s) available…", "4 CPU threads")
ACTUAL    : anglais
ROOT CAUSE: texte construit à l'exécution ; le dictionnaire exact ne le couvre pas
SEVERITY  : P3
FIX       : PR #268 (badf05a) : texte choisi selon la langue active
STATUS    : FIXED (en attente de fusion)

ID        : FIN-007
COMPONENT : Studio i18n
EXPECTED  : élément de navigation "Espace de travail"
ACTUAL    : "ESPACE DE TRAVAIL" en majuscules (clé FR 'Workspace' partagée avec un en-tête de section)
SEVERITY  : P3
FIX       : PR #268 (badf05a) : clé en casse normale ; l'en-tête reste en majuscules via CSS (vérifié Chromium fr-FR)
STATUS    : FIXED (en attente de fusion)

ID        : FIN-008
COMPONENT : QA script QA-001 (scripts/)
EXPECTED  : typecheck strict isolé propre
ACTUAL    : 9 erreurs préexistantes (typage du bloc succès ; `scripts/` hors tsconfig)
SEVERITY  : P3
FIX       : PR #271 (d0d3607) : champs imbriqués vérifiés une fois, échec si malformé ; tsc strict isolé 9 → 0
STATUS    : FIXED (en attente de fusion)
```
