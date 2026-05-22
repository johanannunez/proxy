"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageTitle } from "@/components/admin/chrome/PageTitle";
import type { RailEvent } from "@/lib/admin/detail-rail";
import { DetailRightRail } from "@/components/admin/detail/DetailRightRail";
import styles from "./PropertyDetailShell.module.css";

type PropertyRow = {
  id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  active: boolean | null;
  setup_status: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  created_at: string;
};

type TabKey = "overview" | "tasks" | "maintenance" | "pulse";
const TAB_ORDER: TabKey[] = ["overview", "tasks", "maintenance", "pulse"];
const TAB_LABEL: Record<TabKey, string> = {
  overview: "Overview",
  tasks: "Tasks",
  maintenance: "Maintenance",
  pulse: "Pulse",
};

export function PropertyDetailShell({
  property,
  label,
  activeTab: rawTab,
  initialRailEvents,
  realtimeId,
  children,
}: {
  property: PropertyRow;
  label: string;
  activeTab: string;
  initialRailEvents: RailEvent[];
  realtimeId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: TabKey = (TAB_ORDER as string[]).includes(rawTab)
    ? (rawTab as TabKey)
    : "overview";

  function switchTab(next: TabKey) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(`/admin/properties/${property.id}${qs ? `?${qs}` : ""}`, {
      scroll: false,
    });
  }

  const title = property.address_line1 ?? label ?? "Property";
  const subtitle = [property.city, property.state].filter(Boolean).join(", ");

  const showRail = true;

  return (
    <div className={styles.root}>
      <PageTitle
        title={title}
        subtitle={subtitle || undefined}
        backHref="/admin/properties"
        backLabel="Properties"
      />

      <nav className={styles.tabs} role="tablist" aria-label="Property sections">
        {TAB_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`${styles.tab} ${activeTab === key ? styles.tabActive : ""}`}
            onClick={() => switchTab(key)}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </nav>

      <div className={showRail ? styles.contentWithRail : styles.content}>
        <div className={styles.mainCol}>
          {children}
        </div>
        {showRail ? (
          <DetailRightRail
            parentType="property"
            realtimeId={realtimeId}
            initialEvents={initialRailEvents}
            metadata={[
              ...(property.bedrooms != null
                ? [{ label: "Beds", value: String(property.bedrooms) }]
                : []),
              ...(property.bathrooms != null
                ? [{ label: "Baths", value: String(property.bathrooms) }]
                : []),
              {
                label: "Status",
                value: property.setup_status ?? "draft",
              },
            ]}
          />
        ) : null}
      </div>
    </div>
  );
}
