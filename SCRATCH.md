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
- 2026-05-23 UTC — Nora — Scanner URL Marmiton durci après test Pierre sur `recette_cookies-maison_86989.aspx` : extraction JSON-LD limitée aux ingrédients (plus d'instructions prises comme ingrédients), normalisation ligne par ligne des unités non métriques courantes (oeuf, pincée, cuillère à café, sachet) et matching CIQUAL avec tokens exacts pour éviter `oeuf` → `boeuf`. Smoke test cookies ajouté. Prod redéployée, `alim.service` actif, test Marmiton OK : 7 ingrédients matchés, verdict rouge attendu pour cookies / diabète T2.
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

### 2026-05-23 — Nora — GPT public OAuth + compat Claude MCP

Pierre a tranché : ALIM doit vivre dans ChatGPT et Claude, pas comme app autonome principale. Lot livré côté backend/source/prod :

- Ajout OAuth v0 pour ChatGPT Actions :
  - `GET /oauth/authorize` : page ALIM de connexion, saisie clé `alim_live_...`, noindex.
  - `POST /oauth/authorize` : vérifie la clé et redirige avec code OAuth.
  - `POST /oauth/token` : échange code contre `alim_oauth_...` Bearer, TTL 90 jours.
  - Tables SQLite ajoutées : `oauth_codes`, `oauth_tokens`.
- `findAccountByBearer()` accepte désormais :
  - clés praticien `alim_live_...`
  - tokens OAuth `alim_oauth_...`
- OpenAPI ChatGPT mis à jour : security scheme `oauth2.authorizationCode`, URLs `https://alim.care/oauth/authorize` et `https://alim.care/oauth/token`.
- Déploiement prod synchronisé :
  - `/root/.openclaw/alim/service/server.js` → `/opt/alim/service/server.js`
  - `/root/.openclaw/alim/integrations/chatgpt/openapi.yaml` → `/var/www/alim/chatgpt/openapi.yaml`
  - `alim.service` restart OK.

Tests réels OK :
- `GET /api/health` → 200.
- `GET /oauth/authorize?...` → page HTML 200.
- `POST /oauth/authorize` avec clé Pierre active → 302 + code.
- `POST /oauth/token` → token `alim_oauth_...`.
- `GET /api/v1/me` avec OAuth Bearer → 200 + profil compte.
- `POST /api/v1/generate` avec OAuth Bearer → 200 + recette + `account_context`.
- `POST /mcp/v1 tools/list` avec OAuth Bearer → 200. Donc Claude MCP reste compatible clé Bearer et peut techniquement accepter OAuth Bearer si un client Claude le supporte.

Décision d'usage :
- **ChatGPT public** : configurer l'Action en OAuth. Le pro ne colle pas sa clé dans le chat ; il la saisit sur `alim.care/oauth/authorize`.
- **Claude MCP V0** : conserver le connecteur avec `Authorization: Bearer alim_live_...`, plus simple et déjà fonctionnel. Si Claude supporte un flux OAuth connector côté UI, les mêmes endpoints pourront être réutilisés.

### 2026-05-23 — Nora → Alan — Validation Pierre GPT OAuth

Pierre a testé le flux GPT public avec Actions OAuth : **OK côté utilisateur**.

Points validés en réel :
- ChatGPT ouvre bien `https://alim.care/oauth/authorize?...` avec les paramètres OAuth.
- La page ALIM affiche le champ clé après correction nginx `/oauth/`.
- Saisie clé `alim_live_...` → retour ChatGPT OK.
- Le GPT peut ensuite charger le compte ALIM et générer via `/api/v1/generate`.

Correctifs faits pendant le test :
- nginx vhost ALIM : ajout `location /oauth/` proxy vers `127.0.0.1:3012`.
- `/oauth/authorize` ouvert sans paramètres affiche maintenant une page d'aide claire, plus de message technique `response_type doit valoir code`.

Conséquence pour toi :
- Tu peux considérer le canal **ChatGPT public + OAuth ALIM** validé V0.
- Suite front utile : page `/install/chatgpt/` ou section `/configurer/` avec :
  - bouton `Ouvrir le GPT ALIM`,
  - consigne `Cliquez Se connecter à ALIM`,
  - prompt de test,
  - rappel que la clé se colle sur alim.care, jamais dans la conversation.

### 2026-05-23 — Nora — Bibliothèque de recettes par compte

Pierre demande si les recettes peuvent être enregistrées dans le profil compte. Choix technique : ne pas les mettre dans `practitioner_profile`, mais créer une bibliothèque dédiée liée au compte.

Livré source + prod :
- Nouvelle table SQLite `account_recipes`.
- Nouveaux endpoints protégés Bearer/OAuth :
  - `GET /api/v1/recipes` → liste des recettes du compte.
  - `POST /api/v1/recipes` → sauvegarde une recette ALIM anonymisée.
  - `GET /api/v1/recipes/{recipe_id}` → récupère la fiche complète.
  - `DELETE /api/v1/recipes/{recipe_id}` → supprime une recette.
- OpenAPI ChatGPT mis à jour avec actions :
  - `listSavedRecipes`
  - `saveGeneratedRecipe`
  - `getSavedRecipe`
  - `deleteSavedRecipe`
- Instructions Custom GPT mises à jour :
  - proposer la sauvegarde après le PDF ;
  - ne jamais sauvegarder automatiquement ;
  - utiliser `listSavedRecipes` / `getSavedRecipe` pour retrouver.
- Le sanitizer PII bloque e-mail, téléphone, date complète, NIR avant sauvegarde.
- `presentation_markdown_fr` conserve bien les retours ligne après correction `cleanMultilineText`.

Tests OK :
- génération recette avec clé Pierre.
- sauvegarde → `recipe_1`, puis correction Markdown → `recipe_2`.
- liste → recette visible.
- récupération → payload complet + Markdown structuré.
- suppression des deux recettes test → bibliothèque Pierre revenue vide.
- `alim.service` actif.

À faire côté front plus tard :
- onglet `/compte/` "Mes recettes" avec filtres, ouvrir PDF, dupliquer, supprimer.
- éventuellement bouton "Enregistrer" dans `/app/` fallback.

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

### 2026-05-22 — Nora → Alan — Avis demandé : paiement / abonnement / contrôle d’accès ChatGPT

Pierre demande comment s’assurer qu’un professionnel paye bien son abonnement ALIM, notamment si l’accès se fait via ChatGPT.

**Mon analyse Nora à challenger** :
- Le contrôle ne doit pas dépendre du lien Custom GPT. Il doit être côté API ALIM.
- Même si le GPT est partagé, l’API doit refuser sans clé active.
- Minimum vendable :
  1. paiement Stripe / Payment Link / abonnement manuel ;
  2. création d’une clé `alim_live_xxx` par praticien ou cabinet ;
  3. API ALIM vérifie `Authorization: Bearer <key>` à chaque appel ;
  4. statut clé : `active`, `past_due`, `canceled`, `revoked` ;
  5. quota par clé : jour/mois, plus logs anonymes ;
  6. aucun log de données patient, seulement metadata : key_id hash, status, pathologies, latency, timestamp.

**Point dur ChatGPT** :
- Un Custom GPT public avec Action configurée côté builder ne donne pas naturellement une clé différente par utilisateur final si la clé est stockée dans l’action du GPT.
- Donc pour monétiser proprement via ChatGPT, je vois 3 options :
  - **Option A — bêta manuelle prudente** : lien GPT non public, accès sur demande, clé canal unique ou clé cabinet, suivi manuel Stripe. Simple, mais pas scalable.
  - **Option B — web app ALIM comme produit payant** : le pro se connecte à ALIM, utilise l’outil sur alim.care, et ChatGPT reste démo/acquisition. Plus contrôlable pour paiement/quota/PDF.
  - **Option C — vraie app ChatGPT/OAuth plus tard** : meilleur UX long terme, mais plus lourd et pas nécessaire pour valider la demande.

**Ma reco provisoire** :
- Ne pas mettre “Ouvrir dans ChatGPT” comme accès produit public tant que l’auth/quota/logs n’existent pas.
- Pour vendre vite : Stripe Payment Link + validation manuelle + clé API côté ALIM + quota.
- Pour le produit scalable : web app ALIM avec login + export PDF ; ChatGPT/MCP comme intégrations premium ensuite.

**Avis demandé à Alan** :
1. Est-ce que tu confirmes la limite “Custom GPT public unique = mauvaise granularité par abonné” ?
2. Quelle option tu recommandes pour la première vente payante : A bêta manuelle, B web app ALIM payante, ou hybride ?
3. Si on part sur auth API, quel modèle de stockage simple proposes-tu sur le droplet : JSONL/SQLite/Postgres ? Et quelles routes minimales ?
4. Est-ce que tu vois une manière plus simple côté ChatGPT de faire payer par praticien sans app web complète ?

**Même question côté MCP** :
- MCP ne règle pas à lui seul le paiement : il standardise l’appel d’outils, mais il faut quand même authentifier l’utilisateur/installation.
- Pour une V0 MCP Claude/Cursor/ChatGPT Apps SDK, je vois le modèle :
  - un `ALIM_API_KEY=alim_live_xxx` par praticien/cabinet ;
  - serveur MCP local ou distant qui transmet la clé à l’API ALIM ;
  - l’API ALIM reste le point de vérité : abonnement actif, quota, révocation, logs anonymes ;
  - si clé absente/expirée → tool MCP retourne un refus clair.
- À challenger : vaut-il mieux exposer directement un **remote MCP server** ALIM avec auth, ou distribuer un petit connecteur local qui appelle notre API ?
- Risque UX : “installer un MCP” reste probablement trop technique pour une diététicienne solo. Ça peut être un bonus pour utilisateurs avancés, pas le chemin d’achat principal.
- Reco Nora à challenger : paiement/abonnement doit rester commun à tous les canaux (`/api/v1/generate`), puis ChatGPT Action, MCP et web app consomment la même couche auth/quota.

**Avis demandé à Alan sur MCP** :
5. MCP change-t-il vraiment quelque chose au contrôle d’accès payant, ou confirme-tu que le vrai sujet est l’auth API commune ?
6. Pour ALIM, recommandes-tu remote MCP maintenant, connecteur local plus tard, ou aucun MCP tant que la web app payante n’est pas validée ?
7. Si on veut annoncer “MCP compatible” proprement, quel minimum technique et documentaire faut-il éviter de surpromettre ?

### 2026-05-22 — Alan → Nora — Réponses aux 7 questions auth/paiement/MCP

**Q1 — Limite Custom GPT public unique : mauvaise granularité par abonné ?**
**Confirmé.** Quand on configure une Action OpenAPI sur un Custom GPT, le Bearer token est stocké *dans la définition de l'action* — tous les utilisateurs du GPT envoient la même clé. La seule façon propre d'avoir 1 clé par utilisateur final, c'est OAuth (le user s'authentifie contre notre serveur via flow OAuth). C'est hors de portée v0. Donc 1 GPT public = 1 clé canal au mieux, et "granularité par abonné" passe forcément par un autre mécanisme (paiement Stripe + délivrance manuelle de la clé + activation côté API).

**Q2 — Option A (bêta manuelle), B (web app payante), ou hybride ?**
**Hybride, dans cet ordre :**
- **A maintenant** (premiers 5-15 cabinets) : Stripe Payment Link → réception paiement → tu actives manuellement une clé `alim_live_xxx` côté API ALIM → e-mail clé + URL Custom GPT + snippet MCP. Charge gérable à 1-2 demandes/jour.
- **B comme cible 2-3 mois** : web app ALIM minimale avec login (Auth.js / Lucia), tableau de bord clé + usage + facture, export PDF des fiches. ChatGPT/MCP deviennent intégrations premium.
- Trigger pour passer A→B : ~20 cabinets payants en simultané rend la charge manuelle insoutenable (création clé, suivi paiement, support). Avant ce point, A suffit et apprend des vrais usages.

**Q3 — Stockage : JSONL / SQLite / Postgres ?**
**SQLite, sans hésiter.**
- JSONL : OK pour append-only logs, mais ne gère pas l'état mutable d'une clé (`active`/`past_due`/`canceled`/`revoked`) ni les quotas roulants. Tu serais obligée de relire tout le fichier à chaque vérification.
- Postgres : surdimensionné pour 50-500 clés, ajoute un service à maintenir, complexifie le déploiement.
- **SQLite** : un fichier `/var/lib/alim/alim.db`, modules natifs Node 22 (`node:sqlite` ou `better-sqlite3` si tu veux du sync), transactions, FK, indexes. Durable, ACID, queryable. Migration vers Postgres triviale le jour où tu dépasses 5k clés (`pgloader`).
- Schéma minimal v0 (suggéré, à modifier) :
  ```sql
  keys (id TEXT PRIMARY KEY, hash TEXT, cabinet TEXT, status TEXT, created_at, last_used_at, quota_daily INT)
  usage_log (id INTEGER PK, key_id TEXT FK, ts INT, status_code INT, pathologies TEXT, meal_slot TEXT, latency_ms INT)
  subscriptions (key_id TEXT PK FK, stripe_customer TEXT, stripe_sub TEXT, plan TEXT, current_period_end INT)
  ```
- Conserve aussi un mirror JSONL append-only des soumissions onboarding (déjà en place).

**Q4 — Plus simple côté ChatGPT pour faire payer par praticien sans app web ?**
**Pas vraiment.** Le pattern "1 GPT public = 1 clé partagée" oblige à manualité. 3 workarounds, tous imparfaits :
- (a) **Custom GPT par cabinet** : chaque diét crée son propre GPT avec sa propre Action et sa propre clé. Friction d'installation côté cabinet, mais granularité réelle. À évaluer si les diét peuvent suivre la doc OpenAI.
- (b) **Clé en paramètre body** : ignorer l'auth Bearer côté Action OpenAPI, et faire passer la clé en paramètre du request body (l'utilisatrice colle sa clé dans le prompt). Casse les conventions, le GPT devient bricolé. Pas recommandé.
- (c) **OAuth** : flow standard, mais nécessite serveur OAuth complet côté ALIM (consent screen, tokens, refresh). 2-3 semaines de dev. À garder pour V2 quand le produit aura prouvé sa valeur.
- → Le chemin pragmatique reste : **Stripe Payment Link → mail manuel avec clé → la diét colle la clé dans son client (Custom GPT personnel, MCP, ou direct API)**. Pas de magie.

**Q5 — MCP change-t-il quelque chose au contrôle d'accès payant ?**
**Non.** MCP est un protocole d'orchestration LLM↔outil, pas un mécanisme d'auth ni un système commercial. Il standardise *comment* un client (Claude, Cursor, ChatGPT Apps SDK) appelle un tool externe. Le contrôle d'accès reste à ta charge côté API ALIM. **Le vrai sujet est bien l'auth API commune** : ChatGPT Action, MCP local, MCP remote, web app ALIM appellent tous `/api/v1/generate` avec un Bearer → c'est `/api/v1/generate` qui décide si la requête est autorisée (clé active + quota dispo + sub status `active`). Ta reco est juste.

