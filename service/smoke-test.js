import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const port = 9312;
const dataDir = mkdtempSync(join(tmpdir(), "alim-smoke-"));
const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, ALIM_PORT: String(port), ALIM_DATA_DIR: dataDir },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth(port);
  await fetch(`http://127.0.0.1:${port}/api/v1/me`, {
    headers: { authorization: "Bearer alim_live_init_schema" }
  });
  const apiKey = createSmokeAccount(dataDir);

  const demo1 = await post(port, {
    pathologies: ["diabete_t2", "hta"],
    diet_type: "omnivore",
    meal_slot: "diner",
    portions: 1
  }, apiKey);
  assert.equal(demo1.status, 200);
  assert.ok(demo1.body.nutrients_per_portion.salt_g.value <= 1.6);
  assert.ok(demo1.body.nutrients_per_portion.carb_g.value >= 30);
  assert.ok(demo1.body.nutrients_per_portion.carb_g.value <= 60);
  assert.ok(demo1.body.nutrients_per_portion.fiber_g.value >= 7);
  assert.ok(demo1.body.sources.some((source) => source.citation.includes("Ciqual 2025")));

  const demo2 = await post(port, {
    pathologies: ["diabete_gestationnel", "grossesse"],
    diet_type: "vegetarien",
    season: "ete",
    meal_slot: "dejeuner",
    portions: 1
  }, apiKey);
  assert.equal(demo2.status, 200);
  assert.ok(demo2.body.nutrients_per_portion.carb_g.value >= 20);
  assert.ok(demo2.body.nutrients_per_portion.carb_g.value <= 45);
  assert.equal(demo2.body.nutrients_per_portion.added_sugar_g.value, 0);
  assert.ok(demo2.body.nutrients_per_portion.fiber_g.value >= 7);
  assert.ok(demo2.body.warnings.some((warning) => /laver|lavés|lavage/i.test(warning)));

  const dgSnack = await post(port, {
    pathologies: ["diabete_gestationnel", "grossesse"],
    diet_type: "vegetarien",
    season: "all",
    meal_slot: "collation",
    portions: 1,
    notes: "Premier trimestre, nausées, textures douces, peu odorant."
  }, apiKey);
  assert.equal(dgSnack.status, 200);
  assert.ok(dgSnack.body.nutrients_per_portion.energy_kcal.value >= 150);
  assert.ok(dgSnack.body.nutrients_per_portion.energy_kcal.value <= 250);
  assert.ok(dgSnack.body.nutrients_per_portion.carb_g.value >= 15);
  assert.ok(dgSnack.body.nutrients_per_portion.carb_g.value <= 30);
  assert.ok(dgSnack.body.nutrients_per_portion.fiber_g.value <= 8);
  assert.match(dgSnack.body.presentation_markdown_fr, /nausées|texture douce|peu odorante/i);

  const scan = await post(port, {
    title_fr: "Bol riz blanc courgette",
    recipe_text: [
      "Riz blanc cuit — 180 g",
      "Courgette cuite — 100 g",
      "Huile d'olive — 10 g",
      "Poulet cuit — 90 g"
    ].join("\n"),
    brief: {
      pathologies: ["diabete_t2", "hta"],
      diet_type: "omnivore",
      meal_slot: "dejeuner",
      portions: 1
    }
  }, apiKey, "/api/v1/scan-recipe");
  assert.equal(scan.status, 200);
  assert.ok(["green", "orange", "red"].includes(scan.body.verdict.status));
  assert.ok(scan.body.ingredients_matched.length >= 3);
  assert.ok(scan.body.presentation_markdown_fr.includes("Analyse ALIM"));

  const scanUrlRefused = await post(port, {
    url: "http://127.0.0.1/recipe",
    brief: {
      pathologies: ["diabete_t2", "hta"],
      diet_type: "omnivore",
      meal_slot: "dejeuner",
      portions: 1
    }
  }, apiKey, "/api/v1/scan-recipe-url");
  assert.equal(scanUrlRefused.status, 422);
  assert.ok(scanUrlRefused.body.refused.reason_fr.includes("refusée"));

  const t2OnlyScan = await post(port, {
    title_fr: "Test diabète seul",
    recipe_text: [
      "Riz blanc cuit — 180 g",
      "Courgette cuite — 100 g",
      "Huile d'olive — 10 g"
    ].join("\n"),
    brief: {
      pathologies: ["diabete_t2"],
      diet_type: "omnivore",
      meal_slot: "dejeuner",
      portions: 1
    }
  }, apiKey, "/api/v1/scan-recipe");
  assert.equal(t2OnlyScan.status, 200);
  assert.ok(t2OnlyScan.body.rules_applied.includes("t2_carb_per_meal_max"));

  const cookieScan = await post(port, {
    title_fr: "Cookies maison",
    recipe_text: [
      "85 g de beurre tendre",
      "1 oeuf",
      "85 g de sucre",
      "150 g de farine",
      "100 g de chocolat noir",
      "1 bonne pincée de sel",
      "1 cuillère à café de levure chimique"
    ].join("\n"),
    brief: {
      pathologies: ["diabete_t2"],
      diet_type: "omnivore",
      meal_slot: "collation",
      portions: 1
    }
  }, apiKey, "/api/v1/scan-recipe");
  assert.equal(cookieScan.status, 200);
  const cookieNames = cookieScan.body.ingredients_matched.map((item) => item.name_fr).join(" | ");
  assert.match(cookieNames, /Oeuf cru/i);
  assert.doesNotMatch(cookieNames, /Boeuf/i);
  assert.match(cookieNames, /Sucre blanc/i);
  assert.match(cookieNames, /Chocolat noir/i);

  const refused = await post(port, {
    pathologies: ["diabete_t2", "hta"],
    notes: "Patient CKD stade 3 avec insuffisance rénale."
  }, apiKey);
  assert.equal(refused.status, 422);
  assert.ok(refused.body.refused.reason_fr.includes("insuffisance rénale"));

  console.log("ALIM smoke tests passed");
} finally {
  server.kill("SIGTERM");
  rmSync(dataDir, { recursive: true, force: true });
}

function createSmokeAccount(dataDir) {
  const db = new DatabaseSync(join(dataDir, "alim.sqlite"));
  const apiKey = `alim_live_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(apiKey).digest("hex");
  const result = db.prepare(`
    INSERT INTO accounts (email, display_name, cabinet_name, status, plan, quota_daily)
    VALUES (?, ?, ?, 'active', 'smoke', 50)
  `).run("smoke@alim.local", "Smoke Test", "ALIM Smoke");
  db.prepare(`
    INSERT INTO api_keys (account_id, prefix, token_hash, status, label)
    VALUES (?, ?, ?, 'active', 'smoke')
  `).run(Number(result.lastInsertRowid), apiKey.slice(0, 18), hash);
  db.close();
  return apiKey;
}

async function waitForHealth(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("healthcheck timeout");
}

async function post(port, body, apiKey, path = "/api/v1/generate") {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
}
