import type { Metadata } from "next";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { EmptyState } from "@/components/workspace/EmptyState";
import { propertyLabel } from "@/lib/address";
import { TimelineView } from "./TimelineView";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

export type TimelineEntry = {
  id: string;
  event_type: string;
  category: string;
  title: string;
  body: string | null;
  property_id: string | null;
  icon: string | null;
  is_pinned: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, client } = await getWorkspaceContext();
  const params = await searchParams;
  const propertyParam = typeof params.property === "string" ? params.property : undefined;

  const [entriesResult, { data: properties }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from("owner_timeline")
      .select(
        "id, event_type, category, title, body, property_id, icon, is_pinned, created_at, metadata",
      )
      .eq("owner_id", userId)
      .eq("visibility", "owner")
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    client
      .from("properties")
      .select("id, address_line1, address_line2")
      .eq("owner_id", userId),
  ]);

  const entries: TimelineEntry[] = entriesResult.data ?? [];
  const propertyMap: Record<string, string> = {};
  for (const p of properties ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propertyMap[p.id] = propertyLabel(p as any);
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          icon={<ClockCounterClockwise size={26} weight="duotone" />}
          title="No activity yet"
          body="Key events and milestones for your account and properties will appear here."
        />
      </div>
    );
  }

  return (
    <TimelineView
      entries={entries}
      propertyMap={propertyMap}
      userId={userId}
      initialPropertyFilter={propertyParam}
    />
  );
}
