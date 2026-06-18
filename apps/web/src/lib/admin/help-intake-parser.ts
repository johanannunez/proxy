export type ContentType = "help" | "policy" | "blog" | "flagship";

export type ParsedDraft = {
  title: string;
  summary: string;
  content: string;
  tags: string[];
  suggestedCategory: string;
  readTimeMinutes: number;
  contentType: ContentType;
  suggestedSlug: string;
  suggestedWorkspacePath: string | null;
  needsVisual: boolean;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function processInline(text: string): string {
  return inlineMarkdown(escapeHtml(text));
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    const t = line.trim();

    if (t.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${processInline(t.slice(4))}</h3>`);
    } else if (t.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${processInline(t.slice(3))}</h2>`);
    } else if (t.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${processInline(t.slice(2))}</h1>`);
    } else if (t.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${processInline(t.slice(2))}</li>`);
    } else if (t === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${processInline(t)}</p>`);
    }
  }

  if (inList) out.push("</ul>");
  return out.join("\n");
}

const VALID_CONTENT_TYPES: ContentType[] = ["help", "policy", "blog", "flagship"];

export function parseAlcoveDraft(raw: string): ParsedDraft | null {
  const text = raw.replace(/^---\s*\n?/, "").replace(/\n?---\s*$/, "").trim();

  const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
  const summaryMatch = text.match(/^SUMMARY:\s*(.+)$/m);
  const tagsMatch = text.match(/^TAGS:\s*(.+)$/m);
  const categoryMatch = text.match(/^CATEGORY:\s*(.+)$/m);
  const readTimeMatch = text.match(/^READ\s*TIME:\s*(\d+)/im);
  const contentTypeMatch = text.match(/^CONTENT_TYPE:\s*(.+)$/m);
  const slugMatch = text.match(/^SLUG:\s*(.+)$/m);
  const workspacePathMatch = text.match(/^PORTAL_PATH:\s*(.+)$/m);
  const needsVisualMatch = text.match(/^NEEDS_VISUAL:\s*(true|false)/im);

  if (!titleMatch || !summaryMatch) return null;

  const contentStart = text.search(/(?:^|\n)CONTENT:\n/);
  const contentHeaderLen =
    contentStart === 0 ? "CONTENT:\n".length : "\nCONTENT:\n".length;
  const afterContent =
    contentStart !== -1 ? text.slice(contentStart + contentHeaderLen) : "";
  const nextLabelMatch = afterContent.match(/\n[A-Z][A-Z\s]+:/);
  const rawContent = nextLabelMatch
    ? afterContent.slice(0, nextLabelMatch.index).trim()
    : afterContent.trim();

  const rawContentType = contentTypeMatch
    ? contentTypeMatch[1].trim().toLowerCase()
    : "help";
  const contentType: ContentType = VALID_CONTENT_TYPES.includes(rawContentType as ContentType)
    ? (rawContentType as ContentType)
    : "help";

  const suggestedSlug = slugMatch ? slugMatch[1].trim() : "";

  const rawWorkspacePath = workspacePathMatch ? workspacePathMatch[1].trim() : "";
  const suggestedWorkspacePath =
    rawWorkspacePath && rawWorkspacePath.toLowerCase() !== "none" ? rawWorkspacePath : null;

  const needsVisual = needsVisualMatch
    ? needsVisualMatch[1].toLowerCase() === "true"
    : false;

  return {
    title: titleMatch[1].trim(),
    summary: summaryMatch[1].trim(),
    content: markdownToHtml(rawContent),
    tags: tagsMatch
      ? tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    suggestedCategory: categoryMatch ? categoryMatch[1].trim() : "",
    readTimeMinutes: readTimeMatch ? parseInt(readTimeMatch[1], 10) : 5,
    contentType,
    suggestedSlug,
    suggestedWorkspacePath,
    needsVisual,
  };
}