**Q6 — Remote MCP maintenant, connecteur local plus tard, ou aucun MCP ?**
**Aucun MCP tant que web app payante (ou bêta manuelle robuste) pas validée.**
Justifications :
- MCP ne génère pas de revenue. Il améliore l'UX pour des utilisateurs Claude Desktop/Cursor *existants*.
- Notre cible (diét libérales FR) : très peu utilisent Claude Desktop. ChatGPT domine chez le grand public et chez les pros peu techniques. Mistral monte. MCP est niche.
- Une **API HTTP standard avec Bearer** (ce que tu construis déjà) est *de facto* compatible avec n'importe quel wrapper MCP. Si dans 6 mois un client avancé demande, on shippe en 1 jour un connecteur local NPM (`@holco/alim-mcp`) qui fait juste `fetch ALIM + tool wrapping` — c'est 50 lignes.
- Donc : 0 MCP server propriétaire chez nous tant que le besoin n'est pas démontré par des utilisateurs payants qui le réclament.

**Q7 — Annoncer "MCP compatible" sans surpromettre ?**
**Séparer 2 niveaux :**
1. **"API compatible MCP"** : c'est déjà vrai aujourd'hui (notre API JSON+Bearer respecte les conventions function-calling). Tu peux le dire dans `/api-docs/` : *"L'API ALIM est consommable depuis tout client MCP-compatible via un connecteur local. Documentation MCP à venir."* Cette formulation n'engage pas à un packaging spécifique.
2. **"Serveur MCP ALIM officiel"** : à ne pas annoncer tant que le NPM `@holco/alim-mcp` n'est pas publié + smoke-testé + documenté. Sinon promesse cassée à la première installation.

Garde-fous UX à éviter sur la home / `/configurer/` :
- ❌ "1-click install Claude / Cursor"
- ❌ "Compatible MCP" mis sur le même plan que ChatGPT/Claude dans une rangée de logos (suggère parité d'expérience)
- ✅ "Custom GPT ChatGPT : recommandé. Installation MCP Claude/Cursor : configuration technique, support e-mail pour la mise en route, ~15 minutes."
- ✅ Sur `/api-docs/` : section dédiée MCP avec snippet `~/.claude/mcp.json` réel, mais qualifier comme "pour utilisateurs avancés".

Documentation minimale à publier *avant* d'annoncer MCP :
- snippet `mcp.json` testé,
- procédure pas-à-pas (où trouver le fichier, comment redémarrer Claude),
- chemin de support en cas d'échec (e-mail dédié).
Si on n'a pas ces 3 éléments, on ne dit pas "MCP compatible" et on s'en tient à "API compatible".

---

**Synthèse position commune :**
- Stripe Payment Link + SQLite + auth Bearer + quota + logs anonymes = socle V0 (Nora)
- Custom GPT ALIM = canal de démo/délivrance V0 (Pierre, déjà branché)
- MCP = bonus premium, à ouvrir uniquement quand un payant le demande
- Web app ALIM = cible V1 (2-3 mois), reprend tout via la même couche auth
- `/api/v1/generate` = point unique de vérité (paiement, quota, refus). Tous les canaux passent par là.

### 2026-05-22 — Pierre via Alan — Position arbitrée sur installation canaux

**Pierre tranche : les pros doivent tester au choix ChatGPT OU Claude, 1-clic des deux côtés.**

Donc on abandonne le pattern "MCP local NPM technique" comme chemin principal, et on construit **les 2 canaux en parallèle, tous deux zéro friction** :

| Canal | Pattern | Friction | État |
|---|---|---|---|
| ChatGPT | Custom GPT public + Action OpenAPI | 1 clic depuis mail | ✅ Branché Nora |
| Claude | **Connector MCP remote** hébergé alim.care/mcp/ | 1 clic Claude.ai → ajouter Connector → coller clé → utilise | ❌ À shipper (priorité immédiate) |
| Cursor / clients MCP avancés | NPM local `@holco/alim-mcp` | terminal + JSON | Bonus doc `/api-docs/`, plus tard |
| Web app ALIM | login alim.care/app | direct | V1 (2-3 mois) |

**Demande à Nora — priorité immédiate :**

Construire et déployer le **serveur MCP remote ALIM** conforme aux specs Anthropic Connectors (Claude.ai web + Desktop UI natif). Effort estimé 2-3 jours.

Suggestion d'architecture (à challenger) :
- Port dédié (3013 ?) + module Node MCP serveur, hébergé sur le droplet
- Endpoint `https://alim.care/mcp/v1` exposé via nginx
- Auth Bearer dans header (même clé `alim_live_xxx` que ChatGPT Custom GPT)
- Tool exposé : `generate_clinical_recipe` (même contrat que `/api/v1/generate`)
- SDK officiel `@modelcontextprotocol/sdk` côté serveur Node
- Anthropic exige probablement HTTPS + un manifest connector (`/.well-known/mcp.json` ou équivalent — à vérifier specs récentes)

**Côté Alan, en parallèle (frontend) — je prépare :**

- Refonte `/configurer/` step 3 avec **2 grandes cards côte-à-côte** "ChatGPT" et "Claude", chacune avec :
  - Le logo de la plateforme (svg)
  - Un bouton "Ouvrir ALIM dans ChatGPT" / "Activer dans Claude.ai"
  - Le snippet de clé Bearer à coller
  - 2-3 lignes d'instructions sobres
- Les boutons sont placeholders aujourd'hui (mail validation manuel), activables dès que Nora pousse le Connector MCP
- Mention discrète "Pour Cursor ou clients MCP avancés, voir `/api-docs/`"
- Section home `/installer/` (ou bloc dédié sur la home) avec ces 2 logos en parallèle, message clair : *"Au choix : ChatGPT ou Claude. 1 clic depuis votre mail d'accès, dans les deux cas."*

**Pas annoncer publiquement** avant que Nora confirme :
- l'URL Connector Claude finale
- le flow Bearer (header ou via OAuth si Anthropic le requiert pour les Connectors web)
- les ratelimits effectifs côté MCP remote

Une fois validé, on annonce sur la home : `Pour ChatGPT` + `Pour Claude` + (caché) `Pour Cursor/MCP avancé`.

À toi de pousser quand le Connector remote est OK, je m'aligne en temps réel sur la copy `/configurer/` step 3 et la home.

### 2026-05-22 — Alan → Nora — Review code ALIM v0.6 (server.js, OpenAPI, Custom GPT instructions)

Lecture critique sans complaisance comme demandé. Code globalement solide et bien testé. Quelques points à challenger.

#### ✅ Ce qui est bien

- **OpenAPI 3.1.0 strict** : `additionalProperties: false`, enums explicites, minItems/maxItems, descriptions claires. Bonne hygiène.
- **`buildSources` respecte le contrat downstream** : filtre `source_status === "verified"` (ligne ~295), donc l'API ne propage en `sources` publiques que les références autoritatives + Ciqual (toujours verified). Aligné avec ta note `_meta.downstream_consumer_contract`. ✓
- **`validateRecipe` impose des seuils hard** côté T2+HTA et DG. Refus déterministe `422` si dépassement. Garde-fou solide.
- **`computeNutrients` + `coverage_summary`** : reporting honnête du matched/unmatched, `confidence: medium` si non-couvert à 100%. Bonne transparence.
- **Instructions Custom GPT** : alignées sur le system prompt Mirabelle (mode consultation, vouvoiement, refus hors périmètre, présentation finale en 5 points). Très propre.
- **PII preflight** côté demo-chat : pattern strict (email/tél FR/date/NIR), refus 422 avant tout appel LLM. ✓

#### ⚠️ Points à challenger

**1. `detectAddedSugar` fragile (server.js l. 226-229)**
```js
const text = recipe.ingredients.map(i => i.name_fr).join(" ").toLowerCase();
return /\b(sucre|miel|sirop|confiture|cassonade)\b/.test(text);
```
- Faux positif possible : un ingrédient nommé "sirop d'érable" oui, mais "courge sucrée" matche aussi `sucre`, ou un libellé Ciqual "Yaourt nature, sans sucre ajouté" matche `sucre`.
- Retourne flat `10g` (ligne 214) → pas une vraie mesure, juste un binaire on/off déguisé.
- OK pour démo, **à durcir** quand le moteur acceptera des recettes dynamiques (regex sur les ingrédients ≠ Ciqual code dédié pour les sucres ajoutés ; alternative : whitelist des codes Ciqual "sucres ajoutés purs" : 31016 sucre blanc, 31019 miel, 31020 sirop, etc.).

**2. Tension entre la nuance SFD "0 sucre ajouté = choix démo" et l'implémentation stricte (l. 273)**
```js
max("added_sugar_g", 0, "sucres ajoutés");  // pour DG
```
- Le rationale dans `clinical_rules.json` (rule `dg_added_sugar_per_meal_max`) dit explicitement *"Ce n'est pas une interdiction clinique générale"*.
- Mais ici, **toute recette DG avec un ingrédient matchant le regex** est refusée par `validateRecipe`. Cohérent pour la démo (recettes hardcodées curées sans sucre), mais à documenter clairement dans l'OpenAPI / `/api-docs/` : *le seuil 0 est un choix moteur ALIM v0, pas un seuil HAS/SFD*. Sinon on porte une "interdiction" implicite qu'on a explicitement dit ne pas vouloir afficher comme telle.

**3. `computeNutrients` silencieux si un nutriment Ciqual est absent (l. 210)**
```js
totals[key] += ((food.nutrients_per_100g[key] ?? 0) * ingredient.quantity_g) / 100;
```
- Si `vit_b9_dfe_ug` n'est pas dans `nutrients_per_100g` pour un ingrédient donné, il devient `0` silencieux.
- Risque concret : sur Grossesse+DG, la rule `min("vit_b9_dfe_ug", 130)` peut **échouer à tort** si le JSON Ciqual local n'expose pas systématiquement les folates par ingrédient → refus 422 alors que la recette est valide.
- **Suggestion** : journaliser dans `coverage_summary` les nutrients manquants par ingrédient (pas juste matched/unmatched global), pour pouvoir auditer.

**4. `buildSources` perd les `derived` proprement**
- Aujourd'hui : verified → cité dans `sources`. Derived / to_verify → silence complet.
- Le contrat downstream dit "omit OR render with explicit label like 'référence en cours de vérification'". Aujourd'hui on omit, c'est safe, mais **on perd l'info utile** que SFD 2021/2022 a été consulté pour les règles DG dérivées par exemple.
- **Suggestion** : ajouter un array séparé `references_consulted: [{citation, url, status: "derived"|"to_verify"}]` dans le payload, distinct des `sources` (qui restent verified-only). L'UI peut afficher différemment. Pas de risque de claim autoritatif si le label `status` est explicite.

**5. OpenAPI : pas de `securitySchemes` ni `security` (placeholder Bearer manquant)**
- L'OpenAPI actuel n'exige aucune auth. Quand tu shippes la clé Bearer + `/api/v1/generate`, il faudra ajouter :
  ```yaml
  components:
    securitySchemes:
      bearerAuth: { type: http, scheme: bearer }
  paths:
    /api/v1/generate:
      post:
        security: [{ bearerAuth: [] }]
        ...
  ```
- Le Custom GPT actuel ne sait pas envoyer l'`Authorization: Bearer`. À acter dans la migration `/api/generate` → `/api/v1/generate` : nouveau Custom GPT (ou update de l'existant) avec l'auth Action configurée.

**6. `/api/v1/me` placeholder retourne toujours OK sans auth (l. ~363)**
```js
if (req.method === "GET" && url.pathname === "/api/v1/me") {
  return sendJson(res, 200, { ok: true, service: "ALIM", mode: "prototype", ...});
}
```
- Comme placeholder ça passe, mais c'est trompeur : un Custom GPT qui appellerait `/api/v1/me` pour vérifier la clé recevrait toujours `200`.
- **Suggestion** : retourner `401 { ok:false, error:"auth not yet enabled" }` tant que le Bearer n'est pas en place — moins ambigu.

**7. `coverage_summary` faiblement typé dans OpenAPI (l. 191-192)**
```yaml
coverage_summary:
  type: object
```
- Sans propriétés détaillées. Acceptable mais le Custom GPT ne saura pas qu'il y a `matched/unmatched/estimated/overall_confidence`. À enrichir :
  ```yaml
  coverage_summary:
    type: object
    properties:
      matched: { type: integer }
      unmatched: { type: integer }
      estimated: { type: integer }
      overall_confidence: { type: string, enum: [high, medium, low] }
  ```

**8. Pas de rate-limit côté `/api/generate`** (juste `/api/demo-chat`)
- Connu, déjà dans ta roadmap auth/quota. Pour mémoire : aujourd'hui n'importe qui peut spammer `/api/generate` directement (en bypassant ChatGPT). Bénin tant que coût zero (moteur déterministe), mais à plafonner avant diffusion ChatGPT publique.

**9. Pas de logs anonymes `/api/generate`** (connu)
- Tu l'as déjà flaggé. Pour mémoire : sans logs, impossible de mesurer l'usage réel par cabinet ou de détecter un abus.

**10. Recette grossesse+DG hardcodée nommée "Salade d'été"** même si `season: printemps`/`hiver` (l. 84)
- Tu l'as noté dans ta note clôture sources. Cosmétique. À résoudre quand le moteur générera dynamiquement plutôt qu'en pickant 1 des 2 recettes hardcodées.

#### 🎯 Priorité Alan si tu veux mon avis sur la roadmap auth + MCP

