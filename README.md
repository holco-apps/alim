# ALIM — Garde-fous nutritionnels sourcés pour praticiens

**Statut :** prototype en validation documentaire. Bêta restreinte, non indexé.

Outil d'aide à la formulation de recettes cliniques pour diététiciens libéraux, exposé via `https://alim.care/` (page interactive) et (à venir) via serveur MCP / Custom GPT pour usage depuis Claude ou ChatGPT.

> ALIM est un outil d'aide à la formulation, réservé aux professionnels de santé. Les sorties produites ne remplacent pas le jugement clinique du praticien. Aucune donnée patient n'est collectée ni traitée.

## Pile

- **Front statique** : HTML/CSS/JS vanilla, servi par nginx sur le droplet.
- **Backend** : Node.js (sans dépendance externe), serveur HTTP natif, déterministe v0 (sans appel LLM).
- **Corpus** : ANSES Ciqual 2025 (licence Etalab 2.0) + références HAS / ANSES / OMS / EFSA / CNGOF (citées par URL).
- **Stockage** : zéro DB, zéro PII patient. Tout est servi depuis le filesystem.

## Arborescence

```
/
├── corpus/                 Données nutritionnelles + PDFs sources (cf. §Licences)
│   ├── ciqual_2025.json    ANSES Ciqual 2025 (Etalab 2.0)
│   ├── ciqual_2025_index.json
│   └── *.pdf               PDFs sources HAS / ANSES / OMS / EFSA (référence)
├── rules/
│   ├── clinical_rules.json  27 règles cliniques activables sur 5 pathologies
│   └── verification_log.md  Suivi de vérification documentaire
├── rubrics/
│   ├── demo1_t2_hta.json    Rubrique pass/fail Demo 1 (T2 + HTA)
│   └── demo2_grossesse_dg.json  Rubrique pass/fail Demo 2 (Grossesse + DG)
├── scripts/
│   └── ingest_ciqual.py    Ingestion CIQUAL XLSX → JSON
├── service/                Backend Node
│   ├── server.js
│   ├── package.json
│   └── smoke-test.js
├── web/                    Sources du front (déployé vers /var/www/alim/)
│   ├── index.html          Landing + démos live + form /try
│   ├── configurer/         Page /configurer (clé API, ChatGPT, Claude MCP)
│   └── sources/            Page /sources (vitrine corpus normatif)
├── deploy/
│   └── alim.service        Unit systemd
├── SCRATCH.md              Working notes (interne)
├── RESUME.md               État pour redémarrage rapide (interne)
└── README.md               (ce fichier)
```

## 5 pathologies couvertes — v0

| Pathologie | Démo publique | Statut |
|---|---|---|
| Diabète T2 | ✅ Demo 1 (combinée HTA) | Actif |
| Hypertension artérielle (HTA) | ✅ Demo 1 (combinée T2) | Actif |
| Diabète gestationnel (DG) | ✅ Demo 2 (combinée grossesse) | Actif |
| Grossesse (hors DG) | ✅ Demo 2 (combinée DG) | Actif |
| Dyslipidémie | — (rule cards seulement, pas de démo dédiée) | Actif |

**Pas couvert v0 :** CKD (insuffisance rénale, benchmark interne uniquement), FODMAP/SII (reporté V1, licence Monash).

## Pipeline

1. **Brief validé** — complétude, cohérence, faisabilité.
2. **Règles activées** — cartes cliniques chargées selon les pathologies déclarées.
3. **Recette générée** — proposition initiale avec ingrédients quantifiés.
4. **Calcul Ciqual 2025** — chaque ingrédient résolu dans la table ANSES Ciqual&nbsp;; chaque nutriment porte sa source individuelle (`ciqual` / `estimated` / `missing`).
5. **Validation déterministe** — règles vérifiées sur la sortie. Si une règle saute, une régénération ciblée. Sinon refus traçable.
6. **Sortie auditable** — recette + nutriments per-field-source + règles citées + références documentaires + warnings.

## API HTTP

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/health` | GET | Liveness, version |
| `/api/v1/me` | GET | Identité service + scopes + disclaimer |
| `/api/generate` | POST | Brief → recette ou refus |

Brief minimal :
```json
{
  "pathologies": ["diabete_t2","hta"],
  "diet_type": "omnivore",
  "season": "all",
  "meal_slot": "diner",
  "portions": 1,
  "equipment": ["plaque","four"],
  "notes": "Adulte, fonction rénale normale."
}
```

## Statut du corpus

27 règles cliniques activables — 6 `verified` (PDF + page + verbatim), 5 `derived` (pratique courante / référentiels convergents), 16 `to_verify` (vérification documentaire en cours).

Détail public : `/sources` sur le site déployé, ou `rules/clinical_rules.json` + `rules/verification_log.md` dans ce repo.

Tant que >50 % des règles ne sont pas en `verified`, le wording externe reste prudent : « prototype de garde-fous nutritionnels en validation documentaire » (et non pas encore « sourcés »).

## Garde-fous

- `noindex,nofollow` sur toutes les pages publiques tant qu'on est en bêta restreinte.
- Aucune PII patient collectée ni traitée.
- Aucune sortie tool sans `sources` peuplé (refus si pas de citation).
- Disclaimer obligatoire sur chaque sortie tool.
- Pas de promesse réglementaire (HDS, dispositif médical, certifié).
- Allowlist URL côté front (anses.fr, has-sante.fr, mangerbouger.fr, who.int, doi.org, efsa.europa.eu, cngof.fr, data.gouv.fr, recherche.data.gouv.fr, santepubliquefrance.fr, iris.who.int, ciqual.anses.fr).
- Brief refusé si mention de CKD / insuffisance rénale (hors scope v0).

## Licences

- **Code (HTML/CSS/JS, Node)** : © 2026 HOLCO INVEST. Tous droits réservés tant que ce repo reste privé.
- **`corpus/ciqual_2025.json` & `corpus/ciqual_2025_index.json`** : dérivés de [ANSES Ciqual 2025](https://doi.org/10.57745/RDMHWY), licence ouverte Etalab 2.0. Redistribution autorisée avec attribution.
- **`corpus/*.pdf` (HAS, ANSES, OMS, EFSA)** : documents publics téléchargés depuis les sites officiels. Conservés dans ce repo à des fins de **vérification documentaire** uniquement (correspondance avec `rules/clinical_rules.json` → `verbatim` + `pdf_page`). Les droits restent ceux de leurs éditeurs respectifs. Toute redistribution publique de ce repo devra réévaluer leur inclusion.

## Conventions internes

- Source d'édition : `/root/.openclaw/alim/` (ce repo).
- Statique servi : `/var/www/alim/` (déploiement manuel `cp web/* /var/www/alim/`).
- Service Node prod : `/opt/alim/service/` (systemd unit dans `deploy/`).
- Vhost nginx : `/etc/nginx/sites-available/alim`.

## Travail interne

`SCRATCH.md` et `RESUME.md` sont des notes de coordination de l'équipe. Ils restent dans le repo tant qu'il est privé. À retirer si on passe en open-source.

## Co-mainteneurs

- Alan (HOLCO) — corpus, rules, rubriques, front, infra
- Nora (HOLCO) — service Node, validation, futur MCP wrapper
