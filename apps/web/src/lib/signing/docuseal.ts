import "server-only";
/**
 * DocuSeal API adapter. Self-hostable, open-source e-signature engine — the same
 * one Hubflo uses. Kept behind this thin adapter so the engine stays swappable
 * (we previously had a BoldSign adapter; the signing orchestration in
 * `@/lib/documents/signing` depends only on these functions, not on DocuSeal).
 *
 * Config (env):
 *   DOCUSEAL_API_TOKEN  — required; from DocuSeal → Settings → API. Absent => null.
 *   DOCUSEAL_BASE_URL   — API base, defaults to cloud https://api.docuseal.com.
 *                         Self-host: https://sign.myproxyhost.com/api
 *   DOCUSEAL_APP_URL    — app base for constructing signer URLs, defaults to
 *                         https://docuseal.com. Self-host: https://sign.myproxyhost.com
 *   DOCUSEAL_BRAND_LOGO_URL — optional; operator logo shown inside the signing
 *                         form. Replaced by per-org branding settings in Phase 3.
 *   DOCUSEAL_BRAND_COLOR — optional; primary color for the signing form.
 */

const DEFAULT_BASE_URL = "https://api.docuseal.com";
const DEFAULT_APP_URL = "https://docuseal.com";

function token(): string | null {
  return process.env.DOCUSEAL_API_TOKEN ?? null;
}
function baseUrl(): string {
  return (process.env.DOCUSEAL_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}
function appUrl(): string {
  return (process.env.DOCUSEAL_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "");
}

/** True when DocuSeal is configured enough to create real submissions. */
export function isDocuSealConfigured(): boolean {
  return Boolean(token());
}

function headers(): HeadersInit {
  return { "X-Auth-Token": token() as string, "Content-Type": "application/json" };
}

/**
 * Branded signing: the operator's logo and primary color appear inside the
 * DocuSeal signing form instead of DocuSeal's defaults. Sourced from env vars
 * for now; per-org branding settings replace this in Phase 3.
 */
function brandingCustomization(): { logo_url: string; primary_color: string } | null {
  const logoUrl = process.env.DOCUSEAL_BRAND_LOGO_URL ?? null;
  if (!logoUrl) return null;
  return {
    logo_url: logoUrl,
    primary_color: process.env.DOCUSEAL_BRAND_COLOR ?? "#0F172A",
  };
}

export type SubmissionSubmitterInput = {
  role: string;
  email: string;
  name?: string;
  externalId?: string;
};

export type SubmissionSubmitter = {
  submitterId: number;
  email: string;
  role: string;
  slug: string;
  status: string;
  embedUrl: string;
  completedAt: string | null;
};

export type CreateSubmissionResult = {
  submissionId: number;
  submitters: SubmissionSubmitter[];
} | null;

type RawSubmitter = {
  id: number;
  submission_id: number;
  email: string;
  role: string;
  slug: string;
  status?: string;
  completed_at?: string | null;
  embed_src?: string | null;
};

function toSubmitter(raw: RawSubmitter): SubmissionSubmitter {
  return {
    submitterId: raw.id,
    email: raw.email,
    role: raw.role,
    slug: raw.slug,
    status: raw.status ?? "pending",
    embedUrl: raw.embed_src || `${appUrl()}/s/${raw.slug}`,
    completedAt: raw.completed_at ?? null,
  };
}

/**
 * Create a submission from a template with ordered submitters (owner signer(s)
 * first, Proxy countersigner last). `sendEmail: false` keeps signing on-platform
 * via the embedded form. Returns null when DocuSeal isn't configured.
 */
export async function createSubmission(opts: {
  templateId: number;
  submitters: SubmissionSubmitterInput[];
  sendEmail?: boolean;
  orderPreserved?: boolean;
}): Promise<CreateSubmissionResult> {
  if (!isDocuSealConfigured()) return null;

  const customization = brandingCustomization();
  const res = await fetch(`${baseUrl()}/submissions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      template_id: opts.templateId,
      send_email: opts.sendEmail ?? false,
      order: opts.orderPreserved === false ? "random" : "preserved",
      submitters: opts.submitters.map((s) => ({
        role: s.role,
        email: s.email,
        name: s.name,
        external_id: s.externalId,
      })),
      ...(customization && { customization }),
    }),
  });

  if (!res.ok) {
    console.error("[docuseal] createSubmission failed:", res.status, await res.text());
    return null;
  }

  // DocuSeal returns an array of submitters for the created submission.
  const data = (await res.json()) as RawSubmitter[];
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    submissionId: data[0].submission_id,
    submitters: data.map(toSubmitter),
  };
}

export type SubmissionStatus = {
  submissionId: number;
  status: string;
  completedAt: string | null;
  submitters: SubmissionSubmitter[];
} | null;

/** Read a submission's current status + per-submitter completion. */
export async function getSubmission(submissionId: number): Promise<SubmissionStatus> {
  if (!isDocuSealConfigured()) return null;
  const res = await fetch(`${baseUrl()}/submissions/${submissionId}`, { headers: headers() });
  if (!res.ok) {
    console.error("[docuseal] getSubmission failed:", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as {
    id: number;
    status?: string;
    completed_at?: string | null;
    submitters: RawSubmitter[];
  };
  return {
    submissionId: data.id,
    status: data.status ?? "pending",
    completedAt: data.completed_at ?? null,
    submitters: (data.submitters ?? []).map(toSubmitter),
  };
}

/**
 * Audit log URL for a completed submission. DocuSeal generates a completion
 * certificate (signer emails, IP addresses, full event trail) per submission.
 */
export async function getSubmissionAuditUrl(submissionId: number): Promise<string | null> {
  if (!isDocuSealConfigured()) return null;
  try {
    const res = await fetch(`${baseUrl()}/submissions/${submissionId}`, { headers: headers() });
    if (!res.ok) return null;
    const data = (await res.json()) as { audit_log_url?: string | null };
    return data.audit_log_url ?? null;
  } catch {
    return null;
  }
}

/** Fetch a fresh embedded signing URL for one submitter (e.g. resend/reopen). */
export async function getSubmitterEmbedUrl(submitterSlug: string): Promise<string> {
  return `${appUrl()}/s/${submitterSlug}`;
}

/**
 * First-page preview image of a template's uploaded document. DocuSeal
 * generates these on upload; used for real thumbnails on template cards.
 */
export async function getTemplatePreviewUrl(templateId: number): Promise<string | null> {
  if (!isDocuSealConfigured()) return null;

  try {
    const res = await fetch(`${baseUrl()}/templates/${templateId}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      documents?: Array<{ preview_image_url?: string | null }>;
    };
    return data.documents?.[0]?.preview_image_url ?? null;
  } catch {
    return null;
  }
}

