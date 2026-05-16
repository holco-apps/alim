import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 9312;
const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, ALIM_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth(port);

  const demo1 = await post(port, {
    pathologies: ["diabete_t2", "hta"],
    diet_type: "omnivore",
    meal_slot: "diner",
    portions: 1
  });
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
  });
  assert.equal(demo2.status, 200);
  assert.ok(demo2.body.nutrients_per_portion.carb_g.value >= 20);
  assert.ok(demo2.body.nutrients_per_portion.carb_g.value <= 45);
  assert.equal(demo2.body.nutrients_per_portion.added_sugar_g.value, 0);
  assert.ok(demo2.body.nutrients_per_portion.fiber_g.value >= 7);
  assert.ok(demo2.body.warnings.some((warning) => /laver|lavés|lavage/i.test(warning)));

  const refused = await post(port, {
    pathologies: ["diabete_t2", "hta"],
    notes: "Patient CKD stade 3 avec insuffisance rénale."
  });
  assert.equal(refused.status, 422);
  assert.ok(refused.body.refused.reason_fr.includes("insuffisance rénale"));

  console.log("ALIM smoke tests passed");
} finally {
  server.kill("SIGTERM");
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

async function post(port, body) {
  const res = await fetch(`http://127.0.0.1:${port}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
}
