import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/platform/PageHeader";
import { ComingSoon } from "@/components/platform/ComingSoon";

export default function WaitlistPage() {
  return (
    <div>
      <PageHeader eyebrow="Coming next" title="Waitlist" subtitle="Approve and invite agencies from the public waitlist as Proxy opens to new operators." />
      <ComingSoon
        icon={UsersThree}
        title="Turn signups into agencies"
        description="The public one-pager waitlist lands here. Review who is asking for access, approve the right operators, and send an invite without leaving the console."
        planned={[
          "Every waitlist signup captured with source and date",
          "Approve and send an invite in one click",
          "Notes and status so nobody slips through",
        ]}
      />
    </div>
  );
}
