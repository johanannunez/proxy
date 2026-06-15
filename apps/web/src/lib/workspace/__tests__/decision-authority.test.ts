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

import {
  getActiveWorkspaceAuthority,
  getWorkspaceMembers,
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
