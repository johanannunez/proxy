import { Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/platform/PageHeader";
import { ComingSoon } from "@/components/platform/ComingSoon";

export default function FeatureLogPage() {
  return (
    <div>
      <PageHeader eyebrow="Coming next" title="Feature Log" subtitle="Collect requests from agencies and owners, upvote them, and feed the roadmap." />
      <ComingSoon
        icon={Lightbulb}
        title="One inbox for what people want"
        description="Requests from every agency and owner gather in one place. Upvotes surface the loudest needs, and each request links straight to the release that ships it."
        planned={[
          "Requests from every agency and owner in one feed",
          "Upvotes and status to rank what matters",
          "Link a request to the release that closes it",
        ]}
      />
    </div>
  );
}
