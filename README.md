# ALIM

**Outil d'aide à la formulation de recettes cliniques** pour les professionnels de la nutrition — diététiciens, nutritionnistes, médecins de la nutrition.

ALIM n'est pas un énième SaaS de gestion patient. Il s'imbrique dans **votre ChatGPT ou Claude habituel** comme une couche métier cadrée : Ciqual 2025, garde-fous HAS / ANSES / EFSA, sources tracées, refus clair hors périmètre. Vous gardez votre flow IA — vous récupérez la rigueur clinique.

> [!IMPORTANT]
> ALIM est un outil d'aide à la formulation, réservé aux **professionnels de santé et de la nutrition**. Les sorties produites ne remplacent pas le jugement clinique du praticien (art. L. 4161-1 du Code de la santé publique). Aucune donnée nominative patient n'est collectée ni traitée.

**Statut** : prototype en validation documentaire — bêta restreinte gratuite. Site officiel : [alim.care](https://alim.care/).

---

## Périmètre clinique bêta

ALIM v0 couvre **deux situations cliniques** uniquement :

- **Diabète de type 2 + HTA**
- **Grossesse + diabète gestationnel**

Toute pathologie hors de ce périmètre (insuffisance rénale, dyslipidémie isolée, pédiatrie, TCA, etc.) déclenche un **refus explicite et tracé**, jamais une improvisation. Extension périmètre dans la roadmap (dyslipidémie, IRC, FODMAP).

---

## Architecture

```
┌────────────────────┐
│   Praticien        │
│   (diététicien)    │
└──────┬─────────────┘
       │
       ▼
┌────────────────────┐         ┌──────────────────────┐
│  ChatGPT / Claude  │  ◀────▶ │   ALIM service       │
│  (IA habituelle)   │  tools  │   /api/v1            │
└────────────────────┘  MCP    │   /mcp/v1            │
                               │   /oauth             │
                               │                      │
                               │   Node.js + SQLite   │
                               │   Corpus Ciqual 2025 │
                               │   27 règles HAS/ANSES│
                               └──────────────────────┘
```

- **Front statique** : HTML/CSS/JS vanilla (pas de framework, pas de build), servi par nginx
- **Backend** : Node.js (modules natifs + `node:sqlite` expérimental), serveur HTTP, sans dépendance externe lourde
- **Stockage compte** : SQLite (`/var/lib/alim/alim.sqlite`) — table `accounts` + `api_keys` (hashées SHA-256) + `api_usage_logs` + `oauth_tokens` + `saved_recipes`
- **Stockage corpus** : filesystem (`corpus/ciqual_2025.json` + PDFs HAS/ANSES)
- **Secrets** : `/etc/alim.env` (hors repo, mode 640 root:root)
- **Mail transactionnel** : Resend (`alim@holco.co`)
- **Pas de DB patient, pas de PII** : chaque génération est stateless, les briefs ne sont pas conservés au-delà de la réponse

---

## Endpoints

### API REST publique

| Endpoint | Méthode | Auth | Description |
|---|---|---|---|
| `/api/health` | GET | — | liveness |
| `/api/generate` | POST | — | Génération démo publique (rate-limited 20/IP/jour) |
| `/api/onboarding/submit` | POST | — | Soumission demande bêta |
| `/api/demo-chat` | POST | — | Chat Mirabelle (SSE, rate-limited) |

### API REST authentifiée (Bearer `alim_live_…` ou OAuth token)

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/v1/me` | GET | Compte + plan + quota + practitioner_profile + cabinet_branding |
| `/api/v1/account` | PUT | Modifier practitioner_profile + cabinet_branding |
| `/api/v1/account/regenerate-key` | POST | Rotation clé d'accès |
| `/api/v1/generate` | POST | Génération avec contexte compte (PDF brandé) |
| `/api/v1/recipes` | GET / POST | Bibliothèque de recettes sauvegardées |
| `/api/v1/recipes/:id` | GET / DELETE | Détail / suppression d'une recette sauvegardée |

### OAuth 2.0 (pour Custom GPT ChatGPT public)

- `GET /oauth/authorize` — page consentement (collecte clé `alim_live_…`)
- `POST /oauth/token` — échange code → access_token
- `/.well-known/oauth-authorization-server` (RFC 8414)
- `/.well-known/oauth-protected-resource` (RFC 9728)

Scope unique : `alim.generate`. Auth method : `client_secret_post`, `client_secret_basic`, `none`. PKCE `S256` supporté.

### MCP — Model Context Protocol (pour Claude Custom Connector / Cursor)

- `POST /mcp/v1` — endpoint Streamable HTTP, Bearer required
- `/.well-known/mcp.json` — manifest v0.1.5, **9 tools** annoncés

**Tools exposés :**

| Tool | Verbe | Description |
|---|---|---|
| `get_alim_account` | read | Lit le compte ALIM connecté |
| `brief_radar` | read | Score la complétude d'une demande, propose la prochaine action utile (1 question max, jamais de questionnaire) |
| `generate_clinical_recipe` | write | Génère une fiche recette cadrée à partir d'un brief patient anonyme |
| `scan_recipe_text` | read | Lit le texte d'une recette existante et la recadre (nutriments, garde-fous, sources) |
| `scan_recipe_url` | read | Lit une recette depuis une URL et la recadre |
| `list_saved_recipes` | read | Liste les recettes de la bibliothèque |
| `save_generated_recipe` | write | Sauvegarde une recette (confirmation explicite) |
| `get_saved_recipe` | read | Détail d'une recette sauvegardée |
| `delete_saved_recipe` | write | Supprime une recette (confirmation explicite) |

---

## Quick start pour les praticiens

1. Demander un accès bêta sur [alim.care/configurer](https://alim.care/configurer/) (gratuit, sans engagement)
2. Recevoir par e-mail une clé `alim_live_…` après validation manuelle
3. Au choix :
   - **ChatGPT** : ouvrir le [GPT ALIM Pro](https://chatgpt.com/g/g-6a10d4e300f0819184833f4b467e53b7-alim-pro), se connecter à ALIM via OAuth, coller la clé une fois — [guide complet](https://alim.care/install/chatgpt/)
   - **Claude.ai** (Pro / Team / Enterprise) : ajouter un Custom Connector avec l'URL `https://alim.care/mcp/v1` + Bearer `alim_live_…` — [guide complet](https://alim.care/install/claude/)
   - **Cursor / autres clients MCP** : endpoint standard `/mcp/v1` + Bearer

Espace praticien : [alim.care/compte](https://alim.care/compte/) — préférences, branding cabinet, clé, quota.

---

## Arborescence

```
/
├── corpus/                         Données nutritionnelles + PDFs sources
│   ├── ciqual_2025.json            ANSES Ciqual 2025 (Etalab 2.0)
│   ├── ciqual_2025_index.json
│   └── *.pdf                       HAS / ANSES / OMS / EFSA (référence vérification)
├── rules/
│   ├── clinical_rules.json         27 règles cliniques activables
│   └── verification_log.md         Suivi vérification documentaire
├── rubrics/
│   ├── demo1_t2_hta.json
│   └── demo2_grossesse_dg.json
├── service/
│   ├── server.js                   Service Node (API + OAuth + MCP)
│   ├── provision-account.js        CLI provisionning compte bêta
│   └── smoke-test.js
├── integrations/
│   └── chatgpt/                    OpenAPI + instructions Custom GPT
├── web/                            Front statique (servi par nginx)
│   ├── index.html
│   ├── compte/                     Espace praticien
│   ├── configurer/                 Onboarding bêta
│   ├── install/chatgpt/            Guide install ChatGPT
│   ├── install/claude/             Guide install Claude
│   ├── sources/                    Corpus public
│   ├── mock-pdf/                   Aperçu PDF cabinet
│   ├── api-docs/                   Doc API
│   └── .well-known/
├── emails/                         Templates Resend (HTML)
└── SCRATCH.md                      Journal coordination Alan / Nora
```

---

## Garde-fous & limites assumées

- **Pas de diagnostic, pas de prescription, pas d'interprétation de bilan biologique à visée médicale** (art. L. 4161-1 CSP)
- **Pas de logiciel dossier patient** — ALIM s'ajoute à votre LDP existant, ne le remplace pas
- **Pas de données nominatives patient** — filtre PII actif (e-mail, téléphone FR, date de naissance, NIR)
- **Pas de fallback IA non cadré** — quota dépassé ou erreur réseau → message explicite, jamais en silence
- **Refus clair hors périmètre** plutôt qu'invention
- **`noindex,nofollow`** sur toutes les pages publiques tant que la bêta documentaire est en cours
- **Allowlist URL côté front** (`anses.fr`, `has-sante.fr`, `mangerbouger.fr`, `who.int`, `doi.org`, `efsa.europa.eu`, `cngof.fr`, `data.gouv.fr`, `recherche.data.gouv.fr`, `santepubliquefrance.fr`, `iris.who.int`, `ciqual.anses.fr`)
- **Aucune revendication réglementaire** (HDS, dispositif médical certifié) — ALIM est un outil d'aide, pas un DM. Le praticien reste responsable de l'usage clinique des sorties.

---

## Statut corpus

27 règles cliniques activables (`rules/clinical_rules.json`) :

- **`verified`** : PDF + page + verbatim cités
- **`derived`** : pratique courante / référentiels convergents
- **`to_verify`** : vérification documentaire en cours

Détail public : [alim.care/sources](https://alim.care/sources/).

Tant que les seuils HAS / ANSES ne sont pas tous en `verified`, le wording public reste prudent : *« prototype de garde-fous nutritionnels en validation documentaire »* (et non « sourcés »).

---

## Licences

- **Code** (HTML/CSS/JS, Node) : © 2026 HOLCO INVEST. Repo public en lecture ; toute réutilisation commerciale nécessite accord écrit.
- **`corpus/ciqual_2025.json` & `corpus/ciqual_2025_index.json`** : dérivés d'[ANSES Ciqual 2025](https://doi.org/10.57745/RDMHWY), licence ouverte **Etalab 2.0**. Redistribution autorisée avec attribution.
- **`corpus/*.pdf`** (HAS, ANSES, OMS, EFSA) : documents publics téléchargés depuis les sites officiels, conservés à des fins de vérification documentaire uniquement. Les droits restent ceux de leurs éditeurs respectifs.

---

## Convention déploiement (interne)

- Source d'édition : `/root/.openclaw/alim/` (ce repo)
- Static prod : `/var/www/alim/`
- Service Node : `/opt/alim/service/` (systemd `alim.service`)
- Watcher admin onboarding : `/opt/alim/admin/` (systemd + cron)
- Vhost nginx : `/etc/nginx/sites-available/alim`

---

## Co-mainteneurs

- **Alan (HOLCO)** — front statique, pages install/compte/configurer, corpus, rubriques, infrastructure, emails templates
- **Nora (HOLCO)** — service Node (API v1, OAuth, MCP), provisioning, validation documentaire, OpenAPI ChatGPT

Coordination dans [`SCRATCH.md`](SCRATCH.md).

---

## Contact

- Bêta praticiens : [alim@holco.co](mailto:alim@holco.co)
- Site : [alim.care](https://alim.care/) · Org : [HOLCO](https://holco.co/)
