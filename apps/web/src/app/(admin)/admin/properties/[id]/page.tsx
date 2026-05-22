import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { propertyLabel } from "@/lib/address";
import { fetchRecentActivity } from "@/lib/admin/detail-rail";
import { TasksTab } from "@/components/admin/tasks/TasksTab";
import { MaintenanceTemplatesPanelServer } from "@/components/admin/properties/MaintenanceTemplatesPanelServer";
import { PropertyDetailShell } from "./PropertyDetailShell";
import { PulseTab } from "./PulseTab";

export const metadata: Metadata = { title: "Property Detail" };
export const dynamic = "force-dynamic";

type TabKey = "overview" | "tasks" | "maintenance" | "pulse";
const KNOWN_TABS: readonly TabKey[] = ["overview", "tasks", "maintenance", "pulse"];

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam = "overview" } = await searchParams;
  const tab: TabKey = (KNOWN_TABS as readonly string[]).includes(tabParam)
    ? (tabParam as TabKey)
    : "overview";

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select(
      "id, address_line1, address_line2, city, state, postal_code, name, bedrooms, bathrooms, setup_status, active, created_at, owner_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!property) notFound();

  const label = propertyLabel(property);

  // Fetch initial rail events server-side.
  const initialRailEvents = await fetchRecentActivity("property", id, 8);

  return (
    <PropertyDetailShell
      property={property}
      label={label}
      activeTab={tab}
      initialRailEvents={initialRailEvents}
      realtimeId={id}
    >
      {tab === "tasks" ? (
        <TasksTab parentType="property" parentId={property.id} />
      ) : tab === "maintenance" ? (
        <div style={{ padding: "24px" }}>
          <MaintenanceTemplatesPanelServer propertyId={property.id} />
        </div>
      ) : tab === "pulse" ? (
        <PulseTab
          propertyId={property.id}
          propertyAddress={property.address_line1 ?? property.name ?? 'Property'}
        />
      ) : (
        <div
          style={{
            padding: "32px",
            background: "#F7FAFC",
            border: "1px dashed #D4DEE8",
            borderRadius: 14,
            color: "#647689",
            fontSize: 13.5,
            lineHeight: 1.6,
          }}
        >
          Detail view in progress. Recent activity is shown on the right.
        </div>
      )}
    </PropertyDetailShell>
  );
}