export type CreateTemplateResult = {
  templateId: number;
  name: string;
} | null;

/**
 * Upload a PDF to DocuSeal and create a new template from it.
 * DocuSeal runs field auto-detection on the uploaded PDF.
 */
export async function createTemplate(
  name: string,
  pdfBuffer: Buffer,
  fileName: string,
): Promise<CreateTemplateResult> {
  if (!isDocuSealConfigured()) return null;

  // DocuSeal creates templates from a PDF via POST /templates/pdf with a JSON
  // body carrying the file as base64. The plain /templates endpoint does not
  // accept a multipart upload and returns a 400 parameter-parse error.
  const res = await fetch(`${baseUrl()}/templates/pdf`, {
    method: "POST",
    headers: {
      "X-Auth-Token": token() as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      documents: [{ name: fileName, file: pdfBuffer.toString("base64") }],
    }),
  });

  if (!res.ok) {
    console.error("[docuseal] createTemplate failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { id: number; name: string };
  return { templateId: data.id, name: data.name };
}

/**
 * Clone an existing DocuSeal template (used for the system-template fork flow).
 */
export async function cloneTemplate(
  sourceTemplateId: number,
  newName: string,
): Promise<CreateTemplateResult> {
  if (!isDocuSealConfigured()) return null;

  const res = await fetch(`${baseUrl()}/templates/${sourceTemplateId}/clone`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });

  if (!res.ok) {
    console.error("[docuseal] cloneTemplate failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { id: number; name: string };
  return { templateId: data.id, name: data.name };
}
