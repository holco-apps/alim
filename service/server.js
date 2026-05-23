import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";

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
  "protein_g",
  "carb_g",
  "fat_g",
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
    profile_id: "t2_hta",
    match: (brief) => hasAll(brief.pathologies, ["diabete_t2", "hta"]),
    recipes_by_meal: {
      petit_dejeuner: {
        name_fr: "Bol d'avoine crémeux, fromage blanc, framboises et chia",
        portion_g: 527,
        prep_time_min: 8,
        cooking_time_min: 3,
        difficulty_fr: "Très simple",
        ingredients: [
          { name_fr: "Flocons d'avoine cuits à l'eau", quantity_g: 250, ciqual_code: "9313" },
          { name_fr: "Fromage blanc nature 2-3% MG", quantity_g: 130, ciqual_code: "19646" },
          { name_fr: "Framboises fraîches", quantity_g: 100, ciqual_code: "13015" },
          { name_fr: "Graines de chia", quantity_g: 12, ciqual_code: "15047" },
          { name_fr: "Amandes sans sel concassées", quantity_g: 15, ciqual_code: "15000" },
          { name_fr: "Cannelle, vanille, zeste de citron", quantity_g: 0, ciqual_code: null }
        ],
        steps_fr: [
          "Réchauffer les flocons d'avoine déjà cuits avec 2 à 3 cuillères à soupe d'eau, à feu doux, jusqu'à obtenir une texture crémeuse.",
          "Hors du feu, incorporer le fromage blanc pour garder une texture fraîche et limiter l'ajout de matière grasse.",
          "Ajouter les framboises, les graines de chia et les amandes concassées.",
          "Parfumer avec cannelle, vanille ou zeste de citron, sans sucre, miel ni sirop ajouté.",
          "Servir dans un bol. Si le patient préfère une texture plus fluide, détendre avec un peu d'eau ou de lait écrémé non compté dans cette version."
        ],
        patient_note_fr: "Petit-déjeuner rassasiant, doux et non salé, pensé pour limiter le grignotage de fin de matinée.",
        shopping_list_fr: [
          "Flocons d'avoine nature",
          "Fromage blanc nature 2-3% MG",
          "Framboises fraîches ou surgelées non sucrées",
          "Graines de chia",
          "Amandes sans sel",
          "Cannelle, vanille ou citron"
        ],
        substitutions_fr: [
          "Framboises → myrtilles ou kiwi en quantité comparable.",
          "Amandes → noisettes sans sel, en gardant une petite portion.",
          "Fromage blanc → yaourt nature non sucré si mieux toléré."
        ],
        serving_tips_fr: [
          "Ne pas ajouter de miel, sirop d'agave ou confiture.",
          "Ajouter cannelle ou vanille pour renforcer la perception sucrée sans sucre ajouté."
        ]
      },
      dejeuner: {
        name_fr: "Assiette pois chiches, quinoa, aubergine rôtie et herbes citronnées",
        portion_g: 555,
        prep_time_min: 15,
        cooking_time_min: 25,
        difficulty_fr: "Simple",
        ingredients: [
          { name_fr: "Pois chiches cuits rincés", quantity_g: 140, ciqual_code: "20507" },
          { name_fr: "Quinoa cuit sans sel", quantity_g: 60, ciqual_code: "9341" },
          { name_fr: "Aubergine rôtie sans sel", quantity_g: 190, ciqual_code: "20300" },
          { name_fr: "Épinards cuits", quantity_g: 120, ciqual_code: "20027" },
          { name_fr: "Oignon poêlé sans matière grasse", quantity_g: 35, ciqual_code: "20322" },
          { name_fr: "Huile d'olive vierge extra", quantity_g: 10, ciqual_code: "17270" },
          { name_fr: "Citron, ail, cumin, coriandre, poivre", quantity_g: 0, ciqual_code: null }
        ],
        steps_fr: [
          "Couper l'aubergine en dés, mélanger avec cumin, ail, poivre et un filet d'eau, puis rôtir au four ou à la poêle sans sel ajouté.",
          "Rincer soigneusement les pois chiches s'ils sont en conserve, puis les réchauffer avec l'oignon poêlé.",
          "Ajouter les épinards cuits et le quinoa, puis mélanger doucement pour garder une texture d'assiette composée.",
          "Hors du feu, ajouter l'huile d'olive, beaucoup de citron et les herbes fraîches.",
          "Servir tiède. Le goût doit venir des épices, du citron et des herbes, pas du sel."
        ],
        patient_note_fr: "Déjeuner végétarien complet, riche en fibres, avec légumineuse + céréale en portion maîtrisée.",
        shopping_list_fr: [
          "Pois chiches cuits sans sel ou rincés",
          "Quinoa nature",
          "Aubergine",
          "Épinards",
          "Oignon",
          "Huile d'olive",
          "Citron, ail, cumin, coriandre, poivre"
        ],
        substitutions_fr: [
          "Aubergine → courgette ou poivron selon saison.",
          "Pois chiches → lentilles cuites si meilleure tolérance digestive.",
          "Quinoa → riz basmati en portion similaire."
        ],
        serving_tips_fr: [
          "Rincer les légumineuses en conserve pour réduire le sel résiduel.",
          "Préparer l'aubergine à l'avance pour faciliter le repas de midi."
        ]
      },
      diner: {
        name_fr: "Curry doux lentilles, épinards et riz basmati citronné",
        portion_g: 510,
        prep_time_min: 12,
        cooking_time_min: 12,
        difficulty_fr: "Simple",
        ingredients: [
          { name_fr: "Lentilles cuites sans sel", quantity_g: 160, ciqual_code: "20360" },
          { name_fr: "Riz basmati cuit sans sel", quantity_g: 70, ciqual_code: "9125" },
          { name_fr: "Épinards cuits", quantity_g: 150, ciqual_code: "20027" },
          { name_fr: "Carotte cuite à l'eau", quantity_g: 80, ciqual_code: "20305" },
          { name_fr: "Oignon poêlé sans matière grasse", quantity_g: 40, ciqual_code: "20322" },
          { name_fr: "Huile d'olive vierge extra", quantity_g: 8, ciqual_code: "17270" },
          { name_fr: "Curry doux, gingembre, citron vert, coriandre", quantity_g: 2, ciqual_code: "11005" }
        ],
        steps_fr: [
          "Faire revenir l'oignon avec curry doux, gingembre et un fond d'eau pendant 3 à 4 minutes, sans sel ajouté.",
          "Ajouter les lentilles cuites, les épinards et la carotte. Réchauffer doucement 5 minutes pour obtenir une texture de curry épais.",
          "Ajouter l'huile d'olive hors du feu, puis citron vert et coriandre fraîche.",
          "Servir avec le riz basmati cuit sans sel. Garder le riz en accompagnement mesuré, pas en base dominante.",
          "Ajuster avec citron, gingembre ou herbes si le patient trouve le plat trop fade."
        ],
        patient_note_fr: "Dîner chaud, végétarien et rassasiant, construit sans sel ajouté ni lait de coco pour limiter sel et graisses saturées.",
        shopping_list_fr: [
          "Lentilles cuites sans sel",
          "Riz basmati",
          "Épinards",
          "Carotte",
          "Oignon",
          "Huile d'olive",
          "Curry doux, gingembre, citron vert, coriandre"
        ],
        substitutions_fr: [
          "Épinards → brocoli ou haricots verts selon saison.",
          "Riz basmati → quinoa si le patient préfère.",
          "Lentilles → pois chiches rincés, en gardant une portion similaire."
        ],
        serving_tips_fr: [
          "Éviter bouillon cube, sauce soja, pâte de curry salée et lait de coco.",
          "Batch cooking possible : cuire lentilles et riz à l'avance, puis assembler au dernier moment."
        ]
      }
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
      "Les autres repas doivent rester compatibles avec l'objectif de 5 g de sel par jour.",
      DISCLAIMER
    ]
  },
  grossesse_dg: {
    profile_id: "grossesse_dg",
    match: (brief) => hasAll(brief.pathologies, ["diabete_gestationnel", "grossesse"]),
    recipe: {
      name_fr: "Salade d'été pois chiches, quinoa, épinards lavés et tofu",
      portion_g: 493,
      prep_time_min: 15,
      cooking_time_min: 0,
      difficulty_fr: "Simple",
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
    if (!config.match(brief)) continue;
    const mealRecipe = config.recipes_by_meal?.[brief.meal_slot];
    if (mealRecipe) return { ...config, recipe: mealRecipe };
    return config;
  }
  return null;
}

