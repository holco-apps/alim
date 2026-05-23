import { mkdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.ALIM_DATA_DIR || "/var/lib/alim";
const DB_FILE = process.env.ALIM_DB_FILE || `${DATA_DIR}/alim.sqlite`;
const DEFAULT_DAILY_QUOTA = Number(process.env.ALIM_DEFAULT_DAILY_QUOTA || 300);

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function usage() {
  console.error([
    "Usage:",
    "  node provision-account.js --email pro@example.com --name \"Prenom Nom\" --cabinet \"Cabinet\" [--quota 20]",
    "",
    "Optional:",
    "  --status active|pending|inactive",
    "  --plan beta|pro",
    "  --profile-json '{\"metier\":\"dieteticienne\"}'",
    "  --branding-json '{\"display_name\":\"Cabinet\"}'"
  ].join("\n"));
  process.exit(1);
}

const email = arg("email").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) usage();

const displayName = arg("name", "").trim();
const cabinetName = arg("cabinet", "").trim();
const status = arg("status", "active").trim();
const plan = arg("plan", "beta_free").trim();
const quotaDaily = Number(arg("quota", String(DEFAULT_DAILY_QUOTA)));
const practitionerProfile = arg("profile-json", "{}");
const cabinetBranding = arg("branding-json", "{}");

JSON.parse(practitionerProfile);
JSON.parse(cabinetBranding);

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
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

db.prepare(`
  INSERT INTO accounts (
    email, display_name, cabinet_name, status, plan, quota_daily,
    practitioner_profile, cabinet_branding, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(email) DO UPDATE SET
    display_name = excluded.display_name,
    cabinet_name = excluded.cabinet_name,
    status = excluded.status,
    plan = excluded.plan,
    quota_daily = excluded.quota_daily,
    practitioner_profile = excluded.practitioner_profile,
    cabinet_branding = excluded.cabinet_branding,
    updated_at = CURRENT_TIMESTAMP
`).run(
  email,
  displayName,
  cabinetName,
  status,
  plan,
  Number.isFinite(quotaDaily) ? quotaDaily : DEFAULT_DAILY_QUOTA,
  practitionerProfile,
  cabinetBranding
);

const account = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email);
const token = `alim_live_${randomBytes(24).toString("base64url")}`;
const prefix = token.slice(0, 18);
const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

db.exec("BEGIN IMMEDIATE");
try {
  db.prepare("UPDATE api_keys SET status = 'rotated' WHERE account_id = ? AND status = 'active'")
    .run(account.id);
  db.prepare(`
    INSERT INTO api_keys (account_id, prefix, token_hash, status, label)
    VALUES (?, ?, ?, 'active', 'default')
  `).run(account.id, prefix, tokenHash);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log(JSON.stringify({
  ok: true,
  account_id: `acct_${account.id}`,
  email,
  status,
  plan,
  quota_daily: Number.isFinite(quotaDaily) ? quotaDaily : DEFAULT_DAILY_QUOTA,
  key_prefix: prefix,
  api_key: token
}, null, 2));
