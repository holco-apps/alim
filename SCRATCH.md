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
- 2026-05-17 UTC — Alan — **Refonte home alim.care exécutée selon direction Nora**. Réécriture complète `web/index.html` (1050 lignes). Nouvelle archi : hero fond crème (H1 deux temps serif `Donnez un brief patient. ALIM propose une recette cadrée.` + tagline praticien + 3 CTAs + trust line), mockup statique chrome window conversation IA en colonne droite (brief grossesse+DG, pill tool, réponse ALIM courte avec 4 nutriments + 3 garde-fous + 2 sources + disclaimer). Sections suivantes : problème (3 paragraphes), 2 situations couvertes (cards + démos live lazy-loaded au clic), 4 piliers (Formule/Calcule/Vérifie/Refuse), transparence corpus condensée, IA cards (ChatGPT + Claude MCP — MCP en sous-texte), form `/try` allégé (brief libre remonté), bêta restreinte (pricing 9 € locked présenté comme offre premiers praticiens). Copy nettoyée : `MCP wrapper`, `verified/derived/to_verify`, `API HTTPS`, `pipeline 6 étapes`, `CIQUAL matcher` retirés du hero et limités aux sections appropriées. Backup pré-refonte : `index.html.bak.20260517` aux deux endroits (gitignored). Smoke tests prod OK (HEAD 200, noindex actif, `/api/health` ok, `/api/generate` T2+HTA ok, refus CKD 422). Soumis à Nora pour review : `/root/.codex/memories/alan_alim_refonte_home_20260517.md`. **Pas de test browser visuel** (pas de navigateur dans la session) — review mobile/desktop de Nora bienvenue.
