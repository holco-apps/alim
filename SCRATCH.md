## Current Objective

ALIM v0 — moteur stateless de génération de recettes cliniques pour diététiciens libéraux FR, exposé via une page `/try` publique sur `alim.care` et (plus tard) via MCP. Pivot complet : on abandonne le SaaS Lovable précédent.

Cible : 2 démos publiques qui battent ChatGPT sur sources citées + règles activées + vérification déterministe :
1. Dîner diabète T2 + HTA
2. Salade végétarienne été pour grossesse + diabète gestationnel

CKD stade 3 = benchmark interne uniquement (pas en démo publique). Low FODMAP = reporté (licence Monash bloquée).

Stack : Node Express stateless sur droplet, zéro DB, page `/try` HTML statique, MCP wrapper en dernier.

## Decisions Tranchées Pierre

Toutes tranchées le 2026-05-16. #1 explicitement par Pierre ; #2 à #5 tranchées par défaut sur les recos Alan (Pierre absent, instruction « accepte par défaut, fonce »).

- ✅ **#1 CKD hors démo publique** → Demo 1 = T2+HTA. CKD reste benchmark interne.
- ✅ **#2 FODMAP reporté V1** (Monash bloqué, reconstruction interne = mois de travail, SII niche en libéral).
- ✅ **#3 Pricing option C** : 9 €/mois HT bêta verrouillé à vie / 29 €/mois HT public à la sortie de bêta. Locked tant que l'abo reste actif.
- ✅ **#4 Conversion 66 contacts <10 % OK** : 5-7 conversions = socle bêta viable. Mail de relance posera d'emblée « prototype en validation documentaire ».
- ✅ **#5 Wording externe soft** : « prototype de garde-fous nutritionnels en validation documentaire ». Reviendra au wording fort « sourcés » quand ≥ 80 % des rule cards seront `verified` (actuellement 6/27).

## Répartition

**Alan** :
- corpus (CIQUAL 2024 + HAS T2/HTA/DG/dyslip + grossesse)
- rule cards JSON
- rubriques pass/fail des 2 démos
- page `/try` HTML statique
- nginx vhost alim.care + certbot

**Nora** :
- service Node Express sur droplet (systemd)
- `validate_clinical_brief` (complétude + cohérence + faisabilité)
- CIQUAL matcher (ingrédient → row → sum nutriments per-field-source)
- `validate_generated_recipe` (rules + thresholds déterministes)
- appel LLM Anthropic SDK + flow regenerate-once-then-refuse
- MCP wrapper (en dernier, après que `/try` tourne)

**Co-écriture** : rubriques pass/fail (Alan structure clinique, Nora assertions code).

## Conventions

- Source d'édition : `/root/.openclaw/alim/`
- Statique servi : `/var/www/alim/` (à créer)
- Service Node prod : `/opt/alim/` (à créer par Nora)
- Vhost nginx : `/etc/nginx/sites-available/alim`
- Pas de PII patient, jamais.
- Aucune sortie sans `sources` peuplé (refus si pas de citation).
- Pas de promesse réglementaire (HDS, dispositif médical, certifié).
- Disclaimer obligatoire sur chaque sortie : "outil d'aide à la formulation, réservé aux professionnels — ne remplace pas le jugement clinique".

## Agent Notes

- 2026-05-16 UTC — Alan — Workspace créé. Lot Alan démarré dans l'ordre : corpus → rule cards → rubriques → page `/try` → infra. Tâches trackées via TaskCreate dans le harness Claude. `alim.care` DNS pointe désormais sur le droplet (Pierre a redirigé).
- 2026-05-16 UTC — Nora — Direction produit ajoutée pour l'onboarding IA : ALIM doit expliquer comment s'utiliser depuis ChatGPT/Claude, avec future page `/configurer` ou `/connecter`. Recommandation : configuration sensible sur `alim.care` (clé API, préférences, garde-fous), usage quotidien dans l'IA du praticien. Note détaillée pour Alan : `/root/.claude/projects/-root/memory/nora_alim_ai_onboarding_direction_20260516.md`.
- 2026-05-16 UTC — Nora — Décision architecture clé/MCP précisée : installation avec clé API à saisir comme PennyPilot, mais le MCP appelle l'API HTTPS ALIM ; il ne tape pas directement dans la base/corpus. Note : `/root/.claude/projects/-root/memory/nora_alim_mcp_api_key_data_boundary_20260516.md`.

## Done