function computeNutrients(recipe) {
  const totals = Object.fromEntries(nutrientKeys.map((key) => [key, 0]));
  const missingNutrients = {};
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
      const value = food.nutrients_per_100g[key];
      if (value === undefined || value === null) {
        missingNutrients[key] ||= [];
        missingNutrients[key].push({
          ciqual_code: ingredient.ciqual_code,
          name_fr: ingredient.name_fr
        });
        continue;
      }
      totals[key] += (value * ingredient.quantity_g) / 100;
    }
  }

  totals.added_sugar_g = detectAddedSugar(recipe) ? 10 : 0;
  const missingKeys = Object.keys(missingNutrients);
  return {
    nutrients: formatNutrients(totals),
    coverage_summary: {
      matched,
      unmatched,
      estimated: 0,
      missing_nutrients: missingNutrients,
      overall_confidence: unmatched === 0 && missingKeys.length === 0 ? "high" : "medium"
    }
  };
}

function detectAddedSugar(recipe) {
  return recipe.ingredients.some((ingredient) => {
    const name = ingredient.name_fr.toLowerCase();
    if (/\bsans\s+sucres?\s+ajout[ée]s?\b/.test(name)) return false;
    return /\b(sucre|miel|sirop|confiture|cassonade|agave|érable|erable)\b/.test(name);
  });
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

const mealLabels = {
  petit_dejeuner: "Petit-déjeuner",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Collation"
};

const nutrientLabels = {
  energy_kcal: "Calories",
  protein_g: "Protéines",
  carb_g: "Glucides",
  fat_g: "Lipides",
  fiber_g: "Fibres",
  saturated_fat_g: "Acides gras saturés",
  sugar_g_total: "Sucres totaux",
  added_sugar_g: "Sucres ajoutés estimés",
  salt_g: "Sel",
  potassium_mg: "Potassium",
  vit_b9_dfe_ug: "Folates"
};

const nutrientUnits = {
  energy_kcal: "kcal",
  protein_g: "g",
  carb_g: "g",
  fat_g: "g",
  fiber_g: "g",
  saturated_fat_g: "g",
  sugar_g_total: "g",
  added_sugar_g: "g",
  salt_g: "g",
  potassium_mg: "mg",
  vit_b9_dfe_ug: "µg"
};

function nutrientValue(nutrients, key) {
  return nutrients[key]?.value ?? null;
}

function buildNutritionPanel(nutrients) {
  const keys = [
    "energy_kcal",
    "protein_g",
    "carb_g",
    "fat_g",
    "fiber_g",
    "saturated_fat_g",
    "sugar_g_total",
    "added_sugar_g",
    "salt_g",
    "potassium_mg",
    "vit_b9_dfe_ug"
  ];
  return keys
    .filter((key) => nutrients[key])
    .map((key) => ({
      key,
      label_fr: nutrientLabels[key] || key,
      value: nutrients[key].value,
      unit: nutrientUnits[key] || "",
      source: nutrients[key].source,
      confidence: nutrients[key].confidence
    }));
}

function buildClinicalAdaptations(config, nutrients) {
  if (config.profile_id === "t2_hta") {
    return [
      `Glucides par portion : ${nutrientValue(nutrients, "carb_g")} g, dans la plage moteur v0 T2.`,
      `Fibres : ${nutrientValue(nutrients, "fiber_g")} g par portion, avec légumineuses, céréales complètes ou fruits entiers selon le repas.`,
      `Sel : ${nutrientValue(nutrients, "salt_g")} g par portion, sans sel ajouté dans la formulation.`,
      `Graisses saturées : ${nutrientValue(nutrients, "saturated_fat_g")} g par portion, sous le plafond de garde-fou HTA v0.`,
      "Aucun sucre ajouté détecté dans la liste d'ingrédients."
    ];
  }
  if (config.profile_id === "grossesse_dg") {
    return [
      `Glucides par portion : ${nutrientValue(nutrients, "carb_g")} g, dans la plage moteur v0 diabète gestationnel.`,
      `Fibres : ${nutrientValue(nutrients, "fiber_g")} g par portion pour ralentir l'absorption glucidique.`,
      "Aucun alcool, aliment cru à risque, fromage au lait cru, poisson cru, viande crue ou oeuf cru dans la formulation.",
      "Les végétaux crus doivent être lavés soigneusement avant découpe.",
      "Les folates alimentaires ne remplacent pas une supplémentation prescrite."
    ];
  }
  return [];
}

function buildMicronutritionHighlights(recipe, nutrients) {
  const names = recipe.ingredients.map((ingredient) => ingredient.name_fr.toLowerCase()).join(" ");
  const highlights = [];
  if (/(lentilles|pois chiches|quinoa|avoine)/.test(names)) {
    highlights.push({
      focus_fr: "Fibres et satiété",
      detail_fr: "La base céréale complète ou légumineuse contribue à une meilleure satiété et à une réponse glycémique plus progressive.",
      nutrients: ["fiber_g", "carb_g"]
    });
  }
  if (/(épinards|epinards|persil|framboises)/.test(names)) {
    highlights.push({
      focus_fr: "Micronutriments végétaux",
      detail_fr: "Les légumes verts, herbes fraîches ou fruits rouges apportent folates, potassium et composés végétaux utiles à la qualité globale du repas.",
      nutrients: ["vit_b9_dfe_ug", "potassium_mg"]
    });
  }
  if (/(huile d'olive|amandes|chia|avocat)/.test(names)) {
    highlights.push({
      focus_fr: "Qualité lipidique",
      detail_fr: "Les matières grasses sont apportées par des sources végétales non salées, avec une attention portée aux graisses saturées.",
      nutrients: ["fat_g", "saturated_fat_g"]
    });
  }
  return highlights.slice(0, 3);
}

function buildProfessionalSheet(config, brief, nutrients, coverage_summary) {
  const recipe = config.recipe;
  return {
    title_fr: recipe.name_fr,
    meal_slot: brief.meal_slot,
    meal_slot_label_fr: mealLabels[brief.meal_slot] || brief.meal_slot,
    portions: brief.portions,
    portion_g: recipe.portion_g,
    prep_time_min: recipe.prep_time_min ?? null,
    cooking_time_min: recipe.cooking_time_min ?? null,
    total_time_min: (recipe.prep_time_min ?? 0) + (recipe.cooking_time_min ?? 0),
    difficulty_fr: recipe.difficulty_fr || "Simple",
    nutrition_panel_per_portion: buildNutritionPanel(nutrients),
    macros_per_portion: {
      calories_kcal: nutrientValue(nutrients, "energy_kcal"),
      protein_g: nutrientValue(nutrients, "protein_g"),
      carb_g: nutrientValue(nutrients, "carb_g"),
      fat_g: nutrientValue(nutrients, "fat_g"),
      fiber_g: nutrientValue(nutrients, "fiber_g"),
      salt_g: nutrientValue(nutrients, "salt_g")
    },
    ingredients_detailed_fr: recipe.ingredients.map((ingredient) => ({
      label_fr: ingredient.quantity_g > 0
        ? `${ingredient.name_fr} — ${ingredient.quantity_g} g`
        : ingredient.name_fr,
      name_fr: ingredient.name_fr,
      quantity_g: ingredient.quantity_g,
      ciqual_code: ingredient.ciqual_code
    })),
    preparation_steps_fr: recipe.steps_fr || [],
    clinical_adaptations_fr: buildClinicalAdaptations(config, nutrients),
    micronutrition_highlights_fr: buildMicronutritionHighlights(recipe, nutrients),
    patient_explanation_fr: recipe.patient_note_fr || "",
    export_blocks: {
      shopping_list_fr: recipe.shopping_list_fr || [],
      substitutions_fr: recipe.substitutions_fr || [],
      serving_tips_fr: recipe.serving_tips_fr || [],
      practitioner_footer_fr: "Proposition technique générée par ALIM. À valider, adapter ou refuser par le professionnel selon le contexte clinique complet."
    },
    quality: {
      ciqual_coverage: coverage_summary,
      disclaimer_fr: DISCLAIMER
    }
  };
}

function formatMacro(value, unit = "g") {
  if (value === null || value === undefined) return "n/d";
  return `${value} ${unit}`;
}

function buildPresentationMarkdown(sheet, sources, warnings) {
  const m = sheet.macros_per_portion;
  const lines = [
    `## ${sheet.title_fr}`,
    "",
    `**${sheet.meal_slot_label_fr} · ${sheet.total_time_min} min · ${sheet.difficulty_fr} · 1 portion (${sheet.portion_g} g)**`,
    "",
    "### Valeurs nutritionnelles par portion",
    "",
    "| Énergie | Protéines | Glucides | Lipides | Fibres | Sel |",
    "|---:|---:|---:|---:|---:|---:|",
    `| ${formatMacro(m.calories_kcal, "kcal")} | ${formatMacro(m.protein_g)} | ${formatMacro(m.carb_g)} | ${formatMacro(m.fat_g)} | ${formatMacro(m.fiber_g)} | ${formatMacro(m.salt_g)} |`,
    "",
    "### Ingrédients pesés",
    "",
    ...sheet.ingredients_detailed_fr.map((ingredient) => `- ${ingredient.label_fr}`),
    "",
    "### Préparation",
    "",
    ...sheet.preparation_steps_fr.map((step, index) => `${index + 1}. ${step}`),
    "",
    "### Pourquoi cette recette est adaptée",
    "",
    ...sheet.clinical_adaptations_fr.map((item) => `- ${item}`),
    "",
    "### Repères micro-nutritionnels",
    "",
    ...sheet.micronutrition_highlights_fr.map((item) => `- **${item.focus_fr}** : ${item.detail_fr}`),
    "",
    "### Message patient",
    "",
    sheet.patient_explanation_fr || "Recette à adapter selon les habitudes, la tolérance et le contexte clinique du patient.",
    "",
    "### Conseils pratiques",
    "",
    ...sheet.export_blocks.serving_tips_fr.map((tip) => `- ${tip}`),
    "",
    "### Substitutions possibles",
    "",
    ...sheet.export_blocks.substitutions_fr.map((substitution) => `- ${substitution}`),
    "",
    "### Liste de courses",
    "",
    ...sheet.export_blocks.shopping_list_fr.map((item) => `- ${item}`),
    "",
    "### Sources",
    "",
    ...sources.map((source) => `- ${source.citation}`),
    "",
    "### Points de vigilance",
    "",
    ...warnings.map((warning) => `- ${warning}`),
    "",
    "**Sous votre validation clinique.**"
  ];

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildPdfUrl(brief) {
  const params = new URLSearchParams();
  for (const pathology of brief.pathologies) params.append("pathologies", pathology);
  params.set("meal_slot", brief.meal_slot);
  params.set("diet_type", brief.diet_type);
  params.set("season", brief.season);
  params.set("portions", String(brief.portions));
  for (const item of brief.equipment) params.append("equipment", item);
  if (brief.notes) params.set("notes", brief.notes);
  return `https://alim.care/pdf/?${params.toString()}`;
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

  if (config.profile_id === "t2_hta") {
    max("salt_g", 1.6, "sel");
    max("carb_g", 60, "glucides");
    min("carb_g", 30, "glucides");
    max("added_sugar_g", 10, "sucres ajoutés");
    min("fiber_g", 7, "fibres");
    max("saturated_fat_g", 7, "acides gras saturés");
    if ((n.sugar_g_total?.value ?? 0) > 25) warnings.push("Sucres totaux élevés : vérifier la source des sucres naturels.");
  }

  if (config.profile_id === "grossesse_dg") {
    max("carb_g", 45, "glucides");
    min("carb_g", 20, "glucides");
    // Choix moteur v0 démo : zéro sucre ajouté dans les recettes DG générées.
    // Ce n'est pas une interdiction clinique générale des produits sucrés.
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

function buildReferencesConsulted(ruleIds) {
  const allRules = Object.values(rules.pathologies).flatMap((p) => p.rules);
  const byId = new Map(allRules.map((rule) => [rule.id, rule]));
  const references = [];
  for (const id of ruleIds) {
    const rule = byId.get(id);
    if (!rule || !rule.source_url || rule.source_status === "verified") continue;
    references.push({
      citation: rule.source_fr,
      url: rule.source_url,
      status: rule.source_status
    });
  }
  return dedupeSources(references);
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

  const sources = buildSources(config.rules_applied);
  const references_consulted = buildReferencesConsulted(config.rules_applied);
  const professional_sheet = buildProfessionalSheet(config, brief, nutrients, coverage_summary);
  const presentation_markdown_fr = buildPresentationMarkdown(professional_sheet, sources, warnings);
  const pdf_url = buildPdfUrl(brief);

  return {
    ok: true,
    status: 200,
    payload: {
      recipe: config.recipe,
      nutrients_per_portion: nutrients,
      professional_sheet: {
        ...professional_sheet,
        presentation_markdown_fr
      },
      presentation_markdown_fr,
      pdf_url,
      coverage_summary,
      rules_applied: config.rules_applied,
      sources,
      references_consulted,
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
    practitioner_profile: normalizePractitionerProfile(data.practitioner_profile),
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

function normalizePractitionerProfile(input) {
  const data = (input && typeof input === "object") ? input : {};
  return {
    specialites: clampStr(data.specialites || ""),
    style_support: clampStr(data.style_support || ""),
    niveau_detail: clampStr(data.niveau_detail || ""),
    formats_utiles: clampStr(data.formats_utiles || ""),
    contextes_patients: clampStr(data.contextes_patients || ""),
    sources_pref: clampStr(data.sources_pref || ""),
    branding_pdf: clampStr(data.branding_pdf || ""),
    documents_note: clampStr(data.documents_note || "")
  };
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
  <li>Profil ALIM : <pre>${escapeHtml(JSON.stringify(record.practitioner_profile || {}, null, 2))}</pre></li>
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

// ----- Auth comptes ALIM (API v1 / Custom GPT / MCP) ---------------------
const ALIM_DATA_DIR = process.env.ALIM_DATA_DIR || "/var/lib/alim";
const ALIM_DB_FILE = process.env.ALIM_DB_FILE || `${ALIM_DATA_DIR}/alim.sqlite`;
const DEFAULT_DAILY_QUOTA = Number(process.env.ALIM_DEFAULT_DAILY_QUOTA || 20);
let authDb = null;

function getAuthDb() {
  if (authDb) return authDb;
  mkdirSync(ALIM_DATA_DIR, { recursive: true });
  authDb = new DatabaseSync(ALIM_DB_FILE);
  authDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      cabinet_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      plan TEXT NOT NULL DEFAULT 'beta',
      quota_daily INTEGER NOT NULL DEFAULT ${DEFAULT_DAILY_QUOTA},
      practitioner_profile TEXT NOT NULL DEFAULT '{}',
      cabinet_branding TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      label TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
      ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      day TEXT NOT NULL,
      route TEXT NOT NULL,
      channel TEXT NOT NULL,
      status INTEGER NOT NULL,
      pathologies TEXT NOT NULL DEFAULT '[]',
      meal_slot TEXT NOT NULL DEFAULT '',
      request_hash TEXT NOT NULL DEFAULT '',
      refusal_reason TEXT NOT NULL DEFAULT '',
      latency_ms INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_usage_account_day ON api_usage_logs(account_id, day);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(token_hash);
  `);
  return authDb;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function keyHash(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function requestHash(input) {
  return createHash("sha256")
    .update(JSON.stringify(input || {}), "utf8")
    .digest("hex")
    .slice(0, 24);
}

function generateAlimApiKey() {
  return `alim_live_${randomBytes(24).toString("base64url")}`;
}

function readBearerToken(req) {
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function findAccountByBearer(req) {
  const token = readBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, payload: { ok: false, error: "Clé Bearer ALIM manquante." } };
  }
  const db = getAuthDb();
  const row = db.prepare(`
    SELECT
      a.id AS account_id, a.email, a.display_name, a.cabinet_name, a.status AS account_status,
      a.plan, a.quota_daily, a.practitioner_profile, a.cabinet_branding,
      k.id AS api_key_id, k.prefix, k.status AS key_status
    FROM api_keys k
    JOIN accounts a ON a.id = k.account_id
    WHERE k.token_hash = ?
  `).get(keyHash(token));

  if (!row) {
    return { ok: false, status: 401, payload: { ok: false, error: "Clé ALIM invalide." } };
  }
  if (row.key_status !== "active") {
    return { ok: false, status: 403, payload: { ok: false, error: "Clé ALIM désactivée." } };
  }
  if (row.account_status !== "active") {
    return {
      ok: false,
      status: 403,
      payload: {
        ok: false,
        error: "Compte ALIM non actif.",
        account_status: row.account_status,
        action_required: "Activez ou régularisez l'abonnement ALIM."
      }
    };
  }
  db.prepare("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.api_key_id);
  return { ok: true, account: row };
}

function usageForToday(accountId) {
  const db = getAuthDb();
  const day = todayIso();
  const row = db.prepare(`
    SELECT COUNT(*) AS used
    FROM api_usage_logs
    WHERE account_id = ? AND day = ? AND route IN ('/api/v1/generate', '/mcp/v1')
  `).get(accountId, day);
  return Number(row?.used || 0);
}

function accountPayload(row) {
  const used_today = usageForToday(row.account_id);
  const quota_daily = Number(row.quota_daily || DEFAULT_DAILY_QUOTA);
  const practitioner_profile = safeJsonParse(row.practitioner_profile, {});
  const cabinet_branding = safeJsonParse(row.cabinet_branding, {});
  return {
    ok: true,
    account: {
      id: `acct_${row.account_id}`,
      email: row.email,
      display_name: row.display_name,
      cabinet_name: row.cabinet_name,
      status: row.account_status,
      plan: row.plan,
      quota_daily,
      quota_month: quota_daily,
      used_today,
      usage_month: used_today,
      remaining_today: Math.max(0, quota_daily - used_today),
      practitioner_profile,
      cabinet_branding
    },
    disclaimer: DISCLAIMER
  };
}

function normalizeStringArray(value, allowed = null, max = 16) {
  if (!Array.isArray(value)) return [];
  const allow = allowed ? new Set(allowed) : null;
  return value
    .map((item) => cleanText(String(item), 80))
    .filter((item) => item && (!allow || allow.has(item)))
    .slice(0, max);
}

function normalizeAccountUpdate(input) {
  const data = input && typeof input === "object" ? input : {};
  const p = data.practitioner_profile && typeof data.practitioner_profile === "object"
    ? data.practitioner_profile
    : {};
  const b = data.cabinet_branding && typeof data.cabinet_branding === "object"
    ? data.cabinet_branding
    : {};

  return {
    practitioner_profile: {
      metier: cleanText(p.metier || "", 64),
      cadre_exercice: cleanText(p.cadre_exercice || "", 64),
      tone: cleanText(p.tone || "", 64),
      detail_level: cleanText(p.detail_level || "", 64),
      patienteles: normalizeStringArray(p.patienteles, ["DT2", "HTA", "grossesse", "DG", "surpoids", "senior", "pediatrie", "sport"]),
      formats: normalizeStringArray(p.formats, ["fiche_patient_pdf", "variantes", "liste_courses", "tableau_nutritionnel", "message_patient", "substitutions"]),
      contraintes: normalizeStringArray(p.contraintes, ["petit_budget", "repas_familial", "cuisine_minimale", "batch_cooking", "halal", "casher", "vegetarien", "vegan"]),
      notes: cleanText(p.notes || "", 1000)
    },
    cabinet_branding: {
      name: cleanText(b.name || "", 120),
      qualification: cleanText(b.qualification || "", 120),
      adeli: cleanText(b.adeli || "", 40),
      city: cleanText(b.city || "", 80),
      contact: cleanText(b.contact || "", 160)
    }
  };
}

function logApiUsage({ account, route, channel, status, input, output, latencyMs }) {
  const normalized = input && typeof input === "object" ? normalizeBrief(input) : null;
  const brief = normalized?.ok ? normalized.brief : null;
  const refusal = output?.refused?.reason_fr || "";
  getAuthDb().prepare(`
    INSERT INTO api_usage_logs (
      account_id, api_key_id, day, route, channel, status,
      pathologies, meal_slot, request_hash, refusal_reason, latency_ms
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    account.account_id,
    account.api_key_id,
    todayIso(),
    route,
    channel,
    Number(status || 0),
    JSON.stringify(brief?.pathologies || []),
    brief?.meal_slot || "",
    requestHash(input),
    String(refusal).slice(0, 500),
    Number(latencyMs || 0)
  );
}

function quotaOk(account) {
  const quota = Number(account.quota_daily || DEFAULT_DAILY_QUOTA);
  const used = usageForToday(account.account_id);
  if (used >= quota) {
    return {
      ok: false,
      used,
      quota,
      payload: {
        refused: {
          reason_fr: `Quota ALIM atteint pour aujourd'hui (${used}/${quota}).`
        },
        quota: { used_today: used, quota_daily: quota, remaining_today: 0 },
        warnings: [DISCLAIMER]
      }
    };
  }
  return { ok: true, used, quota };
}

async function handleV1Me(req, res) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.payload);
  return sendJson(res, 200, accountPayload(auth.account));
}

async function handleV1AccountUpdate(req, res) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.payload);

  let input;
  try {
    input = await readJson(req);
  } catch (error) {
    return sendJson(res, error.status || 400, {
      ok: false,
      error: error.status ? error.message : "Body JSON invalide."
    });
  }

  const update = normalizeAccountUpdate(input);
  const db = getAuthDb();
  db.prepare(`
    UPDATE accounts
    SET practitioner_profile = ?,
        cabinet_branding = ?,
        cabinet_name = COALESCE(NULLIF(?, ''), cabinet_name),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    JSON.stringify(update.practitioner_profile),
    JSON.stringify(update.cabinet_branding),
    update.cabinet_branding.name,
    auth.account.account_id
  );

  const refreshed = db.prepare(`
    SELECT
      a.id AS account_id, a.email, a.display_name, a.cabinet_name, a.status AS account_status,
      a.plan, a.quota_daily, a.practitioner_profile, a.cabinet_branding,
      ? AS api_key_id, ? AS prefix, 'active' AS key_status
    FROM accounts a
    WHERE a.id = ?
  `).get(auth.account.api_key_id, auth.account.prefix, auth.account.account_id);

  return sendJson(res, 200, accountPayload(refreshed));
}

async function handleV1RegenerateKey(req, res) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.payload);

  const db = getAuthDb();
  const token = generateAlimApiKey();
  const prefix = token.slice(0, 18);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE api_keys SET status = 'rotated' WHERE account_id = ? AND status = 'active'")
      .run(auth.account.account_id);
    db.prepare(`
      INSERT INTO api_keys (account_id, prefix, token_hash, status, label)
      VALUES (?, ?, ?, 'active', 'rotated')
    `).run(auth.account.account_id, prefix, keyHash(token));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return sendJson(res, 200, {
    ok: true,
    api_key: token,
    key_prefix: prefix
  });
}

async function handleV1Generate(req, res) {
  const startedAt = Date.now();
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.payload);

  const quota = quotaOk(auth.account);
  if (!quota.ok) {
    logApiUsage({
      account: auth.account,
      route: "/api/v1/generate",
      channel: "api_v1",
      status: 429,
      input: {},
      output: quota.payload,
      latencyMs: Date.now() - startedAt
    });
    return sendJson(res, 429, quota.payload);
  }

  let input;
  try {
    input = await readJson(req);
  } catch (error) {
    const payload = {
      refused: { reason_fr: error.status ? error.message : "Body JSON invalide." },
      warnings: [DISCLAIMER]
    };
    logApiUsage({
      account: auth.account,
      route: "/api/v1/generate",
      channel: "api_v1",
      status: error.status || 400,
      input: {},
      output: payload,
      latencyMs: Date.now() - startedAt
    });
    return sendJson(res, error.status || 400, payload);
  }

  const normalized = normalizeBrief(input);
  const result = normalized.ok ? generate(normalized.brief) : {
    status: normalized.status,
    payload: normalized.payload
  };
  const payload = {
    ...result.payload,
    account_context: {
      practitioner_profile: safeJsonParse(auth.account.practitioner_profile, {}),
      cabinet_branding: safeJsonParse(auth.account.cabinet_branding, {})
    },
    account: {
      plan: auth.account.plan,
      quota_daily: quota.quota,
      quota_month: quota.quota,
      used_today: quota.used + 1,
      usage_month: quota.used + 1,
      remaining_today: Math.max(0, quota.quota - quota.used - 1)
    }
  };
  logApiUsage({
    account: auth.account,
    route: "/api/v1/generate",
    channel: "api_v1",
    status: result.status,
    input,
    output: payload,
    latencyMs: Date.now() - startedAt
  });
  return sendJson(res, result.status, payload);
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

// ===== Remote MCP connector (Claude / MCP clients) =======================
const MCP_ENDPOINT = "/mcp/v1";
const MCP_DISCOVERY = "/.well-known/mcp.json";
const MCP_TOOL_NAME = "generate_clinical_recipe";
const MCP_RATE_LIMIT_PER_IP_PER_DAY = 60;
const MCP_RATE_LIMIT_GLOBAL_PER_HOUR = 300;
const mcpIpRl = new Map();
const mcpGlobalRl = { count: 0, resetAt: 0 };
const MCP_AUTH_REQUIRED = process.env.ALIM_MCP_AUTH_REQUIRED === "1";
const MCP_BEARER_TOKENS = new Set(
  String(process.env.ALIM_MCP_BEARER_TOKENS || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
);
const API_GENERATE_RATE_LIMIT_PER_IP_PER_DAY = 200;
const API_GENERATE_RATE_LIMIT_GLOBAL_PER_HOUR = 1000;
const apiGenerateIpRl = new Map();
const apiGenerateGlobalRl = { count: 0, resetAt: 0 };

const mcpInputSchema = {
  pathologies: z.array(z.enum(["diabete_t2", "hta", "diabete_gestationnel", "grossesse"]))
    .min(1)
    .max(4)
    .describe("Pathologies couvertes. Combinaisons v0 : diabete_t2+hta ou grossesse+diabete_gestationnel."),
  meal_slot: z.enum(["petit_dejeuner", "dejeuner", "diner", "collation"])
    .describe("Repas concerné."),
  diet_type: z.enum(["omnivore", "vegetarien", "vegan", "pescetarien", "sans_gluten", "sans_lactose"])
    .default("omnivore")
    .describe("Préférence alimentaire principale."),
  season: z.enum(["printemps", "ete", "automne", "hiver", "all"])
    .default("all")
    .describe("Saison ou all si inconnue."),
  equipment: z.array(z.enum(["plaque", "four", "vapeur", "micro_ondes", "blender"]))
    .max(8)
    .default(["plaque", "four"])
    .describe("Équipement disponible chez le patient."),
  portions: z.number().int().min(1).max(8).default(1),
  notes: z.string()
    .max(600)
    .default("")
    .describe("Brief anonymisé : goûts, contraintes, allergies simples, hypothèses. Jamais de donnée nominative.")
};

function createAlimMcpServer(account = null) {
  const server = new McpServer({
    name: "ALIM",
    title: "ALIM — recettes nutritionnelles cadrées",
    version: "0.1.0"
  });

  server.registerTool(MCP_TOOL_NAME, {
    title: "Générer une recette clinique cadrée",
    description: [
      "Génère une fiche recette ALIM professionnelle prête à présenter au praticien.",
      "La réponse contient presentation_markdown_fr pour l'affichage conversationnel, professional_sheet pour export/édition, pdf_url pour l'aperçu imprimable, ingrédients en grammes, nutriments par portion, garde-fous et sources.",
      "Réservé aux professionnels de la nutrition. Périmètre v0 : diabète T2 + HTA, grossesse + diabète gestationnel.",
      "Appeler après cadrage du brief patient anonymisé. Une demande multi-repas doit être traitée en plusieurs appels, un meal_slot à la fois.",
      "Toujours rappeler que la sortie reste sous validation clinique du praticien."
    ].join(" "),
    inputSchema: mcpInputSchema
  }, async (args) => {
    const startedAt = Date.now();
    const quota = account ? quotaOk(account) : { ok: true };
    if (!quota.ok) {
      logApiUsage({
        account,
        route: "/mcp/v1",
        channel: "mcp",
        status: 429,
        input: args || {},
        output: quota.payload,
        latencyMs: Date.now() - startedAt
      });
      return {
        isError: true,
        structuredContent: quota.payload,
        content: [{ type: "text", text: JSON.stringify(quota.payload, null, 2) }]
      };
    }

    const normalized = normalizeBrief(args || {});
    let status = 200;
    let payload;

    if (!normalized.ok) {
      status = normalized.status || 422;
      payload = normalized.payload;
    } else {
      const result = generate(normalized.brief);
      status = result.status;
      payload = result.payload;
    }

    payload = {
      ...payload,
      meta: {
        channel: "mcp",
        status,
        latency_ms: Date.now() - startedAt,
        disclaimer: DISCLAIMER
      }
    };

    if (account) {
      logApiUsage({
        account,
        route: "/mcp/v1",
        channel: "mcp",
        status,
        input: args || {},
        output: payload,
        latencyMs: Date.now() - startedAt
      });
    }

    return {
      isError: status >= 400,
      structuredContent: payload,
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2)
        }
      ]
    };
  });

  return server;
}

async function handleMcpRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization, mcp-session-id, mcp-protocol-version",
      "Access-Control-Expose-Headers": "mcp-session-id",
      "Access-Control-Max-Age": "86400"
    });
    return res.end();
  }

  if (req.method === "GET") {
    res.writeHead(405, {
      "content-type": "application/json; charset=utf-8",
      "allow": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*"
    });
    return res.end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for MCP Streamable HTTP." },
      id: null
    }));
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "allow": "POST, OPTIONS" });
    return res.end();
  }

  const mcpAuth = mcpAuthResult(req);
  if (!mcpAuth.ok) {
    res.writeHead(401, {
      "content-type": "application/json; charset=utf-8",
      "www-authenticate": "Bearer",
      "Access-Control-Allow-Origin": "*"
    });
    return res.end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "ALIM MCP nécessite une clé Bearer active." },
      id: null
    }));
  }

  const rl = mcpRateLimitOk(getClientIp(req));
  if (!rl.ok) {
    res.writeHead(429, {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    return res.end(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: rl.reason === "global"
          ? "ALIM MCP est temporairement saturé. Réessayez dans une heure."
          : "Quota démo MCP atteint. Demandez un accès bêta dédié sur /configurer/."
      },
      id: null
    }));
  }

  const server = createAlimMcpServer(mcpAuth.account || null);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("[mcp] error:", error.message);
    if (!res.headersSent) {
      res.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      }));
    } else {
      res.end();
    }
  }
}

function mcpAuthResult(req) {
  if (!MCP_AUTH_REQUIRED) return { ok: true, account: null };
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match && MCP_BEARER_TOKENS.has(match[1])) return { ok: true, account: null };
  const accountAuth = findAccountByBearer(req);
  if (accountAuth.ok) return { ok: true, account: accountAuth.account };
  return { ok: false };
}

function mcpRateLimitOk(ip) {
  return rollingRateLimitOk(
    ip,
    mcpIpRl,
    mcpGlobalRl,
    MCP_RATE_LIMIT_PER_IP_PER_DAY,
    MCP_RATE_LIMIT_GLOBAL_PER_HOUR
  );
}

function apiGenerateRateLimitOk(ip) {
  return rollingRateLimitOk(
    ip,
    apiGenerateIpRl,
    apiGenerateGlobalRl,
    API_GENERATE_RATE_LIMIT_PER_IP_PER_DAY,
    API_GENERATE_RATE_LIMIT_GLOBAL_PER_HOUR
  );
}

function rollingRateLimitOk(ip, ipMap, globalState, perIpPerDay, globalPerHour) {
  const now = Date.now();
  if (now > globalState.resetAt) {
    globalState.count = 0;
    globalState.resetAt = now + 60 * 60 * 1000;
  }
  if (globalState.count >= globalPerHour) {
    return { ok: false, reason: "global" };
  }
  const ipState = ipMap.get(ip) || { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  if (now > ipState.resetAt) {
    ipState.count = 0;
    ipState.resetAt = now + 24 * 60 * 60 * 1000;
  }
  if (ipState.count >= perIpPerDay) {
    return { ok: false, reason: "ip", resetAt: ipState.resetAt };
  }
  ipState.count += 1;
  ipMap.set(ip, ipState);
  globalState.count += 1;
  return { ok: true };
}

function mcpDiscoveryPayload(hostname = "alim.care") {
  return {
    name: "ALIM",
    title: "ALIM — recettes nutritionnelles cadrées",
    version: "0.1.0",
    transport: "streamable-http",
    endpoint: `https://${hostname}${MCP_ENDPOINT}`,
    auth: MCP_AUTH_REQUIRED ? "bearer" : "prototype-no-auth",
    authorization_header: MCP_AUTH_REQUIRED ? "Authorization: Bearer alim_live_..." : null,
    tools: [
      {
        name: MCP_TOOL_NAME,
        title: "Générer une recette clinique cadrée",
        output_contract: [
          "presentation_markdown_fr : rendu prêt à afficher dans Claude",
          "professional_sheet : blocs structurés pour fiche patient, PDF et export",
          "pdf_url : lien vers l'aperçu imprimable ALIM",
          "sources / references_consulted : citations séparées par statut documentaire",
          "refused : refus traçable si brief hors périmètre"
        ]
      }
    ],
    beta_scope: ["diabete_t2+hta", "grossesse+diabete_gestationnel"],
    privacy: "No patient identifiers. Briefs must stay anonymized.",
    client_guidance: [
      "Ask concise clinical framing questions before calling the tool.",
      "Call one meal_slot per tool call.",
      "Render presentation_markdown_fr first, then offer pdf_url.",
      "Do not invent nutrition values outside the tool output."
    ],
    support: "alim@holco.co"
  };
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

  if (req.method === "GET" && url.pathname === MCP_DISCOVERY) {
    return sendJson(res, 200, mcpDiscoveryPayload(url.hostname || "alim.care"));
  }

  if (url.pathname === MCP_ENDPOINT) {
    return handleMcpRequest(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/me") {
    return handleV1Me(req, res);
  }

  if (req.method === "PUT" && url.pathname === "/api/v1/account") {
    return handleV1AccountUpdate(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/account/regenerate-key") {
    return handleV1RegenerateKey(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/generate") {
    return handleV1Generate(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    try {
      const rl = apiGenerateRateLimitOk(getClientIp(req));
      if (!rl.ok) {
        return sendJson(res, 429, {
          refused: {
            reason_fr: rl.reason === "global"
              ? "ALIM est temporairement saturé. Réessayez dans une heure."
              : "Quota démo atteint sur /api/generate. Demandez un accès bêta dédié sur /configurer/."
          },
          warnings: [DISCLAIMER]
        });
      }
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
