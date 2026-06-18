// Copies the pdfjs-dist worker into public/ so react-pdf can load it from a
// same-origin path (/pdf.worker.min.mjs). This avoids the Turbopack failure on
// `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`, which only
// works under webpack. Resolving from the installed package guarantees the
// worker version always matches the pdfjs-dist that react-pdf uses, so the two
// can never drift out of sync. Runs automatically via predev/prebuild.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "public", "pdf.worker.min.mjs");

try {
  const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log("[copy-pdf-worker] copied worker ->", dest);
} catch (err) {
  console.error("[copy-pdf-worker] failed to copy pdfjs worker:", err.message);
  process.exit(1);
}
