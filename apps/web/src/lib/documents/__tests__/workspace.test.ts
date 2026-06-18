import { describe, it, expect, vi } from "vitest";

/**
 * Workstream A1: the owner document hub reads everything — including property
 * form documents — from the `documents` spine. Nothing reads the retired
 * legacy detail tables.
 */

vi.mock("server-only", () => ({}));

import { getOwnerDocumentHub } from "../workspace";

type SpineRowFixture = Record<string, unknown>;

function spineRow(overrides: SpineRowFixture): SpineRowFixture {
  return {
    id: "doc-default",
    document_key: null,
    property_id: null,
    status: "needed",
    scope_kind: "owner",
    visibility: "client",
    gate_group: null,
    sequence: 0,
    source: "manual",
    source_ref: null,
    title: "Document",
    file_url: null,
    expires_at: null,
    submitted_at: null,
    completed_at: null,
    updated_at: null,
    admin_gate_override: false,
    display_sort_order: 0,
    display_group: null,
    waived: false,
    is_urgent: false,
    admin_note: null,
    owner_note: null,
    custom_due_date: null,
    manually_completed_at: null,
    manually_completed_note: null,
    ...overrides,
  };
}

function createFakeClient(rowsByTable: Record<string, unknown[]>) {
  const tablesQueried: string[] = [];
  function builder(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const m of ["select", "eq", "neq", "is", "in", "not", "order", "limit"]) {
      b[m] = () => b;
    }
    b.then = (
      onFulfilled: (value: { data: unknown[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: rowsByTable[table] ?? [], error: null }).then(onFulfilled, onRejected);
    return b;
  }
  return {
    tablesQueried,
    client: {
      from(table: string) {
        tablesQueried.push(table);
        return builder(table);
      },
    },
  };
}

describe("getOwnerDocumentHub", () => {
  it("includes property form documents sourced from the documents spine", async () => {
    const fake = createFakeClient({
      documents: [
        spineRow({
          id: "doc-agreement",
          document_key: "host_rental_agreement",
          status: "on_file",
          source: "signed_document",
          title: "Host Rental Agreement",
          completed_at: "2026-05-01T00:00:00Z",
        }),
        spineRow({
          id: "doc-wifi",
          document_key: "wifi_info",
          property_id: "prop-1",
          scope_kind: "property",
          status: "on_file",
          source: "property_form",
          title: "Wi-Fi Information",
          completed_at: "2026-05-02T00:00:00Z",
        }),
      ],
      properties: [
        { id: "prop-1", name: "Jadwin House", address_line1: "1431 Jadwin Ave", city: "Richland" },
      ],
    });

    const hub = await getOwnerDocumentHub(fake.client, "owner-1");

    // The spine is the only source consulted for documents.
    expect(fake.tablesQueried).toContain("documents");
    expect(fake.tablesQueried).not.toContain("property_forms");
    expect(fake.tablesQueried).not.toContain("signed_documents");

    // The property form document appears in the hub output.
    const wifi = hub.filed.find((d) => d.documentKey === "wifi_info");
    expect(wifi).toBeDefined();
    expect(wifi?.propertyLabel).toBe("Jadwin House");
    expect(hub.progress.total).toBe(2);
    expect(hub.progress.complete).toBe(2);
  });

  it("locks gated documents until prerequisites from the spine are complete", async () => {
    const fake = createFakeClient({
      documents: [
        spineRow({
          id: "doc-agreement",
          document_key: "host_rental_agreement",
          status: "sent",
          source: "signed_document",
          title: "Host Rental Agreement",
        }),
        spineRow({
          id: "doc-wifi",
          document_key: "wifi_info",
          property_id: "prop-1",
          scope_kind: "property",
          status: "needed",
          source: "manual",
          title: "Wi-Fi Information",
        }),
      ],
      properties: [
        { id: "prop-1", name: "Jadwin House", address_line1: "1431 Jadwin Ave", city: "Richland" },
      ],
    });

    const hub = await getOwnerDocumentHub(fake.client, "owner-1");

    expect(hub.signature.map((d) => d.documentKey)).toContain("host_rental_agreement");
    expect(hub.locked.map((d) => d.documentKey)).toContain("wifi_info");
  });
});
