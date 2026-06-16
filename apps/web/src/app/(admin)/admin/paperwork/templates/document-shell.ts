// Shared DocuSeal output shell. Wraps an HTML fragment in the legal-document <head>/<style> so the editor preview and the published PDF render identically.

/**
 * Legal-document shell. Matches the typographic system used by
 * `buildAuthorityAddendumHtml` (Georgia body, Arial headings) so every authored
 * template renders consistently when DocuSeal turns it into a signable PDF. The
 * `valueToHtml` fragment from the editor is dropped into the body verbatim.
 */
export function wrapInDocumentShell(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
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
  h1, h2, h3 {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  h1 { font-size: 17pt; text-transform: uppercase; letter-spacing: -0.3px; }
  h2 { font-size: 13pt; }
  h3 { font-size: 11pt; }
  p { margin-bottom: 12px; }
  ul { margin: 0 0 12px 24px; list-style: disc outside; }
  ol { margin: 0 0 12px 24px; list-style: decimal outside; }
  li { display: list-item; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 10.5pt; }
  th { background: #1a1a1a; color: #fff; text-align: left; padding: 8px 12px;
       font-family: Arial, sans-serif; font-size: 9pt; font-weight: 700;
       text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  .signature-block { margin-top: 44px; padding-top: 20px; border-top: 2px solid #1a1a1a; }
  .sig-row { margin-bottom: 18px; }
  .sig-label { display: inline-block; min-width: 90px; font-weight: 700; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}
