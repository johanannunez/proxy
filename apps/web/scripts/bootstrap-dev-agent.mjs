#!/usr/bin/env node
/**
 * One-shot bootstrap for the headless dev agent user.
 *
 * Creates (or updates) auth.users + public.profiles for the dedicated
 * test account used by the gstack browse daemon. Idempotent: safe to
 * re-run. Reads creds from environment so nothing leaks into git.
 *
 *   ENV REQUIRED
 *     NEXT_PUBLIC_SUPABASE_URL
 *     SUPABASE_SERVICE_ROLE_KEY
 *     DEV_AGENT_EMAIL
 *     DEV_AGENT_PASSWORD
 *
 * Usage:
 *   doppler run -- node scripts/bootstrap-dev-agent.mjs
 * Or with explicit env passthrough from apps/web/.env.local:
 *   set -a; source apps/web/.env.local; set +a; node scripts/bootstrap-dev-agent.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const repoRoot = join(__dirname, "..", "..", "..");

function loadEnvLocal() {
  const candidates = [join(webRoot, ".env.local"), join(repoRoot, ".env.local")];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.DEV_AGENT_EMAIL;
const PASSWORD = process.env.DEV_AGENT_PASSWORD;

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!EMAIL) missing.push("DEV_AGENT_EMAIL");
if (!PASSWORD) missing.push("DEV_AGENT_PASSWORD");
if (missing.length) {
  console.error(`[bootstrap-dev-agent] Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  console.log(`[bootstrap-dev-agent] Target email: ${EMAIL}`);

  let user = await findUserByEmail(EMAIL);
  if (user) {
    console.log(`[bootstrap-dev-agent] User exists (id=${user.id}). Resetting password and confirming email.`);
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    console.log(`[bootstrap-dev-agent] Creating user.`);
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Dev Agent" },
    });
    if (error) throw error;
    user = data.user;
    console.log(`[bootstrap-dev-agent] Created user id=${user.id}`);
  }

  console.log(`[bootstrap-dev-agent] Upserting profile with role=admin.`);
  const { error: upsertError } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: EMAIL,
        role: "admin",
        full_name: "Dev Agent",
      },
      { onConflict: "id" },
    );
  if (upsertError) throw upsertError;

  console.log(`[bootstrap-dev-agent] Done. User can sign in with email "${EMAIL}".`);
}

main().catch((err) => {
  console.error(`[bootstrap-dev-agent] Failed:`, err.message ?? err);
  process.exit(1);
});
