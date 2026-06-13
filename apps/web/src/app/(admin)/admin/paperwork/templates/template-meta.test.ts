import { describe, it, expect } from "vitest";
import { metaEditLocked, isValidDocumentKey } from "./template-meta";

describe("metaEditLocked", () => {
  it("locks when sent and the document key is being changed", () => {
    expect(metaEditLocked(true, { document_key: "new_key" })).toBe(true);
  });

  it("locks when sent and signer roles are being changed", () => {
    expect(metaEditLocked(true, { signer_roles: ["Owner", "Proxy"] })).toBe(true);
  });

  it("does not lock when sent but only cosmetic fields change", () => {
    expect(
      metaEditLocked(true, {
        title: "New Title",
        display_name: "New Name",
        description: "Updated description",
      }),
    ).toBe(false);
  });

  it("does not lock when the template has never been sent", () => {
    expect(metaEditLocked(false, { document_key: "new_key" })).toBe(false);
    expect(metaEditLocked(false, { signer_roles: ["Owner"] })).toBe(false);
  });

  it("does not lock on an empty edit", () => {
    expect(metaEditLocked(true, {})).toBe(false);
  });
});

describe("isValidDocumentKey", () => {
  it("accepts lowercase letters, numbers, and underscores", () => {
    expect(isValidDocumentKey("host_rental_agreement_2")).toBe(true);
  });

  it("rejects uppercase, spaces, and punctuation", () => {
    expect(isValidDocumentKey("Host Agreement")).toBe(false);
    expect(isValidDocumentKey("host-agreement")).toBe(false);
    expect(isValidDocumentKey("")).toBe(false);
  });
});