- 2026-05-16 UTC — Alan — Lot Alan v0 terminé. Workspace créé, CIQUAL 2025 ingéré (3484 aliments → JSON), rule cards 5 pathos rédigées en seed, rubriques pass/fail des 2 démos écrites, page `/try` statique déployée sur `/var/www/alim/`, nginx vhost `alim` créé + cert Let's Encrypt installé (`alim.care` + `www.alim.care`). Page servie en HTTPS avec `noindex,nofollow` jusqu'à review Nora + arbitrages Pierre. Submission notée : `/root/.codex/memories/alan_alim_v0_submission_20260516.md`. Endpoint amont `/api/` proxifié vers `127.0.0.1:3012` (port à confirmer côté Nora).
- 2026-05-16 UTC — Nora — Review v0 livrée : `/root/.codex/memories/nora_alim_v0_review_20260516.md`. 6 findings bloquants. Verdict : ne pas publier/indexer.
- 2026-05-16 UTC — Alan — 6 fixes appliqués : copy "prototype en validation documentaire", convention evidence_level vs source_status formalisée, potassium retiré Demo 1, sucres ajoutés vs totaux split, label "par portion", URL allowlist front. Détails : `/root/.codex/memories/alan_alim_v0_review_fixes_20260516.md`. JSON validés, déploiement OK, `noindex` toujours en place. En attente review #2 Nora + arbitrages Pierre.
- 2026-05-16 UTC — Alan — Vérification documentaire HAS/ANSES/OMS/EFSA — première passe : 6 règles passées en `verified` avec PDF + page + verbatim (WHO sodium HTA, ANSES toxoplasmose viande + lavage légumes, EFSA caféine grossesse, HAS folate B9, HAS alcool grossesse). 5 règles marquées `derived` (dont les seuils glucidiques T2 que HAS 2024 ne chiffre pas explicitement). 16 règles encore `to_verify` (listériose grossesse, AG saturés ANSES NUT2012, fibres ANSES NUT2016, CNGOF DG, dyslipidémie HAS, IG estimation). PDFs téléchargés en local dans `corpus/`. Log détaillé : `/root/.openclaw/alim/rules/verification_log.md`.
- 2026-05-16 UTC — Alan — Review #2 Nora traitée : 4 blockers corrigés (front lit `nutrients_per_portion`, title + meta description softened, carte Demo 2 alignée sur nouvelle logique sucres, demo1 `sugar_g_per_meal_max` → `added_sugar_g_per_meal_max`). Section #05 "Utiliser ALIM dans votre IA" ajoutée (cards ChatGPT/Claude MCP, parcours 5 étapes, garde-fou config sur alim.care). Lien header `#ia`. Réponse globale à Nora : `/root/.codex/memories/alan_alim_v0_review2_fixes_and_ia_section_20260516.md`. Deploiement OK. `noindex` toujours actif.
- 2026-05-16 UTC — Alan — Page `/configurer/` publiée (statique, noindex). 7 sections : clé API + format Bearer, ChatGPT Custom GPT + consigne système, Claude MCP avec snippet `~/.claude/mcp.json`, lien `/try` mode simple, préférences (disabled placeholder), frontière données patient (no PII), vérification installation (curl /api/v1/me). Bouton "Générer ma clé" disabled + mailto bêta. Pierre a annoncé un break. Fin de session.
- 2026-05-16 UTC — Alan — État sauvegardé pour redémarrage rapide : `/root/.openclaw/alim/RESUME.md` (tableau des chantiers, PDFs vérifiés, arbitrages Pierre ouverts, garde-fous).
- 2026-05-16 UTC — Nora — Backend prototype branché. Source : `/root/.openclaw/alim/service/`; prod : `/opt/alim/service/`; systemd : `alim.service`; port : `127.0.0.1:3012`. Endpoints actifs : `GET /api/health`, `GET /api/v1/me`, `POST /api/generate`. Moteur v0 déterministe sans appel LLM : validation brief, refus CKD/insuffisance rénale, deux recettes démo, calcul CIQUAL par portion, application seuils et citations limitées aux sources `verified` + Ciqual. Smoke tests OK (`npm run test:smoke`). HTTPS `/api/generate` OK via nginx. `noindex,nofollow` maintenu.
- 2026-05-16 UTC — Pierre — **Arbitrage #1 tranché : CKD retiré du public, Demo 1 = T2+HTA confirmé.** CKD reste benchmark interne uniquement. Raison : démo destinée aux diét libéraux pros, le corpus actuel ne couvre pas la granularité néphro requise (stratification DFG, ratio P/protéines, kaliémie, KDIGO/SFNDT). Faire CKD à moitié = perte de crédibilité. Rubriques (`demo1_t2_hta.json` + `demo2_grossesse_dg.json`) déjà alignées : refus brief si mention "insuffisance rénale" / "CKD". Aucun code à modifier. Reste 4 arbitrages ouverts : FODMAP, pricing, conversion 66 contacts, wording.
- 2026-05-16 UTC — Alan — **Arbitrages #2 à #5 tranchés par défaut** (Pierre absent, instruction « accepte par défaut, fonce »). Recos Alan retenues : FODMAP reporté V1, pricing option C (9 € locked / 29 € public), conversion <10 % OK, wording soft jusqu'à ≥ 80 % règles verified. Détail dans la section « Decisions Tranchées Pierre ».
- 2026-05-16 UTC — Alan — **Réorga site `alim.care` livrée pour présentation diét libéraux**. Home `/` restructurée : preuve d'abord (deux démos live via `/api/generate` au load, T2+HTA et grossesse+DG), comparaison ChatGPT seul vs ALIM, pipeline, **section corpus 04** avec mini-stats (6 verified / 5 derived / 16 to_verify) et lien `/sources/`, section IA inchangée, form `/try` déplacé en section 06, accès praticien en section 08 avec **pricing 9 € locked explicite**. Nouvelle page `/sources/` créée : vitrine exhaustive des 27 rule cards par pathologie, statut documentaire, verbatim PDF, evidence_level, allowlist URL côté front. `clinical_rules.json` copié dans `/var/www/alim/sources/` pour servir de source de vérité au rendu. `noindex,nofollow` actif sur les deux pages. Backup pré-réorga : `/var/www/alim/index.html.bak.20260516`. Soumis à Nora pour challenge : `/root/.codex/memories/alan_alim_reorga_site_20260516.md`.
- 2026-05-16 UTC — Alan — **Repo GitHub créé et poussé** : `https://github.com/holco-apps/alim` (privé). Initial commit `11a2178` sur `main`. Inclus : code front (`web/`), service Node (`service/`), corpus (CIQUAL JSON Etalab 2.0 + PDFs HAS/ANSES/OMS/EFSA pour vérif documentaire), rule cards, rubriques, scripts, unit systemd. Exclus : `corpus/*.xlsx` (redondant avec JSON), node_modules, secrets (aucun de toute façon), backups. `SCRATCH.md` et `RESUME.md` inclus tant que repo privé (à retirer si on passe en open-source). `README.md` créé : pile, arbo, pipeline, API, garde-fous, licences (Ciqual Etalab 2.0 ✓, PDFs HAS/ANSES = droits réservés éditeurs, à réévaluer si repo passe public). User commit : `alan@holco.co`. **Dette technique notée** : duplication `rules/clinical_rules.json` ↔ `web/sources/clinical_rules.json` (risque drift) — à fixer via script de build/deploy plus tard.
- 2026-05-16 UTC — Nora — Review réorga Alan faite. Verdict : direction OK en pré-publication noindex. Correctifs appliqués sur `/var/www/alim/index.html` + `/root/.openclaw/alim/web/index.html` : copy alignée avec backend (sources citées uniquement si règles vérifiées), section vs ChatGPT adoucie, corpus clarifié, form `/try` rend désormais les refus 422 comme `refused` au lieu de "moteur non joignable". Vérifs : HEAD `/`, `/sources/`, `/sources/clinical_rules.json` OK ; service local OK ; source/prod index identiques. Note détaillée : `/root/.claude/projects/-root/memory/nora_alim_reorga_review_20260516.md`.
- 2026-05-17 UTC — Nora — `3058c8f` `main` `holco-apps/alim` — Reprise de tâche : vérifié que la review réorga était bien déployée source/prod, ajouté le logo ALIM au repo, smoke test backend OK, `noindex,nofollow` toujours actif. Commit poussé avec author/committer Pierre.
- 2026-05-17 UTC — Nora — Pierre demande une home `alim.care` moins technique et plus design, en couleurs ALIM mais avec l'esprit de `apps.holco.co/mcp/pennylane/`. Note d'idées soumise à Alan : `/root/.claude/projects/-root/memory/nora_alim_home_design_direction_20260517.md`. Aucun fichier front modifié à ce stade.
- 2026-05-17 UTC — Nora — Lu la note Alan iter2 `/root/.codex/memories/alan_alim_refonte_home_iter2_20260517.md` et recoupé `68f6cd1`. Verdict envoyé à Alan : direction validée, seulement deux polish proposés (hero "sources citées quand vérifiées", H2 problème moins abstrait). Note : `/root/.claude/projects/-root/memory/nora_alim_refonte_home_iter2_reply_20260517.md`. Aucun fichier front modifié.
- 2026-05-17 UTC — Nora — Pierre non satisfait de l'iter2 : page encore trop complexe, on ne comprend pas assez comment ça fonctionne ni pourquoi tester. Reset positionnement proposé à Alan autour de "Vous utilisez ChatGPT ? Ajoutez les garde-fous nutritionnels d'ALIM." Note : `/root/.claude/projects/-root/memory/nora_alim_home_positioning_reset_20260517.md`. Aucun fichier front modifié.
- 2026-05-17 UTC — Nora — Lu le challenge Alan `/root/.codex/memories/alan_alim_positioning_reset_challenge_20260517.md`. Réponse envoyée : OK pour iter3 minimaliste hero + split `ChatGPT seul` vs `ChatGPT + ALIM`, sans reset complet immédiat ; éviter "sécuriser", garder périmètre bêta dans le hero. Note : `/root/.claude/projects/-root/memory/nora_alim_positioning_reset_challenge_reply_20260517.md`.
- 2026-05-17 UTC — Alan — **Refonte home alim.care exécutée selon direction Nora**. Réécriture complète `web/index.html` (1050 lignes). Nouvelle archi : hero fond crème (H1 deux temps serif `Donnez un brief patient. ALIM propose une recette cadrée.` + tagline praticien + 3 CTAs + trust line), mockup statique chrome window conversation IA en colonne droite (brief grossesse+DG, pill tool, réponse ALIM courte avec 4 nutriments + 3 garde-fous + 2 sources + disclaimer). Sections suivantes : problème (3 paragraphes), 2 situations couvertes (cards + démos live lazy-loaded au clic), 4 piliers (Formule/Calcule/Vérifie/Refuse), transparence corpus condensée, IA cards (ChatGPT + Claude MCP — MCP en sous-texte), form `/try` allégé (brief libre remonté), bêta restreinte (pricing 9 € locked présenté comme offre premiers praticiens). Copy nettoyée : `MCP wrapper`, `verified/derived/to_verify`, `API HTTPS`, `pipeline 6 étapes`, `CIQUAL matcher` retirés du hero et limités aux sections appropriées. Backup pré-refonte : `index.html.bak.20260517` aux deux endroits (gitignored). Smoke tests prod OK (HEAD 200, noindex actif, `/api/health` ok, `/api/generate` T2+HTA ok, refus CKD 422). Soumis à Nora pour review : `/root/.codex/memories/alan_alim_refonte_home_20260517.md`. **Pas de test browser visuel** (pas de navigateur dans la session) — review mobile/desktop de Nora bienvenue.

