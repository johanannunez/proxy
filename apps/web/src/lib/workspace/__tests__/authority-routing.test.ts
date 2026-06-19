import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../decision-authority", () => ({
  getActiveWorkspaceAuthority: vi.fn(),
}));

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();

const mockFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  is: mockIs.mockReturnThis(),
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    })
  ),
}));

import { getAuthorityOwner, getEscalationOwners } from "../authority-routing";
import { getActiveWorkspaceAuthority } from "../decision-authority";

const mockGetActive = vi.mocked(getActiveWorkspaceAuthority);

const fakeActiveAuthority = {
  id: "auth-1",
  workspace_id: "ws-1",
  agency_id: "org-1",
  governance_mode: "workspace" as const,
  status: "active" as const,
  docuseal_submission_id: null,
  signed_at: "2026-06-15T00:00:00Z",
  created_at: "2026-06-15T00:00:00Z",
  updated_at: "2026-06-15T00:00:00Z",
};

const fakePerPropertyAuthority = {
  id: "auth-2",
  workspace_id: "ws-1",
  agency_id: "org-1",
  governance_mode: "per_property" as const,
  status: "active" as const,
  docuseal_submission_id: null,
  signed_at: "2026-06-15T00:00:00Z",
  created_at: "2026-06-15T00:00:00Z",
  updated_at: "2026-06-15T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAuthorityOwner", () => {
  it("returns null when no active authority exists", async () => {
    mockGetActive.mockResolvedValue(null);
    const result = await getAuthorityOwner("ws-1", "documents_legal");
    expect(result).toBeNull();
  });

  it("returns the assigned owner profile ID for workspace-wide authority", async () => {
    mockGetActive.mockResolvedValue(fakeActiveAuthority);
    mockMaybeSingle.mockResolvedValueOnce({
      data: { assigned_owner_id: "user-1" },
      error: null,
    });
    const result = await getAuthorityOwner("ws-1", "documents_legal");
    expect(result).toBe("user-1");
  });

  it("returns null when no domain assignment exists", async () => {
    mockGetActive.mockResolvedValue(fakeActiveAuthority);
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getAuthorityOwner("ws-1", "finances_payouts");
    expect(result).toBeNull();
  });

  it("returns property-specific assignment when propertyId is provided and record exists", async () => {
    mockGetActive.mockResolvedValue(fakePerPropertyAuthority);
    // First maybeSingle returns property-specific record
    mockMaybeSingle.mockResolvedValueOnce({
      data: { assigned_owner_id: "user-property" },
      error: null,
    });
    const result = await getAuthorityOwner("ws-1", "documents_legal", "prop-1");
    expect(result).toBe("user-property");
  });

  it("falls back to workspace-wide assignment when no property-specific record exists", async () => {
    mockGetActive.mockResolvedValue(fakePerPropertyAuthority);
    // First maybeSingle: no property-specific record
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Second maybeSingle: workspace-wide record
    mockMaybeSingle.mockResolvedValueOnce({
      data: { assigned_owner_id: "user-workspace-wide" },
      error: null,
    });
    const result = await getAuthorityOwner("ws-1", "documents_legal", "prop-1");
    expect(result).toBe("user-workspace-wide");
  });
});

describe("getEscalationOwners", () => {
  it("returns empty array when no active authority exists", async () => {
    mockGetActive.mockResolvedValue(null);
    const result = await getEscalationOwners("ws-1");
    expect(result).toEqual([]);
  });

  it("returns notify_owner_ids from workspace-wide escalation config", async () => {
    mockGetActive.mockResolvedValue(fakeActiveAuthority);
    mockMaybeSingle.mockResolvedValueOnce({
      data: { notify_owner_ids: ["user-1", "user-2"] },
      error: null,
    });
    const result = await getEscalationOwners("ws-1");
    expect(result).toEqual(["user-1", "user-2"]);
  });

  it("returns empty array when no escalation config exists", async () => {
    mockGetActive.mockResolvedValue(fakeActiveAuthority);
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getEscalationOwners("ws-1");
    expect(result).toEqual([]);
  });

  it("returns property-specific escalation when propertyId is provided and record exists", async () => {
    mockGetActive.mockResolvedValue(fakePerPropertyAuthority);
    mockMaybeSingle.mockResolvedValueOnce({
      data: { notify_owner_ids: ["user-1"] },
      error: null,
    });
    const result = await getEscalationOwners("ws-1", "prop-1");
    expect(result).toEqual(["user-1"]);
  });

  it("falls back to workspace-wide escalation when no property-specific record exists", async () => {
    mockGetActive.mockResolvedValue(fakePerPropertyAuthority);
    // No property-specific escalation
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Workspace-wide escalation
    mockMaybeSingle.mockResolvedValueOnce({
      data: { notify_owner_ids: ["user-1", "user-2"] },
      error: null,
    });
    const result = await getEscalationOwners("ws-1", "prop-1");
    expect(result).toEqual(["user-1", "user-2"]);
  });
});
