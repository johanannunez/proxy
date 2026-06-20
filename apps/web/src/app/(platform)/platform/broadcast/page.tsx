import { Megaphone } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/platform/PageHeader";
import { ComingSoon } from "@/components/platform/ComingSoon";

export default function BroadcastPage() {
  return (
    <div>
      <PageHeader eyebrow="Coming next" title="Broadcast" subtitle="Send announcements and changelog entries to every agency at once." />
      <ComingSoon
        icon={Megaphone}
        title="Reach every agency at once"
        description="Compose an announcement once and deliver it to all agencies, or target by plan tier. A running changelog keeps everyone current on what shipped."
        planned={[
          "Compose once, deliver to every agency",
          "Target by plan tier or recent activity",
          "A changelog every agency can read in-product",
        ]}
      />
    </div>
  );
}