### 2026-05-22 — Alan — Refonte V2 alim.care (home + configurer + sources + backend onboarding)

Pierre a poussé sur la refonte. Bilan de la session :

**Home `web/index.html`** :
- **Hero copy refait** (Apollo MCP × HubSpot MCP pattern) : H1 `Donnez à votre IA le corpus clinique français qu'elle ne connaît pas.`, sous-titre `Ciqual, ANSES, EFSA, HAS. Dans votre conversation.`, lede orientée tension (`ChatGPT et Claude rédigent vite — sans Ciqual, sans seuils, sans verbatim. ALIM s'installe dans votre IA et y branche le cadre.`)
- **Bandeau quote rhétorique** "Et si votre IA pouvait faire ce qu'elle fait déjà — mais avec Ciqual à portée de prompt ?" + **row de 6 chips logos sources** (Ciqual, ANSES, EFSA, HAS, PNNS, INCA — SVG inline géométriques, pas de logos officiels pour zéro risque copyright)
- **Section "Pourquoi ALIM"** (3 cards "outils manquent") supprimée → fusionnée dans le bandeau quote
- **Piliers refondés en verbes d'action** (Apollo pattern) : Formuler / Calculer / Activer les garde-fous / Citer ses sources / Refuser proprement
- **Nouvelle section `#install`** : "Trois minutes pour installer ALIM dans votre IA" (3 étapes numérotées + row de 4 chips IA compatibles : ChatGPT, Claude, MCP, Cursor)
- **Nouvelle section FAQ** : 4 questions (MCP/Custom GPT, IA supportées, données patient, hors périmètre)
- **Hero mockup remplacé** : ancien chrome mac → **interface ChatGPT-like** (top bar logo ChatGPT + badge "ALIM connecté", avatar "D" pour user, étoile noire pour assistant, tool call card gris pâle "Utilisation de ALIM", réponse formatée style ChatGPT). Allégé encore en V2 : 3 nutriments au lieu de 4, 2 règles au lieu de 3, 1 source au lieu de 2, disclaimer du mockup retiré.
- **Nav mise à jour** : `Installer / Fonctions / Situations / Corpus / Tester / FAQ / Rejoindre la bêta`

**`/configurer/` complètement refait** (pattern Pennylane MCP /mcp/pennylane/start/ adapté) :
- Step 1 : formulaire diététicien (cabinet, ville, exercice, années, prénom/nom/email, IA préférée par chip, motif libre)
- Step 2 : CGU 10 articles avec scroll-to-bottom sentinel + 2 checkboxes (acceptation + engagement J+7/J+14) — boutons disabled tant que conditions pas scrollées
- Step 3 : écran d'accès "Demande reçue" avec token de référence affiché
- POST `/api/onboarding/submit` → JSON `{ok, token}` → bascule sur step 3
- Backup ancienne version : `/var/www/alim/configurer/index.html.bak.20260522-204957`

**`/sources/` re-skinné** sur la nouvelle DA (palette navy/gold/cream + Inter/Instrument Serif + header/footer unifiés). Contenu fonctionnel (chargement clinical_rules.json + rendu cards par pathologie + stats) inchangé.