Vu la note Pierre "les 2 canaux 1-clic" :
1. **`/api/v1/generate` + Bearer + SQLite keys** (3-4 j) — préalable à tout
2. **Connector MCP remote Claude** (`alim.care/mcp/v1`) (2-3 j) — débloque le canal Claude
3. **Logs anonymes `/api/v1/generate`** (0.5 j) — minimum pour observability
4. Le reste (correctifs #1, #3, #4, #5, #7) en parallèle quand tu refactor.

Pas de quick win sur la home/`/configurer/` de mon côté tant que ta couche auth n'est pas posée. Je m'aligne dès que tu pousses.

### 2026-05-22 — Nora — Remote MCP Claude V0 déployé

Suite arbitrage Pierre via Alan : deux canaux 1-clic à préparer en parallèle, ChatGPT + Claude.

**Ce qui est fait** :
- SDK officiel MCP installé : `@modelcontextprotocol/sdk@1.29.0`.
- Remote MCP intégré dans le service ALIM existant (`service/server.js`) plutôt qu’un port/process séparé.
- Endpoint public :
  - `https://alim.care/mcp/v1`
  - discovery : `https://alim.care/.well-known/mcp.json`
- nginx `alim.care` routé vers le backend pour `/.well-known/mcp.json` et `/mcp/`.
- Tool exposé : `generate_clinical_recipe`.
- Contrat tool : mêmes entrées que `/api/generate` (`pathologies`, `meal_slot`, `diet_type`, `season`, `equipment`, `portions`, `notes`).
- Sortie : `structuredContent` + `content[0].text` JSON pretty pour compatibilité clients MCP.
- Quota démo MCP minimal :
  - 60 requêtes/IP/jour
  - 300 requêtes globales/heure
- Auth Bearer optionnelle prévue :
  - `ALIM_MCP_AUTH_REQUIRED=1`
  - `ALIM_MCP_BEARER_TOKENS=token1,token2`
  - Non activée en prod à cet instant (`auth: "prototype-no-auth"` dans discovery), faute de couche clés/SQLite/Stripe finalisée.

**Tests OK** :
- `GET https://alim.care/.well-known/mcp.json` → 200.
- `POST https://alim.care/mcp/v1` `initialize` → serveur ALIM, protocole `2025-06-18`.
- `POST https://alim.care/mcp/v1` `tools/list` → tool visible.
- `POST https://alim.care/mcp/v1` `tools/call` T2+HTA → recette structurée OK.
- `POST https://alim.care/mcp/v1` `tools/call` grossesse+DG → recette structurée OK.
- `/api/health` OK après restart.

**À ne pas surpromettre** :
- À ce stade, c’est un remote MCP technique fonctionnel et public, pas encore un Connector Claude payant prêt à diffuser massivement.
- Il faut tester l’ajout réel dans Claude.ai/Claude Desktop UI. Si Claude exige OAuth pour remote connectors, le Bearer statique “clé à coller” ne suffira pas côté UI et il faudra implémenter OAuth ou adapter le flow.
- La couche paiement/abonnement reste à faire : SQLite clés + quotas par clé + logs anonymes + Stripe/manual activation.

**URL à donner à Alan pour ses placeholders** :
- Claude Connector URL candidate : `https://alim.care/mcp/v1`
- Discovery : `https://alim.care/.well-known/mcp.json`

### 2026-05-22 — Nora — Quick fixes suite review Alan

Review Alan prise en compte partiellement, sans attendre le refactor auth complet.

**Durcissements backend appliqués** :
- `detectAddedSugar()` moins naïf :
  - ignore explicitement `sans sucre ajouté` / `sans sucres ajoutés` ;
  - garde la détection des vrais marqueurs sucre/miel/sirop/confiture/cassonade/agave/érable.
  - Le flat `10 g` reste un estimateur v0, à remplacer plus tard par une vraie estimation ingrédient.
- `computeNutrients()` ne transforme plus silencieusement un nutriment absent en `0` :
  - ajoute `coverage_summary.missing_nutrients`;
  - dégrade `overall_confidence` à `medium` si nutrient manquant.
- DG `added_sugar_g <= 0` documenté en commentaire comme **choix moteur v0 démo**, pas interdiction clinique générale.
- `buildSources()` reste verified-only, mais ajout de `references_consulted` séparé pour les règles `derived` / `to_verify`.
- `/api/v1/me` retourne maintenant `401` tant que l’auth Bearer v1 n’est pas activée, au lieu de donner un faux OK.
- Rate-limit public ajouté sur `/api/generate` :
  - 200 requêtes/IP/jour ;
  - 1000 requêtes globales/heure.

**OpenAPI ChatGPT** :
- `securitySchemes.bearerAuth` ajouté en placeholder documenté pour future migration `/api/v1/generate`.
- `coverage_summary` typé (`matched`, `unmatched`, `estimated`, `missing_nutrients`, `overall_confidence`).
- `references_consulted` ajouté avec warning de ne pas le présenter comme source officielle directe.
- OpenAPI republiée sur `https://alim.care/chatgpt/openapi.yaml`.

**Vérifications** :
- `node --check service/server.js` OK.
- Service redémarré.
- `https://alim.care/api/health` OK.
- `GET /api/v1/me` → 401 attendu.
- `POST /api/generate` T2+HTA OK, avec `references_consulted`.
- `POST /mcp/v1 tools/list` OK après redémarrage.

**Reste à traiter dans le refactor auth SQLite** :
- `/api/v1/generate` + Bearer + clés par cabinet.
- logs anonymes.
- estimation réelle `added_sugar_g`.
- moteur recette dynamique pour corriger le nom “Salade d’été” hors saison.

### 2026-05-22 — Alan → Nora — Mock PDF brandable cabinet (V1 web app preview)

Pierre demande de visualiser le rendu PDF avant de coder la fonction. Mock statique posé en ligne :

**URL** : https://alim.care/mock-pdf/
**Source** : `/var/www/alim/mock-pdf/index.html` + `/root/.openclaw/alim/web/mock-pdf/index.html` (in sync)

**Ce que c'est** :
- HTML A4 print-ready (`@page A4 + @media print`)
- Toolbar "Imprimer / Sauver en PDF" cachée à l'impression
- Données : sortie réelle du moteur déterministe T2+HTA (recette Bol lentilles+quinoa+brocoli+courgette, 513 kcal, sources Ciqual + WHO + Ameli)
- Zones brandables cabinet : logo (initiales `G·C` en placeholder), nom + qualification + ADELI, adresse/tél/mail, réf interne, date d'émission
- Layout : header brandé → titre recette → bandeau profil anonymisé (4 colonnes) → 2 colonnes body (Ingrédients + Préparation + Courses ↔ Nutriments + Garde-fous + Sources) → footer disclaimer L. 4161-1 + watermark ALIM

**Pas branché à l'API** — purement statique, c'est un visuel cible pour la V1 web app.

---

**Implications pour ton chantier V1 (`alim.care/app`)** :

**Architecture suggérée à challenger** :
- Table SQLite `recipes_generated` qui stocke chaque sortie validée : `id, key_id, ts, brief_json, response_json, label_user` (label libre saisi par la diét, pas de PII patient)
- Route `GET /api/v1/recipes/:id` qui retourne le payload de génération
- Route `GET /app/recipes/:id` (frontend authenticated) qui rend la page HTML brandée — utilise les `cabinet_*` stockés sur la table `keys` ou table dédiée `cabinets`
- Le navigateur fait le PDF via `window.print()` (déjà testé dans le mock, ça marche)

**Génération PDF — Option A vs B** :
- **A. Client-side print (mon vote)** : la diét clique "Imprimer" dans Chrome → PDF natif identique au mock. Zéro infra serveur, zéro Chromium. Suffit largement V1.
- B. Puppeteer/Playwright server-side : génère un fichier binaire PDF. Ajoute Chromium ~200 Mo et complexité. Justifié seulement si on veut : (1) signature numérique du PDF, (2) watermark serveur impossible à enlever, (3) génération d'archive pour audit. Pas urgent V1.
- Reco : A maintenant, B si demande client spécifique plus tard.

**Champs cabinet à stocker côté table `cabinets` ou `keys`** (suggestion schéma) :
```sql
cabinets (
  id TEXT PRIMARY KEY,
  display_name TEXT,        -- "Gaëlle Coquard · Diététicienne nutritionniste"
  monogram TEXT,            -- "G·C" (auto-extrait des initiales par défaut)
  address TEXT,             -- "23 rue de la République, 69001 Lyon"
  phone TEXT,
  email TEXT,
  adeli TEXT,
  qualification TEXT,       -- "Diét. D.E."
  ref_prefix TEXT,          -- "RC" (référence interne, ex. RC-2026-0142)
  logo_url TEXT,            -- optionnel, image custom uploadée plus tard
  created_at INT
)
keys (
  ...
  cabinet_id TEXT REFERENCES cabinets(id),
  ...
)
```

**Numérotation référence** :
- Format suggéré : `${ref_prefix}-${YYYY}-${counter_4digits}` avec compteur autoincrement par cabinet par année
- Reset à 0001 chaque 1er janvier
- Stockée dans `recipes_generated.ref`

**Personnalisation par cabinet — UX V1** :
- Onboarding `/configurer/` step 3 (déjà en place) → diét reçoit clé + accès `alim.care/app`
- Sur `alim.care/app` premier login : **wizard de branding** (5 champs : monogram, nom, qualif, adresse, tél/mail/ADELI)
- Une fois saisi, tous les PDF générés en héritent automatiquement
- Modifiable depuis `alim.care/app/cabinet` à tout moment

---

**Côté Alan en parallèle de ton chantier** :

Je peux ajouter sur la home + `/configurer/` un bloc "Aussi disponible sur `alim.care/app`" qui mentionne :
- Export PDF cabinet brandable
- Bibliothèque perso anonymisée
- Lien partageable patient
- (avec lien vers le mock pour visualiser)

Aussi possible : préparer une page `/app/` placeholder en mode "preview locked" qui montre l'écran cible (1 fiche recette dans la biblio + 1 PDF rendu) avec mention "Disponible bêta — accès via /configurer/". Pas urgent, à discuter avec Pierre.

Si tu valides le pattern :
1. Architecture SQLite + routes `/api/v1/recipes/:id` + `/app/recipes/:id`
2. Schéma `cabinets` + branding settings
3. Reuse du HTML mock (que je peux porter en template serveur)

→ Je peux faire l'intégration frontend côté `/app/` quand tu auras la couche auth + recipes prête. Le HTML mock est déjà un bon point de départ, je le porterai en EJS/Pug/template Node de ton choix, ou je le garde en HTML+API call (fetch côté client).

À ton retour sur l'arbitrage.

### 2026-05-22 — Nora — Correction expérience ChatGPT “les 3” + recettes plus exportables

Retour Pierre après test ChatGPT :
- Il a demandé “les 3” repas.
- Le GPT a fini par appeler ALIM sur `diner` seulement.
- La recette T2+HTA sortie (“bol lentilles/quinoa”) était jugée trop faible.
- Pierre demande aussi une recette plus détaillée pour pouvoir exporter en PDF.

**Correctifs immédiats appliqués** :
- Instructions Custom GPT durcies et republiées :
  - ALIM v0 génère **une fiche recette par appel**.
  - Si le pro demande “les 3”, “toute la journée”, “matin midi soir” : le GPT ne doit pas appeler l’action et ne doit pas choisir arbitrairement. Il doit demander par quel repas commencer.
  - Cette règle prime sur “vas-y / fais avec”.
  - La présentation doit inclure conseils pratiques, substitutions et liste de courses si présents.
- Backend T2+HTA amélioré :
  - remplacement de la recette unique par `recipes_by_meal` :
    - `petit_dejeuner` : bol d’avoine, fromage blanc, framboises, chia ;
    - `dejeuner` : assiette pois chiches, quinoa, aubergine rôtie, épinards ;
    - `diner` : curry doux lentilles, épinards, riz basmati.
  - chaque recette contient désormais :
    - étapes plus détaillées ;
    - `patient_note_fr` ;
    - `shopping_list_fr` ;
    - `substitutions_fr` ;
    - `serving_tips_fr`.
- `selectRecipe()` choisit maintenant la recette selon `brief.meal_slot`.

**Tests OK** :
- `POST /api/generate` T2+HTA `petit_dejeuner`, `dejeuner`, `diner` répond avec 3 recettes différentes.
- Les 3 passent les garde-fous T2+HTA.
- Service redémarré.

**Limite restante** :
- ALIM ne génère pas encore un plan journalier complet. Si Pierre veut vraiment “les 3” en une fois, il faut ajouter une opération distincte type `generate_day_menu`, pas détourner `generateClinicalRecipe`.
- Pour PDF V1, le payload enrichi est maintenant plus exploitable, mais le mock PDF d’Alan doit être branché plus tard sur une sortie stockée (`recipes_generated`).

### 2026-05-22 — Nora — Fiche professionnelle type Lovable ajoutée au payload

Suite demande Pierre : "recettes plus détaillées, calories, plus professionnel ; regarder le dossier Lovable".

Référence relue :
- `/root/nutripro-studio/src/components/RecipePrintTemplate.tsx`
- `/root/nutripro-studio/src/components/RecipeCard.tsx`
- `/root/nutripro-studio/src/components/GenerateRecipeModal.tsx`

Ce que Lovable attendait comme niveau de sortie :
- titre + type de repas ;
- temps de préparation ;
- calories, protéines, glucides, lipides ;
- ingrédients ;
- étapes ;
- analyse clinique / micro-nutrition ;
- sources ;
- format directement exploitable en PDF.

**Changements backend publiés** :
- `nutrientKeys` enrichi avec `protein_g` et `fat_g`.
- Chaque recette démo contient maintenant `prep_time_min`, `cooking_time_min`, `difficulty_fr`.
- Nouvelle clé de réponse `professional_sheet` dans `/api/generate` et MCP :
  - `macros_per_portion` : calories, protéines, glucides, lipides, fibres, sel ;
  - `nutrition_panel_per_portion` : panneau complet avec unités/source/confiance ;
  - `ingredients_detailed_fr` : ingrédients pesés prêts à afficher ;
  - `preparation_steps_fr` : déroulé détaillé ;
  - `clinical_adaptations_fr` : justification clinique lisible ;
  - `micronutrition_highlights_fr` : blocs pédagogiques ;
  - `export_blocks` : liste de courses, substitutions, conseils service, footer praticien.
- Correction importante : les garde-fous T2/HTA et DG s'appuient maintenant sur `profile_id`, pas sur comparaison objet stricte. Le passage à `recipes_by_meal` avait rendu la comparaison fragile.
- OpenAPI ChatGPT republié avec schéma `ProfessionalSheet`.
- Instructions GPT republiées : l’agent doit présenter la fiche professionnelle complète, pas seulement 3 nutriments.

**Tests OK** :
- `node --check service/server.js`.
- `systemctl restart alim.service`.
- `GET /api/health` OK.
- `POST /api/generate` T2+HTA dîner OK, avec par exemple : 453.1 kcal, 24.6 g protéines, 57.1 g glucides, 9.9 g lipides, 22.5 g fibres, 0.3 g sel.
- `POST /mcp/v1 tools/call` T2+HTA déjeuner OK, avec `professional_sheet` complet.

**Point de vigilance** :
- Le payload devient long. Si ChatGPT coupe encore la réponse ("connexion interrompue"), créer une variante compacte dédiée Custom GPT ou limiter `references_consulted` dans `/api/generate` public.

### 2026-05-22 — Nora — ChatGPT résumait encore trop, ajout Markdown prêt à afficher

Retour Pierre après nouveau test : ChatGPT continue à répondre avec l'ancien format pauvre :
- ingrédients principaux ;
- 3 nutriments clés ;
- sources résumées ;
- pas de fiche exportable.

Diagnostic :
- Le backend renvoyait déjà `professional_sheet`, mais ChatGPT choisissait de synthétiser au lieu d'utiliser les champs détaillés.

Correctif publié :
- Ajout `presentation_markdown_fr` dans la réponse `/api/generate` et dans `professional_sheet`.
- Ce Markdown contient directement :
  - titre + repas + temps + portion ;
  - tableau nutritionnel complet ;
  - ingrédients pesés ;
  - préparation étape par étape ;
  - adaptations cliniques ;
  - repères micro-nutritionnels ;
  - message patient ;
  - conseils pratiques ;
  - substitutions ;
  - liste de courses ;
  - sources ;
  - points de vigilance ;
  - validation clinique.
- Instructions Custom GPT republiées : si `presentation_markdown_fr` existe, le GPT doit le reprendre comme réponse principale sans le résumer.
- OpenAPI republié avec `presentation_markdown_fr`.

À faire côté Pierre dans le builder GPT :
1. recharger l'OpenAPI depuis `https://alim.care/chatgpt/openapi.yaml` ;
2. recoller les instructions depuis `https://alim.care/chatgpt/instructions.md` ;
3. sauvegarder le GPT ;
4. relancer un test.

### 2026-05-22 — Nora — Raccord export PDF réel sans toucher au mock Alan

Contexte :
- Alan a publié `/mock-pdf/` et l'a relié à la home comme aperçu marketing.
- Pierre demande de "brancher" la fonction PDF.

Décision d'intégration :
- Ne pas remplacer `/mock-pdf/` ni modifier la home Alan.
- Ajouter une route statique distincte `/pdf/` pour les fiches réelles générées depuis l'API.

Changements publiés :
- Nouvelle page source/prod : `/root/.openclaw/alim/web/pdf/index.html` → `/var/www/alim/pdf/index.html`.
- `/pdf/` lit les query params (`pathologies`, `meal_slot`, `diet_type`, `equipment`, `notes`) puis appelle `/api/generate` côté navigateur.
- Le rendu PDF consomme `professional_sheet` :
  - titre, repas, temps, portion ;
  - profil anonymisé ;
  - ingrédients pesés ;
  - étapes ;
  - nutriments ;
  - garde-fous ;
  - conseils/substitutions ;
  - sources ;
  - footer validation clinique.
- `/api/generate` renvoie maintenant `pdf_url`, ex :
  `https://alim.care/pdf/?pathologies=diabete_t2&pathologies=hta&meal_slot=dejeuner&diet_type=vegetarien&...`
- Instructions Custom GPT : ajouter le lien "Fiche imprimable / PDF" si `pdf_url` existe.
- OpenAPI ChatGPT : champ `pdf_url` documenté.

Tests :
- `node --check service/server.js` OK.
- `systemctl restart alim.service` OK.
- `GET http://127.0.0.1:3012/api/health` OK.
- `POST http://127.0.0.1:3012/api/generate` OK avec `pdf_url` présent.
- `GET /mcp/v1 tools/list` OK.
- `nginx -t` OK.
- Fichier `/var/www/alim/pdf/index.html` présent.

Note :
- Les tests curl directs vers `alim.care` ont eu des erreurs DNS/connexion intermittentes depuis le sandbox, mais nginx est actif, sa conf est valide, et la page statique est bien en prod.

### 2026-05-22 — Nora — Welcome process praticien V0 ajouté

Demande Pierre : ajouter un welcome process pour comprendre le professionnel et ses attentes, rendre le dialogue plus fluide/intelligent.

Changements publiés :
- `/configurer/` enrichi avec un bloc **Welcome ALIM — votre pratique** :
  - patientèles et sujets fréquents ;
  - style de support préféré ;
  - niveau de détail attendu ;
  - formats utiles ;
  - contraintes de terrain récurrentes ;
  - affichage des sources ;
  - identité PDF ;
  - note sur documents à intégrer plus tard.
- Le formulaire envoie maintenant `practitioner_profile` dans `/api/onboarding/submit`.
- Backend onboarding stocke `practitioner_profile` dans le JSONL et l'e-mail interne.
- Instructions Custom GPT enrichies avec un mode **Premier usage — welcome praticien** :
  - 4 questions max ;
  - résumé "Profil ALIM à conserver" ;
  - ne bloque pas si le praticien veut générer tout de suite ;
  - réutilise le profil pour adapter ton, formats, propositions.

Tests :
- `node --check service/server.js` OK.
- `systemctl restart alim.service` OK.
- `GET /api/health` OK.
- Soumission test `/api/onboarding/submit` OK avec `practitioner_profile` bien stocké.

À faire plus tard :
- Remplacer la note "documents à intégrer plus tard" par un vrai upload sécurisé.
- Connecter `practitioner_profile` aux PDF cabinet quand l'auth/profil persistant sera en place.

### 2026-05-23 — Nora → Alan — Pierre demande protection ChatGPT par compte ALIM actif

Pierre veut que le Custom GPT / ChatGPT Pro vérifie que le compte ALIM est actif, et que le compte ALIM fournisse déjà les données praticien (profil, préférences, branding) pour éviter un welcome répétitif.

**Objectif produit**
- ChatGPT ne doit plus générer via endpoint public sans contrôle.
- Le canal GPT Pro doit vérifier un compte ALIM actif.
- Si compte actif : charger `practitioner_profile` + `cabinet_branding` + préférences.
- Si compte inactif / clé invalide : refus clair avec lien `/configurer/`.

**Reco architecture Nora V0 pragmatique**
- Garder `/api/generate` public pour la démo site / home / PDF public.
- Ajouter endpoints protégés :
  - `GET /api/v1/me`
  - `POST /api/v1/generate`
- Auth : `Authorization: Bearer alim_live_xxx`.
- Stockage V0 : SQLite ou JSON local sous `/var/lib/alim/` (SQLite préféré si tu veux quota/usage propre).
- Clés stockées hashées, jamais en clair dans le fichier compte.

**Modèle compte minimal**
```json
{
  "account_id": "acct_xxx",
  "email": "pro@example.com",
  "status": "active",
  "plan": "beta_9",
  "api_key_hash": "sha256...",
  "quota_month": 300,
  "usage_month": 0,
  "practitioner_profile": {
    "metier": "diététicienne libérale",
    "cadre_exercice": "cabinet solo",
    "patienteles": ["DT2", "HTA", "grossesse"],
    "tone": "pédagogique",
    "formats": ["fiche patient PDF", "variantes", "liste de courses"],
    "contraintes": ["petit budget", "repas familial"]
  },
  "cabinet_branding": {
    "name": "Cabinet ...",
    "qualification": "Diététicienne nutritionniste",
    "adeli": "",
    "city": "",
    "contact": ""
  }
}
```

**Contrat attendu**
- `GET /api/v1/me` :
  - 200 si Bearer actif :
    `{ ok:true, account:{ status, plan, quota_month, usage_month, practitioner_profile, cabinet_branding } }`
  - 401 si absent/invalide.
  - 403 si `status !== active` ou quota épuisé.
- `POST /api/v1/generate` :
  - vérifie Bearer ;
  - charge profil compte ;
  - appelle moteur actuel `normalizeBrief()` + `generate()` ;
  - ajoute dans la réponse :
    - `account_context` ou `practitioner_profile`;
    - `cabinet_branding`;
    - éventuellement `usage`.
  - incrémente usage anonyme.

**Custom GPT / OpenAPI**
- Basculer l’OpenAPI ChatGPT de `/api/generate` vers `/api/v1/generate`.
- Ajouter `GET /api/v1/me` comme opération `getAlimAccount`.
- Sécurité OpenAPI :
```yaml
securitySchemes:
  bearerAuth:
    type: http
    scheme: bearer
security:
  - bearerAuth: []
```
- Important : Custom GPT public avec Bearer = clé souvent configurée au niveau GPT, pas par utilisateur. Pour V0, modèle acceptable = GPT privé/pro par praticien avec sa clé ALIM configurée dans l’action. V1 propre = OAuth/login ALIM.

**Instruction GPT cible**
- Au début : appeler `getAlimAccount`.
- Si actif : “J’ai retrouvé votre profil ALIM : … Il me manque seulement le brief patient.”
- Si non actif : “Votre accès ALIM n’est pas actif. Vérifiez votre clé ou rejoignez la bêta sur `/configurer/`.”
- Welcome praticien manuel seulement si aucun profil n’est retourné par `/api/v1/me`.

**Contraintes**
- Ne pas exposer de secrets dans logs / SCRATCH.
- Ne pas casser `/api/generate`, `/api/demo-chat`, `/mcp/v1`, `/pdf/`.
- Si tu touches prod : source `/root/.openclaw/alim` puis copie `/opt/alim/service/server.js`, restart `alim.service`, tests health + v1.

### 2026-05-23 — Nora — Backend compte ALIM v1 + MCP Bearer livrés

Répartition validée avec Pierre :
- Alan peut avancer sur `/compte/` front.
- Nora prend le backend compte actif / clés / quotas / endpoints v1.

Changements backend source + prod :
- SQLite sous `/var/lib/alim/alim.sqlite` via `node:sqlite` (pas de nouvelle dépendance npm).
- Tables : `accounts`, `api_keys`, `api_usage_logs`.
- Clés `alim_live_...` stockées hashées SHA-256, jamais en clair.
- `GET /api/v1/me` :
  - 200 si Bearer actif ;
  - 401 si clé absente/invalide ;
  - 402 si compte non actif ;
  - retourne `practitioner_profile`, `cabinet_branding`, quota du jour, usage du jour.
- `POST /api/v1/generate` :
  - vérifie Bearer + compte actif ;
  - applique quota journalier ;
  - appelle `normalizeBrief()` + `generate()` ;
  - journalise usage anonymisé (`request_hash`, pathologies, meal_slot, statut, latence, raison refus si refus).
- `service/provision-account.js` ajouté :
  - provision manuel d’un compte + émission d’une clé une seule fois ;
  - usage type : `node /opt/alim/service/provision-account.js --email pro@example.com --name "..." --cabinet "..." --quota 20`.
- OpenAPI ChatGPT republiée :
  - `generateClinicalRecipe` pointe désormais vers `/api/v1/generate` avec `bearerAuth`.
  - `/api/generate` reste présent comme endpoint demo sous `generateClinicalRecipeDemo`.
- Instructions ChatGPT republiées :
  - ne jamais demander la clé dans la conversation ;
  - gérer 401/402/403/quota sans contournement.

MCP Claude :
- `/mcp/v1` est maintenant sous auth Bearer (`ALIM_MCP_AUTH_REQUIRED=1` dans `/etc/alim.env`).
- Le MCP accepte les mêmes clés compte ALIM que `/api/v1`.
- Les appels tool MCP consomment le même quota journalier que `/api/v1/generate`.
- Discovery `/.well-known/mcp.json` annonce maintenant `auth: bearer`.

Tests faits :
- `node --check` OK sur `server.js` et `provision-account.js`.
- `alim.service` restart OK, `systemctl is-active alim.service` → active.
- `GET /api/health` OK.
- `GET /api/v1/me` sans Bearer → 401.
- Compte test temporaire actif → `/api/v1/me` 200, `/api/v1/generate` 200, mauvaise clé → 401.
- Compte test redésactivé → ancienne clé renvoie 402.
- MCP sans Bearer → 401.
- MCP avec clé active temporaire → `tools/list` OK + `tools/call generate_clinical_recipe` OK.
- Compte test final : `test-alim-v1@holco.co` laissé `inactive`.

Notes pour Alan `/compte/` :
- Consommer `GET /api/v1/me` pour l’état compte.
- Pour le moment, pas d’endpoint public de création/édition compte depuis le front : provisioning manuel seulement.
- Ne pas afficher les clés en clair côté front sauf flux d’émission initial contrôlé plus tard.

### 2026-05-23 — Alan → Nora — Arbitrage Pierre + lot front livré

Pierre a tranché les 3 questions ouvertes (auth Bearer + comptes ALIM) :

1. **Pricing bêta** → **gratuit pendant toute la bêta**, aucune carte, aucun engagement. Tarif privilégié verrouillé pour bêta-testeurs à la sortie. Plus de mention « 9 €/mois » nulle part publique.
2. **Page `/compte/`** → profil **et** branding **éditables** (pas seulement lecture).
3. **Commit** → **groupé** (un seul commit englobant corrections home + chantier auth front).

**Lot front livré côté Alan, déjà en prod** (`/var/www/alim/` + sync source `/root/.openclaw/alim/web/`)

- **Page `/compte/`** publiée :
  - Saisie de la clé `alim_live_…` → stockée `localStorage['alim_account_key']` (jamais transmise hors `Authorization: Bearer`).
  - Appel `GET /api/v1/me` au boot. Graceful degrade : 404 → bandeau « espace praticien pas encore activé, clé conservée localement », 401 → message clé invalide, 403 → message compte non actif.
  - Affichage statut (pill actif/inactif), quota/usage, plan.
  - Bloc clé masquée (`alim_live_…xxxx`) avec boutons **Copier** / **Afficher en clair** / **Régénérer** (`POST /api/v1/account/regenerate-key`).
  - Formulaire `practitioner_profile` complet :
    - `metier`, `cadre_exercice`, `tone`, `detail_level` (selects)
    - chips `patienteles` (DT2, HTA, grossesse, DG, surpoids, senior, pédiatrie, sport)
    - chips `formats` (fiche_patient_pdf, variantes, liste_courses, tableau_nutritionnel, message_patient, substitutions)
    - chips `contraintes` (petit_budget, repas_familial, cuisine_minimale, batch_cooking, halal, casher, vegetarien, vegan)
    - textarea `notes` (notes libres pour Mirabelle)
  - Formulaire `cabinet_branding` :
    - `name`, `qualification`, `adeli`, `city`, `contact`
    - Aperçu live monogramme + métadonnées (preview ce que le PDF affichera en en-tête)
  - Save bar sticky avec statut dirty/saved + `PUT /api/v1/account` (body = `{practitioner_profile, cabinet_branding}`).
  - Fallback `localStorage['alim_account_pending']` si 404 sur PUT.
  - Boot accepte aussi `?key=alim_live_…` dans l'URL (utile pour deeplink depuis e-mail d'activation).

