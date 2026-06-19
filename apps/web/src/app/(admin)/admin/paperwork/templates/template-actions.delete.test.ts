import { describe, it, expect, vi, beforeEach } from "vitest";

// Isolate deleteTemplate's orchestration: mock its DB + DocuSeal collaborators,
// keep the real (pure) evaluateDeletability so the gate logic is exercised end-to-end.
// vi.mock factories are hoisted above the (also-hoisted) static imports, so the
// mock objects are built in a vi.hoisted() block to guarantee they exist first.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mocks = vi.hoisted(() => ({
  adminClient: {
    auth: {
      getUser: vi.fn(
        (): Promise<{ data: { user: { id: string } | null } }> =>
          Promise.resolve({ data: { user: { id: "admin-1" } } }),
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: { role: "admin" } })),
    })),
  },
  docTemplates: {
    getDocumentTemplate: vi.fn(),
    countTemplateSendEvidence: vi.fn(),
    deleteDocumentTemplateRecord: vi.fn(),
    deleteReminderConfigForKey: vi.fn(),
    createDocumentTemplateRecord: vi.fn(),
    updateDocumentTemplateRecord: vi.fn(),
    documentKeyExists: vi.fn(),
    templateHasBeenSent: vi.fn(),
  },
  docuseal: {
    createTemplate: vi.fn(),
    createTemplateFromHtml: vi.fn(),
    cloneTemplate: vi.fn(),
    getTemplateFields: vi.fn(),
    renameDocuSealTemplate: vi.fn(),
    getDocuSealTemplateName: vi.fn(),
    archiveDocuSealTemplate: vi.fn(),
    docuSealTemplateHasSubmissions: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mocks.adminClient)),
}));
vi.mock("@/lib/admin/document-templates", () => mocks.docTemplates);
vi.mock("@/lib/signing/docuseal", () => mocks.docuseal);
vi.mock("@/lib/signing/field-coverage", () => ({ computeCoverage: vi.fn() }));
vi.mock("./signer-roles", () => ({ signerRolesLabel: vi.fn(() => "") }));
vi.mock("./template-meta", () => ({
  metaEditLocked: vi.fn(() => false),
  isValidDocumentKey: vi.fn(() => true),
}));

import { deleteTemplate } from "./template-actions";

const { docTemplates, docuseal, adminClient } = mocks;

const customTemplate = {
  id: "t1",
  agency_id: "org-1",
  document_key: "custom_key",
  display_name: "Custom",
  is_system: false,
  docuseal_template_id: 123,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteTemplate", () => {
  it("rejects when the caller is not signed in", async () => {
    adminClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/signed in/i);
    expect(docTemplates.deleteDocumentTemplateRecord).not.toHaveBeenCalled();
  });

  it("rejects an authenticated non-admin caller (privilege escalation guard)", async () => {
    adminClient.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: { role: "owner" } })),
    });
    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/admin/i);
    expect(docTemplates.deleteDocumentTemplateRecord).not.toHaveBeenCalled();
  });

  it("returns not-found when the template is missing", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue(null);
    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  it("deletes a never-built template (null DocuSeal id) without any DocuSeal calls", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue({ ...customTemplate, docuseal_template_id: null });
    docTemplates.countTemplateSendEvidence.mockResolvedValue(0);
    docTemplates.deleteDocumentTemplateRecord.mockResolvedValue(true);

    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(true);
    expect(docuseal.docuSealTemplateHasSubmissions).not.toHaveBeenCalled();
    expect(docuseal.archiveDocuSealTemplate).not.toHaveBeenCalled();
    expect(docTemplates.deleteDocumentTemplateRecord).toHaveBeenCalledWith("t1");
  });

  it("refuses to delete a system template and never queries usage", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue({ ...customTemplate, is_system: true });
    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/system/i);
    expect(docTemplates.countTemplateSendEvidence).not.toHaveBeenCalled();
    expect(docTemplates.deleteDocumentTemplateRecord).not.toHaveBeenCalled();
  });

  it("refuses when local send evidence exists and skips the DocuSeal round-trip", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue(customTemplate);
    docTemplates.countTemplateSendEvidence.mockResolvedValue(2);
    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sent/i);
    expect(docuseal.docuSealTemplateHasSubmissions).not.toHaveBeenCalled();
    expect(docTemplates.deleteDocumentTemplateRecord).not.toHaveBeenCalled();
  });

  it("fails closed when the DocuSeal verification throws", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue(customTemplate);
    docTemplates.countTemplateSendEvidence.mockResolvedValue(0);
    docuseal.docuSealTemplateHasSubmissions.mockRejectedValue(new Error("docuseal down"));
    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/verify/i);
    expect(docTemplates.deleteDocumentTemplateRecord).not.toHaveBeenCalled();
  });

  it("refuses when DocuSeal reports a submission despite a clean local state", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue(customTemplate);
    docTemplates.countTemplateSendEvidence.mockResolvedValue(0);
    docuseal.docuSealTemplateHasSubmissions.mockResolvedValue(true);
    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/signing provider/i);
    expect(docTemplates.deleteDocumentTemplateRecord).not.toHaveBeenCalled();
  });

  it("deletes a never-sent template, clears reminder cadence, and best-effort archives remotely", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue(customTemplate);
    docTemplates.countTemplateSendEvidence.mockResolvedValue(0);
    docuseal.docuSealTemplateHasSubmissions.mockResolvedValue(false);
    docTemplates.deleteDocumentTemplateRecord.mockResolvedValue(true);
    docuseal.archiveDocuSealTemplate.mockResolvedValue(true);

    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(true);
    expect(docTemplates.deleteReminderConfigForKey).toHaveBeenCalledWith("org-1", "custom_key");
    expect(docTemplates.deleteDocumentTemplateRecord).toHaveBeenCalledWith("t1");
    expect(docuseal.archiveDocuSealTemplate).toHaveBeenCalledWith(123);
  });

  it("still succeeds when the best-effort DocuSeal archive fails", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue(customTemplate);
    docTemplates.countTemplateSendEvidence.mockResolvedValue(0);
    docuseal.docuSealTemplateHasSubmissions.mockResolvedValue(false);
    docTemplates.deleteDocumentTemplateRecord.mockResolvedValue(true);
    docuseal.archiveDocuSealTemplate.mockResolvedValue(false);

    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(true);
  });

  it("reports an error when the row delete fails", async () => {
    docTemplates.getDocumentTemplate.mockResolvedValue(customTemplate);
    docTemplates.countTemplateSendEvidence.mockResolvedValue(0);
    docuseal.docuSealTemplateHasSubmissions.mockResolvedValue(false);
    docTemplates.deleteDocumentTemplateRecord.mockResolvedValue(false);

    const res = await deleteTemplate("t1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/could not delete/i);
  });
});
