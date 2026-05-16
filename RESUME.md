# ALIM — état pour redémarrage rapide

**Last updated:** 2026-05-16 ~16h10 UTC, après réorga site post-break.

## En 30 secondes

ALIM v0 prototype servi sur `https://alim.care/` (HTTPS, cert Let's Encrypt valide jusqu'au 2026-08-14), `noindex,nofollow` actif. Trois pages publiques&nbsp;: `/` (landing avec démos live, comparaison vs ChatGPT, corpus, IA, form `/try`, pricing 9 € locked), `/sources/` (corpus normatif exhaustif des 27 rule cards par pathologie, statut documentaire, verbatim PDF) et `/configurer/` (clé API, ChatGPT/Claude MCP, préférences). Backend Node de Nora branché : `/api/health`, `/api/v1/me`, `/api/generate` opérationnels.

**Les 5 arbitrages Pierre sont tranchés** : #1 explicitement (CKD retiré), #2 à #5 par défaut sur recos Alan (Pierre absent, accepte par défaut). Voir SCRATCH `Decisions Tranchées Pierre`.

Lot Alan complet : corpus, rule cards, rubriques, home réorganisée pour présentation diét libéraux, page `/sources`. Soumission complète à Nora pour challenge : `/root/.codex/memories/alan_alim_reorga_site_20260516.md`.

## Comment redémarrer (ordre)

1. Lire `/root/.openclaw/alim/SCRATCH.md` — historique chronologique des contributions Alan/Nora.
2. Lire la dernière note Nora dans `/root/.claude/projects/-root/memory/nora_alim_*.md` (par date de modification) — il y en a 5 à la fin de cette session.
3. Lire la dernière soumission Alan dans `/root/.codex/memories/alan_alim_*.md` — la plus récente est `alan_alim_v0_review2_fixes_and_ia_section_20260516.md`.
4. Vérifier que le site est toujours up&nbsp;: `curl -sI https://alim.care/` → 200, `curl -sI https://alim.care/configurer/` → 200.
5. Vérifier `noindex,nofollow`&nbsp;: `curl -s https://alim.care/ | grep robots` doit retourner `noindex, nofollow`.

## État des chantiers

| Chantier | Statut | Note |
|---|---|---|
| Workspace `/root/.openclaw/alim/` | ✅ | corpus/, rules/, rubrics/, scripts/, web/, SCRATCH.md |
| Corpus CIQUAL 2025 | ✅ | 3484 aliments → `corpus/ciqual_2025.json` (2.8 MB) + index. Script de re-ingestion dans `scripts/ingest_ciqual.py`. Licence Etalab 2.0. |
| Rule cards 5 pathos | 🟡 | `rules/clinical_rules.json` — 6 verified (PDF + page + verbatim), 5 derived, 16 to_verify. |
| Rubriques pass/fail | ✅ | Demo 1 (T2+HTA) et Demo 2 (grossesse+DG). Smoke tests utilisent `nutrients_per_portion`. |
| Page `/` (home) | ✅ | `/var/www/alim/index.html`. Réorganisée 2026-05-16 : hero + 2 CTAs, **section 01 démos live** (T2+HTA et grossesse+DG via `/api/generate` au load), **section 02 vs ChatGPT** (côte-à-côte), section 03 pipeline, **section 04 corpus** (mini-stats + lien `/sources/`), section 05 IA, section 06 form `/try`, **section 08 pricing 9 € locked**. Backup pré-réorga : `index.html.bak.20260516`. |
| Page `/sources/` | ✅ | `/var/www/alim/sources/index.html` + `clinical_rules.json` servi statique. Vitrine corpus : stats, légende verified/derived/to_verify, 5 sections par pathologie, verbatim PDF auto-déplié si verified. noindex actif. |
| Page `/configurer/` | ✅ | `/var/www/alim/configurer/index.html`. 7 sections : clé, ChatGPT, Claude MCP, /try, préférences, frontière données, vérification installation. |
| Vhost nginx + SSL | ✅ | `/etc/nginx/sites-available/alim`. Cert LE expire 2026-08-14. |
| Service Node ALIM | ✅ | Monté par Nora sur `127.0.0.1:3012`, service `alim.service`. Source `/root/.openclaw/alim/service/`, prod `/opt/alim/service/`. Endpoints actifs : `GET /api/health`, `GET /api/v1/me`, `POST /api/generate`. Moteur v0 déterministe sans LLM : deux démos, calcul CIQUAL, validation seuils, refus CKD/insuffisance rénale. |
| MCP server `@holco/alim-mcp` | ❌ | À développer par Nora après le service Node. |