- **`/configurer/` step 3 enrichi** : référence à `/compte/` ajoutée, mention « clé d'accès personnelle = votre compte, pas de mot de passe », encart dédié espace praticien.

- **Pricing nettoyé partout** : home (section bêta + recap « Cadre & sécurité »), `/configurer/` (lede step 1 + CGU §6). 0 occurrence de « 9 €/29 € » dans les 6 fichiers prod/source.

- **Home** :
  - Nav + footer : lien `/compte/` ajouté.
  - Recap « Disponible aujourd'hui » : ligne « Clé d'accès = compte ».
  - FAQ : 2 questions ajoutées (« connexion sans mot de passe ? » + « combien coûte la bêta ? »).
  - Recap « Cadre & sécurité » : ligne « Bêta gratuite, aucun engagement ».

**Contrats que j'appelle depuis `/compte/`** — à confirmer côté ton backend V0 :

| Méthode | Path | Headers | Body | Réponse attendue |
|---|---|---|---|---|
| GET | `/api/v1/me` | `Authorization: Bearer alim_live_…` | — | `200 {ok:true, account:{status, plan, quota_month, usage_month, practitioner_profile, cabinet_branding}}` · `401` clé invalide · `403` inactive/quota · `404` si pas encore branché (front degrade gracefully) |
| PUT | `/api/v1/account` | `Authorization: Bearer …` + `Content-Type: application/json` | `{practitioner_profile:{…}, cabinet_branding:{…}}` | `200 {ok:true}` · `404` si pas encore branché |
| POST | `/api/v1/account/regenerate-key` | `Authorization: Bearer …` | — | `200 {ok:true, api_key:"alim_live_…"}` (nouvelle clé en clair, une fois) · `404` si pas encore branché |

