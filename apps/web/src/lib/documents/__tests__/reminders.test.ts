import { describe, it, expect, vi } from "vitest";

/**
 * Workstream A3: reminder sequence logic.
 *
 * `findDueRound` is the unit-testable spec of the eligibility rules that
 * `find_reminder_candidates()` implements in Postgres — both must agree.
 * `sendDocumentReminder` is tested with injected fakes: no live email,
 * no live database.
 */

vi.mock("server-only", () => ({}));

import {
  findDueRound,
  sendDocumentReminder,
  DEFAULT_CADENCE,
  type ReminderCandidate,
} from "../reminders";

const NOW = new Date("2026-06-11T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    document_id: "doc-1",
    owner_id: "owner-1",
    owner_email: "owner@example.com",
    owner_name: "Avery Owner",
    document_key: "w9",
    document_title: "W-9 Tax Form",
    workspace_id: "ws-1",
    org_id: "00000000-0000-0000-0000-000000000001",
    round: 1,
    config_days: 3,
    ...overrides,
  };
}

type RecordedOp = {
  table: string;
  type: "insert" | "update";
  values: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
};

function createFakeDb() {
  const ops: RecordedOp[] = [];
  function from(table: string) {
    const op: RecordedOp = { table, type: "insert", values: null, filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      insert(values: unknown) {
        op.type = "insert";
        op.values = values;
        ops.push(op);
        return builder;
      },
      update(values: unknown) {
        op.type = "update";
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
        return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
      },
    };
    for (const method of ["eq", "neq", "lt", "lte", "gt", "gte", "in", "is", "not"]) {
      builder[method] = (...args: unknown[]) => {
        op.filters.push({ method, args });
        return builder;
      };
    }
    return builder;
  }
  return { db: { from } as never, ops };
}

describe("reminder candidates (findDueRound mirrors find_reminder_candidates)", () => {
  it("does not include documents with status on_file", () => {
    // Documents already complete should never get reminders.
    for (const status of ["on_file", "expired", "expiring"]) {
      expect(
        findDueRound({ status, createdAt: daysAgo(30), lastRoundSent: 0, now: NOW }),
      ).toBeNull();
    }
  });

  it("does not include waived documents", () => {
    expect(
      findDueRound({
        status: "needed",
        waived: true,
        createdAt: daysAgo(30),
        lastRoundSent: 0,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("fires round 1 reminder after configured days", () => {
    // Document created 3+ days ago with no reminders sent = round 1 candidate.
    expect(
      findDueRound({ status: "needed", createdAt: daysAgo(4), lastRoundSent: 0, now: NOW }),
    ).toEqual({ round: 1, configDays: DEFAULT_CADENCE.round1Days });

    // Too fresh: nothing fires yet.
    expect(
      findDueRound({ status: "needed", createdAt: daysAgo(2), lastRoundSent: 0, now: NOW }),
    ).toBeNull();
  });

  it("fires round 2 only after round 1 was sent", () => {
    // Round 2 should not fire if round 1 was never sent, even past day 7.
    expect(
      findDueRound({ status: "sent", createdAt: daysAgo(10), lastRoundSent: 0, now: NOW }),
    ).toEqual({ round: 1, configDays: DEFAULT_CADENCE.round1Days });

    // With round 1 logged, round 2 fires once the document is 7+ days old.
    expect(
      findDueRound({ status: "sent", createdAt: daysAgo(10), lastRoundSent: 1, now: NOW }),
    ).toEqual({ round: 2, configDays: DEFAULT_CADENCE.round2Days });

    // Round 1 logged but document younger than the round 2 threshold: hold.
    expect(
      findDueRound({ status: "sent", createdAt: daysAgo(5), lastRoundSent: 1, now: NOW }),
    ).toBeNull();
  });

  it("stops after round 3", () => {
    expect(
      findDueRound({ status: "needed", createdAt: daysAgo(60), lastRoundSent: 3, now: NOW }),
    ).toBeNull();
  });
});

describe("sendDocumentReminder", () => {
  it("sends the email, then logs the reminder round", async () => {
    const { db, ops } = createFakeDb();
    const sent: Array<{ to: string; subject: string; html: string }> = [];

    const result = await sendDocumentReminder(candidate({ round: 1 }), {
      db,
      sendEmail: async (args) => {
        sent.push(args);
      },
    });

    expect(result).toEqual({ sent: true, round: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("owner@example.com");
    expect(sent[0].subject).toContain("W-9 Tax Form");
    expect(sent[0].html).toContain("Avery Owner");

    const inserts = ops.filter((op) => op.type === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("document_reminders");
    expect(inserts[0].values).toMatchObject({
      document_id: "doc-1",
      channel: "email",
      round: 1,
      delivered: true,
    });

    // Rounds 1 and 2 never touch the documents table.
    expect(ops.filter((op) => op.table === "documents")).toHaveLength(0);
  });

  it("sets is_urgent on round 3", async () => {
    const { db, ops } = createFakeDb();

    const result = await sendDocumentReminder(candidate({ round: 3, config_days: 14 }), {
      db,
      sendEmail: async () => {},
    });

    expect(result).toEqual({ sent: true, round: 3 });

    const urgentUpdate = ops.find((op) => op.table === "documents" && op.type === "update");
    expect(urgentUpdate).toBeDefined();
    expect(urgentUpdate?.values).toMatchObject({ is_urgent: true });
    expect(urgentUpdate?.filters).toContainEqual({ method: "eq", args: ["id", "doc-1"] });
  });

  it("flags overdue urgency in the round 3 email copy", async () => {
    const { db } = createFakeDb();
    const sent: Array<{ html: string }> = [];

    await sendDocumentReminder(candidate({ round: 3 }), {
      db,
      sendEmail: async (args) => {
        sent.push(args);
      },
    });

    expect(sent[0].html.toLowerCase()).toContain("overdue");
  });

  it("skips without writing anything when the owner has no email", async () => {
    const { db, ops } = createFakeDb();

    const result = await sendDocumentReminder(candidate({ owner_email: "" }), {
      db,
      sendEmail: async () => {
        throw new Error("should not be called");
      },
    });

    expect(result.sent).toBe(false);
    expect(ops).toHaveLength(0);
  });

  it("skips with a logged warning when RESEND_API_KEY is not configured", async () => {
    const { db, ops } = createFakeDb();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      // No sendEmail injected: the default Resend path must notice the
      // missing key and skip instead of throwing or sending.
      const result = await sendDocumentReminder(candidate(), { db });

      expect(result.sent).toBe(false);
      if (!result.sent) {
        expect(result.reason).toContain("RESEND_API_KEY");
      }
      expect(ops).toHaveLength(0);
      expect(warn).toHaveBeenCalled();
    } finally {
      if (previous !== undefined) process.env.RESEND_API_KEY = previous;
      warn.mockRestore();
    }
  });
});
