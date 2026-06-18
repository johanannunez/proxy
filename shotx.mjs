import { chromium } from "playwright";
try {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:4000/api/dev/screenshot-auth", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  await p.goto("http://localhost:4000/admin/paperwork/templates/d1e71310-8130-4d8e-889c-7186f52493ae?tab=settings", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: "temporary screenshots/phaseB.png" });
  await b.close();
  console.log("saved");
} catch (e) { console.log("ERR", String(e).slice(0,200)); }
