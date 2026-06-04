import { describe, expect, it } from "vitest";
import { invoiceActionItems } from "./invoices";
import { riskActionItems } from "./risk";
import { coldLeadActionItems } from "./leads";

describe("invoiceActionItems", () => {
  it("maps cents to dollars, money lane, owner-visible", () => {
    const out = invoiceActionItems({
      invoices: [{ id: "i1", ownerName: "Maria", ownerId: "o1", amountCents: 425000, kind: "monthly", status: "open", dueAt: "2026-06-01T00:00:00Z", daysOverdue: 2 }],
      totalCents: 425000,
      overdueCount: 1,
      total: 1,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "invoice:i1", lane: "money", moneyAtRisk: 4250, ownerVisible: true });
    expect(out[0].title).toContain("Maria");
    expect(out[0].context).toContain("2d overdue");
  });
});

describe("riskActionItems", () => {
  it("marks critical insights as liveNow", () => {
    const out = riskActionItems({
      insights: [{ id: "r1", propertyId: "p1", propertyName: "14 Oak", agentKey: "k", severity: "warning", title: "No hot water", body: "b", createdAt: "2026-06-03T00:00:00Z", isCritical: true }],
      totalUnresolved: 1,
      criticalCount: 1,
      warningCount: 0,
    });
    expect(out[0]).toMatchObject({ id: "risk:r1", liveNow: true, href: "/admin/properties/p1" });
  });
});

describe("coldLeadActionItems", () => {
  it("uses estimatedMrr as moneyAtRisk, null when zero", () => {
    const out = coldLeadActionItems({
      total: 2,
      topLeads: [
        { id: "c1", name: "Sam", daysDormant: 30, estimatedMrr: 1200, lastStage: "lead_cold" },
        { id: "c2", name: "Dee", daysDormant: 12, estimatedMrr: 0, lastStage: "lead_cold" },
      ],
    });
    expect(out[0].moneyAtRisk).toBe(1200);
    expect(out[1].moneyAtRisk).toBeNull();
  });
});
