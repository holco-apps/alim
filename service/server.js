import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
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
const MAX_BODY_BYTES = 128 * 1024;
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
    recipes_by_meal: {
      collation: {
        name_fr: "Bol doux fromage blanc, fraises lavées et amandes moulues",
        portion_g: 260,
        prep_time_min: 7,
        cooking_time_min: 0,
        difficulty_fr: "Très simple",
        ingredients: [
          { name_fr: "Fromage blanc nature pasteurisé 2-3% MG", quantity_g: 130, ciqual_code: "19646" },
          { name_fr: "Fraises crues soigneusement lavées", quantity_g: 100, ciqual_code: "13014" },
          { name_fr: "Amandes sans sel finement moulues", quantity_g: 10, ciqual_code: "15000" },
          { name_fr: "Pain complet ou intégral", quantity_g: 20, ciqual_code: "7110" }
        ],
        steps_fr: [
          "Laver soigneusement les fraises sous eau courante, les équeuter après lavage, puis les couper en petits morceaux.",
          "Verser le fromage blanc dans un bol froid. Ajouter les fraises et les amandes finement moulues pour garder une texture douce.",
          "Servir avec une petite tranche de pain complet ou intégral, nature, sans confiture ni miel.",
          "En cas de nausées, proposer une prise lente, froide ou à température ambiante, avec odeur limitée et assaisonnement neutre."
        ],
        patient_note_fr: "Collation douce et peu odorante, pensée pour le premier trimestre avec nausées, tout en gardant une portion glucidique mesurée.",
        shopping_list_fr: [
          "Fromage blanc nature pasteurisé 2-3% MG",
          "Fraises fraîches",
          "Amandes sans sel",
          "Pain complet ou intégral"
        ],
        substitutions_fr: [
          "Fraises → framboises ou myrtilles en portion comparable, toujours soigneusement lavées.",
          "Fromage blanc → yaourt nature pasteurisé non sucré si mieux toléré.",
          "Amandes moulues → purée d'amande sans sucre ajouté, en petite quantité, si la texture sèche gêne."
        ],
        serving_tips_fr: [
          "Éviter cannelle forte, ail, herbes puissantes et odeurs chaudes en cas de nausées.",
          "Garder une texture simple : bol froid, peu d'ingrédients, prise fractionnée si nécessaire.",
          "Ne pas ajouter de miel, confiture, sirop ou sucre."
        ]
      }
    },
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

function cleanMultilineText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
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

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findCiqualFoodByName(name) {
  const normalized = normalizeForMatch(name);
  if (!normalized || normalized.length < 3) return null;

  const aliases = [
    [/riz blanc/, "riz blanc cuit"],
    [/riz basmati/, "riz basmati cuit"],
    [/quinoa/, "quinoa cuit"],
    [/pates? completes?/, "pates completes cuites"],
    [/pates?/, "pates cuites"],
    [/lentilles? corail/, "lentille corail cuite"],
    [/lentilles? vertes?/, "lentille verte cuite"],
    [/lentilles?/, "lentille cuite"],
    [/pois chiches?/, "pois chiches cuits"],
    [/courgettes?/, "courgette cuite"],
    [/aubergines?/, "aubergine cuite"],
    [/brocolis?/, "brocoli cuit"],
    [/carottes?/, "carotte cuite"],
    [/epinards?/, "epinards cuits"],
    [/tofu/, "tofu nature"],
    [/fromage blanc/, "fromage blanc nature"],
    [/yaourts? nature/, "yaourt nature"],
    [/(farine|froment)/, "farine ble t45"],
    [/beurres?/, "beurre doux"],
    [/(oeufs?|œufs?)/, "oeuf cru"],
    [/sucre vanill[eé]/, "sucre vanille"],
    [/sucres?/, "sucre blanc"],
    [/chocolat noir/, "chocolat noir"],
    [/levure chimique|poudre a lever/, "levure chimique"],
    [/pinc[ée]e?s? de sel|sel\b/, "sel blanc alimentaire"],
    [/fraises?/, "fraise crue"],
    [/myrtilles?/, "myrtille crue"],
    [/amandes?/, "amande sans sel"],
    [/huile d olive/, "huile olive"]
  ];

  const query = aliases.find(([pattern]) => pattern.test(normalized))?.[1] || normalized;
  const qTokens = normalizeForMatch(query).split(" ").filter((token) => token.length > 2);
  const normalizedQuery = normalizeForMatch(query);
  let best = null;

  for (const [code, food] of Object.entries(ciqual.foods)) {
    const foodName = normalizeForMatch(food.name_fr);
    if (!foodName) continue;
    let score = 0;
    if (foodName.includes(normalizedQuery)) score += 6;
    for (const token of qTokens) {
      if (new RegExp(`(^| )${token}( |$)`).test(foodName)) score += 2;
    }
    if (foodName.includes("cuit") || foodName.includes("bouilli")) score += /\bcuit|bouilli|r[ôo]ti|vapeur/.test(query) ? 2 : 0.6;
    if (foodName.includes("sans sel")) score += 0.8;
    if (foodName.includes("sucre") && !normalized.includes("sucre")) score -= 2;
    if (foodName.includes("sale") && !normalized.includes("sale")) score -= 2;
    if (!best || score > best.score) best = { code, food, score };
  }

  if (!best || best.score < Math.max(2, qTokens.length)) return null;
  return { ciqual_code: best.code, name_fr: best.food.name_fr, score: round(best.score, 1) };
}

function parseRecipeText(recipeText) {
  const text = cleanMultilineText(recipeText, 5000);
  if (/^https?:\/\//i.test(text) && text.length < 300) {
    return {
      ok: false,
      reason_fr: "Scanner V0 : collez le texte de la recette et ses quantités. L'analyse directe d'URL web n'est pas encore activée."
    };
  }

  const lines = normalizeRecipeIngredientLines(text)
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4)
    .slice(0, 80);

  const ingredients = [];
  const unmatched_lines = [];

  for (const line of lines) {
    const match = line.match(/(?:^|[\s:-])(\d{1,4}(?:[,.]\d{1,2})?)\s*(g|grammes?|kg|ml|cl)\b/i);
    if (!match) continue;
    const rawQuantity = Number.parseFloat(match[1].replace(",", "."));
    if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) continue;
    const unit = match[2].toLowerCase();
    let quantity_g = rawQuantity;
    if (unit === "kg") quantity_g *= 1000;
    if (unit === "cl") quantity_g *= 10;
    // Approximation V0 : ml = g. Suffisant pour scanner, à affiner par densité plus tard.

    const name = line
      .replace(match[0], " ")
      .replace(/\b(cuit|cuite|cru|crue|rinc[eé]s?|lav[eé]s?|sans sel|nature|bio)\b/gi, " $1 ")
      .replace(/[-–—:,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const matched = findCiqualFoodByName(name);
    if (!matched) {
      unmatched_lines.push(line);
      continue;
    }
    ingredients.push({
      name_fr: matched.name_fr,
      input_label_fr: line,
      quantity_g: round(quantity_g, 1),
      ciqual_code: matched.ciqual_code,
      match_score: matched.score
    });
  }

  if (ingredients.length === 0) {
    return {
      ok: false,
      reason_fr: "Aucun ingrédient quantifié en grammes n'a pu être extrait. Exemple attendu : `Riz basmati cuit — 120 g`."
    };
  }

  return { ok: true, recipe_text: text, ingredients, unmatched_lines };
}

function normalizeRecipeIngredientLines(text) {
  const defaults = [
    { pattern: /\b(\d+(?:[,.]\d+)?)\s*(?:oeufs?|œufs?)\b/gi, replace: "$1 oeuf — 50 g" },
    { pattern: /\b(\d+(?:[,.]\d+)?)\s*bonnes?\s+pinc[ée]es?\s+de\s+sel\b/gi, replace: "$1 pincée de sel — 1 g" },
    { pattern: /\b(\d+(?:[,.]\d+)?)\s*pinc[ée]es?\s+de\s+sel\b/gi, replace: "$1 pincée de sel — 1 g" },
    { pattern: /\b(\d+(?:[,.]\d+)?)\s*cuill[èe]res?\s+[àa]\s+caf[ée]\s+de\s+levure\s+chimique\b/gi, replace: "$1 cuillère à café de levure chimique — 5 g" },
    { pattern: /\b(\d+(?:[,.]\d+)?)\s*sachets?\s+de\s+sucre\s+vanill[ée]\b/gi, replace: "$1 sachet de sucre vanillé — 7.5 g" }
  ];
  return String(text || "")
    .split("\n")
    .map((line) => {
      let output = line;
      for (const item of defaults) {
        if (/(?:^|[\s:-])\d{1,4}(?:[,.]\d{1,2})?\s*(?:g|grammes?|kg|ml|cl)\b/i.test(output)) break;
        output = output.replace(item.pattern, item.replace);
      }
      return output;
    })
    .join("\n");
}

