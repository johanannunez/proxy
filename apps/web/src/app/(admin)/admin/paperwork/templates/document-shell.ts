// Shared DocuSeal output shell. Wraps an HTML fragment in the legal-document
// <head>/<style> so the editor preview and the published PDF render identically.

import { FONTS, googleFontsHref } from "./[id]/editor/fonts";

/**
 * Embeds @import lines for ONLY the Google fonts a document actually uses, so
 * the PDF render stays lean and the custom fonts are present server-side. The
 * serializer emits `font-family:<stack>`; each stack starts with the Google
 * family name, so a substring match is enough. @import rules must lead the
 * stylesheet, so this output is spliced in first.
 */
export function usedFontImports(html: string): string {
  if (!html.includes("font-family:")) return "";
  return FONTS.filter((f) => html.includes(f.googleFamily))
    .map((f) => `@import url('${googleFontsHref(f)}');`)
    .join("\n  ");
}

/**
 * Typography rules shared between the PDF shell and the Paged.js preview.
 * Covers h1–h6 through .sig-label. Does NOT include the box-sizing reset or
 * the body block — those differ between the print shell and the preview.
 */
export const DOCUMENT_TYPOGRAPHY_CSS = `h1, h2, h3, h4, h5, h6 {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  h1 { font-size: 17pt; text-transform: uppercase; letter-spacing: -0.3px; }
  h2 { font-size: 13pt; }
  h3 { font-size: 11pt; }
  h4 { font-size: 10.5pt; margin-top: 16px; margin-bottom: 6px; }
  h5 { font-size: 10pt; margin-top: 14px; margin-bottom: 5px; }
  h6 { font-size: 9.5pt; margin-top: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
  p { margin-bottom: 12px; }
  ul { margin: 0 0 12px 24px; list-style: disc outside; }
  ol { margin: 0 0 12px 24px; list-style: decimal outside; }
  li { display: list-item; margin-bottom: 4px; }
  li[data-checked] { list-style: none; }
  li[data-checked]::before { content: "\\2610  "; }
  li[data-checked="true"]::before { content: "\\2611  "; }
  blockquote { margin: 0 0 14px; padding: 6px 16px; border-left: 3px solid #cbd5e1;
               color: #475569; font-style: italic; }
  pre { background: #f1f5f9; border-radius: 6px; padding: 12px 14px; margin: 0 0 14px;
        overflow-x: auto; }
  pre code { font-family: "Courier New", monospace; font-size: 10pt; background: none; padding: 0; }
  code { font-family: "Courier New", monospace; font-size: 0.92em; background: #f1f5f9;
         padding: 1px 4px; border-radius: 3px; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 22px 0; }
  s { text-decoration: line-through; }
  sup { vertical-align: super; font-size: 0.72em; }
  sub { vertical-align: sub; font-size: 0.72em; }
  a { color: #1b77be; text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 10.5pt; }
  th { background: #1a1a1a; color: #fff; text-align: left; padding: 8px 12px;
       font-family: Arial, sans-serif; font-size: 9pt; font-weight: 700;
       text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  img { max-width: 100%; height: auto; }
  .page-break { break-after: page; page-break-after: always; height: 0; }
  .signature-block { margin-top: 44px; padding-top: 20px; border-top: 2px solid #1a1a1a; }
  .sig-row { margin-bottom: 18px; }
  .sig-label { display: inline-block; min-width: 90px; font-weight: 700; }`;

/**
 * Legal-document shell. Georgia-ish serif body, Arial-ish headings by default;
 * any per-run font choices come through as inline `font-family` styles backed by
 * the embedded @imports above. The `valueToHtml` fragment drops into the body.
 */
export function wrapInDocumentShell(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  ${usedFontImports(html)}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
    padding: 56px 72px;
    max-width: 800px;
    margin: 0 auto;
  }
  ${DOCUMENT_TYPOGRAPHY_CSS}
</style>
</head>
<body>
${html}
</body>
</html>`;
}
