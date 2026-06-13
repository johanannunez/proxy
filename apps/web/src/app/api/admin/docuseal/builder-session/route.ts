// apps/web/src/app/api/admin/docuseal/builder-session/route.ts
//
// Mints a short-lived builder session for the embedded <docuseal-builder>.
// DocuSeal requires an HS256 JWT signed with the API key whose payload names
// the API-key owner (user_email) and the template to open (template_id). The
// raw API token does NOT work and leaves the builder with no document loaded.
import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function signBuilderJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/** The API-key owner's email is required as user_email in the builder JWT.
 *  Resolved from DocuSeal so it stays correct across environments. */
let cachedOwnerEmail: string | null = null;
async function resolveOwnerEmail(apiToken: string, baseUrl: string): Promise<string | null> {
  if (cachedOwnerEmail) return cachedOwnerEmail;
  try {
    const res = await fetch(`${baseUrl}/user`, { headers: { "X-Auth-Token": apiToken } });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    cachedOwnerEmail = data.email ?? null;
    return cachedOwnerEmail;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const apiToken = process.env.DOCUSEAL_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json({ error: "DocuSeal not configured." }, { status: 503 });
  }

  const apiBase = (process.env.DOCUSEAL_BASE_URL ?? "https://api.docuseal.com").replace(/\/$/, "");
  const ownerEmail = await resolveOwnerEmail(apiToken, apiBase);
  if (!ownerEmail) {
    return NextResponse.json(
      { error: "Could not resolve the DocuSeal account owner." },
      { status: 502 },
    );
  }

  const templateId = request.nextUrl.searchParams.get("templateId");
  const payload: Record<string, unknown> = { user_email: ownerEmail };
  if (templateId) payload.template_id = Number(templateId);

  const token = signBuilderJwt(payload, apiToken);
  const host = process.env.DOCUSEAL_APP_URL ?? "https://docuseal.com";
  return NextResponse.json({ token, host });
}
