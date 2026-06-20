import { SlidersHorizontal } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/platform/PageHeader";
import { ComingSoon } from "@/components/platform/ComingSoon";

export default function EntitlementsPage() {
  return (
    <div>
      <PageHeader eyebrow="Coming next" title="Entitlements" subtitle="Manage plan tiers, per-agency feature flags, and comped extensions." />
      <ComingSoon
        icon={SlidersHorizontal}
        title="Control what each agency can do"
        description="Set an agency's plan tier and limits, flip features on without a deploy, and grant trials or comped extensions when an account needs room to grow."
        planned={[
          "Plan tier and limits per agency",
          "Feature flags toggled without a deploy",
          "Trials and comped extensions, logged",
        ]}
      />
    </div>
  );
}
