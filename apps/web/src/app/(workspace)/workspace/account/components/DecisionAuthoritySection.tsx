import { Scales } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentWorkspaceAuthority,
  getAuthorityWithAssignments,
  getWorkspaceMembers,
} from "@/lib/workspace/decision-authority";
import { DecisionAuthorityForm } from "./DecisionAuthorityForm";
import type { AuthorityConfig } from "@/types/decision-authority";

interface Props {
  workspaceId: string;
}

export async function DecisionAuthoritySection({ workspaceId }: Props) {
  const [authority, members] = await Promise.all([
    getCurrentWorkspaceAuthority(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);

  // Only renders for multi-member workspaces
  if (members.length < 2) return null;

  const memberIds = members.map((m) => m.id);

  const supabase = await createClient();
  const { data: propertiesData } = await supabase
    .from("properties")
    .select("id, name")
    .in("owner_id", memberIds)
    .order("name");

  const properties = (propertiesData ?? []) as { id: string; name: string }[];

  let existingConfig: AuthorityConfig | null = null;
  if (authority) {
    const full = await getAuthorityWithAssignments(authority.id);
    existingConfig = full?.configs.find((c) => c.property_id === null) ?? null;
  }

  return (
    <section id="decision-authority" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Decision authority
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Define who holds authority in each decision domain. Once signed, Proxy routes
        documents, financial actions, and escalations to the right owner automatically.
      </p>

      <div
        className="rounded-2xl border p-7"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(2,170,235,0.08)" }}
          >
            <Scales size={20} weight="duotone" style={{ color: "var(--color-brand)" }} />
          </div>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Decision Authority Addendum
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Available in your Paperwork template library
            </p>
          </div>
        </div>

        <DecisionAuthorityForm
          workspaceId={workspaceId}
          members={members}
          properties={properties}
          existingAuthority={authority}
          existingConfig={existingConfig}
        />
      </div>
    </section>
  );
}