## Vérification documentaire — déjà fait

PDFs téléchargés dans `corpus/`&nbsp;:
- `who_sodium_2012.pdf` — sodium 5 g/jour HTA, page 2
- `anses_qr_toxoplasmose.pdf` — viande bien cuite + lavage légumes, page 2
- `efsa_caffeine_2015.pdf` — caféine 200 mg/jour grossesse, page 3
- `has_projet_grossesse_argumentaire.pdf` — folate 400 µg supplémentation (p. 15) + alcool zéro grade A (p. 19)
- `has_t2_2024.pdf` — alimentation équilibrée R.30 sans seuil glucidique chiffré

Log détaillé&nbsp;: `rules/verification_log.md`.

## Vérification documentaire — encore à faire si on relance

Pour passer en `verified`&nbsp;:
- **Listériose grossesse** (no_raw_cheese, no_raw_fish, no_raw_eggs, no_charcuterie) — ANSES Q/R Listériose ou avis `MIC-Ra-ListerioseAliments.pdf`
- **HTA** : potassium DASH (EFSA), AG saturés (ANSES NUT 2012)
- **T2** : sucres ajoutés (PNNS 4), fibres (ANSES NUT 2016), IG (table par catégorie)
- **DG** : carb_per_meal, fibres, IG (CNGOF 2010 PDF)
- **Dyslipidémie** : AG saturés + cholestérol (HAS dyslipidémie)

Pas urgent tant qu'on n'a pas levé `noindex`.

## Arbitrages Pierre — tous tranchés (2026-05-16)

1. ✅ **CKD retiré du public**, Demo 1 = T2+HTA. CKD reste benchmark interne. (Tranché explicitement par Pierre.)
2. ✅ **FODMAP reporté V1** (Monash bloqué, reconstruction interne = mois, SII niche).
3. ✅ **Pricing option C** : 9 €/mois HT bêta verrouillé à vie / 29 €/mois HT public à la sortie de bêta.
4. ✅ **Conversion <10 % OK** sur les 66 contacts Alim.care. 5-7 conversions = socle bêta viable.
5. ✅ **Wording soft** : « prototype de garde-fous nutritionnels en validation documentaire » jusqu'à ≥ 80 % règles `verified` (actuellement 6/27).

#2 à #5 tranchées par défaut sur les recos Alan (Pierre absent, instruction « accepte par défaut »). À reverser facilement si Pierre change d'avis au retour.

## Conventions de travail (rappel pour redémarrage)

- Source d'édition&nbsp;: `/root/.openclaw/alim/`
- Statique servi&nbsp;: `/var/www/alim/`
- Service Node prod (à monter)&nbsp;: `/opt/alim/`
- Vhost nginx&nbsp;: `/etc/nginx/sites-available/alim`
- Mémoires Alan → Nora&nbsp;: `/root/.codex/memories/alan_*.md`
- Mémoires Nora → Alan&nbsp;: `/root/.claude/projects/-root/memory/nora_*.md`

## Garde-fous à NE PAS oublier au redémarrage

- `noindex,nofollow` reste actif tant que Pierre n'a pas dit "publie".
- Pas de PII patient dans aucun chemin ALIM.
- Aucune sortie tool sans `sources` peuplé.
- Pas de promesse réglementaire (HDS, dispositif médical, certifié).
- Wording disclaimer obligatoire dans toutes les sorties tool.
- Allowlist URL côté front pour `sources[].url` (anses.fr, has-sante.fr, mangerbouger.fr, who.int, doi.org, efsa.europa.eu, cngof.fr, data.gouv.fr, recherche.data.gouv.fr, santepubliquefrance.fr).
