import { describe, it, expect } from "vitest";
import { evaluateDeletability } from "./template-deletability";

describe("evaluateDeletability", () => {
  const base = { isSystem: false, sendEvidenceCount: 0, hasRemoteSubmissions: false };

  it("allows deleting a non-system template with no send evidence and no remote submissions", () => {
    const v = evaluateDeletability(base);
    expect(v.canDelete).toBe(true);
    expect(v.reason).toBeNull();
  });

  it("blocks system templates first, even when otherwise clean", () => {
    const v = evaluateDeletability({ ...base, isSystem: true });
    expect(v.canDelete).toBe(false);
    expect(v.reason).toMatch(/system/i);
  });

  it("blocks when local send evidence exists", () => {
    const v = evaluateDeletability({ ...base, sendEvidenceCount: 1 });
    expect(v.canDelete).toBe(false);
    expect(v.reason).toMatch(/sent/i);
  });

  it("blocks when DocuSeal reports a submission despite zero local evidence", () => {
    const v = evaluateDeletability({ ...base, hasRemoteSubmissions: true });
    expect(v.canDelete).toBe(false);
    expect(v.reason).toMatch(/signing provider/i);
  });

  it("prioritizes the system reason over send evidence", () => {
    const v = evaluateDeletability({ isSystem: true, sendEvidenceCount: 5, hasRemoteSubmissions: true });
    expect(v.reason).toMatch(/system/i);
  });

  it("prioritizes local send evidence over the remote-submission reason", () => {
    const v = evaluateDeletability({ isSystem: false, sendEvidenceCount: 2, hasRemoteSubmissions: true });
    expect(v.reason).toMatch(/sent/i);
  });
});