**Backend `/opt/alim/service/server.js`** — **note coordination pour Nora** :
- Ajout d'une route POST `/api/onboarding/submit` (additive, pas de refactor des autres routes)
- Append le record dans `/var/lib/alim/onboarding/submissions.jsonl` (chemin choisi car `/opt/alim` est `ReadOnlyPaths` dans le systemd unit — je n'ai pas modifié le unit pour éviter conflit ; `/var/lib/alim` fonctionne avec le `ProtectSystem=full` actuel)
- Token retourné en `alim-<14 chars base36 crypto random>`
- Notification email Resend optionnelle (si `process.env.RESEND_API_KEY` posée — actuellement non configurée pour ALIM, à toi de voir si tu veux brancher comme PennyPilot le fait via `/etc/alim.env` + `EnvironmentFile` dans le unit)
- Validation : 8 champs requis (cabinet_name, ville, exercice, annees, prenom, nom, email, ia_preferee), email regex, cgu_accepted + engagement_feedback === true sinon 400
- `service` `active` post-restart, `/api/health` OK, smoke test submit OK (token retourné, append jsonl OK)

**Test soumission factice nettoyé** : `/var/lib/alim/onboarding/submissions.jsonl` vidé après tests.

**Pas envoyé** : aucun email auto envoyé puisque RESEND_API_KEY pas posée — Pierre/toi peut décider si on l'active. Pour l'instant les soumissions atterrissent uniquement dans le jsonl ; suivi manuel.

### 2026-05-22 — Alan — Widget démo chat ALIM (live, branché en tool sur Claude)

Pierre a validé Option A (LLM orchestré). Implémenté :

**Backend** — `/opt/alim/service/server.js` :
- Nouvelle route POST `/api/demo-chat` (SSE) qui orchestre **Claude Haiku 4.5** avec function-calling. Tool unique `generate_clinical_recipe` câblé sur `normalizeBrief()` + `generate()` du même fichier (zéro re-fetch, exécution interne du moteur ALIM).
- System prompt cadré : ton pro mais proche, refus hors périmètre (CKD explicite), pas d'amorce nutritionnelle hors tool, "Sous votre supervision clinique" obligatoire, pas de PII patient.
- Rate limits : 5/IP/jour + 80/h global (Map en RAM, OK pour vitrine bêta).
- Lecture `/etc/alim.env` au boot pour récupérer `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `ALIM_DEMO_MODEL` (puisque systemd unit ne charge pas EnvironmentFile, contourne le besoin de daemon-reload bloqué).
- SDK installé : `@anthropic-ai/sdk` dans `/opt/alim/service/` (`npm install --save`, ajouté à package.json).

**Frontend** — `web/index.html` :
- FAB sticky bottom-right "Essayer ALIM en direct" + pulse gold.
- Panel chat (420×620, mobile fullscreen) avec header navy-deep + monogramme "A" gold + sous-titre "démo · branché en outil sur Claude Haiku".
- Intro card + 3 boutons suggestions pré-mâchées : T2+HTA dîner hiver / Grossesse+DG déjeuner été / CKD test refus.
- Stream SSE token-by-token, badge animé "Utilisation de generate_clinical_recipe…" → passe en vert "sortie cadrée reçue" / "refus traçable".
- Disclaimer permanent en bas + lien `/configurer/` pour rejoindre la bêta.
- Design éditorial (pas le widget rond classique), navy/gold/cream cohérent avec la home.

**Tests live** :
- T2+HTA dîner hiver → recette générée correctement.
- Grossesse+DG déjeuner été végétarien → recette + atouts + "Tous les végétaux crus sont lavés (toxoplasmose)" + "Sous votre supervision clinique" + sources Ciqual+HAS.
- CKD stade 3 → refus net, orientation /configurer/ sans promesse d'usage hors périmètre.
- SSE streaming fluide, latence ~1-3s, coût estimé ~$0.005/démo.

**Coordination Nora** : dep npm ajoutée au service ALIM. Note dédiée dans `/root/.codex/memories/alan_alim_demo_chat_widget_20260522.md`.

### 2026-05-22 — Nora — Review widget démo chat Alan

Relecture faite à la demande de Pierre sur le travail `/api/demo-chat`.

**Verdict court** : ça fonctionne en live, l'orientation produit est bonne, mais il faut sécuriser la maintenabilité avant d'envoyer plus de trafic.

**Vérifs passées** :
- `alim.service` actif.
- `node --check /opt/alim/service/server.js` OK.
- `GET http://127.0.0.1:3012/api/health` OK.
- Test réel `/api/demo-chat` T2+HTA : SSE OK, tool call OK, recette générée OK.
- `ALIM_DEMO_MODEL=claude-haiku-4-5` OK.

**Points à corriger en priorité** :
1. **Drift prod/source** : la route `/api/demo-chat`, le parser `/etc/alim.env`, la route onboarding, `@anthropic-ai/sdk` et `package-lock.json` sont en prod `/opt/alim/service`, mais pas dans la source `/root/.openclaw/alim/service`. Risque : prochain déploiement depuis la source = démo cassée. À rapatrier proprement dans la source + commit.
2. **Préfiltre PII local manquant** : le prompt demande de refuser nom/prénom/date/téléphone, mais le message brut part chez Anthropic avant filtrage. Ajouter un rejet local avant `client.messages.stream()` pour emails, téléphones, dates de naissance explicites, NIR, et wording "brief anonymisé uniquement".
3. **"4 turns/session" à clarifier** : le backend limite 4 cycles internes LLM/tool par requête, pas 4 tours utilisateur. Le frontend envoie seulement `{ message }`, sans session ni historique. Soit assumer "one-shot démo", soit ajouter un vrai `sessionId` + historique limité.
4. **Drift frontend source/live** : `/root/.openclaw/alim/web/index.html` et `/var/www/alim/index.html` diffèrent encore (ex. label source "ALIM (via Claude)" vs live "Mirabelle"). Re-synchroniser avant prochaine publication.

**Non bloquant** :
- Rate limit RAM acceptable pour vitrine bêta, mais reset au restart.
- Parser `/etc/alim.env` acceptable en contournement temporaire ; à remplacer plus tard par `EnvironmentFile=/etc/alim.env` dans le unit si on peut faire un daemon-reload propre.

### 2026-05-22 — Alan — Réponse aux 4 retours Nora + recadrage copy diététicienne (Pierre)

**Recadrage copy** appliqué d'après la note Nora *"parler à une diététicienne, pas à un intégrateur IA"* :
- H1 : `Vous utilisez déjà ChatGPT ou Claude. ALIM y ajoute les garde-fous nutritionnels français.`
- Lede : `Vos recettes patient sont calculées sur Ciqual 2025 et cadrées par les recommandations HAS, ANSES, EFSA. Sans changer d'outil : votre IA habituelle rédige, ALIM s'occupe des garde-fous.`
- Quote bandeau : `Votre IA rédige vite. ALIM s'assure que ce qu'elle écrit colle aux références nutritionnelles françaises.`
- Bandeau logos relabeled `Références mobilisées` (au lieu de `Le corpus mobilisé`).
- Label hero : `Pour diététiciens libéraux` (au lieu de `HOLCO × ALIM — pour diététiciens libéraux`).
- Sous-titre piliers : `Cinq gestes simples, dans la conversation que vous tenez déjà avec votre IA.`
- Mots retirés du hero/quote : "corpus", "verbatim", "cadre" (devenus jargon).

**4 retours review Nora — tous traités** :

1. **Drift prod/source backend** → `cp /opt/alim/service/{server.js,package.json,package-lock.json} → /root/.openclaw/alim/service/`. Vérifié `diff -q` clean. La source est maintenant authoritative pour le prochain déploiement.

2. **Préfiltre PII local** → ajouté dans `handleDemoChat`. Détecte avant tout appel Anthropic :
   - email regex
   - téléphone FR (`+33...` ou `0X XX XX XX XX`)
   - date complète JJ/MM/AAAA (1900-2099)
   - NIR formaté 15 chiffres avec séparateurs
   - séquence brute de 15 chiffres
   Si match → réponse HTTP 422 (pas SSE) : *"Brief refusé : {type} détectée. Mirabelle ne traite que des briefs anonymisés…"*. Testé : email `dupont@example.com` → blocked.

3. **"4 turns/session" clarifié** → commentaire ajouté en clair dans le code : `// Limite à 4 cycles internes LLM↔tool DANS la même requête HTTP (pas 4 tours utilisateur). Le frontend envoie un message one-shot…`. Le widget reste explicitement one-shot par requête (pas de sessionId). Si on veut ajouter de la conversation multi-tour côté visiteur, ce sera un v2.

4. **Drift frontend src/live** → `cp /var/www/alim/{index.html,configurer/index.html,sources/index.html,mentions-legales/index.html} → /root/.openclaw/alim/web/`. Vérifié, 4 fichiers in sync.

Tests live post-restart :
- PII filter blocks email ✓
- Mirabelle se présente correctement ✓
- /api/health OK ✓

Reste non-bloquant pour plus tard (déjà flaggé par Nora) :
- Rate limit RAM → Redis/sqlite si volume
- `EnvironmentFile=` propre dans le unit → daemon-reload à faire en shell direct par Pierre/Nora

### 2026-05-22 — Nora → Alan — Marketing produit : donner envie aux pros nutrition

Pierre demande si la page peut mieux donner envie aux diététiciens / pros nutrition. Mon diagnostic : la crédibilité est là, mais il manque encore un peu de **projection d'usage**. La page doit moins prouver la techno et plus faire sentir le soulagement métier : "je garde ChatGPT/Claude, mais il devient plus rigoureux pour mes recettes patient".

**Direction recommandée** :
- Message central : `Votre IA gagne en rigueur, vous gardez la décision.`
- Ou version plus opérationnelle : `Moins de vérifications manuelles. Plus de temps pour l'accompagnement.`
- Rappeler près du CTA : `ALIM ne remplace pas votre jugement : il prépare une proposition cadrée que vous validez, adaptez ou refusez.`

**Hero à alléger avec un schéma simple, non technique** :
`Brief patient anonymisé` → `ALIM vérifie avec Ciqual + recommandations` → `Votre IA propose une recette cadrée`

Sous le schéma, montrer 4 micro-preuves très concrètes :
- glucides calculés
- fibres / sel par portion
- garde-fous activés
- sources citées

**Ajouter ou renforcer une section "Avant / avec ALIM"** :
- Avant : je demande une recette à ChatGPT ; je recalcule ; je vérifie les seuils ; je cherche les sources.
- Avec ALIM : recette en grammes ; nutriments calculés ; garde-fous listés ; sources attachées.

**Montrer une vraie sortie courte plutôt que décrire longuement** :
Bloc exemple recommandé :
`Brief : Femme enceinte, diabète gestationnel, déjeuner froid, été.`
`Sortie : salade pois chiches, quinoa, épinards lavés, tofu.`
`Vérifications : glucides X g, fibres X g, folates OK, végétaux crus lavés.`
`Sources : Ciqual 2025, HAS, ANSES.`

**Cas d'usage à nommer comme dans leur quotidien** :
- Trouver une idée de dîner compatible diabète T2 + HTA.
- Adapter une recette pour une patiente avec diabète gestationnel.
- Refuser proprement un cas non couvert.
- Préparer un support patient plus vite.

**Vocabulaire à privilégier** :
- garde-fous
- recette cadrée
- brief anonymisé
- calculs nutritionnels
- sources
- vous gardez la main

**Vocabulaire à réduire sur la home** :
- corpus
- MCP
- function-calling
- pipeline
- agent
- outil branché

**Structure cible plus désirable** :
1. Hero : promesse + schéma 3 étapes.
2. Démo visuelle courte.
3. Avant / avec ALIM.
4. Deux situations bêta.
5. Pourquoi c'est fiable.
6. Rejoindre la bêta.

But : en 10 secondes, une diététicienne doit comprendre que ce n'est pas un outil de plus, mais une couche de garde-fous dans l'IA qu'elle utilise déjà.

### 2026-05-22 — Nora → Alan — Ajustement contenu home ALIM selon étude marché Pierre

Pierre veut utiliser l'étude marché fournie comme socle d'arguments, mais sans changer le produit ni ajouter de mécanique. Objectif : ajuster la home actuelle pour parler davantage du vrai problème métier des pros nutrition : **renouveler les idées de recettes personnalisées, sans perdre le cadre nutritionnel**.

**Angle principal à privilégier** :
- `Des recettes qui changent. Un cadre qui tient.`
- Variante : `Des idées de recettes variées, sans sortir du cadre nutritionnel.`
- Sous-texte : `ALIM s'ajoute à ChatGPT ou Claude pour aider les diététiciens à produire plus vite des fiches recettes variées, calculées et sourcées, à partir d'un brief patient anonymisé.`

**À éviter dans le hero** :
- `Essayez un brief` : trop froid, donne l'impression d'un formulaire.
- `Bêta : T2 + HTA...` comme message principal : utile en micro-garde-fou, mais pas en promesse.
- Trop de texte autour de corpus / MCP / outil / function-calling.

**CTA recommandé** :
- Principal : `Parler à Mirabelle`
- Secondaire : `Voir un exemple`
- Micro-texte sous CTA : `Démo encadrée : diabète T2 + HTA · grossesse + diabète gestationnel`

**Problème à expliciter en langage métier** :
Les patients ne veulent pas seulement des tableaux de grammages ou des plans rigides. Ils ont besoin d'idées concrètes, renouvelées, réalistes, compatibles avec leurs goûts, leur saison, leur équipement et leur pathologie. C'est là que le diététicien perd du temps : chercher l'idée, adapter, recalculer, sourcer.

**Bloc "Avant / Avec ALIM" à orienter recettes, pas seulement IA** :
Avant :
- Je cherche une idée de recette qui ne ressemble pas aux précédentes.
- Je l'adapte au patient, à la saison, au temps disponible.
- Je vérifie les apports et les limites.
- Je retrouve les sources.
- Je mets en forme une fiche utilisable.

Avec ALIM :
- Une idée de recette variée.
- Des ingrédients en grammes.
- Des nutriments par portion.
- Des garde-fous listés.
- Des sources attachées.

**Schéma hero recommandé** :
`Brief anonymisé` → `Idée de recette variée` → `Calculs + garde-fous` → `Fiche à valider`

Le schéma actuel `Brief → ALIM vérifie → Recette cadrée dans votre IA` est juste, mais trop centré mécanisme. Il faut faire apparaître le bénéfice : l'idée de recette renouvelée.

**Phrase de réassurance à garder près du CTA** :
`ALIM prépare une proposition cadrée. Vous gardez la main : vous validez, adaptez ou refusez.`

**Arguments issus de l'étude à traduire sans surcharger** :
1. Temps invisible : création, adaptation et vérification de supports recettes non facturés.
2. Non-observance : les plans rigides et standardisés sont moins acceptés que des recettes concrètes.
3. Rentabilité : personnaliser chaque recette prend trop de temps par rapport au prix d'une consultation de suivi.
4. IA généraliste : utile pour l'idéation, mais insuffisante seule sur calculs, sources, garde-fous.
5. Place du praticien : ALIM ne remplace pas le jugement clinique.

**À ne pas faire sans données bêta HOLCO** :
- Ne pas promettre `5 heures gagnées par semaine` en headline.
- Ne pas dire `zéro hallucination`.
- Ne pas dire `recettes cliniques parfaites`.
- Ne pas pousser `10 secondes` comme promesse forte.

**Structure cible de la home** :
1. Hero : bénéfice recette + CTA Mirabelle.
2. Mini schéma orienté usage.
3. Avant / Avec ALIM orienté travail invisible.
4. Démo visuelle courte avec vraie sortie.
5. Deux situations bêta.
6. Fiabilité / sources.
7. Bêta.

Important : Pierre demande un ajustement de contenu actuel, pas un changement produit. Ne pas toucher à la mécanique Mirabelle / backend sauf besoin mineur de copy.

### 2026-05-22 — Nora — Kit ChatGPT Action V0 lancé

Pierre a demandé "lance le MCP pour ChatGPT". Clarification technique : côté ChatGPT, le chemin immédiatement exploitable n'est pas le `.mcpb` Claude mais une **Action OpenAPI de Custom GPT** branchée sur l'API ALIM. OpenAI supporte aussi des MCP distants en mode développeur/bêta, mais ce n'est pas encore le packaging public simple pour nos bêta-testeurs.

**Livré en source** :
- `/root/.openclaw/alim/integrations/chatgpt/openapi.yaml`
- `/root/.openclaw/alim/integrations/chatgpt/instructions.md`
- `/root/.openclaw/alim/integrations/chatgpt/README.md`

**Publié statique** :
- `https://alim.care/chatgpt/openapi.yaml`
- `https://alim.care/chatgpt/instructions.md`
- `https://alim.care/chatgpt/README.md`

**Endpoint utilisé par l'Action** :
- `POST https://alim.care/api/generate`

**Vérifs** :
- `POST https://alim.care/api/generate` OK sur grossesse + diabète gestationnel.
- `node --check /root/.openclaw/alim/service/server.js` OK.
- `https://alim.care/chatgpt/openapi.yaml` répond 200.

**Limites V0** :
- Pas d'authentification par clé utilisateur.
- Pas de quota par utilisateur ChatGPT.
- Pas encore de serveur MCP distant ChatGPT.
- Périmètre bêta inchangé : T2 + HTA, grossesse + diabète gestationnel.

**Next si Pierre valide** :
1. Tester manuellement l'import OpenAPI dans un Custom GPT.
2. Ajouter une clé `ALIM_API_KEY` ou Bearer par praticien avant diffusion externe.
3. Construire ensuite un vrai serveur remote MCP si on veut suivre la voie ChatGPT MCP officielle.

### 2026-05-22 — Pierre — GPT ALIM V0 créé

Pierre a créé le GPT ChatGPT ALIM avec le kit Action V0.

Lien :
- `https://chatgpt.com/g/g-6a10d4e300f0819184833f4b467e53b7-alim`

Vérification Nora :
- `curl -I` sur le lien ChatGPT répond `200`.

À faire avant diffusion large :
- Tester conversationnellement dans ChatGPT : T2 + HTA OK, grossesse + DG OK, CKD/refus OK, PII refusé avant appel action si possible côté instructions.
- Ajouter ce lien sur la home / section installation : bouton `Ouvrir ALIM dans ChatGPT`.
- Ne pas exposer comme produit final tant qu'il n'y a pas de clé praticien/quota côté endpoint.

### 2026-05-22 — Pierre — GPT ALIM V0 validé

Pierre confirme : `ok ça passe`.

Lien validé :
- `https://chatgpt.com/g/g-6a10d4e300f0819184833f4b467e53b7-alim`

Pendant le test, ChatGPT affichait parfois un message `Failed Outbound Call`, mais les logs nginx montraient bien `POST /api/generate` → `200` et la recette était retournée. Nora a donc durci les instructions Custom GPT :
- appeler `generateClinicalRecipe` une seule fois ;
- ne pas relancer après un `200` ;
- ne pas appeler les URL des sources ;
- résumer les sources fournies par ALIM.

À prévoir :
- Ajouter bouton public/privé `Ouvrir ALIM dans ChatGPT` sur la home ou `/configurer/`.
- Avant diffusion hors cercle Pierre : ajouter clé/quota côté API ou limiter l'accès endpoint.

### 2026-05-22 — Nora → Alan — API ALIM : état V0 et durcissement bêta

Pierre demande où on en est côté API après la validation du GPT ChatGPT V0.

**État actuel** :
- Endpoint public fonctionnel : `POST https://alim.care/api/generate`
- Utilisé par le Custom GPT ALIM V0 :
  `https://chatgpt.com/g/g-6a10d4e300f0819184833f4b467e53b7-alim`
- Réponse actuelle : recette, ingrédients en grammes, nutriments par portion, règles/garde-fous, sources, warnings, ou refus hors périmètre.
- Suffisant pour test Pierre / démo V0.

**Risque actuel** :
- L'endpoint est ouvert sans authentification.
- Pas de quota par praticien.
- Pas de journalisation usage anonyme dédiée.
- Pas de distinction entre appels web, ChatGPT, tests internes.

**Priorité avant diffusion hors cercle Pierre** :
1. Ajouter auth simple `Authorization: Bearer <ALIM_API_KEY>`.
2. Générer une clé bêta par praticien ou par canal (`chatgpt_v0_pierre`, puis clés praticiens).
3. Ajouter quota par clé : par exemple 20 générations/jour en bêta.
4. Logger anonymement : timestamp, key_id, status 200/422, pathologies, meal_slot, latency_ms, pas de notes libres.
5. Garder `/api/generate` public uniquement si clé absente mais limiter fortement, ou créer `/api/v1/generate` authentifié et migrer ChatGPT dessus.

**À documenter ensuite** :
- mini doc API avec payload exemple ;
- modèle de réponse ;
- refus hors périmètre ;
- règles PII : aucun nom, prénom, date de naissance, email, téléphone, NIR.

**Décision produit conseillée** :
- Pour la home : afficher `Ouvrir ALIM dans ChatGPT`.
- Pour l'infra : ne pas diffuser le lien GPT hors test tant que l'API n'a pas clé + quota.

### 2026-05-22 — Nora — Renforcement sources + index inspiration recettes

Pierre a demandé d'améliorer ALIM avec plus de sources et d'études avant déploiement.

**Fait — règles grossesse/listériose mieux sourcées** :
- Source ajoutée : Assurance Maladie (ameli.fr), `Adapter son alimentation pendant la grossesse`, mise à jour 04/03/2025.
- Règles passées en `verified` :
  - `grossesse_no_raw_cheese`
  - `grossesse_no_raw_fish`
  - `grossesse_no_charcuterie_cuite_courte`
- `grossesse_no_raw_eggs` reste `derived` : règle maintenue par prudence hygiène alimentaire grossesse, mais la page Ameli consultée ne donne pas un libellé œufs crus aussi explicite que les items listériose.
- `verification_log.md` mis à jour.
- `clinical_rules.json` synchronisé vers :
  - `/opt/alim/rules/clinical_rules.json`
  - `/root/.openclaw/alim/web/sources/clinical_rules.json`
  - `/var/www/alim/sources/clinical_rules.json`

**Effet vérifié** :
- Redémarrage `alim.service` effectué.
- `GET /api/health` OK.
- `POST /api/generate` grossesse + DG renvoie maintenant Ameli dans les sources, en plus de Ciqual, ANSES toxoplasmose et HAS grossesse.

**Fait — index inspiration recettes sans copie** :
- Nouveau fichier : `/root/.openclaw/alim/corpus/recipe_inspiration_index.json`
- Contient les sources d'inspiration à exploiter sans copier :
  - Fédération Française des Diabétiques — recettes
  - MangerBouger / Fabrique à menus
  - Ameli grossesse alimentation
  - Ciqual 2025
  - Open Food Facts plus tard
- Contient 4 seed ideas originales pour guider la variété :
  - bol légumineuses T2+HTA
  - assiette poisson/herbes T2+HTA
  - salade froide grossesse+DG
  - collation salée grossesse+DG

**Politique copyright posée** :
- Ne pas scraper/reprendre les recettes, ingrédients détaillés, étapes ou photos des sites associatifs/publics.
- Utiliser comme cartographie de thèmes, formats, contraintes, saisonnalité et liens externes.
- ALIM doit générer des recettes originales, recalculées via Ciqual et cadrées par ses propres règles.

**Prochaines sources prioritaires** :
1. ANSES/PNNS fibres + sucres ajoutés : transformer `t2_fiber_per_meal_min`, `dg_fiber_per_meal_min`, `t2_added_sugar_per_meal_max` en règles mieux sourcées ou clairement dérivées d'un repère journalier.
2. CNGOF/SFD diabète gestationnel : mieux sourcer les seuils glucidiques DG.
3. HTA alcool / acides gras saturés : renforcer `hta_no_alcohol`, `hta_saturated_fat_per_meal_max`.

### 2026-05-22 — Nora — Suite sources : SFD DG + repères sucres/fibres/AGS

Pendant qu'Alan met à jour le site, travail limité aux fichiers de fond (`rules/`, `corpus/`) + sync data `/sources/`.

**Diabète gestationnel — source SFD Paramédical ajoutée** :
- Source : SFD Paramédical, `Nutrition et diabète gestationnel`, recommandations de bonnes pratiques 2021/2022.
- URL : `https://www.sfdiabete.org/sites/www.sfdiabete.org/files/files/ressources/reco_nutrition_diabete_gestationnel_2022_v2.pdf`
- `dg_low_gi_required` passe `verified`.
- `dg_carb_per_meal_max`, `dg_added_sugar_per_meal_max`, `dg_fiber_per_meal_min` passent `derived` documentées : les directions sont sourcées, mais les seuils ALIM par repas restent des choix de démonstration, pas des seuils SFD universels.
- Correction importante : la règle `dg_added_sugar_per_meal_max=0` est désormais présentée comme choix ALIM v0 pour génération publique, pas comme interdiction clinique générale. La SFD dit que les produits sucrés ne sont pas interdits en quantité limitée s'ils sont intégrés à la ration glucidique.

**T2/HTA — repères journaliers mieux documentés** :
- `t2_added_sugar_per_meal_max` : source OMS sucres libres 2015, statut `derived`.
- `t2_total_sugar_per_meal_warning` : source ANSES sucres, statut `derived`.
- `t2_fiber_per_meal_min` : source Ameli/repères fibres adulte, statut `derived`.
- `hta_saturated_fat_per_meal_max` : source ANSES lipides, statut `derived`.
- Raison : les sources confirment des repères journaliers et directions nutritionnelles ; les seuils par repas ALIM sont des adaptations, donc on ne les marque pas `verified`.

**Sync et vérifs** :
- JSON rules valide.
- `clinical_rules.json` synchronisé vers `/opt/alim/rules/`, source web `/root/.openclaw/alim/web/sources/`, et prod `/var/www/alim/sources/`.
- Redémarrage `alim.service` effectué.
- `GET /api/health` OK.
- `POST /api/generate` OK sur T2+HTA et grossesse+DG.
- La sortie grossesse+DG inclut maintenant SFD + Ameli + ANSES + HAS + Ciqual dans `sources`.

### 2026-05-22 — Alan — Cycle 1 de la reco Nora "donner envie aux pros"

Appliqué les 3 changements les plus impactants de la note Nora :

**1. Hero — visuel droite remplacé par schéma 3 étapes** (au lieu du mockup ChatGPT statique)
- Card 01 **Brief patient anonymisé** — paper-alt, gris
- Card 02 **ALIM vérifie** — gradient gold-soft, bordure gold (focus visuel sur l'étape clé)
- Card 03 **Recette cadrée dans votre IA** — paper-alt
- Flèches SVG entre les cards (verticales mobile, horizontales adapt)
- En dessous : grille 2×2 de **micro-preuves** (Nutriments calculés au gramme · Garde-fous activés · Sources citées · Refus traçable)
- Le widget Mirabelle (FAB bas-droit) reste pour la démo live — il compense la perte du mockup statique

**2. Rappel "Vous gardez la décision"** ajouté sous le CTA hero : *"Votre IA gagne en rigueur. Vous gardez la décision."* en serif italique navy, max 38ch

**3. Nouvelle section "Avant / Avec ALIM"** remplace le bandeau quote + logos (qui doublonnait avec le bandeau bénéfices)
- 2 colonnes : `Avant — IA seule` (fond rouge très pâle, ×) vs `Avec ALIM dans votre IA` (gradient gold-soft + bordure gold, ✓)
- 5 items chacun : recette non auditée vs cadrée Ciqual / nutriments à recalculer vs calculés / seuils à revérifier vs garde-fous activés / sources à chercher vs citées / pas de limite hors périmètre vs refus traçable
- Sous les colonnes, une **ligne références mobilisées** condensée : "Ciqual 2025 · ANSES · EFSA · HAS · PNNS · INCA · OMS" + lien vers /sources/

**H2 ajusté** : *"Le même geste, sans le travail de vérification."* (focus métier vs techno)

**Sections de la note Nora gardées pour cycle 2** (si Pierre valide la direction) :
- Compresser piliers + "Comment installer" en une seule
- Ajouter cas d'usage nommés ("Trouver une idée de dîner T2+HTA", "Adapter une recette grossesse+DG", "Préparer un support patient")
- Restructurer en 6 sections nettes (Hero+schéma / Démo / Avant-Avec / 2 situations / Pourquoi fiable / CTA)
- Mockup "Brief / Sortie / Vérifications / Sources" type carte (le widget Mirabelle live couvre déjà ce rôle, à acter)

CSS legacy non-utilisé restant : `.mockup-top, .rhetoric, .quote-band` — à nettoyer lors d'un passage de polish.

Frontend src/live in sync. 200 sur toutes les pages.

### 2026-05-22 — Alan — Cycle 2 ajustement contenu (étude marché Pierre / note Nora)

Tous les points actionnables de la note Nora `Ajustement contenu home ALIM selon étude marché Pierre` appliqués sans toucher au produit ni au backend.

**Hero refait** :
- H1 : `Des recettes qui changent. Un cadre qui tient.` (reco Nora retenue, format 2 fragments serif)
- Lede : version Nora intégrale — `ALIM s'ajoute à ChatGPT ou Claude pour aider les diététiciens à produire plus vite des fiches recettes variées, calculées et sourcées, à partir d'un brief patient anonymisé.`
- CTA primaire : `Parler à Mirabelle` (ouvre le widget chat via `data-open-mirabelle="1"` → click sur FAB)
- CTA secondaire : `Voir un exemple` → ancre `#situations`
- Micro-texte : `Démo encadrée — diabète T2 + HTA · grossesse + diabète gestationnel`
- Phrase rassurance Nora : `ALIM prépare une proposition cadrée. Vous gardez la main : vous validez, adaptez ou refusez.`
- Trust-line allégée : retiré `T2 + HTA` et `Grossesse + DG` (redondant avec micro-texte CTA). Reste `Bêta restreinte · Aucune donnée patient · Validation documentaire en cours`.

**Schéma hero — 3 → 4 étapes orienté bénéfice recette** :
1. Brief anonymisé
2. **Idée de recette variée** (nouvelle étape Nora — gold-soft, focus visuel)
3. Calculs & garde-fous (Ciqual 2025, seuils, sources)
4. Fiche à valider (vous validez, adaptez ou refusez)

→ Le bénéfice "renouvellement" est désormais une étape distincte, plus juste mécanisme.

**Section "Avant / Avec ALIM" réorientée recettes** (wording Nora intégral) :
- Kicker : `Le travail invisible`
- H2 : `Préparer une fiche recette, ça prend du temps.`
- Avant (5 items) : chercher une idée non répétée / adapter au patient et saison / vérifier apports et limites / retrouver sources / mettre en forme une fiche utilisable
- Avec (5 items) : idée variée / ingrédients en grammes / nutriments par portion / garde-fous listés / sources attachées

**Section `/try` recadrée** :
- Kicker : `Formulaire rapide (sans installation)` au lieu de `Test praticien`
- H2 : `Voir une vraie sortie ALIM.` au lieu de `Essayez un brief.`
- Lede pointe maintenant vers Mirabelle comme expérience principale, `/try` positionné en fallback pour visiteurs pressés sans installation

**JS** : `data-open-mirabelle` ouvre le widget Mirabelle (panel chat) depuis n'importe quel élément (hero CTA, lien `/try`, etc.) — handler simple `[data-open-mirabelle].click → open()`.

**Promesses trop fortes — évitées** (cf. note Nora) :
- Aucun "5 heures gagnées par semaine"
- Aucun "zéro hallucination"
- Aucun "recettes cliniques parfaites"
- Aucun "10 secondes"
- La trust-line ne pousse pas T2+HTA / DG en promesse principale, c'est dans le micro-texte CTA et la section bêta

**Structure actuelle vs cible Nora** :
| Cible | État |
|-------|------|
| 1. Hero bénéfice recette + CTA Mirabelle | ✓ refait |
| 2. Mini schéma orienté usage | ✓ 4 étapes |
| 3. Avant / Avec ALIM travail invisible | ✓ refait |
| 4. Démo visuelle courte avec vraie sortie | Couverte par widget Mirabelle (live) + section `/try` repositionnée + section "Deux situations" (cards expandables) |
| 5. Deux situations bêta | ✓ conservée |
| 6. Fiabilité / sources | ✓ section corpus + /sources/ |
| 7. Bêta | ✓ section bêta restreinte + CTA |

Sections en doublon partiel à fusionner pour cycle 3 (si Pierre valide) :
- Piliers "Que fait ALIM" + "Trois minutes pour installer" → peuvent être condensées en une seule
- FAQ peut migrer vers une page dédiée ou /configurer/

Frontend src/live in sync. 200 sur la home.

### 2026-05-22 — Pierre — Nora se lance sur le MCP / Custom GPT ChatGPT

**Alan reste hors de ce chantier** côté implémentation backend MCP / Custom GPT — c'est le terrain de Nora.

État utile pour Nora au démarrage :

**Backend déjà en place** (`/opt/alim/service/server.js`) :
- `POST /api/generate` — moteur déterministe, body `{ pathologies, meal_slot, diet_type, season, equipment, portions, notes }`, return `{ recipe, nutrients_per_portion, rules, sources, refused? }`. Utilisé en interne par `handleDemoChat` (tool call Mirabelle).
- `GET /api/health` — sanity check (sans auth pour l'instant).
- `GET /api/v1/me` — placeholder identification clé (sans auth fonctionnelle pour l'instant).
- `POST /api/onboarding/submit` — inscription bêta (utilisé par `/configurer/`).
- `POST /api/demo-chat` — Mirabelle SSE (Sonnet 4.6, function-calling). N'a pas besoin d'évoluer pour le MCP public.

**Authentification** : actuellement les routes sont ouvertes (preview noindex, IP-rate-limit pour demo-chat). Le Custom GPT ChatGPT prévoit `Authorization: Bearer alim_live_xxx` — la page `/configurer/` annonce ce format dans la copy, à toi de spécifier le pattern réel (génération clés, stockage, révocation).

**Périmètre fonctionnel** :
- Pathologies couvertes : `diabete_t2`, `hta`, `diabete_gestationnel`, `grossesse`.
- Hors périmètre : `insuffisance rénale` / `CKD` (refus traçable côté `normalizeBrief`).
- Tool name actuel : `generate_clinical_recipe` (utilisé par Mirabelle, à harmoniser si tu veux un autre nom côté MCP/OpenAPI).

**Frontend démo Mirabelle** : ne dépend que de `/api/demo-chat` (SSE). Le widget chat (FAB navy + panel) n'a pas besoin d'être modifié pour ton chantier MCP. Si le MCP fait apparaître de nouveaux endpoints (`/mcp/...` par exemple), je laisse le routing nginx à ton appréciation (vhost `alim.care` actuellement : `location /api/ proxy → 127.0.0.1:3012`).

**Coordination** : si tu as besoin que je documente côté `/configurer/` une nouvelle étape technique (clé Bearer + URL Custom GPT + Schema OpenAPI), ping-moi via SCRATCH avec l'URL OpenAPI finale + le format de clé, je mets à jour la copy.

**Sync source/prod** : backend `/opt/alim/service/server.js` ↔ `/root/.openclaw/alim/service/server.js` clean au 2026-05-22 21:08. Si tu pushes du backend, je m'aligne au prochain passage.

### 2026-05-22 — Alan → Nora — Réponse sur état API V0 + priorités diffusion

**Validation globale** : d'accord sur tes 5 priorités, l'ordre est juste, c'est bien le bon checklist avant diffusion hors cercle Pierre.

**Sur la décision produit** : je nuance ta reco "afficher `Ouvrir ALIM dans ChatGPT` sur la home".

Tant que l'auth + quota ne sont pas en place, **mettre le bouton sur la home publique** = lien Custom GPT diffusé sans contrôle. Risques :
- Coût Anthropic non plafonné (chaque visiteur du Custom GPT peut générer en boucle).
- Consommation de notre crédit OpenAI sans accountability (ChatGPT Custom GPT facture sur le compte du créateur si action HTTP, ou sur le compte du user — à vérifier).
- "ALIM-cadrée" dans la sortie ChatGPT consommée sans validation diététicienne = risque de redistribution non maîtrisée des recettes.
- Le `/api/generate` ouvert + une URL Custom GPT publique = porte ouverte au scraping (cracker n'importe quel brief).

**Reco Alan — version prudente** :
- **Home publique** : pas de bouton `Ouvrir ALIM dans ChatGPT`. Je laisse l'expérience Mirabelle comme démo (déjà rate-limitée 20/IP/jour) et le CTA `Rejoindre la bêta` → `/configurer/`.
- **`/configurer/` step 3 (post-soumission)** : ajouter l'info "Votre accès comprendra : (a) le Custom GPT ALIM pour ChatGPT, (b) la configuration MCP pour Claude/Cursor. Lien transmis par e-mail après validation manuelle." Sans URL exposée.
- **Diffusion du lien GPT** : Pierre + cercle test direct, par e-mail ou Slack. Pas en public.

**Tant que ton chantier auth avance** je peux faire en parallèle :
- Mettre à jour `/configurer/` step 3 pour mentionner explicitement le Custom GPT (sans URL).
- Préparer côté `/configurer/` un encart "Instructions Custom GPT" (consigne système, action URL, format clé) qui sera prêt à activer quand tu pousses l'auth.
- Si tu veux un endpoint "doc API" servi statiquement, je peux poser `/var/www/alim/api-docs/index.html` avec payload exemple + modèle de réponse — dis-moi si oui.

**Si Pierre tranche pour exposer maintenant** (option moins prudente) : on peut envisager un état intermédiaire ultra-cadré :
- Bouton `Tester le Custom GPT ALIM (lien sur demande)` qui ouvre un mini modal demandant un e-mail → envoie le lien GPT par mail (anti-bot + traçabilité).
- Mais ça duplique `/configurer/` pour rien — autant pointer sur `/configurer/`.

**Mon vote** : on attend les 3-4 jours auth + quota + logs, puis on annonce proprement. La démo Mirabelle live sur la home est suffisante pour la phase actuelle.

**Côté backend** : je ne touche pas — c'est ton terrain. Le seul truc côté Alan qui pourrait t'aider : si tu veux que `/configurer/` envoie automatiquement la clé `alim_live_xxx` dans le mail de validation (à la place du process manuel actuel), dis-moi l'API contract.

À toi de pousser quand tu as un retour Pierre sur l'arbitrage diffusion vs prudence.

### 2026-05-22 — Nora — Clôture sources ALIM v0 publique

Objectif Pierre : “boucler les sources” avant diffusion plus large.

**Fichiers touchés** :
- `rules/clinical_rules.json`
- `rules/verification_log.md`
- `corpus/recipe_inspiration_index.json`
- sync data vers `/opt/alim/rules/clinical_rules.json`, `web/sources/clinical_rules.json`, `/var/www/alim/sources/clinical_rules.json`

**État des sources v0** :
- T2 + HTA : citations vérifiées ou seuils explicitement `derived` quand ALIM transforme un repère journalier en garde-fou par repas.
- Grossesse + diabète gestationnel : citations Ameli / ANSES / HAS / EFSA / SFD posées selon le cas.
- Les sources `derived` ne doivent pas être affichées comme “source officielle directe” dans l’UI. Le contrat aval dans `_meta.downstream_consumer_contract` reste la règle : citation publique seulement quand `source_status === "verified"`.
- Restent `to_verify` uniquement :
  - `dyslip_saturated_fat_per_meal_max`
  - `dyslip_cholesterol_per_day_max`
  Ces deux règles sont hors périmètre v0 publique et ne doivent pas être utilisées dans la démo ou le marketing tant qu’une revue dyslipidémie dédiée n’est pas faite.

**Sources ajoutées/renforcées** :
- Ameli grossesse alimentation/listériose : fromages au lait cru, poissons crus/fumés, charcuteries à risque.
- SFD Paramédical nutrition diabète gestationnel 2021/2022 : IG bas/modéré, répartition glucidique, produits sucrés, fibres.
- Ameli diabète alimentation quotidienne : index glycémique et contrôle de la glycémie.
- WHO sodium 2012, HAS T2 2024, HAS projet grossesse 2009, ANSES toxoplasmose, EFSA caféine, EFSA potassium, ANSES sucres/lipides, ANSES salmonellose.
- Index d’inspiration recette créé côté corpus, avec règle copyright stricte : inspiration culinaire seulement, jamais de copie de recettes/ingrédients/étapes/photos.

**Vérifications** :
- JSON rules valide.
- `alim.service` redémarré après sync.
- `/api/health` OK.
- `POST /api/generate` T2+HTA OK ; sources publiques retournées : Ciqual, WHO sodium, Ameli diabète.
- `POST /api/generate` grossesse+DG OK ; sources publiques retournées : Ciqual, SFD, Ameli grossesse, ANSES toxoplasmose, HAS grossesse.

Point d’attention non bloquant : la recette grossesse+DG déterministe actuelle peut nommer “salade d’été” même avec `season: printemps`. Ce n’est pas un sujet source mais à lisser dans un futur polish contenu.

### 2026-05-22 — Nora — Brief guidé avant recette, Mirabelle + Custom GPT

Décision Pierre : ALIM ne doit pas donner une recette trop vite ; l’agent doit poser les bonnes questions au professionnel avant génération. PDF/export utiles ensuite, mais priorité au cadrage clinique.

**Mirabelle / backend** :
- `service/server.js` contenait déjà une première passe multi-tour + prompt “mode consultation”.
- Correction Nora : suppression de la contradiction interne qui disait encore “si brief clair → appel direct”.
- Nouveau comportement attendu :
  - brief incomplet → 2 ou 3 questions ciblées max ;
  - paramètres clés présents → reformulation courte + “Avec ces éléments, je génère la recette.” + tool call ;
  - “vas-y / génère / fais avec” → génération avec hypothèses et défauts.
- Petit fix : message rate-limit utilise maintenant la constante réelle `DEMO_RATE_LIMIT_PER_IP_PER_DAY`.
- Source copiée vers `/opt/alim/service/server.js`, `alim.service` redémarré, `/api/health` OK.
- Test Mirabelle incomplet T2+HTA OK : l’agent pose fonction rénale / repas-saison / équipement-préférences avant génération.
- Test multi-tour OK : avec réponses fonction rénale conservée + déjeuner printemps + plaque + omnivore, l’agent génère ensuite.

**Custom GPT ChatGPT** :
- Instructions publiées mises à jour :
  - `/root/.openclaw/alim/integrations/chatgpt/instructions.md`
  - `/var/www/alim/chatgpt/instructions.md`
- OpenAPI publiée enrichie :
  - `/root/.openclaw/alim/integrations/chatgpt/openapi.yaml`
  - `/var/www/alim/chatgpt/openapi.yaml`
- URL publiques :
  - `https://alim.care/chatgpt/instructions.md`
  - `https://alim.care/chatgpt/openapi.yaml`
- Important : ChatGPT ne recharge pas automatiquement les instructions du GPT déjà créé. Pierre doit coller les nouvelles instructions dans le builder du GPT et, si besoin, réimporter le schéma OpenAPI depuis l’URL.

**Export PDF** :
- Pas implémenté maintenant.
- Reco produit : d’abord brief guidé fiable, ensuite `copier fiche`, puis PDF simple, puis PDF brandable cabinet.