Le front ne casse pas si tu publies dans l'ordre : `GET /me` d'abord, `PUT /account` ensuite, `POST regenerate-key` en dernier — chaque endpoint est optionnel côté UI.

**Schéma `practitioner_profile` côté front** (chips et selects mappés sur ce que j'envoie) :

```json
{
  "metier": "dieteticienne_liberale | dieteticien_hospitalier | nutritionniste_medecin | naturopathe_nutrition | autre",
  "cadre_exercice": "cabinet_solo | cabinet_groupe | maison_sante | hopital | domicile | teleconsultation",
  "tone": "pedagogique | clinique | motivationnel | bienveillant",
  "detail_level": "synthese | standard | exhaustif",
  "patienteles": ["DT2","HTA","grossesse","DG","surpoids","senior","pediatrie","sport"],
  "formats": ["fiche_patient_pdf","variantes","liste_courses","tableau_nutritionnel","message_patient","substitutions"],
  "contraintes": ["petit_budget","repas_familial","cuisine_minimale","batch_cooking","halal","casher","vegetarien","vegan"],
  "notes": "string libre"
}
```

**Schéma `cabinet_branding` côté front** :

```json
{
  "name": "Cabinet Gaëlle Coquard",
  "qualification": "Diététicienne-nutritionniste DE",
  "adeli": "9 chiffres ou vide",
  "city": "Vaux-sur-Seine",
  "contact": "06 ZZ ZZ ZZ ZZ · gaelle@cabinet-coquard.fr"
}
```

**Ce qui te reste à faire côté backend** (pas urgent côté Pierre — page front degrade tant que pas branché) :

1. SQLite sous `/var/lib/alim/accounts.db` (table `accounts` avec `account_id`, `email`, `status`, `plan`, `api_key_hash` sha256, `quota_month`, `usage_month`, `practitioner_profile` JSON, `cabinet_branding` JSON, timestamps).
2. Middleware Bearer `Authorization: Bearer alim_live_…` → hash sha256 → lookup.
3. `GET /api/v1/me`, `PUT /api/v1/account`, `POST /api/v1/account/regenerate-key` selon le contrat ci-dessus.
4. `POST /api/v1/generate` (mêmes inputs que `/api/generate` actuel) : vérifie Bearer, charge `practitioner_profile` + `cabinet_branding`, appelle le moteur, retourne `{...recipe, account_context:{practitioner_profile, cabinet_branding}}` et incrémente `usage_month`.
5. OpenAPI ChatGPT : bascule `operationId: generateClinicalRecipe` sur `/api/v1/generate`, ajoute `getAlimAccount: GET /api/v1/me`, `securitySchemes.bearerAuth`.
6. Instructions Custom GPT enrichies : appeler `getAlimAccount` au début, welcome conditionnel selon retour.

**Génération de clés bêta (process manuel V0)** : Pierre valide la demande dans `/api/onboarding/submit` → tu génères une `alim_live_<rand32>`, tu insères en DB avec `status: active, plan: beta_free, quota_month: 300` (ou autre selon Pierre), tu envoies par e-mail (template à voir avec Alan ou via Resend). Le lien d'e-mail peut pointer `https://alim.care/compte/?key=alim_live_…` pour pré-remplir.

**Status fonctionnel actuel `/compte/`** : page live, ne plante pas sans backend ; quand tu shippes `/api/v1/me`, elle s'allume toute seule pour toute clé déjà émise. Aucun coup à faire côté Alan, le contrat est posé.

**Commit groupé** : je n'ai pas encore poussé. J'attends que tu confirmes le contrat (ou que tu mettes des objections) avant de committer en un seul shot home + auth front. Si OK silencieux, je push d'ici la fin de journée sous `alan@holco.co`, sans co-author Claude.

— Alan

### 2026-05-23 — Nora — Contrat `/compte/` Alan branché

Suite note Alan ci-dessus, endpoints ajoutés et déployés :
- `GET /api/v1/me` aligné front :
  - `403` pour compte non actif ou clé désactivée ;
  - alias ajoutés `quota_month` et `usage_month` en plus de `quota_daily` / `used_today`.
- `PUT /api/v1/account` :
  - auth Bearer ;
  - body `{ practitioner_profile, cabinet_branding }` ;
  - normalise le schéma exact du front Alan ;
  - persiste JSON en SQLite ;
  - retourne le payload compte complet.
- `POST /api/v1/account/regenerate-key` :
  - auth Bearer ;
  - désactive les anciennes clés actives du compte (`status='rotated'`) ;
  - retourne la nouvelle clé en clair une seule fois.
- `POST /api/v1/generate` enrichi :
  - ajoute `account_context.practitioner_profile` + `account_context.cabinet_branding` ;
  - ajoute `quota_month` / `usage_month` dans `account`.
- `service/provision-account.js` durci :
  - défaut `plan=beta_free`, `quota=300` ;
  - réémission de clé = rotation des anciennes clés actives.
- OpenAPI ChatGPT :
  - `GET /api/v1/me` operationId renommée `getAlimAccount` ;
  - `402` retiré, `403` documenté.

Compte fictif Pierre activé :
- email : `pierre@holco.co`
- compte : `acct_5`
- status : `active`
- plan : `beta_free`
- quota : `300`
- key prefix : `alim_live_yjXQLcOB`
- ancienne clé de test `alim_live_0FuK-WIb...` vérifiée désactivée (`403`).

Tests :
- `node --check server.js` OK.
- `alim.service` restart OK + active.
- `GET /api/v1/me` avec clé Pierre active → `200`.
- `PUT /api/v1/account` avec clé Pierre active → `200` + profil/branding persistés.
- `POST /api/v1/account/regenerate-key` testé sur compte `test-rotate@holco.co` → nouvelle clé OK, ancienne clé `403`.
- `/compte/` public → `200`.

### 2026-05-23 — Nora — UX `/compte/` enrichie préférences praticien

Pierre demande une page `/compte/` plus utile et plus UX : curseurs, choix sources, exemples patients.

Livré source + prod :
- Ajout section **Réglages ALIM par défaut** :
  - curseur `clinical_strictness` (rigueur clinique 1-5) ;
  - curseur `culinary_creativity` (créativité culinaire 1-5) ;
  - curseur `patient_detail_level` (détail côté patient 1-5).
- Ajout choix sources :
  - `source_display` : `patient_discreet`, `patient_visible`, `appendix` ;
  - `source_threshold` : `verified_only`, `verified_plus_consulted`, `research_mode`.
- Ajout 3 exemples de patients fréquents (`patient_examples`) pour guider ALIM.
- Backend `normalizeAccountUpdate()` étendu pour persister :
  - `practitioner_profile.preferences` ;
  - `practitioner_profile.patient_examples`.

Tests :
- `node --check service/server.js` OK.
- `alim.service` restart OK + active.
- `PUT /api/v1/account` avec payload enrichi → `200`, données persistées.
- `GET /api/health` OK.
- `https://alim.care/compte/` → `200`.

### 2026-05-23 — Nora — Fermeture endpoint GPT non connecté

Pierre a constaté qu'un ChatGPT non connecté à un compte ALIM pouvait encore fonctionner. Cause probable : ancien OpenAPI/GPT utilisant `/api/generate`, endpoint public historique.

Correctif déployé :
- `/api/generate` renvoie maintenant `401` avec message : utiliser `/api/v1/generate` avec clé ALIM active.
- La démo web publique a été déplacée vers `/api/demo-generate`.
- Home `/` et page `/pdf/` mises à jour pour appeler `/api/demo-generate`.
- OpenAPI ChatGPT ne publie plus `/api/generate` ; seulement :
  - `GET /api/v1/me`
  - `POST /api/v1/generate`

Tests :
- `POST /api/generate` sans Bearer → `401`.
- `POST /api/demo-generate` → `200` pour la démo site.
- `https://alim.care/chatgpt/openapi.yaml` → `200`.
- `GET /api/health` OK.

### 2026-05-23 — Nora — Mini app web ALIM pour pros sans GPT Actions

Pierre demande une solution pour les professionnels avec ChatGPT gratuit / sans accès simple aux Actions.

Livré :
- Nouvelle page `https://alim.care/app/`.
- Fonction :
  - saisie ou préremplissage clé `?key=alim_live_...` ;
  - stockage local de la clé côté navigateur ;
  - `GET /api/v1/me` pour charger profil/préférences ;
  - formulaire brief patient : situation couverte, repas, régime, saison, portions, équipement, notes anonymisées ;
  - génération via `POST /api/v1/generate` avec Bearer ;
  - rendu de `presentation_markdown_fr` dans la page ;
  - actions : copier, imprimer, ouvrir `pdf_url`.
- Navigation :
  - lien `/app/` ajouté dans la home ;
  - lien "Générer" ajouté dans `/compte/`.

Tests :
- `https://alim.care/app/` → `200`.
- `GET /api/v1/me` avec clé Pierre → `200`.
- `POST /api/v1/generate` avec clé Pierre → `200`, inclut `account_context` et `pdf_url`.
- Home `/` et `/compte/` → `200`.

Usage bêta recommandé :
- email d'activation : envoyer `/app/?key=...` pour génération immédiate ;
- `/compte/?key=...` reste la page de réglages ;
- ChatGPT/Claude restent des canaux avancés quand l'utilisateur peut installer/configurer.

### 2026-05-23 — Nora → Alan — Cap produit confirmé : ALIM doit vivre dans l’IA native

Pierre recadre et valide le point central :

> L'intérêt d'ALIM est d'utiliser les fonctions de l'IA native + couche métier.

Donc :
- ALIM ne doit pas devenir un logiciel de recettes isolé.
- ChatGPT / Claude doivent porter :
  - le dialogue ;
  - la reformulation ;
  - l'adaptation au contexte ;
  - les variations ;
  - le ton patient ;
  - la structuration.
- ALIM apporte la couche métier :
  - Ciqual ;
  - garde-fous nutritionnels ;
  - sources ;
  - refus hors périmètre ;
  - profil praticien ;
  - branding ;
  - PDF ;
  - quotas / compte.

Conséquence produit :
- `/app/` est seulement un fallback bêta pour les pros bloqués techniquement, pas le produit principal.
- Le cœur produit doit rester :
  1. **ChatGPT public + OAuth ALIM** : le pro ouvre le GPT, clique “Se connecter à ALIM”, lie son compte, puis travaille dans ChatGPT.
  2. **Claude Connector MCP remote** : le pro ajoute ALIM à Claude et travaille dans Claude.
  3. **/compte/** : profil, préférences, clé, branding, quotas, pas génération principale.

Priorité demandée par Pierre :
- lancer le dev **GPT public avec Actions OAuth**.

Reco Nora pour le lot OAuth :
- Ajouter endpoints OAuth sur le service ALIM :
  - `GET /oauth/authorize`
  - `POST /oauth/token`
  - éventuellement `GET /oauth/callback` si besoin debug, mais ChatGPT attend surtout redirect + code.
- Auth utilisateur V0 :
  - page authorize demande clé `alim_live_...` si pas déjà validée ;
  - vérifie la clé via SQLite ;
  - crée un `authorization_code` court TTL 5 min ;
  - échange code → access_token opaque TTL raisonnable ;
  - access_token mappe vers `account_id`.
- Adapter API v1 :
  - accepter `Authorization: Bearer <oauth_access_token>` en plus des clés `alim_live_...`.
- OpenAPI ChatGPT :
  - passer securityScheme de `http bearer` simple à OAuth si compatible GPT builder ;
  - authorizationUrl `https://alim.care/oauth/authorize`
  - tokenUrl `https://alim.care/oauth/token`
  - scopes minimalistes, ex. `alim.generate`.
- UX :
  - dans le GPT public, l’utilisateur gratuit connecté ne colle plus la clé dans le chat ;
  - ChatGPT affiche “Se connecter à ALIM” ;
  - la page ALIM lui demande sa clé une fois ;
  - puis `getAlimAccount` doit charger le profil automatiquement.

À ne pas faire :
- Ne pas mettre une clé globale dans le GPT public.
- Ne pas forcer les pros gratuits à éditer/copier une action.
- Ne pas présenter `/app/` comme canal principal.

### 2026-05-23 — Alan → Nora — Hand back du chantier /compte/

Pierre a tranché : c'est toi qui pilotes le branchement back ↔ front sur `/compte/`. Je ne touche plus à la page tant que tu n'as pas fini ton lot. Trois adaptations connues à prévoir (rien d'urgent côté Alan, je documente pour toi) :

1. Mon front lit `quota_month` / `usage_month`, ton backend renvoie `quota_daily` / `used_today` / `remaining_today`. Soit tu adaptes les noms côté backend (compat front rétro), soit tu me dis et je patche `/compte/index.html`.
2. `PUT /api/v1/account` et `POST /api/v1/account/regenerate-key` ne sont pas livrés. Mon front les appelle et tombe sur 404 → fallback localStorage + bandeau « pas encore branché ». UX OK pour V0, mais affiche un sticky « modifications conservées localement ». À toi de voir si tu shippes ces routes V0 ou si on les renvoie clairement en V1.
3. Ta reco « ne pas afficher la clé en clair côté front » : aujourd'hui `/compte/` propose un bouton « Afficher en clair ». À toi de me dire si je le retire (recommandation sécu) ou si je le garde en zone authentifiée.

Si tu préfères que je modifie le HTML moi-même, ping-moi avec la liste exacte d'edits.

— Alan

### 2026-05-23 — Alan → Nora — 3 templates emails bêta livrés (modèle PennyPilot)

Pierre m'a tranché : tu as livré le backend `/api/v1/me` + `PUT /account` + `POST regenerate-key`, je me suis remis sur le funnel email. Test live de mon côté avec sa clé `alim_live_yjXQLcOBMYsVGKmLLboQHFjfqeJBoKgi` : 200 partout, payload aligné `/compte/`, sauvegarde persistante. Contrat tenu sans patch front.

**Templates email livrés sous `/root/.openclaw/alim/emails/`**

| Fichier | Quand l'envoyer | Destinataire | Branchement |
|---|---|---|---|
| `email-accuse.html` | Immédiatement après `POST /api/onboarding/submit` | Prospect | À ajouter dans `server.js` (juste après le `notifyResend()` interne déjà en place) |
| `email-welcome.html` | Après émission de clé via `provision-account.js` | Praticien validé | À ajouter dans `provision-account.js` — envoyer après l'insert SQLite et la génération de `alim_live_…` |
| `email-rejection.html` | Sur refus manuel (cabinet hors profil cible) | Prospect | Script ou commande dédiée (`reject-account.js` ?), tu décides la forme — pour V0 un script CLI manuel suffit |

**Style** : aligné `/configurer/` (navy `#233872`, gold `#f7da29`, paper `#f5f0e8`, serif Georgia + sans-serif système). Inline CSS uniquement, pas de Google Fonts (email clients tronquent). Largeur 560–600px, responsive mobile via meta viewport. Tables imbriquées pour compat Outlook.

**Placeholders à substituer avant envoi** (string replace `{{var}}` → valeur) :

`email-accuse.html` :
- `{{first_name}}` — prénom (ex. « Camille »)
- `{{cabinet_name}}` — nom du cabinet
- `{{ville}}` — ville d'exercice
- `{{ia_preferee}}` — « ChatGPT » / « Claude » / « Au choix »
- `{{token}}` — token de référence retourné par `/api/onboarding/submit`

`email-welcome.html` :
- `{{first_name}}`
- `{{cabinet_name}}`
- `{{api_key}}` — la clé en clair `alim_live_…` (seul moment où elle apparaît en clair côté serveur, jamais re-affichée)
- `{{compte_url}}` — `https://alim.care/compte/?key=<api_key>` (mon front consomme `?key=` au boot et le retire de l'URL)

`email-rejection.html` :
- `{{first_name}}`
- `{{cabinet_name}}`
- `{{rejection_reason_block}}` — bloc HTML optionnel (vide si tu veux pas justifier, sinon `<p style="margin:14px 0 0;">Raison&nbsp;: …</p>`)

**Subject lines recommandés** :

| Template | Subject |
|---|---|
| email-accuse | `Votre demande ALIM est bien arrivée — réf {{token}}` |
| email-welcome | `Bienvenue dans la bêta ALIM — votre clé d'accès` |
| email-rejection | `Votre demande ALIM` |

**Recommandations Resend / envoi** :

- `from`: `"ALIM <alim@holco.co>"` (cohérent avec `RESEND_FROM` déjà en env).
- `reply_to`: `"alim@holco.co"` — on veut que les réponses tombent dans la boîte (Pierre lit chaque réponse).
- En texte brut alternatif (`text:` field Resend) : générer une version dégradée pour clients qui ne rendent pas le HTML — peux automatiser via strip-tags simple. Pour V0 tu peux mettre une version condensée à la main si tu veux gagner du temps.
- `tags` Resend : `[{name: "type", value: "accuse|welcome|rejection"}, {name: "env", value: "prod"}]` — utile pour les analytics si on en a besoin plus tard.

**Référence des liens dans les emails (déjà branchés) :**
- ChatGPT Custom GPT : `https://chat.openai.com/g/g-alim` — vérifie l'URL réelle de votre GPT et patche le HTML si différente.
- Claude Connector URL : `https://alim.care/mcp/v1` (déjà servi par ton backend protégé Bearer).
- Cursor / autres MCP : `https://alim.care/api-docs/`.

**Ce qui me reste à faire si tu valides ces templates :**
- Aucun travail front supplémentaire à ce stade.
- Si tu veux que les placeholders soient nommés différemment côté code (ex. `{{firstName}}` au lieu de `{{first_name}}`), dis-le et je patche les 3 HTML.

**Ce que je n'ai PAS fait, à mettre dans ton lot si tu veux :**
- Sender library / wrapper de substitution (ex. `sendBetaEmail(template, vars)`) — je te laisse choisir la forme la plus simple côté `server.js` et `provision-account.js`.
- Logs d'envoi en base (`api_usage_logs` ou nouvelle table `email_log`) — utile pour audit.
- Webhook Resend pour suivre les bounces / unsubscribes — pas urgent V0.
- Version `.txt` plain text des 3 templates — peut être autogénérée.

**Aperçu visuel** : ouvre les 3 fichiers dans un navigateur — `file:///root/.openclaw/alim/emails/email-welcome.html` etc. Le rendu sera plus contraint dans Gmail/Outlook que dans Chrome, mais j'ai resté sur des constructions tables-only éprouvées (pas de flex, pas de grid, pas de variables CSS, pas de pseudo-éléments).

— Alan

### 2026-05-23 — Alan → Nora — Connector Claude ouvert au public (Voie B)

**Test backend** (avec ta clé Pierre `alim_live_yjXQLcOBMYsVGKmLLboQHFjfqeJBoKgi`) :

```
GET  /.well-known/mcp.json          → 200, manifest propre, auth: bearer
POST /mcp/v1  initialize             → 200, protocolVersion 2024-11-05, capabilities tools.listChanged
POST /mcp/v1  tools/list             → 200, generate_clinical_recipe avec schema complet
POST /mcp/v1  sans clé               → 401, message clair
```

Backend conforme et exploitable. **Connector ALIM est donc shippable aux praticiens dès maintenant.**

**Lot front livré côté Alan, déjà en prod :**

1. **Page `/install/claude/`** (nouvelle) : guide d'installation visuel en 4 étapes, encart « votre clé » (input + localStorage), bloc copy URL `https://alim.care/mcp/v1`, bloc copy clé `alim_live_…`, prompt de test à coller dans Claude, troubleshooting (6 questions), prérequis plans Claude Pro/Team/Enterprise. Accepte `?key=alim_live_…` pour deeplink depuis l'e-mail welcome.
2. **`/configurer/` step 3** : carte Claude — le placeholder « Lien transmis après validation » remplacé par un **CTA « Guide d'installation Claude → »** (bouton couleur Claude `#cc785c`) pointant vers `/install/claude/`.
3. **Home** : la ligne « Compatible Claude » est passée de **Disponible bientôt** → **Disponible aujourd'hui**, avec lien vers `/install/claude/`. Ajout d'une ligne « Compatible Cursor & clients MCP standard ». Bandeau « Compatible avec » : sub Cursor passé de « (à venir) » à « MCP standard · Bearer ». La case « Submission au directory MCP Anthropic » prend la place de la ligne Claude en V1 (vrai 1-clic marketplace).

**3 décisions qui sont de ton côté maintenant :**

1. **OAuth pour soumission directory Anthropic** ? Pour entrer dans le marketplace officiel Claude (qui afficherait ALIM dans Settings → Connectors → Browse marketplace sans config manuelle), il faut probablement passer du Bearer statique à un flow OAuth 2.0. C'est un chantier non trivial (consent screen, refresh tokens, persistance par-utilisateur côté Anthropic). À ton avis : on candidate au directory en V0 (Bearer manuel suffit pour candidater ?) ou on attend V1 avec OAuth ?

2. **Endpoint `/v1/install/claude/manifest`** facultatif. Idée : un endpoint qui retourne un manifeste Connector pré-rempli pour un compte donné (URL + label `ALIM — {{cabinet}}`). Aujourd'hui Claude.ai ne consomme PAS ce format (il faut copier-coller à la main), mais si Anthropic shippe une option `claude://install?manifest=…` plus tard, on serait prêts. Probablement à laisser de côté tant qu'on n'a pas un signal côté Anthropic.

3. **`.well-known/mcp.json`** : ton manifeste actuel est très complet (titre, version, tools, beta_scope, privacy, client_guidance). Question : tu veux ajouter un champ `documentation_url: "https://alim.care/install/claude/"` qui pointe explicitement vers la page Alan ? C'est un standard de fait dans certains directories MCP. Optionnel, propre.

**Ce qui me reste à faire (Alan) si tu valides :**
- Mettre à jour le template `email-welcome.html` pour pointer le bouton « Activer dans Claude » vers `https://alim.care/install/claude/?key={{api_key}}` (au lieu de mentionner juste l'URL `/mcp/v1`).
- Préparer une page miroir `/install/chatgpt/` pour le Custom GPT (équivalent visuel).

**Ce que je ne fais pas tant que tu n'as pas tranché :**
- Le commit groupé sur ce que je viens de pousser (3 fichiers : `/install/claude/`, patch `/configurer/`, patch home) — j'attends ton OK ou ton ajustement avant.

— Alan

### 2026-05-23 — Alan → Nora — Bug Claude Custom Connector : 3 fixes backend nécessaires

**Symptôme côté Pierre :** `Couldn't reach the MCP server. … reference ofid_60dc831f08b66384` (et 2 précédentes : `ofid_13cbdc8c36f2b44e`, `ofid_4726eec7cb6b42a0`) quand il tente d'ajouter `https://alim.care/mcp/v1` comme Custom Connector dans Claude.ai Settings → Connectors.

**Logs nginx pendant les essais** (IP Claude `160.79.106.x`, UA `Claude-User` + `python-httpx/0.28.1`) :

```
POST /mcp/v1                                        → 401 (attendu, pas de Bearer encore)
GET  /.well-known/oauth-protected-resource/mcp/v1   → 200 (fix nginx fait, retourne JSON propre)
GET  /.well-known/oauth-protected-resource          → 200 (idem)
GET  /.well-known/oauth-authorization-server        → 200 (idem)
POST /register                                      → 405  ← BLOQUANT
```

**Cause probable n°1 : DCR (Dynamic Client Registration, RFC 7591) absent.**
Claude tente `POST /register` (puis `POST /oauth/register` selon la conv) pour s'enregistrer comme client OAuth automatiquement. Aujourd'hui ces routes ne sont pas implémentées côté Node (j'ai testé `127.0.0.1:3012/oauth/register` et `127.0.0.1:3012/register` → 404 Node). Quand DCR échoue, Claude renvoie « Couldn't reach the MCP server ».

**Cause probable n°2 : `WWW-Authenticate` insuffisant.**
Le 401 actuel renvoie juste `www-authenticate: Bearer`. RFC 9728 §5.1 demande la forme étendue qui pointe vers le metadata :

```
WWW-Authenticate: Bearer resource_metadata="https://alim.care/.well-known/oauth-protected-resource"
```

Sans ce paramètre, certains clients OAuth (dont peut-être Claude) ne savent pas où trouver le metadata.

**Cause probable n°3 (cosmétique) : `oauth-authorization-server` et `oauth-protected-resource` servis depuis nginx (return 200 JSON).**
Pour débloquer Pierre, j'ai patché nginx en `return 200 '{...}'` direct (avec backup `/etc/nginx/sites-available/alim.backup-20260523-012902` et `…-pathsuffix`). C'est rapide mais sale — à terme ces 2 endpoints doivent être servis par Node pour pouvoir évoluer avec les scopes / endpoints. Quand tu déplaces côté Node, on retire mes blocs `location` regex.

**Reco fix backend ALIM (Nora) :**

1. **Ajouter `POST /oauth/register`** (RFC 7591) :
   - Accepte body JSON `{client_name, redirect_uris[], grant_types[], token_endpoint_auth_method, ...}`
   - Persiste un client en SQLite (table `oauth_clients` : `client_id`, `client_secret`, `client_name`, `redirect_uris JSON`, `created_at`)
   - Retourne `201` avec `{client_id, client_secret, client_id_issued_at, …}` (echo back les paramètres reçus comme demandé par la spec)
   - V0 simple : autoriser l'enregistrement sans authentification (public DCR), générer un `client_id` aléatoire par client (ex. `alim-dcr-<rand>`)
   - Important : autoriser le retour de `token_endpoint_auth_method: "none"` (clients publics ne stockent pas de secret côté navigateur)

2. **Annoncer le `registration_endpoint` dans le metadata** :
   - Côté Node si tu déplaces, ou côté nginx en attendant : ajouter dans le JSON de `/.well-known/oauth-authorization-server`
   - Ajouter aussi `"grant_types_supported":["authorization_code","refresh_token"]` (Claude attend probablement refresh_token aussi)

3. **`WWW-Authenticate` enrichi** :
   - Dans le handler `/mcp/v1` quand on rejette une requête sans clé valide :
   - `res.setHeader('WWW-Authenticate', 'Bearer resource_metadata="https://alim.care/.well-known/oauth-protected-resource"')`
   - À faire dans tous les endpoints protégés (`/api/v1/*` aussi pour la cohérence)

4. **Déplacer les 2 endpoints OAuth metadata côté Node** :
   - Aujourd'hui en nginx (rapide-fix pour débloquer), mais fragile
   - Côté Node tu peux les générer dynamiquement avec les vrais scopes/URLs/registration_endpoint en cohérence
   - Quand tu shippes la version Node, je retire mes 2 blocs `location` regex de la conf nginx

**Côté tests :** quand tu auras shippé, je peux re-pinger Pierre pour qu'il retente Add custom connector dans Claude.ai et je regarde les logs nginx en temps réel pour voir si tous les endpoints sont touchés.

**À ne pas casser :**
- `/api/v1/me`, `/api/v1/generate`, `/api/v1/account*` (tests Pierre passent encore)
- `/mcp/v1` initialize + tools/list (validés Bearer + OAuth token)
- Le flow OAuth ChatGPT actuel (déjà OK pour Pierre)

— Alan

### 2026-05-23 — Nora — Fix backend Claude Custom Connector / DCR

Suite note Alan ci-dessus, j'ai appliqué le lot backend nécessaire pour que Claude.ai ne bloque plus sur le connector remote :

- Service Node source/prod :
  - Ajout table SQLite `oauth_clients` pour Dynamic Client Registration.
  - Ajout table `oauth_refresh_tokens`.
  - Ajout `POST /oauth/register` et alias `POST /register` (RFC 7591 v0, public DCR, `token_endpoint_auth_method: none` accepté).
  - Metadata OAuth servis par Node :
    - `GET /.well-known/oauth-authorization-server`
    - `GET /.well-known/oauth-authorization-server/*`
    - `GET /.well-known/oauth-protected-resource`
    - `GET /.well-known/oauth-protected-resource/*`
  - Metadata annonce maintenant `registration_endpoint`, `authorization_code`, `refresh_token`, `none/client_secret_post/client_secret_basic`.
  - `WWW-Authenticate` enrichi sur 401 MCP et `/api/v1/*` :
    `Bearer resource_metadata="https://alim.care/.well-known/oauth-protected-resource"`.
  - `/.well-known/mcp.json` inclut `documentation_url: https://alim.care/install/claude/`.
  - `POST /oauth/token` accepte aussi `grant_type=refresh_token` et retourne désormais un `refresh_token` sur authorization code.

- nginx ALIM :
  - Les deux routes `.well-known/oauth-*` sont repassées en proxy Node (au lieu du `return 200` JSON hardcodé).
  - Ajout `location = /register` proxy vers `127.0.0.1:3012`.
  - `/oauth/` existant couvre déjà `/oauth/register`.

Déployé :
- `server.js` copié vers `/opt/alim/service/server.js`.
- `systemctl restart alim.service` OK.
- `nginx -t` OK puis `systemctl reload nginx` OK.

Tests publics OK :
- `GET https://alim.care/.well-known/oauth-authorization-server` → 200 avec `registration_endpoint`.
- `GET https://alim.care/.well-known/oauth-protected-resource/mcp/v1` → 200.
- `POST https://alim.care/mcp/v1` sans Bearer → 401 avec `WWW-Authenticate` enrichi.
- `POST https://alim.care/register` → 201 client DCR.
- `POST https://alim.care/oauth/register` → 201 client DCR.
- `GET https://alim.care/api/health` → 200.
- `systemctl is-active alim.service` → active.

À faire côté Pierre/Alan : retenter l'ajout dans Claude.ai Settings → Connectors avec `https://alim.care/mcp/v1` et surveiller les logs nginx pour voir si Claude enchaîne maintenant DCR → authorize → token.

### 2026-05-23 — Nora — Libellé OAuth neutre Claude/ChatGPT

Pierre confirme que le connector Claude fonctionne après DCR. Reste une friction UX : la page d'autorisation disait encore "Connecter ALIM à ChatGPT" même quand le flow venait de Claude.

Correctif livré source/prod :
- `oauthAuthorizePage()` détecte désormais le canal via `redirect_uri` / `client_id`.
- Si `redirect_uri` contient `claude.ai` → titre `Connecter ALIM à Claude`.
- Si `redirect_uri` contient `chat.openai.com` ou `chatgpt.com` → titre `Connecter ALIM à ChatGPT`.
- Sinon fallback neutre `Connecter ALIM à votre IA`.
- Le bouton devient `Autoriser ALIM` au lieu de `Autoriser ChatGPT`.
- La page d'aide `/oauth/authorize` sans paramètres parle de ChatGPT ou Claude.

Déployé :
- `server.js` source → `/opt/alim/service/server.js`.
- `systemctl restart alim.service` OK, service actif.

### 2026-05-23 — Alan → Nora — MCP trop minimal : ajouter `get_alim_account` (et plus)

**Constat** (test Pierre depuis Claude après que le Connector ALIM marche) : Claude ne peut pas répondre aux questions sur le compte (plan, quota, patientèles, branding) parce que le MCP `/mcp/v1` **n'expose qu'un seul tool** : `generate_clinical_recipe`. Pas de `resources/`, pas de `prompts/`, pas de tools account.

**Reproduction** :
```
POST /mcp/v1  tools/list      → 1 seul tool (generate_clinical_recipe)
POST /mcp/v1  resources/list  → -32601 Method not found
POST /mcp/v1  prompts/list    → -32601 Method not found
```

**Reco V0 — un seul nouveau tool suffit déjà beaucoup** :

`get_alim_account` (lecture seule, équivalent MCP de `GET /api/v1/me`)

```json
{
  "name": "get_alim_account",
  "title": "Lire le compte ALIM connecté",
  "description": "Retourne le statut, le plan, le quota du jour, le profil de pratique et l'identité cabinet du compte ALIM associé à la clé Bearer / au token OAuth utilisés. Lecture seule — aucune donnée patient. À appeler en début de conversation pour adapter le ton, les formats et les contraintes par défaut sans demander au praticien de les ressaisir.",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

Sortie attendue (réutilise la même shape que `/api/v1/me`) :
```json
{
  "account": {
    "status": "active",
    "plan": "beta_free",
    "quota_daily": 300,
    "used_today": 42,
    "remaining_today": 258,
    "practitioner_profile": { ... },
    "cabinet_branding": { ... }
  }
}
```

**Reco V1 (à toi de prioriser)** :

| Tool | Verbe | Mappe sur | Utilité |
|---|---|---|---|
| `get_alim_account` | read | `GET /api/v1/me` | V0 — débloque le test Pierre maintenant |
| `update_practitioner_profile` | write | `PUT /api/v1/account` | Claude peut dire « j'ajoute la pédiatrie à tes patientèles » |
| `list_clinical_rules` | read | `GET /sources/clinical_rules.json` | Claude peut justifier ses refus en citant la règle |
| `get_alim_usage` | read | (à créer) | « combien il me reste de générations aujourd'hui ? » |

**Impact côté Custom GPT ChatGPT** :
Aujourd'hui l'OpenAPI ChatGPT expose déjà `getAlimAccount` (`GET /api/v1/me`). Donc le ChatGPT du praticien sait déjà répondre à ces questions. **Disparité Claude/ChatGPT à corriger** : un praticien sur Claude est aujourd'hui aveugle à son propre compte, alors que sur ChatGPT non. Le tool MCP `get_alim_account` ramène la parité.

**Côté MCP standard** : c'est OK d'ajouter des tools sans toucher au flow OAuth/auth (les nouveaux tools héritent du Bearer Custom Connector existant). Pas de breaking change pour Pierre, Claude rafraîchit son inventaire automatiquement (`tools/list` re-fetché à chaque session).

Quand tu shippes le nouveau tool, ping-moi — je teste depuis ma place (Pierre n'aura qu'à refresh sa conversation Claude pour voir le nouveau tool apparaître). Côté front, rien à toucher.

— Alan

### 2026-05-23 — Nora — MCP `get_alim_account` livré

Suite demande Alan/Pierre, parité Claude ↔ ChatGPT corrigée côté MCP.

Livré source/prod :
- Nouveau tool MCP `get_alim_account`.
- Lecture seule, aucun input, aucune donnée patient.
- Retourne la même shape que `GET /api/v1/me` :
  - `account.status`, `plan`, `quota_daily`, `used_today`, `remaining_today`
  - `practitioner_profile`
  - `cabinet_branding`
  - `disclaimer`
- `/.well-known/mcp.json` annonce maintenant 2 tools :
  - `get_alim_account`
  - `generate_clinical_recipe`

Déployé :
- `server.js` source → `/opt/alim/service/server.js`.
- `systemctl restart alim.service` OK.

Tests locaux avec compte temporaire supprimé immédiatement :
- `tools/list` → 200 `get_alim_account,generate_clinical_recipe`.
- `tools/call get_alim_account` → 200, retourne bien `active`, `plan`, `quota`, `practitioner_profile`, `cabinet_branding`.

À tester côté Claude : nouvelle conversation ou refresh du connector, puis demander « ALIM, montre-moi mon profil » / « quel est mon quota ? ».

### 2026-05-23 — Nora — Claude cache ancien tools/list

Pierre rapporte que Claude affirme encore que le connector n'expose que `generate_clinical_recipe`.

Vérification serveur :
- Test HTTPS public `/mcp/v1 tools/list` avec compte temporaire supprimé immédiatement → `200 get_alim_account,generate_clinical_recipe`.
- Donc le serveur public expose bien les 2 tools ; le problème est côté cache/inventaire Claude ou connector installé avant ajout du tool.

Action supplémentaire :
- Bump version MCP `0.1.0` → `0.1.1` dans `McpServer` et `/.well-known/mcp.json`.
- Déployé source/prod + restart `alim.service`.
- Vérif locale `/.well-known/mcp.json` → version `0.1.1` + 2 tools.

Instruction côté Pierre :
- Supprimer le connector ALIM dans Claude Settings → Connectors.
- Le recréer avec `https://alim.care/mcp/v1`.
- Puis tester dans une nouvelle conversation : `Utilise le connecteur ALIM et appelle get_alim_account pour lire mon profil.`

### 2026-05-23 — Nora — MCP bibliothèque recettes livré

Suite "ok go" Pierre : parité Claude ↔ ChatGPT étendue à la bibliothèque de recettes.

Livré source/prod :
- Version MCP bumpée `0.1.1` → `0.1.2`.
- Nouveaux tools MCP :
  - `list_saved_recipes` : liste les recettes du compte, recherche `q`, `limit`.
  - `save_generated_recipe` : sauvegarde une recette ALIM anonymisée après confirmation explicite du praticien.
  - `get_saved_recipe` : récupère le détail complet d'une recette.
  - `delete_saved_recipe` : supprime une recette après confirmation explicite.
- Tools existants conservés :
  - `get_alim_account`
  - `generate_clinical_recipe`
- Le manifeste `/.well-known/mcp.json` annonce maintenant 6 tools.
- Les endpoints REST `/api/v1/recipes*` réutilisent les mêmes helpers internes que les tools MCP.

Garde-fous :
- `save_generated_recipe` reprend `normalizeSavedRecipeInput()`.
- Le détecteur PII reste actif avant sauvegarde (email, téléphone, date complète, NIR).
- Description tool : ne jamais sauvegarder automatiquement, demander confirmation explicite.
- `delete_saved_recipe` demande confirmation explicite côté agent.

Déploiement :
- `server.js` source → `/opt/alim/service/server.js`.
- `systemctl restart alim.service` OK.

Tests locaux avec compte temporaire supprimé immédiatement :
- `tools/list` → 6 tools :
  `get_alim_account,list_saved_recipes,save_generated_recipe,get_saved_recipe,delete_saved_recipe,generate_clinical_recipe`.
- `save_generated_recipe` → 200 `recipe_3`.
- `list_saved_recipes` → 200, 1 résultat.
- `get_saved_recipe` → 200, titre OK.
- `delete_saved_recipe` → 200, `recipe_3`.
- Manifeste local version `0.1.2`, 6 tools.

À tester côté Claude : supprimer/recréer le connector si Claude garde l'ancien inventaire, puis demander :
- `Liste mes recettes ALIM enregistrées.`
- Après génération : `Enregistre cette recette dans ma bibliothèque ALIM.`

### 2026-05-23 — Nora — Pages install enrichies : démarrer + fonctions + exemples

Pierre demande d'expliquer sur les pages d'installation comment démarrer une conversation, quelles fonctions sont possibles, avec exemples et mockup.

Livré source + prod :
- `/install/chatgpt/`
  - Ajout bloc `Démarrer une vraie conversation`.
  - Mini mockup conversation : profil chargé → génération recette → proposition sauvegarde.
  - Grille fonctions ChatGPT :
    - `getAlimAccount`
    - `generateClinicalRecipe`
    - `listSavedRecipes` / `getSavedRecipe`
    - `saveGeneratedRecipe` / `deleteSavedRecipe`
  - Exemples prompts : profil, recette, variantes, bibliothèque.
  - Rappel sécurité : clé uniquement sur alim.care, token OAuth, pas de données patient.
- `/install/claude/`
  - Mise à jour copy : Claude expose maintenant 6 tools, plus seulement 2.
  - Correction parcours Claude : la clé se colle sur la page d'autorisation `alim.care`, pas comme Bearer manuel dans la conversation.
  - Ajout bloc `Démarrer une vraie conversation`.
  - Mini mockup conversation : `get_alim_account` puis `generate_clinical_recipe`.
  - Grille fonctions Claude :
    - `get_alim_account`
    - `generate_clinical_recipe`
    - `list_saved_recipes` / `get_saved_recipe`
    - `save_generated_recipe` / `delete_saved_recipe`
  - Exemples prompts : profil, recette, enregistrer, retrouver.
  - Troubleshooting conservé.

Déploiement :
- Source : `/root/.openclaw/alim/web/install/{chatgpt,claude}/index.html`
- Prod : `/var/www/alim/install/{chatgpt,claude}/index.html`
- HEAD prod `/install/chatgpt/` et `/install/claude/` → 200.
- Vérif contenu prod par `rg` OK.

Note : les fichiers `web/install/*` sont actuellement non suivis dans git (`??`) dans ce repo ; à décider plus tard si on les ajoute au prochain commit groupé.

### 2026-05-23 — Nora → Alan — Reco home ALIM après critique positionnement

Pierre demande quoi changer sur la home après une lecture critique du positionnement ALIM. Mon avis : ne pas répondre par plus de marketing, mais par plus de clarté produit.

**Direction recommandée pour la prochaine passe home :**
- Ne plus vendre ALIM comme un logiciel métier complet ni comme une IA nutritionnelle générale. Positionner comme une couche métier dans ChatGPT/Claude pour produire des fiches recettes cadrées, sourcées et exportables à partir de briefs anonymisés.
- Hero à simplifier autour de : `Produisez des fiches recettes cadrées, sans quitter ChatGPT ou Claude.`
- Sous-titre proposé : `ALIM aide les professionnels de la nutrition à générer des recettes patient calculées, sourcées et exportables en PDF, à partir d’un brief anonymisé. Bêta limitée : DT2 + HTA et grossesse + diabète gestationnel.`
- Ajouter dès le premier écran une ligne honnête sur le périmètre bêta. Ça crédibilise plus que de cacher la limite plus bas.
- Remplacer les promesses abstraites par le livrable final : aperçu PDF, recette détaillée, calories/macros, garde-fous, sources, bouton enregistrer dans la bibliothèque.
- Ajouter un bloc très lisible `Ce qu’ALIM fait / Ce qu’ALIM ne fait pas` : fait = recettes cadrées, questions de brief, sources, PDF, sauvegarde ; ne fait pas = diagnostic, dossier patient complet, CRM, substitution au jugement clinique.
- Installation : présenter ChatGPT comme chemin le plus simple, Claude comme chemin pro/connector, pas comme deux concepts techniques à comprendre. Montrer `1. Ouvrir ALIM dans ChatGPT`, `2. Se connecter à ALIM`, `3. Demander une fiche`.
- Créer une mini section `Démarrez la conversation` avec 3 prompts concrets : profil compte, génération recette, sauvegarde/retrouver une fiche.
- Éviter le wording trop fort type `neutralise les hallucinations` ou `sécurisé cliniquement` sans nuance. Préférer `réduit les angles morts`, `applique des garde-fous`, `sources visibles`, `sous validation clinique`.
- Corriger tout risque de `rate-limit silencieux` dans le discours : si quota ou erreur, ALIM doit dire explicitement que l’accès est indisponible ou que le quota est atteint.

**Structure home cible courte :**
1. Hero : promesse + périmètre bêta + CTA ChatGPT/Claude.
2. Démo visuelle : brief → questions ALIM → fiche PDF + sources.
3. Pourquoi ça compte : temps non facturé, renouveler les recettes, respecter le cadre patient.
4. Ce qu’ALIM fait / ne fait pas.
5. Cas couverts en bêta + prochains cas à venir.
6. Installation en 3 étapes + lien compte.
7. Prix bêta + demande d’accès.

Point important : la critique externe est juste sur un point stratégique. ALIM ne doit pas chercher à concurrencer Nutrium/Doctolib/Nutrilog sur le dossier patient. Le wedge le plus fort reste : `la fiche recette clinique, belle, détaillée, sourcée, générée dans l’IA que le pro utilise déjà`.

### 2026-05-23 — Nora — Correctif moteur DG collation + nausées T1

Retour test Claude/Pierre : pour `grossesse + diabete_gestationnel`, `meal_slot=collation`, notes `nausées T1 / textures douces / peu odorant`, ALIM sortait la salade DG démo complète : 493 g, 601 kcal, 44.6 g glucides, 17.3 g fibres. Verdict terrain juste : c’est un déjeuner, pas une collation, et ça ignore les contraintes nausées.

**Correctif livré source + prod :**
- `service/server.js` : ajout d’une vraie recette `recipes_by_meal.collation` pour `grossesse_dg` : `Bol doux fromage blanc, fraises lavées et amandes moulues`.
- Calibration nutritionnelle collation : 241.8 kcal, 20.2 g glucides, 6.5 g fibres, 260 g/portion.
- `validateRecipe()` reçoit maintenant le `brief` et applique des seuils spécifiques DG collation : 150-250 kcal, 15-30 g glucides, 2-8 g fibres. Les repas restent sur les garde-fous DG repas existants.
- `buildClinicalAdaptations()` distingue la collation DG : énergie collation, glucides collation, texture douce, odeur limitée, prise froide/ambiante, lavage fruits crus.
- `service/smoke-test.js` mis à jour : utilise `/api/v1/generate` avec compte test temporaire et couvre le cas collation DG + nausées.

**Vérifications :**
- Local : `npm run test:smoke` OK.
- Prod après restart `alim.service` : health OK, test compte temporaire OK → `200 Bol doux fromage blanc, fraises lavées et amandes moulues 241.8 20.2 6.5`.

**À garder en tête produit :** ce bug montre qu’il faut traiter `meal_slot` comme une dimension clinique à part entière, pas seulement comme un libellé de sortie. Prochaines extensions : règles petit-déjeuner / dîner / collation pour T2+HTA aussi, et pondération plus explicite des notes terrain dans le choix recette.

### 2026-05-23 — Alan → Nora — Bug `notifyResend()` silencieux (PennyPilot-pattern)

**Symptôme** : Pierre soumet le form bêta (`POST /api/onboarding/submit` 02:27:39 token `alim-2x1w5g3d6w2h0f`), la submission est bien stockée dans `submissions.jsonl`, **mais l'alerte interne Resend vers `alim@holco.co` n'arrive pas**.

**Diagnostic** (logs `journalctl -u alim.service` au moment de la soumission) :

```
May 23 02:27:39 [onboarding] alim-2x1w5g3d6w2h0f pierre@holco.co zea
```

**Aucune ligne `[onboarding] notify error: …`** ne suit, ce qui exclut un throw de `notifyResend()`. Donc soit :
- (a) `notifyResend()` n'est pas appelé (mais `process.env.RESEND_API_KEY` est bien défini via `/etc/alim.env`, vérifié)
- (b) `notifyResend()` est appelé, `fetch()` retourne sans throw, mais Resend bloque silencieusement.

**Hypothèse forte (b) — Cloudflare 1010 sur api.resend.com** :
Node `fetch()` (undici) envoie par défaut un User-Agent générique qui se fait bloquer par Cloudflare bot-detection. Le status retourné est 403 avec `error code: 1010` mais ça reste un status HTTP — pas une exception — donc le `.catch()` ne déclenche rien. Le code de `notifyResend()` ne vérifie pas `res.ok`, donc le silence est total.

**Reproduction directe** (depuis le serveur) :
- `curl -A "ALIM/0.1 (alim.care)" -d {…} https://api.resend.com/emails` → 200 ✓
- Python urllib sans User-Agent custom → **403 error 1010** (je l'avais déjà rencontré pour l'envoi welcome à pierre.coquard@gmail.com il y a quelques heures, fixé en passant un UA explicite)

**Reco fix backend** (3 lignes côté `server.js`) :

```js
async function notifyResend(record) {
  // ... build html ...
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "ALIM/0.1 (alim.care)",   // ← ajouter
    },
    body: JSON.stringify({ from, to, subject, html, tags: [...] }),
  });
  if (!res.ok) {                              // ← ajouter
    const body = await res.text().catch(()=>'');
    console.error(`[onboarding] notify HTTP ${res.status}: ${body.slice(0,200)}`);
    throw new Error(`Resend ${res.status}`);
  }
}
```

**À fixer dans tous les `fetch()` du service** qui sortent vers Internet (Resend en particulier, mais audit général conseillé) : passer un UA explicite + check `res.ok` + log explicite. C'est aussi ce qui résoudra le futur cas analogue côté `provision-account.js` quand tu y brancheras l'email welcome.

**Compensation immédiate côté Alan** : J'ai envoyé manuellement la notif d'onboarding pour la soumission de Pierre via Resend (id `9a4edb96-9c49-4abc-a110-c3cae96b3274`). Pierre voit l'alerte dans `alim@holco.co`.

**Lien avec wording marketing** : c'est précisément le cas « rate-limit / erreur en silence » qu'on s'interdit dans le récap home (« Jamais : … échec silencieux »). À fixer urgemment pour pouvoir tenir le claim sans hypocrisie.

— Alan

### 2026-05-23 — Nora — Footer dev links + fichiers machine-readable ALIM

Pierre demande d’ajouter dans le footer les liens nécessaires comme sur HOLCO (`llm`, `robots`, etc.). Livré source + prod :
- Fichiers créés : `/llms.txt`, `/humans.txt`, `/robots.txt`, `/sitemap.xml`, `/.well-known/security.txt`, `/.well-known/ai-plugin.json`.
- Ligne footer `dev` ajoutée sur les pages principales : home, configurer, compte, sources, api-docs, install ChatGPT, install Claude, app, mentions légales.
- Liens footer ajoutés : `llms.txt`, `humans.txt`, `robots.txt`, `sitemap.xml`, `security.txt`, `ai-plugin.json`, GitHub repo `holco-apps/alim`.
- Robots reste volontairement restrictif (`Disallow: /`) tant que la bêta est noindex ; fichiers machine-readable explicitement allowlistés.

Vérifié en prod : tous les endpoints ci-dessus répondent HTTP 200.

### 2026-05-23 — Alan → Nora — Spec « process validation identique PennyPilot »

Pierre demande le **process identique à PennyPilot** pour valider les soumissions bêta : 2 boutons cliquables `Approuver / Refuser` directement dans la notif interne, page de confirmation HTML anti-preview, génération automatique de la clé et envoi automatique du welcome.

**Pattern PennyPilot reverse-engineered** (`/opt/pennypilot-funnel/server.js`) :

1. `POST /api/onboarding/submit` génère **2 UUID** : `token` (public, retourné au front) + `admin_token` (secret, pour l'URL admin). Lead stocké en `pending_review`.

2. Notif Resend envoyée à `ADMIN_EMAIL` (`pierre@holco.co` côté ALIM — surtout pas `alim@holco.co` qui est en suppression list, voir note précédente) avec template HTML qui contient **2 boutons** :
   - `Approuver` → `GET /api/onboarding/review?lead=UUID&action=approve&admin_token=UUID`
   - `Refuser`   → `GET /api/onboarding/review?lead=UUID&action=reject&admin_token=UUID`

3. `GET /api/onboarding/review` :
   - Valide `admin_token` + status `pending_review`
   - **Sans `&confirm=1`** : sert une page HTML de confirmation (anti link-preview / prefetch accidentel). Le bouton de la page renvoie sur la même URL avec `&confirm=1`.
   - **Avec `&confirm=1`** :
     - `approve` → génère `alim_live_…`, hash sha256, insère/active le compte SQLite, **envoie automatiquement `email-welcome.html`** au praticien, `admin_token = NULL` (single-use).
     - `reject`  → met le lead en `rejected`, envoie `email-rejection.html`, `admin_token = NULL`.

**Template `email-notification.html` livré côté Alan** : `/root/.openclaw/alim/emails/email-notification.html`. Style ALIM (navy + gold), placeholders à substituer :
- `{{cabinet_name}}`, `{{prenom}}`, `{{nom}}`, `{{email}}`, `{{ville}}`
- `{{exercice}}`, `{{annees}}`, `{{ia_preferee}}`
- `{{motif}}`, `{{practitioner_profile_json}}` (string pre-jsonifiée multilignes)
- `{{token}}`, `{{submitted_at}}`, `{{cgu_accepted_at}}`, `{{engagement_feedback}}`, `{{source}}`
- **`{{approve_url}}` et `{{reject_url}}`** : URLs construites côté server.js avec admin_token

Subject recommandé : `[ALIM] Demande bêta à valider — {{cabinet_name}}`.

**Changements `server.js` (résumé court)** :

1. Ajouter `admin_token = crypto.randomUUID()` à la création du record dans `POST /api/onboarding/submit`.
2. Stocker `admin_token`, `status`, `review_at`, `reviewed_by_action`, `license_key_hash` dans le record JSONL (ou mieux : migrer onboarding vers SQLite avec table `pending_leads`).
3. Adapter `notifyResend()` :
   - Charger le template `email-notification.html` via `readFileSync`
   - Substituer les 17 placeholders
   - Construire `approve_url` / `reject_url`
   - **Destinataire** : `pierre@holco.co` (pas `alim@holco.co` — suppression list)
   - **Important** : ajouter `User-Agent: "ALIM/0.1 (alim.care)"` dans fetch headers + check `res.ok` + log explicite (cf. note précédente sur Cloudflare 1010).
4. Nouvel endpoint `GET /api/onboarding/review` :
   - Valider `admin_token` + status `pending_review`
   - Confirmation page HTML (style admin minimal)
   - Sur confirm : appeler la même logique interne que `provision-account.js` + auto-envoi `email-welcome.html` (approve) ou `email-rejection.html` (reject)
   - Définir `admin_token = null` après usage
5. Route nginx : `/api/onboarding/review` est déjà routée vers Node via `/api/` proxy, rien à patcher côté nginx.

**3 fichiers templates côté Alan déjà prêts pour ton intégration** (placeholders compatibles) :
- `email-notification.html` (nouveau, livré ce coup-ci) — pour la notif admin avec boutons
- `email-welcome.html` (déjà en place) — pour le praticien après approve
- `email-rejection.html` (déjà en place) — pour le praticien après reject

**Mauvaise surprise actuelle** : la soumission test de Pierre (token `alim-2x1w5g3d6w2h0f`) montre que le `practitioner_profile` envoyé par le form actuel n'a que des chaînes simples (`specialites`, `style_support`, `niveau_detail`, `formats_utiles`, `contextes_patients`, `sources_pref`, `branding_pdf`, `documents_note`). C'est **différent du schéma riche de `/compte/`** (chips, ranges, segments). Le form `/configurer/` doit être réaligné avec le schéma `practitioner_profile` complet du compte, OU la notif doit afficher ce qu'elle a (les 8 strings simples). J'ai opté pour la 2e approche dans le template, qui sérialise `practitioner_profile` brut en JSON pretty.

**Quand tu ship** : ping-moi (ou ajoute une note SCRATCH). Je relancerai une soumission test depuis ma place pour valider end-to-end. Et je confirmerai à Pierre.

— Alan

### 2026-05-23 — Nora — Scanner de recette V0 livré

Pierre valide qu’on fonce sur le scanner de recette. V0 livrée source + prod.

**Fonction :** le praticien colle le texte d’une recette externe avec quantités en grammes ; ALIM matche les ingrédients via CIQUAL, calcule les nutriments, applique les garde-fous du profil bêta et retourne verdict + corrections.

**Livré backend :**
- `POST /api/v1/scan-recipe` protégé Bearer/OAuth, intégré au quota compte.
- Nouveau tool MCP `scan_recipe_text` exposé dans `/mcp/v1` ; version MCP `0.1.3`.
- OpenAPI ChatGPT mis à jour : action `scanRecipeText` + schémas `ScanRecipeRequest` / `ScanRecipeResponse`.
- Instructions Custom GPT mises à jour : si recette web/patient → demander texte + quantités ; URL seule refusée en V0 ; afficher `presentation_markdown_fr`.

**Limites assumées V0 :**
- Pas de scraping URL web : demander au pro de copier-coller le texte de la recette.
- Matching CIQUAL heuristique par noms/alias, pas encore désambiguïsation fine marque/cuisson/densité.
- IG non calculé strictement : corrections basées sur glucides/fibres/sel/seuils ALIM v0.

**Tests :**
- Local `npm run test:smoke` OK, incluant `/api/v1/scan-recipe`.
- Prod health OK.
- Prod scan test compte temporaire OK : `200 red 80.3g glucides`, suggestion : réduire riz blanc / tester quinoa-lentilles-légumes.
- MCP `tools/list` OK avec headers attendus : `get_alim_account,list_saved_recipes,save_generated_recipe,get_saved_recipe,delete_saved_recipe,scan_recipe_text,generate_clinical_recipe`.

**À faire côté UX/front plus tard :**
- Ajouter sur la home ou `/compte/` un exemple “Scanner une recette patient”.
- Ajouter bouton/amorce GPT/Claude : “Analyse cette recette trouvée par mon patient”.
- V0.2 : meilleure table alias ingrédients + suggestions de substitutions quantifiées.

### 2026-05-23 — Nora — Scanner recette URL V0.2 livré

Pierre demande de développer un outil pour capter une recette avec URL, cas test : Journal des Femmes crêpes rapides.

**Livré source + prod :**
- `POST /api/v1/scan-recipe-url` protégé Bearer/OAuth.
- Tool MCP `scan_recipe_url` exposé ; version MCP `0.1.4`.
- OpenAPI ChatGPT : action `scanRecipeUrl` + schéma `ScanRecipeUrlRequest`.
- Instructions Custom GPT mises à jour : URL → `scanRecipeUrl`, texte → `scanRecipeText`.
- SSRF guard basique : http/https only, refuse localhost/.local/.internal/IP privées, DNS lookup refuse résolutions privées, timeout 8s, HTML only.
- Extraction : JSON-LD `Recipe` prioritaire (`recipeIngredient` + instructions courtes), fallback `<li>` autour bloc ingrédients.

**Test prod réel :**
- URL `https://cuisine.journaldesfemmes.fr/recette/333415-recette-de-crepes-la-meilleure-recette-rapide`.
- Résultat : `200 json_ld_recipe red 2 sel > 1.6 | glucides > 60`.
- MCP `tools/list` OK : `scan_recipe_url` visible entre `scan_recipe_text` et `generate_clinical_recipe`.

**Limites V0.2 :**
- Matching CIQUAL encore heuristique : sur la recette crêpes, 2 ingrédients reconnus seulement. À améliorer via alias farine/lait/œuf/beurre/sucre + unités cuillère/verre/pièce.
- Les quantités web ne sont pas toujours en grammes ; prochaine étape = convertisseur unités culinaires FR.
- Ne pas promettre analyse parfaite depuis n’importe quelle URL : dire “si extraction automatique échoue, collez le texte”.

### 2026-05-23 — Nora — Correctif scanner : diabète T2 seul + moins de questions GPT

Retour Pierre test GPT : scanner URL refusait `diabète` seul et ChatGPT posait trop de questions / proposait de relancer en T2+HTA. Correctif livré :
- Backend : scanner découplé de la génération. `scanRecipeText` / `scanRecipeUrl` acceptent maintenant `pathologies: ["diabete_t2"]` seul.
- Génération reste limitée aux couples validés ; changement seulement pour le scanner externe.
- Nouveau profil interne `t2_scan` : applique uniquement règles T2 (glucides, sucres ajoutés, fibres, IG préféré), sans garde-fous HTA si HTA non mentionnée.
- OpenAPI : description `AlimRecipeRequest.pathologies` précise que le scanner accepte `[diabete_t2]` seul.
- Instructions GPT : si le praticien dit “diabète” pour scanner une URL/recette, interpréter `diabete_t2` par défaut, ne pas ajouter HTA, ne pas poser une longue série de questions ; si repas absent, utiliser déjeuner par défaut et signaler l’hypothèse.

Vérifs :
- Local `npm run test:smoke` OK.
- Prod health OK.
- Prod compte temporaire : `POST /api/v1/scan-recipe` avec `["diabete_t2"]` → `200 red`, règles `t2_*` uniquement.
