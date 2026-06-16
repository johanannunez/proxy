// Shared plain-text → document-HTML helpers. Not a "use server" module so the
// sync helpers can be imported by multiple server-action files (createWritten /
// createHtmlTemplateRecord) and unit tested.

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Turn pasted/AI-generated plain text into simple, safe document HTML: blank
 *  lines become paragraph breaks, single newlines become line breaks. The title
 *  becomes an <h1>. Output is editor-compatible (h1 + p), so it seeds
 *  source_html for written templates that open populated in the Plate editor. */
export function textToHtml(title: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<h1>${escapeHtml(title)}</h1>${paragraphs}`;
}
