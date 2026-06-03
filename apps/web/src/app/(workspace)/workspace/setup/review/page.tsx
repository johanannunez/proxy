import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle,
  Circle,
  PencilSimple,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { StepShell } from "@/components/workspace/setup/StepShell";
import { activeSetupSearchIndex as setupSearchIndex } from "@/lib/wizard/search-index";
import { ReviewSubmitBar } from "./ReviewClient";

export const metadata: Metadata = { title: "Review and Submit" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({
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

  let property: Record<string, unknown> | null = null;
  if (propertyId) {
    const { data } = await supabase
      .from("properties")
      .select("id, name, property_type, address_line1, bedrooms, amenities, house_rules, wifi_details, financial_baseline, guidebook_spots, cleaning_choice, photos, compliance_details, agreement_acknowledged_at, setup_status, updated_at")
      .eq("id", propertyId)
      .single();
    property = data as Record<string, unknown> | null;
  }

  // Check which property sections are complete
  const completionMap: Record<string, boolean> = {
    "agreement-preview": Boolean(property?.agreement_acknowledged_at),
    "basics": Boolean(property?.property_type && property?.address_line1),
    "address": Boolean(property?.address_line1),
    "space": Boolean(property?.bedrooms),
    "amenities": Boolean(property?.amenities && Array.isArray(property.amenities) && (property.amenities as unknown[]).length > 0),
    "rules": Boolean(property?.house_rules),
    "wifi": Boolean(property?.wifi_details),
    "financial": Boolean(property?.financial_baseline),
    "recommendations": Boolean(property?.guidebook_spots && Array.isArray(property.guidebook_spots) && (property.guidebook_spots as unknown[]).length > 0),
    "cleaning": Boolean(property?.cleaning_choice),
    "photos": Boolean(property?.photos && Array.isArray(property.photos) && (property.photos as unknown[]).length > 0),
    "compliance": Boolean(property?.compliance_details),
    "host-agreement": false, // BoldSign not wired yet
    "review": false, // This is the current step
  };

  const sections = setupSearchIndex
    .filter((s) => s.track === "property" && s.stepKey !== "review")
    .map((s) => ({
      key: s.stepKey,
      label: s.label,
      href: propertyId ? `${s.href}?property=${propertyId}` : s.href,
      complete: completionMap[s.stepKey] ?? false,
    }));

  const completedCount = sections.filter((s) => s.complete).length;
  const allComplete = completedCount === sections.length;
  const isSubmitted = property?.setup_status === "pending_review";

  return (
    <StepShell
      track="property"
      stepNumber={14}
      title="Review and submit"
      whyWeAsk="One last look before we start preparing your listing. Make sure everything is accurate."
      estimateMinutes={3}
      lastUpdated={property?.updated_at as string | null | undefined}
    >
      <div className="flex flex-col gap-6">
        {/* Section checklist */}
        <div
          className="rounded-2xl border p-6"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
          }}
        >
          <h2
            className="mb-4 text-base font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Completion checklist
          </h2>
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {completedCount} of {sections.length} sections complete
          </p>
          <ul className="flex flex-col gap-1">
            {sections.map((section) => (
              <li key={section.key}>
                <div className="flex items-center justify-between rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    {section.complete ? (
                      <CheckCircle
                        size={18}
                        weight="fill"
                        style={{ color: "var(--color-success)" }}
                      />
                    ) : (
                      <Circle
                        size={18}
                        weight="regular"
                        style={{ color: "var(--color-warm-gray-400)" }}
                      />
                    )}
                    <span
                      className="text-sm font-medium"
                      style={{
                        color: section.complete
                          ? "var(--color-text-primary)"
                          : "var(--color-text-secondary)",
                      }}
                    >
                      {section.label}
                    </span>
                  </div>
                  <Link
                    href={section.href}
                    className="flex items-center gap-1 text-xs font-medium transition-colors"
                    style={{ color: "var(--color-brand)" }}
                  >
                    <PencilSimple size={12} weight="bold" />
                    {section.complete ? "Edit" : "Complete"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ReviewSubmitBar
          propertyId={propertyId ?? ""}
          allComplete={allComplete}
          completedCount={completedCount}
          totalCount={sections.length}
          isSubmitted={isSubmitted}
        />
      </div>
    </StepShell>
  );
}
