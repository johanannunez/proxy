import type { WorkspaceDocumentKey } from "@/lib/admin/documents-hub-shared";

export const WORKSPACE_DOCUMENT_REQUEST_ROUTES: Partial<Record<WorkspaceDocumentKey, string>> = {
  host_rental_agreement: "/workspace/setup/host-agreement",
  card_authorization: "/workspace/setup/payout",
  ach_authorization: "/workspace/setup/payout",
  w9: "/workspace/setup/w9",
  identity: "/workspace/setup/identity",
  property_setup: "/workspace/setup",
  wifi_info: "/workspace/setup/wifi",
  guidebook: "/workspace/setup/recommendations",
  block_dates_calendar: "/workspace/reserve",
  str_permit: "/workspace/setup/str-permit",
  hoa_info: "/workspace/setup/hoa-info",
  insurance_certificate: "/workspace/setup/insurance-certificate",
  platform_authorization: "/workspace/setup/platform-authorization",
};

export function getWorkspaceDocumentRequestRoute(key: WorkspaceDocumentKey): string | null {
  return WORKSPACE_DOCUMENT_REQUEST_ROUTES[key] ?? null;
}

export function buildWorkspaceDocumentRequestUrl(origin: string, key: WorkspaceDocumentKey): string | null {
  const route = getWorkspaceDocumentRequestRoute(key);
  if (!route) return null;
  return `${origin.replace(/\/$/, "")}${route}`;
}

export function buildWorkspaceDocumentChecklistUrl(origin: string, workspaceId: string): string {
  const params = new URLSearchParams({
    workspace: workspaceId,
    source: "documents",
  });
  return `${origin.replace(/\/$/, "")}/workspace/setup?${params.toString()}`;
}
