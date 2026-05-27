export type WorkspaceLinkMessage = {
  metadata: Record<string, unknown>;
};

export function resolveInboxWorkspaceHref(args: {
  ownerWorkspaceId: string | null | undefined;
  messages: WorkspaceLinkMessage[];
}): string | null {
  const workspaceId = normalizeId(args.ownerWorkspaceId) ?? findLatestWorkspaceId(args.messages);
  return workspaceId ? `/admin/workspaces/${encodeURIComponent(workspaceId)}?tab=inbox` : null;
}

function findLatestWorkspaceId(messages: WorkspaceLinkMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const workspaceId = normalizeId(messages[index].metadata.workspace_id);
    if (workspaceId) return workspaceId;
  }

  return null;
}

function normalizeId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
