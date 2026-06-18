/**
 * Plain-text helpers for HTML message bodies.
 *
 * These are for previews, SMS length counting, and AI context — they are NOT
 * security sanitizers. Untrusted HTML that gets rendered must go through
 * `SafeHtml` / DOMPurify instead.
 *
 * `htmlToPlainText` strips tags with a single linear scan (not a tag-matching
 * regular expression), so it is complete by construction: there is no regex
 * for a crafted input to bypass, and nested or unbalanced angle brackets are
 * handled gracefully.
 */
export function htmlToPlainText(input: string): string {
  let out = "";
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "<") {
      depth++;
      continue;
    }
    if (ch === ">") {
      if (depth > 0) depth--;
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Heuristic: does this body contain HTML markup (so it should render as HTML)? */
export function looksLikeHtml(input: string): boolean {
  return /<[a-z!/]/i.test(input);
}
