import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { getSubmissionAuditUrl } from "@/lib/signing/docuseal";

export const dynamic = "force-dynamic";

/**
 * Completion certificate for a signed document: redirects to the DocuSeal
 * audit log (signer emails, IP addresses, full event trail). Admin-gated.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const db = untypedDatabase(supabase);
  const { data: doc } = await db
    .from<{ source_ref: string | null }>("documents")
    .select("source_ref")
    .eq("id", id)
    .maybeSingle();

  const submissionId = doc?.source_ref ? Number(doc.source_ref) : NaN;
  if (!Number.isFinite(submissionId)) {
    return NextResponse.json(
      { error: "This document has no e-signature submission on record." },
      { status: 404 },
    );
  }

  const auditUrl = await getSubmissionAuditUrl(submissionId);
  if (!auditUrl) {
    return NextResponse.json(
      { error: "The completion certificate is not available yet. It is generated when all parties have signed." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(auditUrl);
}
