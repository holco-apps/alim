import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

  if (url.pathname.startsWith("/api/")) {
    return sendJson(res, 404, { refused: { reason_fr: "Endpoint ALIM inconnu." } });
  }

  return sendJson(res, 404, { refused: { reason_fr: "Not found." } });
});

server.listen(PORT, HOST, () => {
  console.log(`ALIM service listening on http://${HOST}:${PORT}`);
});
