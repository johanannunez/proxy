#!/usr/bin/env node
// Capture the real admin Workspace Overview across multiple tabs for the
// rotating hero. Auths via /api/dev/auth (2FA bypassed by DEV_SKIP_MFA),
// masks PII, dresses the Home tab, then clicks through each tab and captures.
//
// Usage: node scripts/capture-tabs.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ID = "82f31977-d829-4069-82c7-cbb411a46210";
const BASE = "http://localhost:4000";
const OUTDIR = join(__dirname, "..", "apps/web/public/marketing/screenshots");
const TABS = ["Home", "Documents", "Finances", "Properties", "Tasks", "Timeline"];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
const page = await context.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem("proxy-theme", "light");
    localStorage.setItem("theme", "light");
  } catch {}
});

await page.goto(`${BASE}/api/dev/auth?redirect=/admin/workspaces/${WORKSPACE_ID}`, {
  waitUntil: "networkidle",
  timeout: 45000,
});
await page.waitForSelector("h1", { timeout: 20000 });
await page.waitForTimeout(1500);

// PII mask (persists across client-side tab nav).
await page.evaluate(() => {
  const swap = (oldText, newText, restyle) => {
    for (const el of document.querySelectorAll("p,div,span,a")) {
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
  swap("Johanan Nunez", "Avery Cole");
  swap("jo@johanannunez.com", "avery@proxy.demo");
  swap("tina.olive@pending.theparcelco.com", "tina@olivefamily.co");
  // Home-tab dressing
  swap(
    "No brief yet. Click Refresh to generate one.",
    "2 lease renewals are due in the next 18 days. Owner response rate is strong this quarter, and the March payout summary is ready to send.",
    true,
  );
  swap("No messages yet", "Tina: Thanks for the quick turnaround on the lease!");
  swap("No recent activity", "Lease renewal sent to Tina Olive · 2h ago");
});

// Locate the workspace tab bar via "Timeline" (a tab-only label) and report
// which labels are clickable.
const found = await page.evaluate(() => {
  const tl = [...document.querySelectorAll("button,a,[role=tab]")].find(
    (e) => e.textContent.trim() === "Timeline",
  );
  if (!tl) return { ok: false };
  const bar = tl.parentElement;
  const labels = [...bar.children].map((c) => c.textContent.trim());
  return { ok: true, labels };
});
console.log("Tab bar:", JSON.stringify(found));

for (const tab of TABS) {
  if (tab !== "Home") {
    const clicked = await page.evaluate((label) => {
      const tl = [...document.querySelectorAll("button,a,[role=tab]")].find(
        (e) => e.textContent.trim() === "Timeline",
      );
      const bar = tl?.parentElement;
      if (!bar) return false;
      const el = [...bar.querySelectorAll("*")].find(
        (e) => e.textContent.trim() === label && e.children.length === 0,
      );
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, tab);
    if (!clicked) {
      console.log("SKIP (no tab):", tab);
      continue;
    }
    await page.waitForTimeout(1200);
    // Re-apply founder mask in case content re-rendered.
    await page.evaluate(() => {
      const swap = (o, n) => {
        for (const el of document.querySelectorAll("p,div,span,a"))
          for (const x of el.childNodes)
            if (x.nodeType === 3 && x.textContent.trim() === o) {
              x.textContent = n;
              return;
            }
      };
      swap("Johanan Nunez", "Avery Cole");
      swap("jo@johanannunez.com", "avery@proxy.demo");
    });
  }
  const out = join(OUTDIR, `workspace-hero-${tab.toLowerCase()}-v1.png`);
  await page.screenshot({ path: out });
  console.log("Saved", out);
}

await browser.close();
