#!/usr/bin/env node
/**
 * Signs the persistent gstack browse daemon into the local Parcel dev
 * server as the dedicated headless agent user, so subsequent browse
 * calls land on /admin and /portal instead of /login.
 *
 *   ENV REQUIRED (Doppler parcel/dev injects these)
 *     DEV_AGENT_EMAIL
 *     DEV_AGENT_PASSWORD
 *
 *   ENV OPTIONAL
 *     PARCEL_DEV_URL  (default http://localhost:4000)
 *     BROWSE_BIN      (default ~/.claude/skills/gstack/browse/dist/browse)
 *
 * Usage:
 *   pnpm dev-login                       # via root package.json script
 *   pnpm --filter web dev-login          # via the web workspace
 *
 * Exit codes:
 *   0  Signed in (or session already valid)
 *   1  Misconfigured or login failed
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const EMAIL = process.env.DEV_AGENT_EMAIL;
const PASSWORD = process.env.DEV_AGENT_PASSWORD;
const BASE = process.env.PARCEL_DEV_URL || "http://localhost:4000";
const BIN =
  process.env.BROWSE_BIN ||
  join(homedir(), ".claude/skills/gstack/browse/dist/browse");

if (!EMAIL || !PASSWORD) {
  console.error("[dev-login] DEV_AGENT_EMAIL or DEV_AGENT_PASSWORD missing. Run via `doppler run --project parcel --config dev`.");
  process.exit(1);
}

if (!existsSync(BIN)) {
  console.error(`[dev-login] gstack browse binary not found at ${BIN}.`);
  console.error("[dev-login] Set BROWSE_BIN env var, or run the gstack setup once: cd ~/.claude/skills/gstack/browse && ./setup");
  process.exit(1);
}

function browse(...args) {
  return execFileSync(BIN, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function browseSilent(...args) {
  try {
    return browse(...args);
  } catch (err) {
    const out = err.stdout?.toString() ?? "";
    const errOut = err.stderr?.toString() ?? "";
    return (out + errOut).trim();
  }
}

function probeAdmin() {
  browse("goto", `${BASE}/admin`);
  const path = browse("js", "location.pathname");
  return path.replace(/^"|"$/g, "");
}

function login() {
  browse("goto", `${BASE}/login?redirect=/admin`);
  browseSilent("wait", "input[name='email']");
  browse("fill", "input[name='email']", EMAIL);
  browse("fill", "input[name='password']", PASSWORD);
  browse("click", "button[type='submit']");
  browseSilent("wait", "main");
}

function main() {
  console.log(`[dev-login] Probing ${BASE}/admin`);
  const initialPath = probeAdmin();
  if (initialPath.startsWith("/admin")) {
    console.log("[dev-login] Session already valid. Skipping form login.");
    process.exit(0);
  }

  console.log(`[dev-login] Not signed in (landed on ${initialPath}). Logging in as ${EMAIL}.`);
  login();

  const finalPath = browse("js", "location.pathname").replace(/^"|"$/g, "");
  if (!finalPath.startsWith("/admin")) {
    console.error(`[dev-login] Login completed but did not land on /admin (got ${finalPath}). Check credentials and dev server.`);
    process.exit(1);
  }

  console.log(`[dev-login] Signed in. Current location: ${finalPath}`);
}

try {
  main();
} catch (err) {
  console.error(`[dev-login] Failed:`, err.message ?? err);
  process.exit(1);
}
