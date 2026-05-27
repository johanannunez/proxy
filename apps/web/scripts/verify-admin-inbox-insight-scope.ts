import assert from "node:assert/strict";
import { scopeCommunicationsDashboard } from "../src/app/(admin)/admin/inbox/insight-scope";

const dashboard = {
  recentActionItems: [
    {
      id: "owner-action",
      title: "Follow up",
      body: "Owner asked for a statement.",
      entityType: "owner",
      workspaceId: "owner-1",
      createdAt: "2026-05-27T15:00:00.000Z",
    },
    {
      id: "vendor-action",
      title: "Vendor call",
      body: "Vendor needs scheduling.",
      entityType: "vendor",
      workspaceId: "vendor-1",
      createdAt: "2026-05-27T14:00:00.000Z",
    },
  ],
  unresolvedCallers: [
    {
      phone: "(509) 555-0100",
      claudeSummary: "Owner called about a statement.",
      createdAt: "2026-05-27T13:00:00.000Z",
    },
    {
      phone: "+15095550199",
      claudeSummary: "Unknown caller.",
      createdAt: "2026-05-27T12:00:00.000Z",
    },
  ],
};

const scoped = scopeCommunicationsDashboard({
  dashboard,
  selectedOwnerId: "owner-1",
  selectedOwnerPhone: "+15095550100",
});

assert.deepEqual(scoped, {
  recentActionItems: [dashboard.recentActionItems[0]],
  unresolvedCallers: [dashboard.unresolvedCallers[0]],
});

const global = scopeCommunicationsDashboard({
  dashboard,
  selectedOwnerId: null,
  selectedOwnerPhone: null,
});

assert.deepEqual(global, dashboard);

console.log("Admin inbox insight scope verified.");
