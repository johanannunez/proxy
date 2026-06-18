import { Buildings, UsersThree } from "@phosphor-icons/react/dist/ssr";

type WorkspaceMember = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

type WorkspaceProps = {
  workspace: {
    id: string;
    name: string;
    type: string;
    ein: string | null;
  };
  members: WorkspaceMember[];
  currentUserId: string;
};

const TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  llc: "LLC",
  partnership: "Partnership",
  trust: "Trust",
  corporation: "Corporation",
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return email[0]?.toUpperCase() ?? "?";
}

export function WorkspaceSection({ workspace, members, currentUserId }: WorkspaceProps) {
  if (members.length === 1 && workspace.type === "individual") {
    return null;
  }

  const otherMembers = members.filter((m) => m.id !== currentUserId);
  const typeLabel = TYPE_LABELS[workspace.type] ?? workspace.type;
  const isMultiMember = members.length > 1;

  return (
    <section id="workspace" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Your workspace
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        The shared owner workspace for properties, documents, meetings, and people.
      </p>

      <div
        className="rounded-2xl border p-7"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(2, 170, 235, 0.08)" }}
          >
            {isMultiMember ? (
              <UsersThree size={22} weight="duotone" style={{ color: "var(--color-brand)" }} />
            ) : (
              <Buildings size={22} weight="duotone" style={{ color: "var(--color-brand)" }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className="text-base font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {workspace.name}
              </h3>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.08)",
                  color: "var(--color-brand)",
                }}
              >
                {typeLabel}
              </span>
            </div>
            {workspace.ein ? (
              <p
                className="mt-1 font-mono text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                EIN: {workspace.ein}
              </p>
            ) : null}
          </div>
        </div>

        {/* Other members */}
        {otherMembers.length > 0 ? (
          <div
            className="mt-6 border-t pt-5"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <p
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Shared with
            </p>
            <ul className="flex flex-col gap-3">
              {otherMembers.map((member) => {
                const initials = getInitials(member.full_name, member.email);
                const displayName = member.full_name?.trim() || member.email;
                return (
                  <li key={member.id} className="flex items-center gap-3">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.avatar_url}
                        alt={displayName}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: "var(--color-warm-gray-100)",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {initials}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-medium"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {displayName}
                      </div>
                      <div
                        className="truncate text-xs"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        {member.email}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* Helper text */}
        <p
          className="mt-5 text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          To add or remove members from your workspace, contact Proxy.
        </p>
      </div>
    </section>
  );
}
