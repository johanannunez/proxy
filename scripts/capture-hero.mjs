#!/usr/bin/env node
// One-off: capture the real admin Workspace Overview for the marketing hero.
// Auths via /api/dev/auth (2FA bypassed by DEV_SKIP_MFA in dev), dresses the
// empty states with believable demo content, masks the founder email, and
// captures a retina (DPR 2) screenshot.
//
// Usage: node scripts/capture-hero.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ID = "82f31977-d829-4069-82c7-cbb411a46210";
const BASE = "http://localhost:4000";
const OUT = join(
  __dirname,
  "..",
  "apps/web/public/marketing/screenshots/workspace-hero-light-v1.png",
);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
const page = await context.newPage();

// Force light theme before any app code runs.
await page.addInitScript(() => {
  try {
    localStorage.setItem("proxy-theme", "light");
    localStorage.setItem("theme", "light");
  } catch {}
});

await page.goto(
  `${BASE}/api/dev/auth?redirect=/admin/workspaces/${WORKSPACE_ID}`,
  { waitUntil: "networkidle", timeout: 45000 },
);
await page.waitForSelector("h1", { timeout: 20000 });
await page.waitForTimeout(1500);

// Art-direction + PII masking: replace specific text nodes by their content.
await page.evaluate(() => {
  const swap = (oldText, newText, restyle) => {
    const els = document.querySelectorAll("p,div,span,a");
    for (const el of els) {
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && n.textContent.trim() === oldText) {
          n.textContent = newText;
          if (restyle) {
            el.style.color = "#1e3a52";
            el.style.fontStyle = "normal";
          }
          return true;
        }
      }
    }
    return false;
  };

  // Fill the AI relationship brief (biggest empty state, top of content).
  swap(
    "No brief yet. Click Refresh to generate one.",
    "2 lease renewals are due in the next 18 days. Owner response rate is strong this quarter, and the March payout summary is ready to send.",
    true,
  );
  // Dress the other empty states.
  swap("No messages yet", "Tina: Thanks for the quick turnaround on the lease!");
  swap("No recent activity", "Lease renewal sent to Tina Olive · 2h ago");
  // Mask the real founder identity in the sidebar.
  swap("Johanan Nunez", "Avery Cole");
  swap("jo@johanannunez.com", "avery@proxy.demo");
  // Tidy the placeholder owner email in the header.
  swap("tina.olive@pending.theparcelco.com", "tina@olivefamily.co");
});

await page.waitForTimeout(400);
await page.screenshot({ path: OUT });
await browser.close();
console.log("Saved", OUT);
