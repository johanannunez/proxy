import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only and the supabase client before importing the module under test
vi.mock("server-only", () => ({}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockIn = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  order: mockOrder.mockReturnThis(),
  single: mockSingle,
  upsert: mockUpsert.mockReturnThis(),
  delete: mockDelete.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  in: mockIn.mockReturnThis(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "user-1" } }, error: null })),
      },
      from: mockFrom,
    })
  ),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

import {
  getActiveWorkspaceAuthority,
  getCurrentWorkspaceAuthority,
  getWorkspaceMembers,
  saveWorkspaceAuthority,
  activateWorkspaceAuthority,
} from "../decision-authority";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getActiveWorkspaceAuthority", () => {
  it("returns null when no active authority exists", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getActiveWorkspaceAuthority("ws-1");
    expect(result).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("workspace_authority");
  });

  it("returns the active authority record when one exists", async () => {
    const fakeAuthority = {
      id: "auth-1",
      workspace_id: "ws-1",
      org_id: "org-1",
      governance_mode: "workspace",
      status: "active",
      docuseal_submission_id: null,
      signed_at: null,
      created_at: "2026-06-15T00:00:00Z",
      updated_at: "2026-06-15T00:00:00Z",
    };
    mockSingle.mockResolvedValueOnce({ data: fakeAuthority, error: null });
    const result = await getActiveWorkspaceAuthority("ws-1");
    expect(result?.id).toBe("auth-1");
    expect(result?.status).toBe("active");
  });
});

describe("getWorkspaceMembers", () => {
  it("returns profiles with matching workspace_id", async () => {
    const fakeMembers = [
      { id: "user-1", full_name: "Alice", email: "alice@test.com", avatar_url: null },
      { id: "user-2", full_name: "Bob", email: "bob@test.com", avatar_url: null },
    ];
    mockEq.mockReturnThis();
    // Chain: from().select().eq() resolves to { data, error }
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: fakeMembers, error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFrom.mockReturnValueOnce(chain as any);
    const result = await getWorkspaceMembers("ws-1");
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("alice@test.com");
  });
});

describe("getCurrentWorkspaceAuthority", () => {
  it("returns null when no non-superseded record exists", async () => {
    // Chain: from().select().eq().in().order().limit().maybeSingle()
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFrom.mockReturnValueOnce(chain as any);
    const result = await getCurrentWorkspaceAuthority("ws-1");
    expect(result).toBeNull();
  });

  it("returns the most recent non-superseded record", async () => {
    const fakeAuthority = {
      id: "auth-1",
      workspace_id: "ws-1",
      org_id: "org-1",
      governance_mode: "workspace",
      status: "pending_signatures",
      docuseal_submission_id: "sub-1",
      signed_at: null,
      created_at: "2026-06-15T00:00:00Z",
      updated_at: "2026-06-15T00:00:00Z",
    };
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: fakeAuthority, error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFrom.mockReturnValueOnce(chain as any);
    const result = await getCurrentWorkspaceAuthority("ws-1");
    expect(result?.status).toBe("pending_signatures");
  });
});

describe("saveWorkspaceAuthority", () => {
  it("returns null when new draft insert fails", async () => {
    // Insert fails immediately — prior records should NOT have been touched
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "insert failed" } }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFrom.mockReturnValueOnce(insertChain as any);
    const result = await saveWorkspaceAuthority({
      workspaceId: "ws-1",
      orgId: "org-1",
      governanceMode: "workspace",
      configs: [],
    });
    expect(result).toBeNull();
    // The first from() call must be the insert, not a supersede
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((mockFrom.mock.calls as any[][])[0][0]).toBe("workspace_authority");
    // Only one from() call: the failed insert. Supersede must never have been called.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("returns authorityId on success with no domain or escalation rows", async () => {
    // Mock: insert -> { data: { id: "new-auth" }, error: null }, then supersede -> ok
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "new-auth" }, error: null }),
    };
    const supersededChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFrom.mockReturnValueOnce(insertChain as any).mockReturnValueOnce(supersededChain as any);
    const result = await saveWorkspaceAuthority({
      workspaceId: "ws-1",
      orgId: "org-1",
      governanceMode: "workspace",
      configs: [],
    });
    expect(result).toBe("new-auth");
  });
});

describe("activateWorkspaceAuthority", () => {
  it("returns true when update succeeds", async () => {
    // Chain: from().update().eq().eq() -> { error: null }
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) })
        .mockResolvedValue({ error: null }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFrom.mockReturnValueOnce(chain as any);
    const result = await activateWorkspaceAuthority("sub-1", "2026-06-15T00:00:00Z");
    expect(result).toBe(true);
  });
});
