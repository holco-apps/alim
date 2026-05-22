import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load /etc/alim.env if present (systemd unit ne charge pas EnvironmentFile pour l'instant)
const ENV_FILE = process.env.ALIM_ENV_FILE || "/etc/alim.env";
if (existsSync(ENV_FILE)) {
  try {
    const content = readFileSync(ENV_FILE, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch (e) {
    console.error("[env] could not read", ENV_FILE, e.message);
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ALIM_ROOT || resolve(__dirname, "..");
const PORT = Number(process.env.ALIM_PORT || 3012);
const HOST = process.env.ALIM_HOST || "127.0.0.1";
const MAX_BODY_BYTES = 16 * 1024;
const DISCLAIMER =
  "Outil d'aide à la formulation, réservé aux professionnels — ne remplace pas le jugement clinique.";

const ciqual = JSON.parse(readFileSync(resolve(ROOT, "corpus/ciqual_2025.json"), "utf8"));
const rules = JSON.parse(readFileSync(resolve(ROOT, "rules/clinical_rules.json"), "utf8"));

const nutrientKeys = [
  "energy_kcal",
  "carb_g",
  "sugar_g",
  "fiber_g",
  "saturated_fat_g",
  "salt_g",
  "potassium_mg",
  "alcohol_g",
  "vit_b9_dfe_ug"
];

const demoRecipes = {
  t2_hta: {
    match: (brief) => hasAll(brief.pathologies, ["diabete_t2", "hta"]),
    recipe: {
      name_fr: "Bol tiède lentilles, quinoa, brocoli et courgette citronnée",
      portion_g: 550,
      ingredients: [
        { name_fr: "Lentilles cuites sans sel", quantity_g: 180, ciqual_code: "20360" },
        { name_fr: "Quinoa cuit sans sel", quantity_g: 80, ciqual_code: "9341" },
        { name_fr: "Brocoli vapeur", quantity_g: 160, ciqual_code: "20304" },
        { name_fr: "Courgette cuite", quantity_g: 120, ciqual_code: "20021" },
        { name_fr: "Huile d'olive vierge extra", quantity_g: 10, ciqual_code: "17270" },
        { name_fr: "Citron, ail, persil, poivre", quantity_g: 0, ciqual_code: null }
      ],
      steps_fr: [
        "Réchauffer les lentilles, le quinoa, le brocoli vapeur et la courgette cuite sans ajout de sel.",
        "Assaisonner avec citron, ail, herbes fraîches et poivre.",
        "Ajouter l'huile d'olive au service pour préserver les acides gras insaturés."
      ]
    },
    rules_applied: [
      "hta_salt_per_day_max",
      "hta_salt_per_meal_max",
      "hta_saturated_fat_per_meal_max",
      "hta_no_alcohol",
      "t2_carb_per_meal_max",
      "t2_carb_per_meal_min",
      "t2_added_sugar_per_meal_max",
      "t2_total_sugar_per_meal_warning",
      "t2_fiber_per_meal_min",
      "t2_low_gi_preferred"
    ],
    warnings: [
      "Apport en sel maîtrisé par les aliments intrinsèques ; aucun sel ajouté dans la recette.",
      "Repas adapté à un dîner ; les autres repas doivent rester compatibles avec l'objectif de 5 g de sel par jour.",
      DISCLAIMER
    ]
  },
  grossesse_dg: {
    match: (brief) => hasAll(brief.pathologies, ["diabete_gestationnel", "grossesse"]),
    recipe: {
      name_fr: "Salade d'été pois chiches, quinoa, épinards lavés et tofu",
      portion_g: 493,
      ingredients: [
        { name_fr: "Pois chiches cuits rincés", quantity_g: 130, ciqual_code: "20507" },
        { name_fr: "Quinoa cuit sans sel", quantity_g: 50, ciqual_code: "9341" },
        { name_fr: "Épinards crus soigneusement lavés", quantity_g: 60, ciqual_code: "20059" },
        { name_fr: "Concombre cru soigneusement lavé", quantity_g: 100, ciqual_code: "20019" },
        { name_fr: "Avocat", quantity_g: 50, ciqual_code: "13004" },
        { name_fr: "Tofu nature pasteurisé", quantity_g: 80, ciqual_code: "20904" },
        { name_fr: "Persil frais soigneusement lavé", quantity_g: 15, ciqual_code: "11014" },
        { name_fr: "Huile d'olive vierge extra", quantity_g: 8, ciqual_code: "17270" }
      ],
      steps_fr: [
        "Laver soigneusement les épinards, le concombre et le persil sous eau courante avant découpe.",
        "Assembler les pois chiches rincés, le quinoa refroidi, les légumes lavés, l'avocat et le tofu pasteurisé.",
        "Assaisonner avec huile d'olive, citron et herbes lavées, sans sucre ajouté ni alcool."
      ]
    },
    rules_applied: [
      "dg_carb_per_meal_max",
      "dg_added_sugar_per_meal_max",
      "dg_total_sugar_per_meal_warning",
      "dg_low_gi_required",
      "dg_fiber_per_meal_min",
      "grossesse_no_raw_cheese",
      "grossesse_no_raw_fish",
      "grossesse_no_raw_meat",
      "grossesse_no_raw_eggs",
      "grossesse_no_charcuterie_cuite_courte",
      "grossesse_no_alcohol",
      "grossesse_wash_raw_vegetables",
      "grossesse_b9_per_day_min"
    ],
    warnings: [
      "Tous les végétaux crus de cette recette doivent être lavés soigneusement avant découpe.",
      "Aucun fromage au lait cru, poisson cru, œuf cru, charcuterie ou alcool n'est inclus.",
      "Les folates alimentaires ne remplacent pas la supplémentation prescrite pendant la grossesse.",
      DISCLAIMER
    ]
  }
};

function hasAll(values = [], required) {
  const set = new Set(values);
  return required.every((value) => set.has(value));
}

function normalizeBrief(input) {
  const brief = {
    pathologies: normalizeList(input.pathologies),
    diet_type: cleanText(input.diet_type || "omnivore", 32),
    season: cleanText(input.season || "all", 32),
    meal_slot: cleanText(input.meal_slot || "dejeuner", 32),
    portions: clampInt(input.portions, 1, 8, 1),
    equipment: normalizeList(input.equipment),
    notes: cleanText(input.notes || input.notes_fr || "", 600)
  };

  const text = [
    ...brief.pathologies,
    brief.diet_type,
    brief.season,
    brief.meal_slot,
    ...brief.equipment,
    brief.notes
  ].join(" ").toLowerCase();

  if (/(insuffisance\s+r[ée]nale|ckd|irc|dialyse)/i.test(text)) {
    return refused("ALIM v0 refuse les briefs avec insuffisance rénale ou CKD : ce cas reste hors démo publique.");
  }
  if (brief.pathologies.length === 0) {
    return refused("Indiquez au moins une pathologie pour charger les règles cliniques.");
  }
  if (brief.pathologies.includes("grossesse") && brief.pathologies.includes("hta")) {
    return refused("ALIM v0 ne couvre pas encore l'intersection grossesse + HTA.");
  }
  return { ok: true, brief };
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(String(item), 64).toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function refused(reason_fr, status = 422) {
  return { ok: false, status, payload: { refused: { reason_fr }, warnings: [DISCLAIMER] } };
}

function selectRecipe(brief) {
  for (const config of Object.values(demoRecipes)) {
    if (config.match(brief)) return config;
  }
  return null;
}

function computeNutrients(recipe) {
  const totals = Object.fromEntries(nutrientKeys.map((key) => [key, 0]));
  let matched = 0;
  let unmatched = 0;

  for (const ingredient of recipe.ingredients) {
    if (!ingredient.ciqual_code) continue;
    const food = ciqual.foods[ingredient.ciqual_code];
    if (!food) {
      unmatched += 1;
      continue;
    }
    matched += 1;
    for (const key of nutrientKeys) {
      totals[key] += ((food.nutrients_per_100g[key] ?? 0) * ingredient.quantity_g) / 100;
    }
  }

  totals.added_sugar_g = detectAddedSugar(recipe) ? 10 : 0;
  return {
    nutrients: formatNutrients(totals),
    coverage_summary: {
      matched,
      unmatched,
      estimated: 0,
      overall_confidence: unmatched === 0 ? "high" : "medium"
    }
  };
}

function detectAddedSugar(recipe) {
  const text = recipe.ingredients.map((ingredient) => ingredient.name_fr).join(" ").toLowerCase();
  return /\b(sucre|miel|sirop|confiture|cassonade)\b/.test(text);
}

function formatNutrients(totals) {
  const rename = { sugar_g: "sugar_g_total" };
  const output = {};
  for (const [key, value] of Object.entries(totals)) {
    output[rename[key] || key] = {
      value: round(value, key.includes("_mg") || key.includes("_ug") ? 0 : 1),
      source: key === "added_sugar_g" ? "estimated" : "ciqual",
      confidence: key === "added_sugar_g" ? "medium" : "high"
    };
  }
  return output;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validateRecipe(config, nutrients) {
  const failures = [];
  const warnings = [...config.warnings];
  const n = nutrients;
  const max = (field, limit, label) => {
    if ((n[field]?.value ?? Infinity) > limit) failures.push(`${label} > ${limit}`);
  };
  const min = (field, limit, label) => {
    if ((n[field]?.value ?? -Infinity) < limit) failures.push(`${label} < ${limit}`);
  };

  if (config === demoRecipes.t2_hta) {
    max("salt_g", 1.6, "sel");
    max("carb_g", 60, "glucides");
    min("carb_g", 30, "glucides");
    max("added_sugar_g", 10, "sucres ajoutés");
    min("fiber_g", 7, "fibres");
    max("saturated_fat_g", 7, "acides gras saturés");
    if ((n.sugar_g_total?.value ?? 0) > 25) warnings.push("Sucres totaux élevés : vérifier la source des sucres naturels.");
  }

  if (config === demoRecipes.grossesse_dg) {
    max("carb_g", 45, "glucides");
    min("carb_g", 20, "glucides");
    max("added_sugar_g", 0, "sucres ajoutés");
    min("fiber_g", 7, "fibres");
    min("vit_b9_dfe_ug", 130, "folates");
    max("alcohol_g", 0, "alcool");
    if ((n.sugar_g_total?.value ?? 0) > 15) warnings.push("Sucres totaux au-dessus du seuil d'alerte DG : vérifier leur origine.");
  }

  return { failures, warnings };
}

function buildSources(ruleIds) {
  const allRules = Object.values(rules.pathologies).flatMap((p) => p.rules);
  const byId = new Map(allRules.map((rule) => [rule.id, rule]));
  const sources = [
    {
      citation: "ANSES Ciqual 2025 — table de composition nutritionnelle des aliments, licence ouverte Etalab 2.0.",
      url: "https://ciqual.anses.fr/"
    }
  ];

  for (const id of ruleIds) {
    const rule = byId.get(id);
    if (!rule || !rule.source_url || rule.source_status !== "verified") continue;
    sources.push({ citation: rule.source_fr, url: rule.source_url });
  }

  return dedupeSources(sources);
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = `${source.citation}|${source.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generate(brief) {
  const config = selectRecipe(brief);
  if (!config) {
    return refused(
      "ALIM v0 couvre seulement les deux démos publiques : diabète T2 + HTA, ou grossesse + diabète gestationnel.",
      422
    );
  }

  const { nutrients, coverage_summary } = computeNutrients(config.recipe);
  const { failures, warnings } = validateRecipe(config, nutrients);
  if (failures.length > 0) {
    return refused(`Recette refusée par validation déterministe : ${failures.join(", ")}.`, 422);
  }

  return {
    ok: true,
    status: 200,
    payload: {
      recipe: config.recipe,
      nutrients_per_portion: nutrients,
      coverage_summary,
      rules_applied: config.rules_applied,
      sources: buildSources(config.rules_applied),
      warnings
    }
  };
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const err = new Error("Payload too large");
      err.status = 413;
      throw err;
    }
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const err = new Error("Invalid JSON");
    err.status = 400;
    throw err;
  }
}

// ----- Onboarding (bêta /configurer/) -----------------------------------
const ONBOARDING_DIR = process.env.ALIM_ONBOARDING_DIR || "/var/lib/alim/onboarding";
const ONBOARDING_FILE = `${ONBOARDING_DIR}/submissions.jsonl`;
const REQUIRED_FIELDS = ["cabinet_name", "ville", "exercice", "annees", "prenom", "nom", "email", "ia_preferee"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STR_LIMIT = 1000;

function clampStr(s) {
  return typeof s === "string" ? s.trim().slice(0, STR_LIMIT) : "";
}

function randomToken() {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return "alim-" + Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}

async function handleOnboardingSubmit(input) {
  const data = (input && typeof input === "object") ? input : {};
  // Validate required fields
  for (const k of REQUIRED_FIELDS) {
    if (!clampStr(data[k])) {
      return { status: 400, payload: { ok: false, error: `Champ manquant : ${k}` } };
    }
  }
  const email = clampStr(data.email);
  if (!EMAIL_RE.test(email)) {
    return { status: 400, payload: { ok: false, error: "Email invalide." } };
  }
  if (data.cgu_accepted !== true || data.engagement_feedback !== true) {
    return { status: 400, payload: { ok: false, error: "Acceptation des conditions et de l'engagement requises." } };
  }
  const token = randomToken();
  const record = {
    token,
    ts: new Date().toISOString(),
    cabinet_name: clampStr(data.cabinet_name),
    ville: clampStr(data.ville),
    exercice: clampStr(data.exercice),
    annees: clampStr(data.annees),
    prenom: clampStr(data.prenom),
    nom: clampStr(data.nom),
    email,
    ia_preferee: clampStr(data.ia_preferee),
    motif: clampStr(data.motif || ""),
    cgu_accepted: true,
    engagement_feedback: true,
    source: clampStr(data.source || "alim.care/configurer"),
  };
  // Append to JSONL
  const { promises: fsp } = await import("node:fs");
  await fsp.mkdir(ONBOARDING_DIR, { recursive: true }).catch(() => {});
  await fsp.appendFile(ONBOARDING_FILE, JSON.stringify(record) + "\n", "utf8");
  console.log(`[onboarding] ${token} ${record.email} ${record.cabinet_name}`);
  // Optional: notify via Resend if key present
  if (process.env.RESEND_API_KEY) {
    notifyResend(record).catch((e) => console.error("[onboarding] notify error:", e.message));
  }
  return { status: 200, payload: { ok: true, token } };
}

async function notifyResend(record) {
  const html = `
<p>Nouvelle demande bêta ALIM — <strong>${escapeHtml(record.cabinet_name)}</strong></p>
<ul>
  <li><strong>${escapeHtml(record.prenom)} ${escapeHtml(record.nom)}</strong> &lt;${escapeHtml(record.email)}&gt;</li>
  <li>Ville : ${escapeHtml(record.ville)}</li>
  <li>Exercice : ${escapeHtml(record.exercice)} · ${escapeHtml(record.annees)}</li>
  <li>IA préférée : ${escapeHtml(record.ia_preferee)}</li>
  <li>Motif : ${escapeHtml(record.motif || "—")}</li>
  <li>Token : <code>${record.token}</code></li>
</ul>`.trim();
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "ALIM <alim@holco.co>",
      to: process.env.RESEND_TO || "alim@holco.co",
      subject: `[ALIM] Nouvelle demande bêta — ${record.cabinet_name}`,
      html,
    }),
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ===== Demo chat (alim.care widget) =====================================
const DEMO_MODEL = process.env.ALIM_DEMO_MODEL || "claude-sonnet-4-6";
const DEMO_RATE_LIMIT_PER_IP_PER_DAY = 20;
const DEMO_RATE_LIMIT_GLOBAL_PER_HOUR = 120;
const demoIpRl = new Map();   // ip → { count, resetAt }
const demoGlobalRl = { count: 0, resetAt: 0 };

const DEMO_SYSTEM_PROMPT = `Vous êtes **Mirabelle**, agente de démonstration d'ALIM. Vous faites découvrir l'outil ALIM aux diététiciennes libérales en l'appelant en outil dans la conversation. Vous n'êtes PAS ALIM : vous êtes une IA qui *utilise* ALIM via function-calling, exactement comme ChatGPT ou Claude le feront chez la praticienne une fois la bêta installée.

**RÈGLE STRICTE DE POLITESSE** : vous vouvoyez TOUJOURS l'interlocutrice. Jamais de "tu". Jamais de "ton", "ta", "tes". Toujours "vous", "votre", "vos". Pas d'exception.

Identité :
- Vous vous présentez "Mirabelle" si on vous demande qui vous êtes. Pas "ALIM".
- Vous rappelez que vous êtes une démo publique, et que les vraies sorties ALIM se font dans l'IA habituelle du praticien.

**Présentation d'ALIM** — quand on vous demande "qu'est-ce qu'ALIM ?", "à quoi sert ALIM ?", ou questions similaires, vous répondez de manière courte et structurée (3 points) :
1. ALIM est un outil d'aide à la formulation nutritionnelle pour diététiciennes libérales françaises.
2. ALIM s'installe dans votre IA habituelle (ChatGPT, Claude, Mistral…) via Custom GPT ou serveur MCP. C'est l'IA qui rédige ; ALIM ajoute les calculs Ciqual, les garde-fous cliniques HAS/ANSES/EFSA, et les sources.
3. La bêta couvre deux situations : diabète T2 + HTA, et grossesse + diabète gestationnel. Pour rejoindre la bêta : /configurer/.

Ne récitez pas mécaniquement ces 3 points pour chaque message — uniquement quand on vous interroge sur ALIM lui-même.

**LIMITE DE LA DÉMO** : une seule recette par session. Après avoir appelé generate_clinical_recipe une fois avec succès, vous ne pouvez plus appeler le tool dans la même conversation. Si l'utilisatrice demande une autre recette, vous répondez poliment qu'une seule génération est possible en démo publique, et que les générations illimitées sont disponibles via /configurer/ (bêta). Vous restez disponible pour des questions sur ALIM.

Votre rôle est strict : aider à formuler UNE recette cadrée pour les deux situations couvertes en bêta. Pas plus.

---

## MODE CONSULTATION — questions techniques avant la recette

Vous êtes une **agente technique**, pas un générateur passif. Avant d'appeler generate_clinical_recipe, vous menez un mini-cadrage clinique en 2 ou 3 questions ciblées, **adaptées au profil annoncé**. Une diététicienne attend que vous l'aidiez à formuler le bon brief, pas que vous deviniez.

Règles du cadrage :
- **2 ou 3 questions par message maximum**, jamais 5+. Vous êtes consultative, pas un formulaire.
- Vous posez les questions **par batch** (2-3 d'un coup), pas une à la fois. Cela respecte le temps de la praticienne.
- Vous ne posez QUE des questions utiles pour le tool ou pour les garde-fous SFD/HAS/ANSES applicables.
- **Une fois que vous avez les paramètres clés** (repas + équipement + saison + 1-2 cadrages cliniques pertinents au profil), vous **annoncez votre intention d'appeler le tool** ("Avec ces éléments, je génère la recette."), puis appelez immédiatement generate_clinical_recipe.
- Si la praticienne dit "vas-y" ou "génère" sans avoir tout précisé, vous générez avec ce que vous avez (et les défauts plate/four, omnivore, all-season).

**Profils et questions-types** (à adapter au contexte) :

### Diabète T2 + HTA (adulte)
Questions essentielles à couvrir :
- Repas concerné (petit-déjeuner / déjeuner / dîner / collation) et saison
- Équipement cuisine disponible
- **Fonction rénale OK** (sinon → refus, CKD hors périmètre)
- **Préférences alimentaires** : omnivore / végétarien / vegan / pescétarien / sans gluten / sans lactose
- **Statut HbA1c approximatif** ou recul sur l'équilibre glycémique (optionnel mais utile pour calibrer le ton)
- Allergies / aversions

Cadrage SFD/HAS sous-jacent (vous mobilisez quand pertinent) :
- Sucres limités, pas interdits (référence SFD 2021/2022)
- Sel ≤ 5 g/jour total (OMS), donc < 1.5 g pour ce repas
- AGS < 10 % de l'apport énergétique (ANSES)
- Fibres ≥ 25-30 g/jour adulte (Ameli)

### Grossesse + Diabète Gestationnel
Questions essentielles :
- **Trimestre** (1er, 2e, 3e) — change les besoins folates / fer / précautions
- **Statut toxoplasmose** (immunisée ou non) — change l'autorisation des végétaux crus
- Repas concerné, saison, équipement
- **Préférences / aversions / nausées** (très fréquentes)
- Compléments en cours (folates, fer, iode…)
- Allergies

Cadrage SFD/HAS/ANSES sous-jacent :
- IG bas obligatoire pour DG (SFD 2021/2022 — verified)
- Glucides cadrés par repas (DG)
- Sucres ajoutés à éviter en démo ALIM v0 (choix démo simplificateur, **pas interdiction clinique générale** — SFD : produits sucrés en quantité limitée intégrés à la ration glucidique journalière)
- Légumes crus → laver soigneusement (toxoplasmose ANSES) ou cuire si non immunisée
- Charcuterie crue, fromages au lait cru, poissons fumés → exclus (listériose)
- Alcool → zéro (HAS, grade A)
- Folates B9 cible 600 µg/j période péri-conceptionnelle (HAS)

### Hors périmètre détecté (insuffisance rénale / CKD / dyslipidémie isolée / autre)
- Refus poli, court, traçable. Orientation /configurer/ pour rejoindre la bêta sur les situations couvertes. Pas de tentative de "demi-recette".
- **Dyslipidémie / hypercholestérolémie isolée** : explicitement hors périmètre v0 publique (revue documentaire dédiée à venir). Vous refusez et orientez sans appeler le tool.

---

## RÈGLES DE CITATION DES SOURCES

Quand vous présentez les sources retournées par le tool, respectez strictement le contrat downstream :
- Les sources dont le statut est **verified** peuvent être présentées comme "source officielle" / "source vérifiée".
- Les sources dont le statut est **derived** sont à introduire comme "**Référence consultée** (pratique convergente)" — **jamais** comme "source officielle directe".
- Les sources dont le statut est **to_verify** sont à introduire comme "**Référence identifiée** (vérification documentaire en cours)".
- Quand le tool ne précise pas le statut, soyez prudente : préférez "consultée" à "vérifiée".

Cela évite de claim une autorité HAS/ANSES que nous n'avons pas encore re-checkée. La science derrière la règle reste valide, c'est notre vérification documentaire qui est partielle.

**Important** : vos questions doivent **toujours sembler venir d'une praticienne expérimentée**, pas d'un chatbot. Évitez les listes mécaniques. Préférez une formulation conversationnelle naturelle, courte (2-3 phrases avant les questions).

Exemple de bon premier message après un brief T2+HTA :
> Bien noté. Avant que je génère, deux questions rapides : la fonction rénale est-elle conservée (on est sur diabète T2 stable, pas de CKD) ? Et côté repas, vous pensez à un déjeuner ou un dîner, avec quel équipement ?

Exemple de bon premier message après un brief DG :
> Très bien. Pour cadrer la recette, j'aurais besoin de trois précisions : à quel trimestre est la patiente, et est-elle immunisée toxoplasmose (ça change ce qu'on peut servir cru) ? Et le repas concerné, en quelle saison ?

Périmètre couvert (sortie autorisée) :
- Diabète T2 + HTA (adulte, fonction rénale normale, hors grossesse)
- Grossesse + diabète gestationnel (hors complication aiguë)

Tout le reste → refuser poliment et orienter vers la bêta (/configurer/). En particulier l'insuffisance rénale (CKD) est explicitement hors périmètre.

Ton :
- Pro mais proche. Pas condescendante, pas survendeuse, pas robotique.
- Phrases courtes. Pas d'emoji. Pas de tournures bavardes.
- Si jargon, courte définition entre parenthèses la première fois.

Format d'échange :
1. Si le brief est incomplet → poser 2 ou 3 questions courtes et ciblées. Ne pas appeler le tool.
2. Si le brief couvre déjà les paramètres clés → reformuler en une phrase le brief compris, annoncer "Avec ces éléments, je génère la recette.", puis appeler generate_clinical_recipe.
3. Si l'utilisatrice répond "vas-y", "génère", "fais avec", ou équivalent après vos questions → appeler generate_clinical_recipe avec les informations disponibles et les valeurs par défaut.
4. Après le tool call, présenter la sortie ALIM en quelques phrases : titre, 3 nutriments clés, 1-2 garde-fous, sources. Toujours mentionner "Sous votre supervision clinique."
5. Si le brief est hors périmètre → refus court + orientation /configurer/ pour rejoindre la bêta sur les situations couvertes. Ne JAMAIS suggérer que /configurer/ ouvre un outil hors périmètre. Ne JAMAIS donner d'amorce nutritionnelle (phosphore, potassium, protéines, etc.) sur une situation que tu n'as pas générée via le tool.
6. Tu ne dois jamais inventer de valeurs nutritionnelles ni de règles cliniques en dehors du tool. Si le tool refuse, tu présentes le refus, pas de contournement.

Règles de présentation des nutriments (CRITIQUE — diététicienne lit) :
- Convention française Ciqual : les **glucides** affichés (carb_g) sont les **glucides assimilables**, **distincts des fibres** (fiber_g). Ne JAMAIS écrire "glucides dont fibres" ou "57 g glucides (dont 23 g fibres)". Présenter les fibres comme une ligne séparée : "glucides 57 g, fibres 23 g".
- Présenter UNIQUEMENT les valeurs retournées par le tool. Ne jamais ajouter de qualificatif que le tool n'a pas donné : pas d'"index glycémique bas/haut", pas d'"équilibre acido-basique", pas de "charge glycémique", pas d'"index inflammatoire". Si tu veux mentionner un mécanisme, fais-le en pédagogie générale ("les lentilles apportent des fibres solubles") sans chiffrer ni qualifier la recette elle-même.
- Les garde-fous présentés doivent provenir des règles actually retournées par le tool (champ rules ou activations). Pas de garde-fou inventé.
- Sources : ne citer que celles présentes dans la sortie du tool. "Ciqual 2025 (ANSES)" est toujours juste pour les nutriments. Pour les seuils cliniques, citer la source exacte retournée (HAS, OMS sodium, EFSA folate, ANSES toxoplasmose, etc.).

Données patient :
- Le visiteur peut donner des infos anonymes sur un cas (pathologie, âge, contraintes, équipement). C'est OK.
- S'il donne nom/prénom/date de naissance/numéro → demander de retirer. Tu refuses de traiter avec des identifiants nominatifs.

Tu es une démo publique. Court, utile, honnête.`;

const DEMO_TOOLS = [
  {
    name: "generate_clinical_recipe",
    description: "Génère une recette diététique cadrée par les règles cliniques et la base Ciqual 2025. Renvoie titre, ingrédients en grammes, nutriments par portion, garde-fous activés, sources. Ne fournit qu'une sortie auditée — refuse hors périmètre.",
    input_schema: {
      type: "object",
      properties: {
        pathologies: {
          type: "array",
          items: { type: "string", enum: ["diabete_t2", "hta", "diabete_gestationnel", "grossesse"] },
          description: "Pathologies à prendre en compte. Doit correspondre à un périmètre couvert."
        },
        meal_slot: {
          type: "string",
          enum: ["petit_dejeuner", "dejeuner", "diner", "collation"],
          description: "Repas concerné."
        },
        diet_type: {
          type: "string",
          enum: ["omnivore", "vegetarien", "vegan", "pescetarien", "sans_gluten", "sans_lactose"],
          default: "omnivore"
        },
        season: {
          type: "string",
          enum: ["printemps", "ete", "automne", "hiver", "all"],
          default: "all"
        },
        equipment: {
          type: "array",
          items: { type: "string", enum: ["plaque", "four", "vapeur", "micro_ondes", "blender"] },
          default: ["plaque", "four"]
        },
        portions: { type: "integer", default: 1 },
        notes: { type: "string", description: "Brief anonymisé (sans données identifiantes)." }
      },
      required: ["pathologies", "meal_slot"]
    }
  }
];

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.socket?.remoteAddress || "0.0.0.0";
}

function demoRateLimitOk(ip) {
  const now = Date.now();
  if (now > demoGlobalRl.resetAt) {
    demoGlobalRl.count = 0;
    demoGlobalRl.resetAt = now + 60 * 60 * 1000;
  }
  if (demoGlobalRl.count >= DEMO_RATE_LIMIT_GLOBAL_PER_HOUR) {
    return { ok: false, reason: "global" };
  }
  const ipState = demoIpRl.get(ip) || { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  if (now > ipState.resetAt) {
    ipState.count = 0;
    ipState.resetAt = now + 24 * 60 * 60 * 1000;
  }
  if (ipState.count >= DEMO_RATE_LIMIT_PER_IP_PER_DAY) {
    return { ok: false, reason: "ip", resetAt: ipState.resetAt };
  }
  ipState.count += 1;
  demoIpRl.set(ip, ipState);
  demoGlobalRl.count += 1;
  return { ok: true };
}

// Préfiltre PII local — bloque avant tout appel Anthropic.
// Garde-fou pour éviter qu'un visiteur colle par accident nom/email/tél/date NIR.
const PII_PATTERNS = [
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, label: "adresse e-mail" },
  { re: /(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}\b/, label: "numéro de téléphone" },
  { re: /\b\d{2}[\/.-]\d{2}[\/.-](?:19|20)\d{2}\b/, label: "date complète (potentielle date de naissance)" },
  { re: /\b[12]\s?\d{2}\s?(?:0[1-9]|1[0-2])\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/, label: "numéro de sécurité sociale" },
  { re: /\b\d{15}\b/, label: "séquence de 15 chiffres (potentiel NIR / IBAN)" },
];

function detectPii(text) {
  for (const p of PII_PATTERNS) {
    if (p.re.test(text)) return p.label;
  }
  return null;
}

async function handleDemoChat(req, res) {
  // Setup SSE early
  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 503, { ok: false, error: "Démo indisponible — ANTHROPIC_API_KEY manquante côté serveur." });
  }

  let input;
  try {
    input = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: "Body JSON invalide." });
  }

  // Accepte 2 formats : { message: "..." } (one-shot, legacy) OU { messages: [{role, content}] } (conversation multi-tour)
  let convo = [];
  if (Array.isArray(input?.messages)) {
    if (input.messages.length === 0) {
      return sendJson(res, 400, { ok: false, error: "Conversation vide." });
    }
    if (input.messages.length > 20) {
      return sendJson(res, 400, { ok: false, error: "Conversation trop longue (20 messages max)." });
    }
    let totalChars = 0;
    for (const m of input.messages) {
      const role = m?.role;
      const content = typeof m?.content === "string" ? m.content.trim() : "";
      if ((role !== "user" && role !== "assistant") || !content) {
        return sendJson(res, 400, { ok: false, error: "Format messages invalide." });
      }
      if (content.length > 2000) {
        return sendJson(res, 400, { ok: false, error: "Un message dépasse 2000 caractères." });
      }
      totalChars += content.length;
      if (totalChars > 8000) {
        return sendJson(res, 400, { ok: false, error: "Conversation totale > 8000 caractères." });
      }
      convo.push({ role, content });
    }
    // Le dernier doit être user (sinon, on ne sait pas quoi répondre)
    if (convo[convo.length - 1].role !== "user") {
      return sendJson(res, 400, { ok: false, error: "Le dernier message doit être de l'utilisateur." });
    }
  } else {
    const message = typeof input?.message === "string" ? input.message.trim() : "";
    if (!message) {
      return sendJson(res, 400, { ok: false, error: "Message vide." });
    }
    if (message.length > 1200) {
      return sendJson(res, 400, { ok: false, error: "Message trop long (1200 caractères max)." });
    }
    convo = [{ role: "user", content: message }];
  }

  // PII preflight — sur le dernier user message uniquement (les précédents ont déjà été validés)
  const lastUserMsg = convo[convo.length - 1].content;
  const piiKind = detectPii(lastUserMsg);
  if (piiKind) {
    return sendJson(res, 422, {
      ok: false,
      error: `Brief refusé : ${piiKind} détectée. Mirabelle ne traite que des briefs anonymisés (pathologie, profil clinique, contraintes alimentaires, équipement). Retirez les coordonnées avant d'envoyer.`
    });
  }

  const ip = getClientIp(req);
  const rl = demoRateLimitOk(ip);
  if (!rl.ok) {
    return sendJson(res, 429, {
      ok: false,
      error: rl.reason === "global"
        ? "Beaucoup de demandes en cours sur la démo. Réessayez dans une heure."
        : `Limite démo atteinte (${DEMO_RATE_LIMIT_PER_IP_PER_DAY}/jour). Rejoignez la bêta sur /configurer/ pour un accès dédié.`
    });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  sse({ type: "start" });

  let Anthropic;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch (e) {
    sse({ type: "error", message: "SDK Anthropic non disponible côté serveur." });
    return res.end();
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // Limite à 4 cycles internes LLM↔tool DANS la même requête HTTP (pas 4 tours utilisateur).
    // Le frontend envoie un message one-shot ; on borne le nombre d'allers-retours du modèle pour
    // borner le coût et éviter les boucles si jamais Claude rappelait le tool de manière imprévue.
    for (let turn = 0; turn < 4; turn++) {
      const stream = client.messages.stream({
        model: DEMO_MODEL,
        max_tokens: 700,
        system: DEMO_SYSTEM_PROMPT,
        tools: DEMO_TOOLS,
        messages: convo
      });

      const blocks = [];
      let current = null;

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          current = { ...event.content_block };
          if (current.type === "tool_use") {
            current.inputJson = "";
            sse({ type: "tool_use_start", name: current.name });
          }
        } else if (event.type === "content_block_delta") {
          const d = event.delta;
          if (current?.type === "text" && d?.type === "text_delta") {
            current.text = (current.text || "") + d.text;
            sse({ type: "text", delta: d.text });
          } else if (current?.type === "tool_use" && d?.type === "input_json_delta") {
            current.inputJson += d.partial_json || "";
          }
        } else if (event.type === "content_block_stop") {
          if (current?.type === "tool_use") {
            try { current.input = JSON.parse(current.inputJson || "{}"); } catch { current.input = {}; }
          }
          if (current) blocks.push(current);
          current = null;
        }
      }

      const message_ = await stream.finalMessage();
      const stopReason = message_.stop_reason;

      // Assemble assistant message for conversation history
      const assistantContent = blocks.map((b) => {
        if (b.type === "text") return { type: "text", text: b.text || "" };
        if (b.type === "tool_use") return { type: "tool_use", id: b.id, name: b.name, input: b.input };
        return null;
      }).filter(Boolean);
      convo.push({ role: "assistant", content: assistantContent });

      // If a tool was called, execute it and feed back
      const toolBlocks = blocks.filter((b) => b.type === "tool_use");
      if (toolBlocks.length > 0 && stopReason === "tool_use") {
        const toolResults = [];
        for (const tb of toolBlocks) {
          if (tb.name === "generate_clinical_recipe") {
            const brief = {
              pathologies: tb.input.pathologies || [],
              meal_slot: tb.input.meal_slot || "dejeuner",
              diet_type: tb.input.diet_type || "omnivore",
              season: tb.input.season || "all",
              equipment: tb.input.equipment || ["plaque", "four"],
              portions: tb.input.portions || 1,
              notes: tb.input.notes || ""
            };
            const normalized = normalizeBrief(brief);
            let outputPayload;
            if (!normalized.ok) {
              outputPayload = normalized.payload;
            } else {
              const r = generate(normalized.brief);
              outputPayload = r.payload;
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: tb.id,
              content: JSON.stringify(outputPayload).slice(0, 8000)
            });
            sse({ type: "tool_use_end", name: tb.name, ok: !outputPayload.refused });
          }
        }
        convo.push({ role: "user", content: toolResults });
        continue; // next turn
      }

      // No tool, end of conversation
      break;
    }
    sse({ type: "done" });
  } catch (err) {
    console.error("[demo-chat] error:", err.message);
    sse({ type: "error", message: "La démo a rencontré une erreur. Réessayez ou rejoignez la bêta sur /configurer/." });
  } finally {
    res.end();
  }
}
// ========================================================================

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "alim", version: "0.1.0" });
  }

  if (req.method === "GET" && url.pathname === "/api/v1/me") {
    return sendJson(res, 200, {
      ok: true,
      service: "ALIM",
      mode: "prototype",
      scopes: ["generate:demo"],
      disclaimer: DISCLAIMER
    });
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    try {
      const input = await readJson(req);
      const normalized = normalizeBrief(input);
      if (!normalized.ok) return sendJson(res, normalized.status, normalized.payload);
      const result = generate(normalized.brief);
      return sendJson(res, result.status, result.payload);
    } catch (error) {
      return sendJson(res, error.status || 500, {
        refused: { reason_fr: error.status ? error.message : "Erreur interne ALIM." },
        warnings: [DISCLAIMER]
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/onboarding/submit") {
    try {
      const input = await readJson(req);
      const r = await handleOnboardingSubmit(input);
      return sendJson(res, r.status, r.payload);
    } catch (error) {
      return sendJson(res, error.status || 500, {
        ok: false,
        error: error.message || "Erreur interne lors de la soumission."
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/demo-chat") {
    return handleDemoChat(req, res);
  }

  if (url.pathname.startsWith("/api/")) {
    return sendJson(res, 404, { refused: { reason_fr: "Endpoint ALIM inconnu." } });
  }

  return sendJson(res, 404, { refused: { reason_fr: "Not found." } });
});

server.listen(PORT, HOST, () => {
  console.log(`ALIM service listening on http://${HOST}:${PORT}`);
});
