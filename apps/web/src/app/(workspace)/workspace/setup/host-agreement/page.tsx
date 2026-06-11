import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { SigningStep } from "@/components/workspace/setup/SigningStep";
import { createDocumentFromTemplate } from "@/lib/signing/boldsign";

export const metadata: Metadata = { title: "Host Agreement Signing" };
export const dynamic = "force-dynamic";

export default async function HostAgreementPage({
  searchParams,
}: {
  searchParams?: Promise<{ property?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const params = await searchParams;
  const propertyId = params?.property ?? null;

  // Fetch user profile for signer details
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // Attempt to create BoldSign signing session if API key is set
  let signUrl: string | null = null;

  if (process.env.BOLDSIGN_API_KEY && profile?.email) {
    // Read template ID
    let templateId = "";
    try {
      const templateIds = await import("@/../../../legal/boldsign-template-ids.json");
      templateId = templateIds.hostRentalAgreement;
    } catch {
      // Template file not found, leave signUrl null
    }

    if (templateId) {
      const result = await createDocumentFromTemplate({
        templateId,
        signerEmail: profile.email,
        signerName: profile.full_name ?? profile.email,
        redirectUrl: propertyId
          ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/workspace/setup?just=host-agreement&property=${propertyId}`
          : undefined,
      });

      if (result) {
        signUrl = result.signUrl;

        // Track the signature on the documents spine. Owners cannot write
        // `documents` under RLS, so use the service client for this system write.
        const db = untypedDatabase(createServiceClient());
        const now = new Date().toISOString();
        let query = db
          .from<{ id: string }>("documents")
          .select("id")
          .eq("owner_id", user.id)
          .eq("document_key", "host_rental_agreement")
          .is("form_key", null);
        query = propertyId ? query.eq("property_id", propertyId) : query.is("property_id", null);
        const { data: existing } = await query.maybeSingle();

        const sentFields = {
          status: "sent",
          source: "signed_document",
          source_ref: result.documentId,
          sent_at: now,
        };
        if (existing) {
          await db.from("documents").update(sentFields).eq("id", existing.id);
        } else {
          await db.from("documents").insert({
            owner_id: user.id,
            property_id: propertyId,
            document_key: "host_rental_agreement",
            doc_type: "host_rental_agreement",
            title: "Host Rental Agreement",
            scope_kind: propertyId ? "property" : "owner",
            visibility: "client",
            ...sentFields,
          });
        }
      }
    }
  }

  return (
    <StepShell
      track="property"
      stepNumber={13}
      title="Host agreement signing"
      whyWeAsk="This is the official management agreement between you and Proxy. It covers terms, responsibilities, and commission."
      estimateMinutes={5}
    >
      <SigningStep
        signUrl={signUrl}
        summaryTitle="Host Rental Agreement"
        summaryPoints={[
          "Covers management terms and responsibilities",
          "Sets the commission rate for your property",
          "Outlines the 30-day cancellation clause",
          "Legally binding once signed by both parties",
          "You will receive a signed copy via email",
        ]}
      />
    </StepShell>
  );
}
