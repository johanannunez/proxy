import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// docuseal.ts imports "server-only"; stub it for the node test env.
vi.mock("server-only", () => ({}));

import { docuSealTemplateHasSubmissions, archiveDocuSealTemplate } from "./docuseal";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.DOCUSEAL_API_TOKEN = "test-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DOCUSEAL_API_TOKEN;
});

function okJson(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) };
}

// This is the contract the deleteTemplate fail-closed gate depends on: a DocuSeal
// error must THROW (so the action blocks), and a clean response must report
// truthfully. A regression to `return false` on !res.ok would silently flip the
// "never hard-delete a remotely-signed template" invariant to fail-open.
describe("docuSealTemplateHasSubmissions (fail-closed contract)", () => {
  it("THROWS when not configured, because it cannot prove zero remote submissions", async () => {
    // A template that owns a docuseal_template_id was built while configured, so a
    // live submission may exist; returning false here would fail OPEN after a token gap.
    delete process.env.DOCUSEAL_API_TOKEN;
    await expect(docuSealTemplateHasSubmissions(123)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("THROWS when DocuSeal responds non-ok (so the caller fails closed)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("err") });
    await expect(docuSealTemplateHasSubmissions(123)).rejects.toThrow();
  });

  it("returns true when at least one submission exists", async () => {
    fetchMock.mockResolvedValue(okJson({ data: [{ id: 1 }] }));
    expect(await docuSealTemplateHasSubmissions(123)).toBe(true);
  });

  it("returns false when no submissions exist", async () => {
    fetchMock.mockResolvedValue(okJson({ data: [] }));
    expect(await docuSealTemplateHasSubmissions(123)).toBe(false);
  });

  it("returns false when the response has no data array", async () => {
    fetchMock.mockResolvedValue(okJson({}));
    expect(await docuSealTemplateHasSubmissions(123)).toBe(false);
  });

  it("queries submissions scoped to the template id", async () => {
    fetchMock.mockResolvedValue(okJson({ data: [] }));
    await docuSealTemplateHasSubmissions(456);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/submissions?template_id=456"),
      expect.any(Object),
    );
  });
});

describe("archiveDocuSealTemplate (best-effort, never throws)", () => {
  it("returns false without calling DocuSeal when not configured", async () => {
    delete process.env.DOCUSEAL_API_TOKEN;
    expect(await archiveDocuSealTemplate(123)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DELETEs /templates/:id and returns true on success", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    expect(await archiveDocuSealTemplate(123)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/templates/123"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("returns false (does not throw) on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("nf") });
    expect(await archiveDocuSealTemplate(123)).toBe(false);
  });

  it("returns false (does not throw) when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await archiveDocuSealTemplate(123)).toBe(false);
  });
});
