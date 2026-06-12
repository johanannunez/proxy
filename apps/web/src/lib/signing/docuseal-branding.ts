import "server-only";

const DEFAULT_BASE_URL = "https://api.docuseal.com";

function baseUrl(): string {
  return (process.env.DOCUSEAL_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function token(): string | null {
  return process.env.DOCUSEAL_API_TOKEN ?? null;
}

/**
 * Pushes org branding (logo URL and primary color) to the DocuSeal account so
 * signing forms render the org's brand instead of the DocuSeal defaults.
 *
 * Swallows all errors with a console.warn so a DocuSeal failure never blocks
 * an admin save operation.
 *
 * DocuSeal API: PATCH /api/account
 *   Body: { logo?: string; primary_color?: string }
 *   Auth: X-Auth-Token header
 */
export async function pushBrandingToDocuSeal(
  logoUrl: string | null,
  primaryColor: string | null,
): Promise<void> {
  if (!logoUrl && !primaryColor) return;

  const apiToken = token();
  if (!apiToken) {
    console.warn("[docuseal-branding] DOCUSEAL_API_TOKEN is not set; skipping branding push.");
    return;
  }

  const body: Record<string, string> = {};
  if (logoUrl) body["logo"] = logoUrl;
  if (primaryColor) body["primary_color"] = primaryColor;

  try {
    const res = await fetch(`${baseUrl()}/api/account`, {
      method: "PATCH",
      headers: {
        "X-Auth-Token": apiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      console.warn(
        `[docuseal-branding] PATCH /api/account returned ${res.status}: ${text}`,
      );
    }
  } catch (err) {
    console.warn("[docuseal-branding] fetch failed:", err);
  }
}
