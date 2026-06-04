/**
 * Message template variable substitution.
 *
 * Replaces {{snake_case}} placeholders in template subject/body with
 * per-recipient values. Unknown placeholders are left untouched so they
 * are visible (and fixable) rather than silently blanked.
 */

export type TemplateVars = {
  first_name?: string | null;
  full_name?: string | null;
  workspace_name?: string | null;
  property_address?: string | null;
};

export const TEMPLATE_VARIABLES: { key: keyof TemplateVars; label: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "full_name", label: "Full name" },
  { key: "workspace_name", label: "Workspace" },
  { key: "property_address", label: "Property address" },
];

export function applyTemplateVariables(text: string, vars: TemplateVars): string {
  if (!text) return text;
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, raw: string) => {
    const key = raw.toLowerCase() as keyof TemplateVars;
    const value = vars[key];
    return value != null && value !== "" ? String(value) : match;
  });
}
