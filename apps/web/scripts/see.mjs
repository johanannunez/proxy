#!/usr/bin/env node
/**
 * One-call visual verification: signs the gstack browse daemon in if
 * needed, navigates to the requested route, captures responsive
 * screenshots (mobile + tablet + desktop), and dumps browser console
 * + recent server log lines into a structured /tmp/agent-see/<slug>/
 * folder. Designed to make routine UI verification a single command
 * during dev mode.
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
 *   pnpm see /admin/inbox
 *   pnpm see /portal/dashboard
 *   pnpm see /admin/inbox --label compose-after
 *
 * Output:
 *   /tmp/agent-see/<slug>/
 *     mobile.png    (375x812)
 *     tablet.png    (768x1024)
 *     desktop.png   (1280x800)
 *     console.txt   (browser console)
 *     network.txt   (recent network calls)
 *     summary.json  (path, status, error counts, slug)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const repoRoot = join(__dirname, "..", "..", "..");

const args = process.argv.slice(2);
let route = null;
let label = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--label") {
    label = args[++i];
  } else if (!route) {
    route = args[i];
  }
}
if (!route) {
  console.error("Usage: pnpm see <route> [--label <name>]");
  console.error("Example: pnpm see /admin/inbox");
  process.exit(1);
}
if (!route.startsWith("/")) route = `/${route}`;

const BASE = process.env.PARCEL_DEV_URL || "http://localhost:4000";
const BIN = process.env.BROWSE_BIN || join(homedir(), ".claude/skills/gstack/browse/dist/browse");
const EMAIL = process.env.DEV_AGENT_EMAIL;
const PASSWORD = process.env.DEV_AGENT_PASSWORD;

if (!existsSync(BIN)) {
  console.error(`[see] gstack browse binary not found at ${BIN}. Run the gstack setup once.`);
  process.exit(1);
}

const slug = label || route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "root";
const outDir = `/tmp/agent-see/${slug}`;
mkdirSync(outDir, { recursive: true });

function b(...a) {
  return execFileSync(BIN, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function bSilent(...a) {
  try {
    return b(...a);
  } catch (err) {
    return (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
  }
}

function ensureLoggedIn() {
  b("goto", `${BASE}${route}`);
  const path = b("js", "location.pathname").replace(/^"|"$/g, "");
  if (!path.startsWith("/login")) return path;

  if (!EMAIL || !PASSWORD) {
    console.error("[see] Hit /login but DEV_AGENT_EMAIL / DEV_AGENT_PASSWORD are missing. Run via `doppler run --project parcel --config dev`.");
    process.exit(1);
  }

  console.log(`[see] Signing in as ${EMAIL}`);
  b("goto", `${BASE}/login?redirect=${encodeURIComponent(route)}`);
  bSilent("wait", "input[name='email']");
  b("fill", "input[name='email']", EMAIL);
  b("fill", "input[name='password']", PASSWORD);
  b("click", "button[type='submit']");
  bSilent("wait", "main");
  return b("js", "location.pathname").replace(/^"|"$/g, "");
}

function viewportShot(name, size) {
  b("viewport", size);
  b("goto", `${BASE}${route}`);
  bSilent("wait", "main");
  // Brief settle for HMR / data fetch
  bSilent("js", "new Promise(r => setTimeout(r, 600))");
  b("screenshot", join(outDir, `${name}.png`));
}

function captureConsole() {
  const out = bSilent("console");
  writeFileSync(join(outDir, "console.txt"), out);
  const errors = out.split("\n").filter((l) => /\[error\]/i.test(l));
  return errors.length;
}

function captureNetwork() {
  const out = bSilent("network");
  writeFileSync(join(outDir, "network.txt"), out);
  const fails = out.split("\n").filter((l) => /\s(4\d\d|5\d\d)\s/.test(l));
  return fails.length;
}

function tailServerLog() {
  const path = join(webRoot, ".next/dev/logs/next-development.log");
  if (!existsSync(path)) return { lines: 0, errors: 0, warnings: 0 };
  const since = Date.now() - 5 * 60 * 1000;
  const raw = readFileSync(path, "utf8");
  const recent = raw
    .split("\n")
    .filter(Boolean)
    .filter((line) => {
      try {
        const entry = JSON.parse(line);
        const t = Date.parse(`1970-01-01T${entry.timestamp}Z`); // best effort
        return Number.isNaN(t) ? true : true;
      } catch {
        return true;
      }
    })
    .slice(-200);
  writeFileSync(join(outDir, "server-log.txt"), recent.join("\n"));
  const errors = recent.filter((l) => /\"level\":\s*\"ERROR\"|level":"error"/i.test(l)).length;
  const warnings = recent.filter((l) => /\"level\":\s*\"WARN\"|level":"warn"/i.test(l)).length;
  return { lines: recent.length, errors, warnings, since };
}

async function main() {
  console.log(`[see] Route: ${route}`);
  console.log(`[see] Output: ${outDir}`);

  const path = ensureLoggedIn();
  console.log(`[see] Landed on: ${path}`);

  viewportShot("mobile", "375x812");
  viewportShot("tablet", "768x1024");
  viewportShot("desktop", "1280x800");

  const consoleErrors = captureConsole();
  const networkFails = captureNetwork();
  const serverLog = tailServerLog();

  const summary = {
    slug,
    route,
    landedOn: path,
    timestamp: new Date().toISOString(),
    artifacts: {
      mobile: join(outDir, "mobile.png"),
      tablet: join(outDir, "tablet.png"),
      desktop: join(outDir, "desktop.png"),
      console: join(outDir, "console.txt"),
      network: join(outDir, "network.txt"),
      serverLog: join(outDir, "server-log.txt"),
    },
    counts: {
      browserConsoleErrors: consoleErrors,
      networkFailures: networkFails,
      serverLogErrors: serverLog.errors,
      serverLogWarnings: serverLog.warnings,
    },
  };
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

  const sizes = ["mobile", "tablet", "desktop"]
    .map((n) => {
      const p = join(outDir, `${n}.png`);
      const s = existsSync(p) ? statSync(p).size : 0;
      return `${n} ${Math.round(s / 1024)}KB`;
    })
    .join("  ");
  console.log(`[see] Screens: ${sizes}`);
  console.log(`[see] Counts: console=${consoleErrors} network=${networkFails} log-errors=${serverLog.errors} log-warns=${serverLog.warnings}`);
  console.log(`[see] Summary: ${join(outDir, "summary.json")}`);
}

main().catch((err) => {
  console.error(`[see] Failed:`, err.message ?? err);
  process.exit(1);
});
