import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPropertyForm } from "@/lib/workspace/property-forms";
import { InspectionForm } from "./InspectionForm";
import { OffboardingForm } from "./OffboardingForm";

export const metadata: Metadata = { title: "Property Forms" };
export const dynamic = "force-dynamic";

type TabKey = "inspection" | "offboarding";

export default async function PropertyFormsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam = "inspection" } = await searchParams;
  const tab: TabKey =
    tabParam === "offboarding" ? "offboarding" : "inspection";

  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, address_line1, city, state")
    .eq("id", id)
    .maybeSingle();

  if (!property) notFound();

  const [inspectionRow, offboardingRow] = await Promise.all([
    getPropertyForm(id, "onboarding_inspection"),
    getPropertyForm(id, "property_offboarding"),
  ]);

  const inspectionSaved: Record<string, unknown> = inspectionRow?.data ?? {};
  const offboardingSaved: Record<string, unknown> = offboardingRow?.data ?? {};
  const inspectionLastUpdated: string | null = inspectionRow?.updated_at ?? null;
  const offboardingLastUpdated: string | null =
    offboardingRow?.updated_at ?? null;

  const label = [property.address_line1, property.city, property.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div style={{ padding: "32px", maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--color-text-tertiary)",
            marginBottom: 6,
          }}
        >
          Admin only
        </p>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--color-text-primary)",
            marginBottom: 4,
          }}
        >
          Property forms
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          {label}
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 32,
          borderBottom: "1px solid var(--color-warm-gray-200)",
          paddingBottom: 0,
        }}
      >
        {(["inspection", "offboarding"] as TabKey[]).map((t) => (
          <a
            key={t}
            href={`/admin/properties/${id}/forms${t !== "inspection" ? `?tab=${t}` : ""}`}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              color:
                tab === t
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
              borderBottom:
                tab === t
                  ? "2px solid var(--color-text-primary)"
                  : "2px solid transparent",
              textDecoration: "none",
              transition: "color 0.12s",
              marginBottom: "-1px",
            }}
          >
            {t === "inspection" ? "Onboarding inspection" : "Property offboarding"}
          </a>
        ))}
      </div>

      {tab === "inspection" ? (
        <InspectionForm
          propertyId={id}
          initial={inspectionSaved}
          isEditing={Object.keys(inspectionSaved).length > 0}
          lastUpdated={inspectionLastUpdated}
        />
      ) : (
        <OffboardingForm
          propertyId={id}
          initial={offboardingSaved}
          isEditing={Object.keys(offboardingSaved).length > 0}
          lastUpdated={offboardingLastUpdated}
        />
      )}
    </div>
  );
}
