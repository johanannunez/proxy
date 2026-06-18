import { describe, it, expect, vi, beforeEach } from "vitest";

// document-templates.ts imports "server-only"; stub it for the node test env.
vi.mock("server-only", () => ({}));

// Per-test results for each table the function queries. With the existence-probe
// implementation the carve-out is enforced by the SQL filter (.or for signed/sent,
// the !inner join for signers), so a fixture is "what that filtered query returns".
let documentsResult: { data: unknown; error: unknown };
let signersResult: { data: unknown; error: unknown };

// A minimal thenable query builder: chain methods return the same object, and
// awaiting it resolves to {data, error}. Mirrors how the real Supabase builder is
// awaited directly (no .single() in these queries; errors resolve, never reject).
function makeQuery(getResult: () => { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  q.select = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.or = vi.fn(() => q);
  q.in = vi.fn(() => q);
  q.limit = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => void) => resolve(getResult());
  return q;
}

// Keep handles to the last builder per table so tests can assert the queries
// target the right columns/filters (the mock injects results by table name, so
// this is what proves .eq("document_key") / the embedded signer filter).
let lastDocsQuery: Record<string, ReturnType<typeof vi.fn>>;
let lastSignersQuery: Record<string, ReturnType<typeof vi.fn>>;

const mockFrom = vi.fn((table: string) => {
  if (table === "documents") {
    lastDocsQuery = makeQuery(() => documentsResult) as never;
    return lastDocsQuery;
  }
  if (table === "document_signers") {
    lastSignersQuery = makeQuery(() => signersResult) as never;
    return lastSignersQuery;
  }
  return makeQuery(() => ({ data: [], error: null }));
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

import { countTemplateSendEvidence } from "./document-templates";

beforeEach(() => {
  vi.clearAllMocks();
  documentsResult = { data: [], error: null };
  signersResult = { data: [], error: null };
});

describe("countTemplateSendEvidence", () => {
  it("returns 0 for an empty key without querying", async () => {
    expect(await countTemplateSendEvidence("")).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 0 (deletable) when neither a sent doc nor a signer exists for the key", async () => {
    documentsResult = { data: [], error: null };
    signersResult = { data: [], error: null };
    expect(await countTemplateSendEvidence("k")).toBe(0);
  });

  it("returns 1 when a signed/sent document exists, and skips the signers query", async () => {
    documentsResult = { data: [{ id: "d1" }], error: null };
    expect(await countTemplateSendEvidence("k")).toBe(1);
    expect(mockFrom).not.toHaveBeenCalledWith("document_signers");
  });

  it("returns 1 when a signer exists despite no signed/sent doc (partial persistSubmission)", async () => {
    documentsResult = { data: [], error: null };
    signersResult = { data: [{ id: "s1" }], error: null };
    expect(await countTemplateSendEvidence("k")).toBe(1);
  });

  it("probes documents by document_key, filtered to signed-or-sent (the carve-out)", async () => {
    await countTemplateSendEvidence("my_key");
    expect(lastDocsQuery.eq).toHaveBeenCalledWith("document_key", "my_key");
    expect(lastDocsQuery.or).toHaveBeenCalledWith("source.eq.signed_document,sent_at.not.is.null");
    expect(lastDocsQuery.limit).toHaveBeenCalledWith(1);
  });

  it("probes signers via the inner join filtered on the parent document's key", async () => {
    await countTemplateSendEvidence("my_key");
    expect(lastSignersQuery.eq).toHaveBeenCalledWith("documents.document_key", "my_key");
    expect(lastSignersQuery.limit).toHaveBeenCalledWith(1);
  });

  it("fails safe (returns 1) on a documents read error, without querying signers", async () => {
    documentsResult = { data: null, error: { message: "boom" } };
    expect(await countTemplateSendEvidence("k")).toBe(1);
    expect(mockFrom).not.toHaveBeenCalledWith("document_signers");
  });

  it("fails safe (returns 1) on a signers read error", async () => {
    documentsResult = { data: [], error: null };
    signersResult = { data: null, error: { message: "boom" } };
    expect(await countTemplateSendEvidence("k")).toBe(1);
  });
});