function isPrivateIp(address) {
  if (!address) return true;
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function assertSafePublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    return { ok: false, reason_fr: "URL invalide." };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, reason_fr: "Seules les URLs http/https sont acceptées." };
  }
  if (url.username || url.password) {
    return { ok: false, reason_fr: "URL avec identifiants refusée." };
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { ok: false, reason_fr: "URL locale ou interne refusée." };
  }
  if (isIP(hostname) && isPrivateIp(hostname)) {
    return { ok: false, reason_fr: "Adresse IP privée refusée." };
  }
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateIp(record.address))) {
      return { ok: false, reason_fr: "Résolution DNS privée ou non sûre refusée." };
    }
  } catch {
    return { ok: false, reason_fr: "Impossible de résoudre le domaine de la recette." };
  }
  return { ok: true, url };
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(Number.parseInt(n, 16)));
}

function stripHtml(value) {
  return htmlDecode(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function findRecipeJsonLd(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeJsonLd(item);
      if (found) return found;
    }
    return null;
  }
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item).toLowerCase() === "recipe")) return value;
  if (value["@graph"]) return findRecipeJsonLd(value["@graph"]);
  if (value.mainEntity) return findRecipeJsonLd(value.mainEntity);
  return null;
}

function extractRecipeFromHtml(html) {
  const scripts = [...String(html || "").matchAll(/<script[^>]+type=["'](?:application\/ld\+json|application&#x2F;ld&#x2B;json)["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const raw = htmlDecode(match[1]).trim();
    try {
      const parsed = JSON.parse(raw);
      const recipe = findRecipeJsonLd(parsed);
      if (!recipe) continue;
      const ingredients = Array.isArray(recipe.recipeIngredient)
        ? recipe.recipeIngredient.map((item) => stripHtml(item)).filter(Boolean)
        : [];
      const instructionsRaw = Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions : [];
      const instructions = instructionsRaw.map((item) => {
        if (typeof item === "string") return stripHtml(item);
        if (item?.text) return stripHtml(item.text);
        if (item?.itemListElement) {
          return item.itemListElement.map((step) => stripHtml(step.text || step.name || step)).filter(Boolean).join(" ");
        }
        return stripHtml(item?.name || "");
      }).filter(Boolean);
      if (ingredients.length) {
        return {
          ok: true,
          title_fr: stripHtml(recipe.name || "Recette scannée depuis URL"),
          recipe_text: ingredients.join("\n"),
          instructions_preview: instructions.slice(0, 8),
          extraction_method: "json_ld_recipe",
          ingredients_count: ingredients.length
        };
      }
    } catch {}
  }

  const ingredientBlock = String(html || "").match(/(?:ingredient|ingredients|ingr[eé]dients?)[\s\S]{0,12000}?(?:preparation|préparation|instructions?|étapes?)/i)?.[0] || "";
  const items = [...ingredientBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((line) => /\d/.test(line))
    .slice(0, 40);
  if (items.length) {
    return {
      ok: true,
      title_fr: stripHtml(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Recette scannée depuis URL"),
      recipe_text: items.join("\n"),
      extraction_method: "html_li_fallback",
      ingredients_count: items.length
    };
  }
  return {
    ok: false,
    reason_fr: "Impossible d'extraire automatiquement les ingrédients. Collez le texte de la recette avec les quantités."
  };
}

async function fetchRecipeFromUrl(rawUrl) {
  const safe = await assertSafePublicUrl(rawUrl);
  if (!safe.ok) return safe;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(safe.url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ALIM recipe scanner (+https://alim.care/robots.txt)",
        "accept": "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) {
      return { ok: false, reason_fr: `La page recette répond ${response.status}.` };
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { ok: false, reason_fr: "Le contenu récupéré n'est pas une page HTML de recette." };
    }
    const html = (await response.text()).slice(0, 650000);
    return {
      ...extractRecipeFromHtml(html),
      url: safe.url.toString(),
      final_url: response.url
    };
  } catch (error) {
    return {
      ok: false,
      reason_fr: error.name === "AbortError"
        ? "Temps de chargement de la recette dépassé."
        : "Impossible de récupérer la page recette."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildScanSuggestions(brief, nutrients, failures, ingredients) {
  const suggestions = [];
  const carb = nutrientValue(nutrients, "carb_g") || 0;
  const fiber = nutrientValue(nutrients, "fiber_g") || 0;
  const salt = nutrientValue(nutrients, "salt_g") || 0;
  const energy = nutrientValue(nutrients, "energy_kcal") || 0;
  const hasRice = ingredients.some((ingredient) => /riz blanc|riz tha|riz basmati/i.test(ingredient.name_fr));
  const hasSaltedCue = ingredients.some((ingredient) => /sel|sauce soja|bouillon|fromage|charcuterie/i.test(ingredient.input_label_fr || ingredient.name_fr));

  if (failures.some((failure) => /glucides/i.test(failure)) || carb > 45) {
    if (hasRice) {
      suggestions.push("Réduire la portion de riz blanc/basmati cuit et tester une base quinoa, lentilles ou légumes supplémentaires, puis recalculer.");
    } else {
      suggestions.push("Réduire la portion de féculent ou la répartir sur un autre moment alimentaire, puis recalculer la fiche.");
    }
  }
  if (failures.some((failure) => /fibres/i.test(failure)) || fiber < 7) {
    suggestions.push("Ajouter une source de fibres compatible : légumineuse en petite portion, légumes cuits, céréale complète ou fruit entier selon tolérance.");
  }
  if (salt > 1.6 || hasSaltedCue) {
    suggestions.push("Supprimer sel ajouté, bouillon cube, sauce soja ou ingrédient très salé ; renforcer citron, herbes et épices douces.");
  }
  if (brief.meal_slot === "collation" && energy > 250) {
    suggestions.push("Recalibrer en vraie collation : viser une portion plus petite, moins d'ingrédients, texture simple et 150-250 kcal.");
  }
  if (brief.pathologies.includes("grossesse")) {
    suggestions.push("Vérifier lavage soigneux des végétaux crus et exclure fromage au lait cru, oeuf cru, poisson cru, viande crue et alcool.");
  }
  return suggestions.slice(0, 5);
}

function buildScanMarkdown(payload) {
  const n = payload.nutrients_per_portion;
  const lines = [
    `## Analyse ALIM — ${payload.verdict.label_fr}`,
    "",
    `**Statut : ${payload.verdict.status.toUpperCase()}** · ${payload.verdict.summary_fr}`,
    "",
    "### Valeurs estimées",
    "",
    "| Énergie | Protéines | Glucides | Lipides | Fibres | Sel |",
    "|---:|---:|---:|---:|---:|---:|",
    `| ${formatMacro(n.energy_kcal?.value, "kcal")} | ${formatMacro(n.protein_g?.value)} | ${formatMacro(n.carb_g?.value)} | ${formatMacro(n.fat_g?.value)} | ${formatMacro(n.fiber_g?.value)} | ${formatMacro(n.salt_g?.value)} |`,
    "",
    "### Ingrédients reconnus",
    "",
    ...payload.ingredients_matched.map((ingredient) => `- ${ingredient.input_label_fr} → ${ingredient.name_fr} (${ingredient.quantity_g} g)`),
    "",
    "### Points à corriger",
    "",
    ...(payload.failures.length ? payload.failures.map((failure) => `- ${failure}`) : ["- Aucun blocage déterministe sur le périmètre couvert."]),
    "",
    "### Ajustements proposés",
    "",
    ...(payload.suggestions_fr.length ? payload.suggestions_fr.map((item) => `- ${item}`) : ["- Recette compatible avec les garde-fous v0. À valider selon le contexte clinique complet."]),
    "",
    "### Sources",
    "",
    ...payload.sources.map((source) => `- ${source.citation}`),
    "",
    "**Sous votre validation clinique.**"
  ];
  if (payload.unmatched_lines.length) {
    lines.splice(lines.indexOf("### Points à corriger"), 0, "### À vérifier manuellement", "", ...payload.unmatched_lines.map((line) => `- ${line}`), "");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function scanRecipe(input) {
  const normalized = normalizeBrief(input.brief || input);
  if (!normalized.ok) return { status: normalized.status, payload: normalized.payload };
  const brief = normalized.brief;
  const config = selectScanConfig(brief);
  if (!config) {
    return refused("Scanner V0 couvre seulement : diabète T2, diabète T2 + HTA, ou grossesse + diabète gestationnel.", 422);
  }

  const parsed = parseRecipeText(input.recipe_text || input.text || "");
  if (!parsed.ok) {
    return refused(parsed.reason_fr, 422);
  }

  const scannedRecipe = {
    name_fr: cleanText(input.title_fr || "Recette scannée", 160),
    portion_g: round(parsed.ingredients.reduce((sum, ingredient) => sum + ingredient.quantity_g, 0), 1),
    ingredients: parsed.ingredients,
    steps_fr: []
  };
  const { nutrients, coverage_summary } = computeNutrients(scannedRecipe);
  const scanConfig = { ...config, recipe: scannedRecipe };
  const { failures, warnings } = validateRecipe(scanConfig, nutrients, brief);
  const suggestions_fr = buildScanSuggestions(brief, nutrients, failures, parsed.ingredients);
  const status = failures.length ? "red" : (suggestions_fr.length || parsed.unmatched_lines.length ? "orange" : "green");
  const labels = {
    green: "Compatible avec les garde-fous ALIM v0",
    orange: "Compatible sous réserve d'ajustements",
    red: "À corriger avant validation"
  };
  const payload = {
    ok: true,
    scan_type: "recipe_text",
    verdict: {
      status,
      label_fr: labels[status],
      summary_fr: failures.length
        ? "La recette dépasse au moins un garde-fou déterministe du profil choisi."
        : "Aucun blocage déterministe détecté sur le périmètre couvert."
    },
    brief,
    title_fr: scannedRecipe.name_fr,
    portion_g: scannedRecipe.portion_g,
    ingredients_matched: parsed.ingredients,
    unmatched_lines: parsed.unmatched_lines,
    nutrients_per_portion: nutrients,
    coverage_summary,
    failures,
    suggestions_fr,
    rules_applied: config.rules_applied,
    sources: buildSources(config.rules_applied),
    references_consulted: buildReferencesConsulted(config.rules_applied),
    warnings: [...warnings, DISCLAIMER]
  };
  payload.presentation_markdown_fr = buildScanMarkdown(payload);
  return { status: 200, payload };
}

function selectScanConfig(brief) {
  const generationConfig = selectRecipe(brief);
  if (generationConfig) return generationConfig;
  if (brief.pathologies.includes("diabete_t2")) {
    return {
      profile_id: "t2_scan",
      rules_applied: [
        "t2_carb_per_meal_max",
        "t2_carb_per_meal_min",
        "t2_added_sugar_per_meal_max",
        "t2_total_sugar_per_meal_warning",
        "t2_fiber_per_meal_min",
        "t2_low_gi_preferred"
      ],
      warnings: [
        "Scanner diabète T2 seul : analyse glucides, sucres ajoutés et fibres. Les garde-fous HTA ne sont pas appliqués sans mention HTA.",
        DISCLAIMER
      ]
    };
  }
  return null;
}

async function scanRecipeUrl(input) {
  const fetched = await fetchRecipeFromUrl(input.url || input.recipe_url || "");
  if (!fetched.ok) return refused(fetched.reason_fr, 422);
  const result = scanRecipe({
    title_fr: input.title_fr || fetched.title_fr,
    recipe_text: fetched.recipe_text,
    brief: input.brief || input
  });
  if (result.payload && !result.payload.refused) {
    result.payload.url_scan = {
      url: fetched.url,
      final_url: fetched.final_url,
      extraction_method: fetched.extraction_method,
      ingredients_count: fetched.ingredients_count,
      title_fr: fetched.title_fr
    };
  }
  return result;
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

function buildClinicalAdaptations(config, nutrients, brief) {
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
    if (brief.meal_slot === "collation") {
      return [
        `Glucides par portion : ${nutrientValue(nutrients, "carb_g")} g, dans la plage moteur v0 collation DG.`,
        `Énergie : ${nutrientValue(nutrients, "energy_kcal")} kcal, calibrée comme collation et non comme repas complet.`,
        `Fibres : ${nutrientValue(nutrients, "fiber_g")} g par portion, sans charge digestive excessive pour une collation.`,
        "Texture douce, odeur limitée et prise froide ou tiède : adaptation terrain en cas de nausées du premier trimestre.",
        "Aucun alcool, aliment cru à risque, fromage au lait cru, poisson cru, viande crue ou oeuf cru dans la formulation.",
        "Les fruits crus doivent être lavés soigneusement avant découpe."
      ];
    }
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
    clinical_adaptations_fr: buildClinicalAdaptations(config, nutrients, brief),
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

function validateRecipe(config, nutrients, brief) {
  const failures = [];
  const warnings = [...config.warnings];
  const n = nutrients;
  const max = (field, limit, label) => {
    if ((n[field]?.value ?? Infinity) > limit) failures.push(`${label} > ${limit}`);
  };
  const min = (field, limit, label) => {
    if ((n[field]?.value ?? -Infinity) < limit) failures.push(`${label} < ${limit}`);
  };

  if (config.profile_id === "t2_hta" || config.profile_id === "t2_scan") {
    if (config.profile_id === "t2_hta") max("salt_g", 1.6, "sel");
    max("carb_g", 60, "glucides");
    min("carb_g", 30, "glucides");
    max("added_sugar_g", 10, "sucres ajoutés");
    min("fiber_g", 7, "fibres");
    if (config.profile_id === "t2_hta") max("saturated_fat_g", 7, "acides gras saturés");
    if ((n.sugar_g_total?.value ?? 0) > 25) warnings.push("Sucres totaux élevés : vérifier la source des sucres naturels.");
  }

  if (config.profile_id === "grossesse_dg") {
    if (brief.meal_slot === "collation") {
      max("energy_kcal", 250, "énergie collation");
      min("energy_kcal", 150, "énergie collation");
      max("carb_g", 30, "glucides collation");
      min("carb_g", 15, "glucides collation");
      max("fiber_g", 8, "fibres collation");
      min("fiber_g", 2, "fibres collation");
    } else {
      max("carb_g", 45, "glucides");
      min("carb_g", 20, "glucides");
      min("fiber_g", 7, "fibres");
      min("vit_b9_dfe_ug", 130, "folates");
    }
    // Choix moteur v0 démo : zéro sucre ajouté dans les recettes DG générées.
    // Ce n'est pas une interdiction clinique générale des produits sucrés.
    max("added_sugar_g", 0, "sucres ajoutés");
    max("alcohol_g", 0, "alcool");
    if ((n.sugar_g_total?.value ?? 0) > 15) warnings.push("Sucres totaux au-dessus du seuil d'alerte DG : vérifier leur origine.");
    if (brief.meal_slot === "collation") {
      warnings.push("Collation DG v0 : calibrage indicatif 150-250 kcal et 15-30 g de glucides, à adapter au plan alimentaire global.");
    }
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
  const { failures, warnings } = validateRecipe(config, nutrients, brief);
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

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const err = new Error("Payload too large");
      err.status = 413;
      throw err;
    }
  }
  return body;
}

async function readFormOrJson(req) {
  const body = await readBody(req);
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return body ? JSON.parse(body) : {};
    } catch {
      const err = new Error("Invalid JSON");
      err.status = 400;
      throw err;
    }
  }
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
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
const OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
const OAUTH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const OAUTH_SCOPE = "alim.generate";
const OAUTH_CLIENT_ID = process.env.ALIM_OAUTH_CLIENT_ID || "";
const OAUTH_CLIENT_SECRET = process.env.ALIM_OAUTH_CLIENT_SECRET || "";
const PUBLIC_ORIGIN = process.env.ALIM_PUBLIC_ORIGIN || "https://alim.care";
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
    CREATE TABLE IF NOT EXISTS oauth_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_hash TEXT NOT NULL UNIQUE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL DEFAULT '',
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT '${OAUTH_SCOPE}',
      expires_at INTEGER NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      scope TEXT NOT NULL DEFAULT '${OAUTH_SCOPE}',
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT '${OAUTH_SCOPE}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL UNIQUE,
      client_secret_hash TEXT NOT NULL DEFAULT '',
      client_name TEXT NOT NULL DEFAULT '',
      redirect_uris TEXT NOT NULL DEFAULT '[]',
      grant_types TEXT NOT NULL DEFAULT '["authorization_code","refresh_token"]',
      response_types TEXT NOT NULL DEFAULT '["code"]',
      scope TEXT NOT NULL DEFAULT '${OAUTH_SCOPE}',
      token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
      raw_metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS account_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      title_fr TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      tags TEXT NOT NULL DEFAULT '[]',
      clinical_context TEXT NOT NULL DEFAULT '{}',
      recipe_payload TEXT NOT NULL DEFAULT '{}',
      presentation_markdown_fr TEXT NOT NULL DEFAULT '',
      pdf_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_usage_account_day ON api_usage_logs(account_id, day);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(token_hash);
    CREATE INDEX IF NOT EXISTS idx_oauth_codes_hash ON oauth_codes(code_hash);
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_hash ON oauth_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_hash ON oauth_refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
    CREATE INDEX IF NOT EXISTS idx_account_recipes_account ON account_recipes(account_id, updated_at);
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

function generateOAuthCode() {
  return `alim_code_${randomBytes(24).toString("base64url")}`;
}

function generateOAuthAccessToken() {
  return `alim_oauth_${randomBytes(32).toString("base64url")}`;
}

function generateOAuthRefreshToken() {
  return `alim_refresh_${randomBytes(32).toString("base64url")}`;
}

function generateOAuthClientId() {
  return `alim-dcr-${randomBytes(16).toString("base64url")}`;
}

function generateOAuthClientSecret() {
  return `alim_secret_${randomBytes(24).toString("base64url")}`;
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
  if (token.startsWith("alim_oauth_")) return findAccountByOAuthToken(token);
  return findAccountByApiKey(token);
}

function findAccountByApiKey(token) {
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

function findAccountByOAuthToken(token) {
  const db = getAuthDb();
  const row = db.prepare(`
    SELECT
      a.id AS account_id, a.email, a.display_name, a.cabinet_name, a.status AS account_status,
      a.plan, a.quota_daily, a.practitioner_profile, a.cabinet_branding,
      NULL AS api_key_id, 'oauth' AS prefix, 'active' AS key_status,
      t.id AS oauth_token_id, t.expires_at
    FROM oauth_tokens t
    JOIN accounts a ON a.id = t.account_id
    WHERE t.token_hash = ?
  `).get(keyHash(token));

  if (!row) {
    return { ok: false, status: 401, payload: { ok: false, error: "Token OAuth ALIM invalide." } };
  }
  if (Number(row.expires_at || 0) < Date.now()) {
    return { ok: false, status: 401, payload: { ok: false, error: "Token OAuth ALIM expiré." } };
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
  db.prepare("UPDATE oauth_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.oauth_token_id);
  return { ok: true, account: row };
}

function usageForToday(accountId) {
  const db = getAuthDb();
  const day = todayIso();
  const row = db.prepare(`
    SELECT COUNT(*) AS used
    FROM api_usage_logs
    WHERE account_id = ? AND day = ? AND route IN ('/api/v1/generate', '/api/v1/scan-recipe', '/api/v1/scan-recipe-url', '/mcp/v1')
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

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
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
      preferences: {
        clinical_strictness: clampNumber(p.preferences?.clinical_strictness, 1, 5, 4),
        culinary_creativity: clampNumber(p.preferences?.culinary_creativity, 1, 5, 3),
        patient_detail_level: clampNumber(p.preferences?.patient_detail_level, 1, 5, 3),
        source_display: cleanText(p.preferences?.source_display || "patient_discreet", 64),
        source_threshold: cleanText(p.preferences?.source_threshold || "verified_only", 64)
      },
      patient_examples: normalizeStringArray(p.patient_examples, null, 3)
        .map((item) => cleanText(item, 400)),
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

function parseBasicClientAuth(req) {
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Basic\s+(.+)$/i);
  if (!match) return {};
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const splitAt = decoded.indexOf(":");
    if (splitAt === -1) return {};
    return {
      client_id: decoded.slice(0, splitAt),
      client_secret: decoded.slice(splitAt + 1)
    };
  } catch {
    return {};
  }
}

function validateOAuthClient({ client_id, client_secret, requireSecret = false }) {
  if (OAUTH_CLIENT_ID && client_id !== OAUTH_CLIENT_ID) {
    return { ok: false, error: "Client OAuth ALIM invalide." };
  }
  if (requireSecret && OAUTH_CLIENT_SECRET && client_secret !== OAUTH_CLIENT_SECRET) {
    return { ok: false, error: "Secret OAuth ALIM invalide." };
  }
  if (!OAUTH_CLIENT_ID && client_id) {
    const client = getAuthDb().prepare(`
      SELECT client_id, client_secret_hash, token_endpoint_auth_method
      FROM oauth_clients
      WHERE client_id = ?
    `).get(client_id);
    if (client) {
      if (requireSecret && client.token_endpoint_auth_method !== "none" && client.client_secret_hash) {
        if (!client_secret || keyHash(client_secret) !== client.client_secret_hash) {
          return { ok: false, error: "Secret OAuth ALIM invalide." };
        }
      }
      getAuthDb().prepare("UPDATE oauth_clients SET last_used_at = CURRENT_TIMESTAMP WHERE client_id = ?")
        .run(client_id);
    }
  }
  return { ok: true };
}

function oauthAuthorizationServerMetadata(origin = PUBLIC_ORIGIN) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    code_challenge_methods_supported: ["S256"]
  };
}

function oauthProtectedResourceMetadata(origin = PUBLIC_ORIGIN) {
  return {
    resource: `${origin}${MCP_ENDPOINT}`,
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/install/claude/`
  };
}

function bearerChallengeHeader() {
  return `Bearer resource_metadata="${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource"`;
}

function normalizeDcrArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20);
}

async function handleOAuthRegister(req, res) {
  let input;
  try {
    input = await readJson(req);
  } catch (error) {
    return sendJson(res, error.status || 400, {
      error: "invalid_client_metadata",
      error_description: error.message || "Body JSON invalide."
    });
  }

  const redirectUris = normalizeDcrArray(input.redirect_uris, []);
  for (const redirectUri of redirectUris) {
    const validation = validateRedirectUri(redirectUri);
    if (!validation.ok) {
      return sendJson(res, 400, {
        error: "invalid_redirect_uri",
        error_description: validation.error
      });
    }
  }

  const authMethod = cleanText(input.token_endpoint_auth_method || "none", 64);
  const tokenEndpointAuthMethod = ["none", "client_secret_post", "client_secret_basic"].includes(authMethod)
    ? authMethod
    : "none";
  const clientId = generateOAuthClientId();
  const clientSecret = tokenEndpointAuthMethod === "none" ? "" : generateOAuthClientSecret();
  const now = Math.floor(Date.now() / 1000);
  const grantTypes = normalizeDcrArray(input.grant_types, ["authorization_code", "refresh_token"]);
  const responseTypes = normalizeDcrArray(input.response_types, ["code"]);
  const scope = cleanText(input.scope || OAUTH_SCOPE, 200) || OAUTH_SCOPE;
  const clientName = cleanText(input.client_name || input.software_id || "Claude MCP Connector", 160);

  getAuthDb().prepare(`
    INSERT INTO oauth_clients (
      client_id, client_secret_hash, client_name, redirect_uris, grant_types,
      response_types, scope, token_endpoint_auth_method, raw_metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clientId,
    clientSecret ? keyHash(clientSecret) : "",
    clientName,
    JSON.stringify(redirectUris),
    JSON.stringify(grantTypes),
    JSON.stringify(responseTypes),
    scope,
    tokenEndpointAuthMethod,
    JSON.stringify(input || {})
  );

  const payload = {
    client_id: clientId,
    client_id_issued_at: now,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    scope,
    token_endpoint_auth_method: tokenEndpointAuthMethod
  };
  if (clientSecret) {
    payload.client_secret = clientSecret;
    payload.client_secret_expires_at = 0;
  }
  return sendJson(res, 201, payload);
}

function validateRedirectUri(redirectUri) {
  if (!redirectUri) return { ok: false, error: "redirect_uri manquant." };
  let parsed;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return { ok: false, error: "redirect_uri invalide." };
  }
  const isLocalhost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(isLocalhost && parsed.protocol === "http:")) {
    return { ok: false, error: "redirect_uri doit utiliser HTTPS." };
  }
  if (process.env.ALIM_OAUTH_STRICT_REDIRECTS === "1") {
    const allowed = String(process.env.ALIM_OAUTH_REDIRECT_HOSTS || "chat.openai.com,chatgpt.com")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(parsed.hostname.toLowerCase())) {
      return { ok: false, error: "redirect_uri non autorisé pour ALIM." };
    }
  }
  return { ok: true, url: parsed };
}

function oauthProviderLabel(params = {}) {
  const redirectUri = String(params.redirect_uri || "");
  const clientId = String(params.client_id || "");
  if (redirectUri.includes("claude.ai") || clientId.toLowerCase().includes("claude")) return "Claude";
  if (redirectUri.includes("chat.openai.com") || redirectUri.includes("chatgpt.com") || clientId.toLowerCase().includes("chatgpt")) return "ChatGPT";
  return "votre IA";
}

function oauthInfoPage() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Connexion ALIM</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f2e8;color:#17251f;font-family:Inter,Arial,sans-serif}
    main{width:min(520px,calc(100vw - 32px));background:#fffaf0;border:1px solid #dccfb7;border-radius:16px;padding:28px;box-shadow:0 24px 80px rgba(23,37,31,.12)}
    h1{margin:0 0 10px;font-family:Georgia,serif;font-size:30px}
    p{line-height:1.5;color:#536056}
    a{color:#8f4d35;font-weight:700}
    .steps{margin:18px 0 0;padding-left:20px;color:#536056}
    .steps li{margin:8px 0}
  </style>
</head>
<body>
  <main>
    <h1>Connecter ALIM à votre IA</h1>
    <p>Cette page ne s'ouvre pas directement. Elle doit être lancée depuis le bouton de connexion de ChatGPT ou Claude, pour que l'IA fournisse l'adresse de retour sécurisée.</p>
    <ol class="steps">
      <li>Retournez dans ChatGPT ou Claude.</li>
      <li>Relancez la connexion ALIM.</li>
      <li>Cliquez sur le bouton de connexion affiché par votre IA.</li>
      <li>Collez votre clé ALIM sur la page qui s'ouvrira.</li>
    </ol>
    <p><a href="/compte/">Gérer mon compte ALIM</a></p>
  </main>
</body>
</html>`;
}

function oauthErrorPage(message, status = 400) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Connexion ALIM</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f2e8;color:#17251f;font-family:Inter,Arial,sans-serif}
    main{width:min(520px,calc(100vw - 32px));background:#fffaf0;border:1px solid #dccfb7;border-radius:16px;padding:28px;box-shadow:0 24px 80px rgba(23,37,31,.12)}
    h1{margin:0 0 10px;font-family:Georgia,serif;font-size:30px}
    p{line-height:1.5;color:#536056}
    a{color:#8f4d35}
  </style>
</head>
<body>
  <main>
    <h1>Connexion ALIM impossible</h1>
    <p>${escapeHtml(message)}</p>
    <p>Relancez la connexion depuis ChatGPT ou Claude, puis choisissez <strong>Se connecter à ALIM</strong>.</p>
    <p><a href="/compte/">Retourner à mon compte ALIM</a></p>
  </main>
</body>
</html>`;
}

function oauthAuthorizePage(params, error = "") {
  const provider = oauthProviderLabel(params);
  const providerText = provider === "votre IA" ? "votre IA" : provider;
  const hidden = ["response_type", "client_id", "redirect_uri", "scope", "state"]
    .map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(params[key] || "")}">`)
    .join("\n");
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Connecter ALIM à ${escapeHtml(providerText)}</title>
  <style>
    :root{color-scheme:light}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f2e8;color:#17251f;font-family:Inter,Arial,sans-serif}
    main{width:min(560px,calc(100vw - 32px));background:#fffaf0;border:1px solid #dccfb7;border-radius:18px;padding:30px;box-shadow:0 24px 80px rgba(23,37,31,.12)}
    .eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#9b6b2f;font-weight:700}
    h1{margin:8px 0 12px;font-family:Georgia,serif;font-size:34px;line-height:1.05}
    p{line-height:1.5;color:#536056}
    label{display:block;font-weight:700;margin:22px 0 8px}
    input[type=password],input[type=text]{width:100%;box-sizing:border-box;border:1px solid #cdbfa8;border-radius:10px;padding:13px 14px;font-size:15px;background:white;color:#17251f}
    button{width:100%;margin-top:16px;border:0;border-radius:999px;background:#17251f;color:#fffaf0;padding:14px 18px;font-weight:800;font-size:15px;cursor:pointer}
    .error{margin-top:14px;padding:12px 14px;border-radius:10px;background:#fff1ed;color:#8f2f1d;border:1px solid #efc0b4}
    .hint{font-size:13px;color:#667066}
    .foot{font-size:12px;margin-top:16px;color:#7a8178}
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">ALIM OAuth</div>
    <h1>Connecter ALIM à ${escapeHtml(providerText)}</h1>
    <p>Collez votre clé ALIM une seule fois. ${escapeHtml(providerText)} recevra un jeton d'accès dédié et n'affichera pas votre clé dans la conversation.</p>
    <form method="post" action="/oauth/authorize">
      ${hidden}
      <label for="api_key">Clé ALIM</label>
      <input id="api_key" name="api_key" type="password" autocomplete="off" placeholder="alim_live_..." required>
      <p class="hint">Vous la retrouvez ou la régénérez dans <a href="/compte/" target="_blank" rel="noopener">votre compte ALIM</a>.</p>
      <button type="submit">Autoriser ALIM</button>
    </form>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <p class="foot">ALIM ne traite pas de données patient nominatives. Usage réservé aux professionnels, sous validation clinique.</p>
  </main>
</body>
</html>`;
}

async function handleOAuthAuthorizeGet(req, res, url) {
  const params = Object.fromEntries(url.searchParams.entries());
  if (!url.search) {
    return sendHtml(res, 200, oauthInfoPage());
  }
  if (params.response_type !== "code") {
    return sendHtml(res, 400, oauthErrorPage("La demande de connexion envoyée par ChatGPT est incomplète. Relancez la connexion depuis le GPT ALIM."));
  }
  const clientValidation = validateOAuthClient({ client_id: params.client_id || "", client_secret: "" });
  if (!clientValidation.ok) {
    return sendHtml(res, 400, oauthErrorPage(clientValidation.error));
  }
  const redirectValidation = validateRedirectUri(params.redirect_uri || "");
  if (!redirectValidation.ok) {
    return sendHtml(res, 400, oauthErrorPage(redirectValidation.error));
  }
  return sendHtml(res, 200, oauthAuthorizePage({
    ...params,
    scope: params.scope || OAUTH_SCOPE
  }));
}

async function handleOAuthAuthorizePost(req, res) {
  let params;
  try {
    params = await readFormOrJson(req);
  } catch (error) {
    return sendHtml(res, error.status || 400, oauthErrorPage(error.message || "Formulaire invalide."));
  }

  const baseParams = {
    response_type: params.response_type || "code",
    client_id: params.client_id || "",
    redirect_uri: params.redirect_uri || "",
    scope: params.scope || OAUTH_SCOPE,
    state: params.state || ""
  };
  if (baseParams.response_type !== "code") {
    return sendHtml(res, 400, oauthErrorPage("response_type doit valoir code."));
  }
  const clientValidation = validateOAuthClient({ client_id: baseParams.client_id, client_secret: "" });
  if (!clientValidation.ok) {
    return sendHtml(res, 400, oauthAuthorizePage(baseParams, clientValidation.error));
  }
  const redirectValidation = validateRedirectUri(baseParams.redirect_uri);
  if (!redirectValidation.ok) {
    return sendHtml(res, 400, oauthAuthorizePage(baseParams, redirectValidation.error));
  }

  const apiKey = String(params.api_key || "").trim();
  const accountAuth = findAccountByApiKey(apiKey);
  if (!accountAuth.ok) {
    return sendHtml(res, 401, oauthAuthorizePage(baseParams, "Clé ALIM invalide, désactivée ou compte non actif."));
  }

  const code = generateOAuthCode();
  getAuthDb().prepare(`
    INSERT INTO oauth_codes (code_hash, account_id, client_id, redirect_uri, scope, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    keyHash(code),
    accountAuth.account.account_id,
    baseParams.client_id,
    baseParams.redirect_uri,
    baseParams.scope,
    Date.now() + OAUTH_CODE_TTL_MS
  );

  const redirectUrl = new URL(baseParams.redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (baseParams.state) redirectUrl.searchParams.set("state", baseParams.state);
  return redirect(res, redirectUrl.toString());
}

async function handleOAuthToken(req, res) {
  let input;
  try {
    input = await readFormOrJson(req);
  } catch (error) {
    return sendJson(res, error.status || 400, { error: "invalid_request", error_description: error.message });
  }
  const basic = parseBasicClientAuth(req);
  const client_id = basic.client_id || input.client_id || "";
  const client_secret = basic.client_secret || input.client_secret || "";
  const clientValidation = validateOAuthClient({ client_id, client_secret, requireSecret: true });
  if (!clientValidation.ok) {
    return sendJson(res, 401, { error: "invalid_client", error_description: clientValidation.error });
  }
  if (!["authorization_code", "refresh_token"].includes(input.grant_type)) {
    return sendJson(res, 400, { error: "unsupported_grant_type", error_description: "ALIM supporte authorization_code et refresh_token." });
  }

  if (input.grant_type === "refresh_token") {
    const refreshToken = String(input.refresh_token || "").trim();
    if (!refreshToken) {
      return sendJson(res, 400, { error: "invalid_request", error_description: "refresh_token manquant." });
    }
    const db = getAuthDb();
    const row = db.prepare(`
      SELECT r.id, r.account_id, r.client_id, r.scope, r.status, a.status AS account_status
      FROM oauth_refresh_tokens r
      JOIN accounts a ON a.id = r.account_id
      WHERE r.token_hash = ?
    `).get(keyHash(refreshToken));
    if (!row || row.status !== "active") {
      return sendJson(res, 400, { error: "invalid_grant", error_description: "Refresh token invalide." });
    }
    if (row.client_id && client_id && row.client_id !== client_id) {
      return sendJson(res, 400, { error: "invalid_grant", error_description: "client_id incohérent." });
    }
    if (row.account_status !== "active") {
      return sendJson(res, 403, { error: "access_denied", error_description: "Compte ALIM non actif." });
    }
    const accessToken = generateOAuthAccessToken();
    const expiresAt = Date.now() + OAUTH_TOKEN_TTL_MS;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE oauth_refresh_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
      db.prepare(`
        INSERT INTO oauth_tokens (token_hash, account_id, scope, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(keyHash(accessToken), row.account_id, row.scope || OAUTH_SCOPE, expiresAt);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return sendJson(res, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(OAUTH_TOKEN_TTL_MS / 1000),
      scope: row.scope || OAUTH_SCOPE
    });
  }

  const code = String(input.code || "").trim();
  if (!code) {
    return sendJson(res, 400, { error: "invalid_request", error_description: "code manquant." });
  }

  const db = getAuthDb();
  const row = db.prepare(`
    SELECT id, account_id, client_id, redirect_uri, scope, expires_at, used_at
    FROM oauth_codes
    WHERE code_hash = ?
  `).get(keyHash(code));
  if (!row || row.used_at || Number(row.expires_at || 0) < Date.now()) {
    return sendJson(res, 400, { error: "invalid_grant", error_description: "Code OAuth invalide ou expiré." });
  }
  if (row.client_id && client_id && row.client_id !== client_id) {
    return sendJson(res, 400, { error: "invalid_grant", error_description: "client_id incohérent." });
  }
  if (input.redirect_uri && row.redirect_uri !== input.redirect_uri) {
    return sendJson(res, 400, { error: "invalid_grant", error_description: "redirect_uri incohérent." });
  }

  const accessToken = generateOAuthAccessToken();
  const refreshToken = generateOAuthRefreshToken();
  const expiresAt = Date.now() + OAUTH_TOKEN_TTL_MS;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE oauth_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
    db.prepare(`
      INSERT INTO oauth_tokens (token_hash, account_id, scope, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(keyHash(accessToken), row.account_id, row.scope || OAUTH_SCOPE, expiresAt);
    db.prepare(`
      INSERT INTO oauth_refresh_tokens (token_hash, account_id, client_id, scope)
      VALUES (?, ?, ?, ?)
    `).run(keyHash(refreshToken), row.account_id, client_id || row.client_id || "", row.scope || OAUTH_SCOPE);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return sendJson(res, 200, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(OAUTH_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: row.scope || OAUTH_SCOPE
  });
}

async function handleV1Me(req, res) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);
  return sendJson(res, 200, accountPayload(auth.account));
}

async function handleV1AccountUpdate(req, res) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);

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
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);

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
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);

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

async function handleV1ScanRecipe(req, res) {
  const startedAt = Date.now();
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);

  const quota = quotaOk(auth.account);
  if (!quota.ok) {
    logApiUsage({
      account: auth.account,
      route: "/api/v1/scan-recipe",
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
      route: "/api/v1/scan-recipe",
      channel: "api_v1",
      status: error.status || 400,
      input: {},
      output: payload,
      latencyMs: Date.now() - startedAt
    });
    return sendJson(res, error.status || 400, payload);
  }

  const result = scanRecipe(input);
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
    route: "/api/v1/scan-recipe",
    channel: "api_v1",
    status: result.status,
    input,
    output: payload,
    latencyMs: Date.now() - startedAt
  });
  return sendJson(res, result.status, payload);
}

async function handleV1ScanRecipeUrl(req, res) {
  const startedAt = Date.now();
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);

  const quota = quotaOk(auth.account);
  if (!quota.ok) {
    logApiUsage({
      account: auth.account,
      route: "/api/v1/scan-recipe-url",
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
      route: "/api/v1/scan-recipe-url",
      channel: "api_v1",
      status: error.status || 400,
      input: {},
      output: payload,
      latencyMs: Date.now() - startedAt
    });
    return sendJson(res, error.status || 400, payload);
  }

  const result = await scanRecipeUrl(input);
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
    route: "/api/v1/scan-recipe-url",
    channel: "api_v1",
    status: result.status,
    input: { ...input, url: input?.url || input?.recipe_url || "" },
    output: payload,
    latencyMs: Date.now() - startedAt
  });
  return sendJson(res, result.status, payload);
}

function publicRecipeId(id) {
  return `recipe_${id}`;
}

function parsePublicRecipeId(value) {
  const match = String(value || "").match(/^recipe_(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function normalizeSavedRecipeInput(input) {
  const data = input && typeof input === "object" ? input : {};
  const source = data.alim_response && typeof data.alim_response === "object"
    ? data.alim_response
    : data.recipe_payload && typeof data.recipe_payload === "object"
      ? data.recipe_payload
      : data;

  const title = cleanText(
    data.title_fr ||
    source.professional_sheet?.title_fr ||
    source.recipe?.name_fr ||
    "",
    180
  );
  if (!title) {
    return { ok: false, status: 400, payload: { ok: false, error: "Titre de recette manquant." } };
  }

  const status = ["draft", "validated", "favorite"].includes(data.status) ? data.status : "draft";
  const clinicalContext = {
    pathologies: normalizeList(data.clinical_context?.pathologies || data.brief?.pathologies || []),
    meal_slot: cleanText(data.clinical_context?.meal_slot || data.brief?.meal_slot || source.professional_sheet?.meal_slot || "", 32),
    diet_type: cleanText(data.clinical_context?.diet_type || data.brief?.diet_type || "", 32),
    season: cleanText(data.clinical_context?.season || data.brief?.season || "", 32),
    notes: cleanText(data.clinical_context?.notes || data.brief?.notes || "", 600)
  };
  const tags = normalizeStringArray(data.tags || [
    ...clinicalContext.pathologies,
    clinicalContext.meal_slot,
    clinicalContext.diet_type,
    clinicalContext.season
  ], null, 20);
  const payload = {
    recipe: source.recipe || null,
    nutrients_per_portion: source.nutrients_per_portion || null,
    professional_sheet: source.professional_sheet || null,
    presentation_markdown_fr: cleanMultilineText(source.presentation_markdown_fr || source.professional_sheet?.presentation_markdown_fr || "", 50000),
    pdf_url: cleanText(source.pdf_url || "", 1000),
    coverage_summary: source.coverage_summary || null,
    rules_applied: Array.isArray(source.rules_applied) ? source.rules_applied.slice(0, 32) : [],
    sources: Array.isArray(source.sources) ? source.sources.slice(0, 24) : [],
    references_consulted: Array.isArray(source.references_consulted) ? source.references_consulted.slice(0, 24) : [],
    warnings: Array.isArray(source.warnings) ? source.warnings.slice(0, 24) : []
  };
  const piiProbe = JSON.stringify({
    title,
    tags,
    clinicalContext,
    presentation_markdown_fr: payload.presentation_markdown_fr
  });
  const piiKind = detectPii(piiProbe);
  if (piiKind) {
    return {
      ok: false,
      status: 422,
      payload: {
        ok: false,
        error: `Recette non enregistrée : ${piiKind} détectée. Enregistrez uniquement des cas anonymisés.`
      }
    };
  }
  return {
    ok: true,
    recipe: {
      title_fr: title,
      status,
      tags,
      clinical_context: clinicalContext,
      recipe_payload: payload,
      presentation_markdown_fr: payload.presentation_markdown_fr,
      pdf_url: payload.pdf_url
    }
  };
}

function recipeSummary(row) {
  return {
    id: publicRecipeId(row.id),
    title_fr: row.title_fr,
    status: row.status,
    tags: safeJsonParse(row.tags, []),
    clinical_context: safeJsonParse(row.clinical_context, {}),
    pdf_url: row.pdf_url || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at || null
  };
}

function listSavedRecipesForAccount(account, { limit = 30, q = "" } = {}) {
  const safeLimit = clampInt(limit, 1, 100, 30);
  const query = cleanText(q || "", 80).toLowerCase();
  const rows = getAuthDb().prepare(`
    SELECT id, title_fr, status, tags, clinical_context, pdf_url, created_at, updated_at, last_used_at
    FROM account_recipes
    WHERE account_id = ?
    ORDER BY updated_at DESC, id DESC
    LIMIT ?
  `).all(account.account_id, safeLimit);
  const recipes = rows
    .map(recipeSummary)
    .filter((recipe) => {
      if (!query) return true;
      return JSON.stringify(recipe).toLowerCase().includes(query);
    });
  return { ok: true, recipes };
}

function saveRecipeForAccount(account, input) {
  const normalized = normalizeSavedRecipeInput(input);
  if (!normalized.ok) return normalized.payload;
  const r = normalized.recipe;
  const result = getAuthDb().prepare(`
    INSERT INTO account_recipes (
      account_id, title_fr, status, tags, clinical_context, recipe_payload,
      presentation_markdown_fr, pdf_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    account.account_id,
    r.title_fr,
    r.status,
    JSON.stringify(r.tags),
    JSON.stringify(r.clinical_context),
    JSON.stringify(r.recipe_payload),
    r.presentation_markdown_fr,
    r.pdf_url
  );
  return {
    ok: true,
    recipe: {
      id: publicRecipeId(result.lastInsertRowid),
      title_fr: r.title_fr,
      status: r.status,
      tags: r.tags,
      clinical_context: r.clinical_context,
      pdf_url: r.pdf_url
    }
  };
}

function getRecipeForAccount(account, recipeId) {
  const id = parsePublicRecipeId(recipeId);
  if (!id) return { ok: false, error: "Recette introuvable." };
  const row = getAuthDb().prepare(`
    SELECT *
    FROM account_recipes
    WHERE id = ? AND account_id = ?
  `).get(id, account.account_id);
  if (!row) return { ok: false, error: "Recette introuvable." };
  getAuthDb().prepare("UPDATE account_recipes SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  return {
    ok: true,
    recipe: {
      ...recipeSummary(row),
      recipe_payload: safeJsonParse(row.recipe_payload, {}),
      presentation_markdown_fr: row.presentation_markdown_fr || ""
    }
  };
}

function deleteRecipeForAccount(account, recipeId) {
  const id = parsePublicRecipeId(recipeId);
  if (!id) return { ok: false, error: "Recette introuvable." };
  const result = getAuthDb().prepare("DELETE FROM account_recipes WHERE id = ? AND account_id = ?")
    .run(id, account.account_id);
  if (!result.changes) return { ok: false, error: "Recette introuvable." };
  return { ok: true, deleted: publicRecipeId(id) };
}

async function handleV1RecipesList(req, res, url) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);
  return sendJson(res, 200, listSavedRecipesForAccount(auth.account, {
    limit: url.searchParams.get("limit"),
    q: url.searchParams.get("q") || ""
  }));
}

async function handleV1RecipeSave(req, res) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);
  let input;
  try {
    input = await readJson(req);
  } catch (error) {
    return sendJson(res, error.status || 400, { ok: false, error: error.message || "Body JSON invalide." });
  }
  const payload = saveRecipeForAccount(auth.account, input);
  return sendJson(res, payload.ok ? 201 : 422, payload);
}

async function handleV1RecipeGet(req, res, recipeId) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);
  const payload = getRecipeForAccount(auth.account, recipeId);
  return sendJson(res, payload.ok ? 200 : 404, payload);
}

async function handleV1RecipeDelete(req, res, recipeId) {
  const auth = findAccountByBearer(req);
  if (!auth.ok) return sendAuthFailure(res, auth.status, auth.payload);
  const payload = deleteRecipeForAccount(auth.account, recipeId);
  return sendJson(res, payload.ok ? 200 : 404, payload);
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
const MCP_ACCOUNT_TOOL_NAME = "get_alim_account";
const MCP_LIST_RECIPES_TOOL_NAME = "list_saved_recipes";
const MCP_SAVE_RECIPE_TOOL_NAME = "save_generated_recipe";
const MCP_GET_RECIPE_TOOL_NAME = "get_saved_recipe";
const MCP_DELETE_RECIPE_TOOL_NAME = "delete_saved_recipe";
const MCP_SCAN_RECIPE_TOOL_NAME = "scan_recipe_text";
const MCP_SCAN_RECIPE_URL_TOOL_NAME = "scan_recipe_url";
const MCP_VERSION = "0.1.4";
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

const mcpScanRecipeInputSchema = {
  recipe_text: z.string()
    .min(20)
    .max(5000)
    .describe("Texte copié de la recette à analyser, avec ingrédients quantifiés en grammes. Ne pas transmettre d'URL seule en V0."),
  title_fr: z.string().max(160).default("Recette scannée"),
  brief: z.object({
    pathologies: z.array(z.enum(["diabete_t2", "hta", "diabete_gestationnel", "grossesse"])).min(1).max(4),
    meal_slot: z.enum(["petit_dejeuner", "dejeuner", "diner", "collation"]),
    diet_type: z.enum(["omnivore", "vegetarien", "vegan", "pescetarien", "sans_gluten", "sans_lactose"]).default("omnivore"),
    season: z.enum(["printemps", "ete", "automne", "hiver", "all"]).default("all"),
    equipment: z.array(z.enum(["plaque", "four", "vapeur", "micro_ondes", "blender"])).max(8).default(["plaque", "four"]),
    portions: z.number().int().min(1).max(8).default(1),
    notes: z.string().max(600).default("")
  }).describe("Brief clinique anonymisé utilisé pour évaluer la recette.")
};

const mcpScanRecipeUrlInputSchema = {
  url: z.string()
    .url()
    .max(500)
    .describe("URL publique http/https d'une page recette. Les URLs locales ou internes sont refusées."),
  title_fr: z.string().max(160).default("Recette scannée depuis URL"),
  brief: mcpScanRecipeInputSchema.brief
};

function createAlimMcpServer(account = null) {
  const server = new McpServer({
    name: "ALIM",
    title: "ALIM — recettes nutritionnelles cadrées",
    version: MCP_VERSION
  });

  server.registerTool(MCP_ACCOUNT_TOOL_NAME, {
    title: "Lire le compte ALIM connecté",
    description: [
      "Retourne le statut, le plan, le quota du jour, le profil de pratique et l'identité cabinet du compte ALIM associé au Bearer/OAuth courant.",
      "Lecture seule. Aucune donnée patient.",
      "À appeler en début de conversation si le praticien demande son profil, son quota, son plan, son cabinet, ou si vous devez adapter le ton et les formats par défaut sans les redemander."
    ].join(" "),
    inputSchema: {}
  }, async () => {
    if (!account) {
      const payload = {
        ok: false,
        error: "Compte ALIM non disponible sur cette connexion MCP.",
        disclaimer: DISCLAIMER
      };
      return {
        isError: true,
        structuredContent: payload,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
      };
    }
    const payload = {
      ...accountPayload(account),
      meta: {
        channel: "mcp",
        tool: MCP_ACCOUNT_TOOL_NAME,
        read_only: true,
        disclaimer: DISCLAIMER
      }
    };
    return {
      isError: false,
      structuredContent: payload,
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
    };
  });

  server.registerTool(MCP_LIST_RECIPES_TOOL_NAME, {
    title: "Lister les recettes ALIM enregistrées",
    description: [
      "Retourne la bibliothèque de recettes anonymisées du compte ALIM connecté.",
      "Lecture seule. À utiliser quand le praticien demande ses recettes, ses favoris, ou une recherche par titre/pathologie/repas."
    ].join(" "),
    inputSchema: {
      q: z.string().max(80).default("").describe("Recherche optionnelle dans les titres, tags et contexte clinique."),
      limit: z.number().int().min(1).max(100).default(30)
    }
  }, async (args) => {
    if (!account) {
      const payload = { ok: false, error: "Compte ALIM non disponible sur cette connexion MCP.", disclaimer: DISCLAIMER };
      return { isError: true, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
    const payload = {
      ...listSavedRecipesForAccount(account, args || {}),
      meta: { channel: "mcp", tool: MCP_LIST_RECIPES_TOOL_NAME, read_only: true, disclaimer: DISCLAIMER }
    };
    return { isError: false, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  });

  server.registerTool(MCP_SAVE_RECIPE_TOOL_NAME, {
    title: "Enregistrer une recette ALIM",
    description: [
      "Enregistre dans la bibliothèque du compte une recette ALIM anonymisée déjà générée.",
      "Ne jamais appeler automatiquement : demander une confirmation explicite au praticien avant sauvegarde.",
      "Refuse les contenus contenant e-mail, téléphone, date complète ou identifiants patient."
    ].join(" "),
    inputSchema: {
      title_fr: z.string().max(180).optional().describe("Titre optionnel si absent de la sortie ALIM."),
      status: z.enum(["draft", "validated", "favorite"]).default("draft"),
      tags: z.array(z.string().max(80)).max(20).default([]),
      clinical_context: z.any().optional().describe("Contexte clinique anonymisé : pathologies, repas, saison, notes sans PII."),
      recipe_payload: z.any().optional().describe("Payload complet de recette ALIM, idéalement la sortie du tool generate_clinical_recipe."),
      alim_response: z.any().optional().describe("Alias accepté pour la sortie complète ALIM à sauvegarder."),
      brief: z.any().optional().describe("Brief anonymisé utilisé pour générer la recette.")
    }
  }, async (args) => {
    if (!account) {
      const payload = { ok: false, error: "Compte ALIM non disponible sur cette connexion MCP.", disclaimer: DISCLAIMER };
      return { isError: true, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
    const payload = {
      ...saveRecipeForAccount(account, args || {}),
      meta: { channel: "mcp", tool: MCP_SAVE_RECIPE_TOOL_NAME, disclaimer: DISCLAIMER }
    };
    return { isError: !payload.ok, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  });

  server.registerTool(MCP_GET_RECIPE_TOOL_NAME, {
    title: "Lire une recette ALIM enregistrée",
    description: "Retourne le détail complet d'une recette enregistrée du compte ALIM connecté.",
    inputSchema: {
      recipe_id: z.string().regex(/^recipe_\d+$/).describe("Identifiant public de recette, par exemple recipe_12.")
    }
  }, async (args) => {
    if (!account) {
      const payload = { ok: false, error: "Compte ALIM non disponible sur cette connexion MCP.", disclaimer: DISCLAIMER };
      return { isError: true, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
    const payload = {
      ...getRecipeForAccount(account, args?.recipe_id || ""),
      meta: { channel: "mcp", tool: MCP_GET_RECIPE_TOOL_NAME, read_only: true, disclaimer: DISCLAIMER }
    };
    return { isError: !payload.ok, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  });

  server.registerTool(MCP_DELETE_RECIPE_TOOL_NAME, {
    title: "Supprimer une recette ALIM enregistrée",
    description: [
      "Supprime une recette de la bibliothèque du compte ALIM connecté.",
      "Demander une confirmation explicite au praticien avant suppression."
    ].join(" "),
    inputSchema: {
      recipe_id: z.string().regex(/^recipe_\d+$/).describe("Identifiant public de recette, par exemple recipe_12.")
    }
  }, async (args) => {
    if (!account) {
      const payload = { ok: false, error: "Compte ALIM non disponible sur cette connexion MCP.", disclaimer: DISCLAIMER };
      return { isError: true, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
    }
    const payload = {
      ...deleteRecipeForAccount(account, args?.recipe_id || ""),
      meta: { channel: "mcp", tool: MCP_DELETE_RECIPE_TOOL_NAME, disclaimer: DISCLAIMER }
    };
    return { isError: !payload.ok, structuredContent: payload, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  });

  server.registerTool(MCP_SCAN_RECIPE_TOOL_NAME, {
    title: "Scanner une recette externe",
    description: [
      "Analyse une recette copiée par le praticien : ingrédients quantifiés, calcul CIQUAL, garde-fous du profil ALIM et ajustements proposés.",
      "V0 texte uniquement : si le praticien donne une URL, demander de coller le texte de la recette et les quantités.",
      "À utiliser pour évaluer une recette trouvée par un patient ou sur le web avant validation clinique."
    ].join(" "),
    inputSchema: mcpScanRecipeInputSchema
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

    const result = scanRecipe(args || {});
    const payload = {
      ...result.payload,
      meta: {
        channel: "mcp",
        tool: MCP_SCAN_RECIPE_TOOL_NAME,
        status: result.status,
        latency_ms: Date.now() - startedAt,
        disclaimer: DISCLAIMER
      }
    };
    if (account) {
      logApiUsage({
        account,
        route: "/mcp/v1",
        channel: "mcp",
        status: result.status,
        input: args || {},
        output: payload,
        latencyMs: Date.now() - startedAt
      });
    }
    return {
      isError: result.status >= 400,
      structuredContent: payload,
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
    };
  });

  server.registerTool(MCP_SCAN_RECIPE_URL_TOOL_NAME, {
    title: "Scanner une recette depuis URL",
    description: [
      "Récupère une page recette publique, extrait les ingrédients via JSON-LD Recipe ou HTML, puis lance l'analyse ALIM.",
      "Refuse les URLs locales, internes ou non HTML.",
      "Si l'extraction échoue, demander au praticien de coller le texte de la recette."
    ].join(" "),
    inputSchema: mcpScanRecipeUrlInputSchema
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

    const result = await scanRecipeUrl(args || {});
    const payload = {
      ...result.payload,
      meta: {
        channel: "mcp",
        tool: MCP_SCAN_RECIPE_URL_TOOL_NAME,
        status: result.status,
        latency_ms: Date.now() - startedAt,
        disclaimer: DISCLAIMER
      }
    };
    if (account) {
      logApiUsage({
        account,
        route: "/mcp/v1",
        channel: "mcp",
        status: result.status,
        input: args || {},
        output: payload,
        latencyMs: Date.now() - startedAt
      });
    }
    return {
      isError: result.status >= 400,
      structuredContent: payload,
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
    };
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
      "www-authenticate": bearerChallengeHeader(),
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
    version: MCP_VERSION,
    transport: "streamable-http",
    endpoint: `https://${hostname}${MCP_ENDPOINT}`,
    documentation_url: `https://${hostname}/install/claude/`,
    auth: MCP_AUTH_REQUIRED ? "bearer" : "prototype-no-auth",
    authorization_header: MCP_AUTH_REQUIRED ? "Authorization: Bearer alim_live_..." : null,
    tools: [
      {
        name: MCP_ACCOUNT_TOOL_NAME,
        title: "Lire le compte ALIM connecté",
        output_contract: [
          "account.status / account.plan : état du compte et abonnement",
          "quota_daily / used_today / remaining_today : quota du jour",
          "practitioner_profile : métier, patientèles, formats, contraintes et préférences",
          "cabinet_branding : identité cabinet pour les sorties patient",
          "lecture seule, aucune donnée patient"
        ]
      },
      {
        name: MCP_LIST_RECIPES_TOOL_NAME,
        title: "Lister les recettes ALIM enregistrées",
        output_contract: [
          "recipes[] : id, titre, statut, tags, contexte clinique anonymisé, pdf_url, dates",
          "lecture seule"
        ]
      },
      {
        name: MCP_SAVE_RECIPE_TOOL_NAME,
        title: "Enregistrer une recette ALIM",
        output_contract: [
          "sauvegarde une sortie ALIM anonymisée après confirmation explicite du praticien",
          "retourne recipe.id / title_fr / tags / clinical_context / pdf_url",
          "refuse les contenus contenant des données personnelles"
        ]
      },
      {
        name: MCP_GET_RECIPE_TOOL_NAME,
        title: "Lire une recette ALIM enregistrée",
        output_contract: [
          "retourne le résumé, recipe_payload complet et presentation_markdown_fr"
        ]
      },
      {
        name: MCP_DELETE_RECIPE_TOOL_NAME,
        title: "Supprimer une recette ALIM enregistrée",
        output_contract: [
          "suppression après confirmation explicite du praticien",
          "retourne l'identifiant supprimé"
        ]
      },
      {
        name: MCP_SCAN_RECIPE_TOOL_NAME,
        title: "Scanner une recette externe",
        output_contract: [
          "texte de recette quantifié → matching CIQUAL → verdict vert/orange/rouge",
          "retourne nutriments estimés, ingrédients reconnus, lignes non reconnues, règles appliquées, corrections proposées",
          "V0 : pas de scraping URL, demander le texte de la recette"
        ]
      },
      {
        name: MCP_SCAN_RECIPE_URL_TOOL_NAME,
        title: "Scanner une recette depuis URL",
        output_contract: [
          "URL publique → extraction JSON-LD Recipe ou HTML → scan_recipe_text",
          "retourne verdict, nutriments estimés, ingrédients reconnus, corrections proposées et métadonnées d'extraction",
          "refuse URLs locales, internes, non HTML ou non extractibles"
        ]
      },
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

function sendAuthFailure(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "www-authenticate": bearerChallengeHeader()
  });
  res.end(body);
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(html);
}

function redirect(res, location) {
  res.writeHead(302, {
    "location": location,
    "cache-control": "no-store"
  });
  res.end();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "alim", version: "0.1.0" });
  }

  if (req.method === "GET" && url.pathname === MCP_DISCOVERY) {
    return sendJson(res, 200, mcpDiscoveryPayload(url.hostname || "alim.care"));
  }

  if (req.method === "GET" && /^\/\.well-known\/oauth-authorization-server(\/.*)?$/.test(url.pathname)) {
    return sendJson(res, 200, oauthAuthorizationServerMetadata(PUBLIC_ORIGIN));
  }

  if (req.method === "GET" && /^\/\.well-known\/oauth-protected-resource(\/.*)?$/.test(url.pathname)) {
    return sendJson(res, 200, oauthProtectedResourceMetadata(PUBLIC_ORIGIN));
  }

  if (req.method === "GET" && url.pathname === "/oauth/authorize") {
    return handleOAuthAuthorizeGet(req, res, url);
  }

  if (req.method === "POST" && url.pathname === "/oauth/authorize") {
    return handleOAuthAuthorizePost(req, res);
  }

  if (req.method === "POST" && url.pathname === "/oauth/token") {
    return handleOAuthToken(req, res);
  }

  if (req.method === "POST" && (url.pathname === "/oauth/register" || url.pathname === "/register")) {
    return handleOAuthRegister(req, res);
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

  if (req.method === "POST" && url.pathname === "/api/v1/scan-recipe") {
    return handleV1ScanRecipe(req, res);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/scan-recipe-url") {
    return handleV1ScanRecipeUrl(req, res);
  }

  if (req.method === "GET" && url.pathname === "/api/v1/recipes") {
    return handleV1RecipesList(req, res, url);
  }

  if (req.method === "POST" && url.pathname === "/api/v1/recipes") {
    return handleV1RecipeSave(req, res);
  }

  const recipeMatch = url.pathname.match(/^\/api\/v1\/recipes\/([^/]+)$/);
  if (recipeMatch && req.method === "GET") {
    return handleV1RecipeGet(req, res, recipeMatch[1]);
  }

  if (recipeMatch && req.method === "DELETE") {
    return handleV1RecipeDelete(req, res, recipeMatch[1]);
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    return sendJson(res, 401, {
      ok: false,
      refused: {
        reason_fr: "Endpoint protégé : utilisez /api/v1/generate avec une clé ALIM active."
      },
      warnings: [DISCLAIMER]
    });
  }

  if (req.method === "POST" && url.pathname === "/api/demo-generate") {
    try {
      const rl = apiGenerateRateLimitOk(getClientIp(req));
      if (!rl.ok) {
        return sendJson(res, 429, {
          refused: {
            reason_fr: rl.reason === "global"
              ? "ALIM est temporairement saturé. Réessayez dans une heure."
              : "Quota démo atteint. Demandez un accès bêta dédié sur /configurer/."
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
