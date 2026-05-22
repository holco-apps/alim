# ALIM — intégration ChatGPT

État au 2026-05-22 : kit Custom GPT prêt pour test manuel.

## Ce qui est livré

- `openapi.yaml` : schéma OpenAPI importable dans les Actions d'un Custom GPT.
- `instructions.md` : consignes système à coller dans le Custom GPT.
- Endpoint public utilisé : `POST https://alim.care/api/generate`.

## Installation manuelle dans ChatGPT

1. Créer un GPT personnalisé.
2. Coller le contenu de `instructions.md` dans les instructions.
3. Ajouter une Action.
4. Importer `openapi.yaml`.
5. Authentification : aucune pour la V0 publique.
6. Tester avec :

```text
Propose une recette de dîner pour un adulte diabète T2 + HTA, fonction rénale normale, hiver, végétarien, sans fruits à coque.
```

## Limites V0

- Périmètre bêta : diabète T2 + HTA, grossesse + diabète gestationnel.
- Pas de clé utilisateur encore branchée.
- Pas de quota par utilisateur ChatGPT.
- Pas de vrai serveur MCP distant ChatGPT encore livré.

## Étape suivante

Si Pierre valide l'usage ChatGPT, deux chemins :

1. **Custom GPT Action stable** : ajouter une clé utilisateur et un endpoint
   d'autorisation simple.
2. **Remote MCP ChatGPT** : construire un serveur MCP HTTPS compatible OpenAI,
   avec authentification OAuth si publication à des tiers.

