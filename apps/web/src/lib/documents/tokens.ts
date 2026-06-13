// apps/web/src/lib/documents/tokens.ts
//
// Personalization token resolver for document send copy (subject + message).
// Pure and dependency-free: safe to import into client components for the live
// preview pane. Do NOT add `import "server-only"` here.

/** Context values a token can resolve to. Every field is optional; a missing
 *  value leaves the literal token in place rather than emptying it. */
export type TokenContext = {
  firstName?: string;
  ownerName?: string;
  property?: string;
};

/** Tokens offered in the UI as clickable chips. */
export const AVAILABLE_TOKENS: { token: string; label: string }[] = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{owner_name}}", label: "Owner name" },
  { token: "{{property}}", label: "Property" },
];

// Single pattern handles spacing and (via the `i` flag) case-insensitivity.
const TOKEN_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Replace `{{first_name}}`, `{{owner_name}}`, and `{{property}}` with the
 * matching context value. Unknown token names and known tokens whose context
 * value is missing (null or undefined) are left untouched, so the admin always
 * sees what will actually render rather than a blank.
 */
export function resolveTokens(text: string, ctx: TokenContext): string {
  const map: Record<string, string | undefined> = {
    first_name: ctx.firstName,
    owner_name: ctx.ownerName,
    property: ctx.property,
  };
  return text.replace(TOKEN_PATTERN, (match, rawName: string) => {
    const value = map[rawName.toLowerCase()];
    return value == null ? match : value;
  });
}
