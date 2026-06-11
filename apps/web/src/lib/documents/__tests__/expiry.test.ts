import { describe, it, expect, vi } from "vitest";

/**
 * Workstream A3: daily expiry processing.
 * Tested with an injected fake database — no live writes.
 */

vi.mock("server-only", () => ({}));

import { processDocumentExpiry } from "../expiry";

type RecordedOp = {
  table: string;
  type: "update";
  values: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
};

function createFakeDb(rowsPerUpdate: number[]) {
  const ops: RecordedOp[] = [];
  let updateIndex = 0;
  function from(table: string) {
    const op: RecordedOp = { table, type: "update", values: null, filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      update(values: unknown) {
        op.values = values;
        ops.push(op);
        return builder;
      },
      select() {
        return builder;
      },
      then(
        onFulfilled: (value: { data: unknown[]; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        const count = rowsPerUpdate[updateIndex] ?? 0;
        updateIndex += 1;
        const data = Array.from({ length: count }, (_, i) => ({ id: `doc-${i}` }));
        return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
      },
    };
    for (const method of ["eq", "lt", "lte", "gt", "gte", "in"]) {
      builder[method] = (...args: unknown[]) => {
        op.filters.push({ method, args });
        return builder;
      };
    }
    return builder;
  }
  return { db: { from } as never, ops };
}

describe("processDocumentExpiry", () => {
  it("expires documents past their expires_at, including ones already marked expiring", async () => {
    const { db, ops } = createFakeDb([2, 3]);

    const result = await processDocumentExpiry(db);

    expect(result).toEqual({ expired: 2, expiring: 3 });

    const expiredOp = ops[0];
    expect(expiredOp.table).toBe("documents");
    expect(expiredOp.values).toMatchObject({ status: "expired" });
    // A document marked 'expiring' yesterday must still transition to
    // 'expired' once the date passes — filtering on on_file alone would
    // strand it in 'expiring' forever.
    expect(expiredOp.filters).toContainEqual({
      method: "in",
      args: ["status", ["on_file", "expiring"]],
    });
    expect(expiredOp.filters.some((f) => f.method === "lt" && f.args[0] === "expires_at")).toBe(
      true,
    );
  });

  it("marks on_file documents inside the 30 day window as expiring", async () => {
    const { db, ops } = createFakeDb([0, 1]);

    const result = await processDocumentExpiry(db);

    expect(result).toEqual({ expired: 0, expiring: 1 });

    const expiringOp = ops[1];
    expect(expiringOp.values).toMatchObject({ status: "expiring" });
    expect(expiringOp.filters).toContainEqual({ method: "eq", args: ["status", "on_file"] });
    // Window: expires_at within (today, today + 30 days].
    expect(expiringOp.filters.some((f) => f.method === "lte" && f.args[0] === "expires_at")).toBe(
      true,
    );
    expect(expiringOp.filters.some((f) => f.method === "gt" && f.args[0] === "expires_at")).toBe(
      true,
    );
  });
});
