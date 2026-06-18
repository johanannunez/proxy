import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Workstream A1: property form sections are stored as raw form rows in the
 * `documents` spine (source = 'property_form', form_key set, payload in
 * form_data). The retired legacy form table must never be queried.
 */

vi.mock("server-only", () => ({}));

type FakeResult = { data: unknown; error: { message: string } | null };

type RecordedWrite = { table: string; op: "insert" | "update" | "upsert"; values: unknown };

function createFakeDb(responses: Record<string, FakeResult | FakeResult[]>) {
  const tablesQueried: string[] = [];
  const writes: RecordedWrite[] = [];

  function nextResponse(table: string): FakeResult {
    const r = responses[table];
    if (Array.isArray(r)) return r.shift() ?? { data: null, error: null };
    return r ?? { data: null, error: null };
  }

  function builder(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    const chainMethods = [
      "select", "eq", "neq", "is", "in", "not", "order", "limit", "delete",
    ] as const;
    for (const m of chainMethods) {
      b[m] = vi.fn(() => b);
    }
    for (const m of ["insert", "update", "upsert"] as const) {
      b[m] = vi.fn((values: unknown) => {
        writes.push({ table, op: m, values });
        return b;
      });
    }
    b.maybeSingle = vi.fn(async () => nextResponse(table));
    b.single = vi.fn(async () => nextResponse(table));
    b.then = (
      onFulfilled: (value: FakeResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(nextResponse(table)).then(onFulfilled, onRejected);
    return b;
  }

  return {
    tablesQueried,
    writes,
    client: {
      from: vi.fn((table: string) => {
        tablesQueried.push(table);
        return builder(table);
      }),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "owner-1" } } })),
      },
    },
  };
}

const serverDb = vi.hoisted(() => ({ current: null as unknown }));
const serviceDb = vi.hoisted(() => ({ current: null as unknown }));
const syncSpineForProperty = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => serverDb.current,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => serviceDb.current,
}));
vi.mock("@/lib/documents/spine", () => ({
  syncSpineForProperty,
}));

import {
  getPropertyForm,
  getPropertyFormCompletionMap,
  upsertPropertyForm,
} from "../property-forms";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPropertyForm", () => {
  it("reads the raw form row from the documents spine, never the legacy table", async () => {
    const fake = createFakeDb({
      documents: {
        data: {
          id: "doc-1",
          property_id: "prop-1",
          form_key: "setup_tech",
          form_data: { wifi_ssid: "ProxyNet", wifi_password: "hunter2" },
          completed_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
        },
        error: null,
      },
    });
    serverDb.current = fake.client;

    const row = await getPropertyForm("prop-1", "setup_tech");

    expect(fake.tablesQueried).toContain("documents");
    expect(fake.tablesQueried).not.toContain("property_forms");
    expect(row).not.toBeNull();
    expect(row?.form_key).toBe("setup_tech");
    expect(row?.data.wifi_ssid).toBe("ProxyNet");
    expect(row?.completed_at).toBe("2026-06-01T00:00:00Z");
  });
});

describe("getPropertyFormCompletionMap", () => {
  it("maps completion from documents spine raw form rows", async () => {
    const fake = createFakeDb({
      documents: {
        data: [
          { form_key: "setup_basic", completed_at: "2026-06-01T00:00:00Z" },
          { form_key: "setup_access", completed_at: null },
        ],
        error: null,
      },
    });
    serverDb.current = fake.client;

    const map = await getPropertyFormCompletionMap("prop-1");

    expect(fake.tablesQueried).toContain("documents");
    expect(map.get("setup_basic")).toBe(true);
    expect(map.get("setup_access")).toBe(false);
  });
});

describe("upsertPropertyForm", () => {
  it("writes the form payload to the documents spine and syncs", async () => {
    const userFake = createFakeDb({});
    const serviceFake = createFakeDb({
      properties: { data: { id: "prop-1", owner_id: "owner-1", contact_id: null }, error: null },
      profiles: { data: { role: "owner" }, error: null },
      documents: { data: null, error: null }, // no existing raw form row -> insert
    });
    serverDb.current = userFake.client;
    serviceDb.current = serviceFake.client;

    const error = await upsertPropertyForm("prop-1", "setup_basic", { bedrooms: "3" });

    expect(error).toBeNull();
    const docWrites = serviceFake.writes.filter((w) => w.table === "documents");
    expect(docWrites.length).toBe(1);
    const values = docWrites[0].values as Record<string, unknown>;
    expect(values.source).toBe("property_form");
    expect(values.form_key).toBe("setup_basic");
    expect(values.form_data).toEqual({ bedrooms: "3" });
    expect(values.owner_id).toBe("owner-1");
    expect(syncSpineForProperty).toHaveBeenCalledWith("prop-1");
  });

  it("rejects a user who does not own the property", async () => {
    const userFake = createFakeDb({});
    const serviceFake = createFakeDb({
      properties: { data: { id: "prop-1", owner_id: "someone-else", contact_id: null }, error: null },
      profiles: { data: { role: "owner" }, error: null },
    });
    serverDb.current = userFake.client;
    serviceDb.current = serviceFake.client;

    const error = await upsertPropertyForm("prop-1", "setup_basic", { bedrooms: "3" });

    expect(error).not.toBeNull();
    expect(serviceFake.writes.filter((w) => w.table === "documents").length).toBe(0);
    expect(syncSpineForProperty).not.toHaveBeenCalled();
  });
});
