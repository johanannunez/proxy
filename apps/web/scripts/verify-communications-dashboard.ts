import assert from "node:assert/strict";
import { buildCommunicationsDashboardData } from "../src/lib/admin/communications-dashboard-data";

const dashboard = buildCommunicationsDashboardData({
  insightRows: [
    {
      id: "insight-1",
      title: "Follow up",
      body: "Owner asked for a statement.",
      parent_type: "owner",
      parent_id: "owner-1",
      created_at: "2026-05-27T14:00:00.000Z",
    },
  ],
  unresolvedRows: [
    {
      phone_from: "(509) 555-0100",
      claude_summary: "Owner called about statement.",
      created_at: "2026-05-27T15:00:00.000Z",
    },
    {
      phone_from: "+15095550100",
      claude_summary: "Same caller texted again.",
      created_at: "2026-05-27T14:30:00.000Z",
    },
    {
      phone_from: "+15095550199",
      claude_summary: "Unknown caller.",
      created_at: "2026-05-27T14:00:00.000Z",
    },
  ],
});

assert.deepEqual(dashboard.recentActionItems, [
  {
    id: "insight-1",
    title: "Follow up",
    body: "Owner asked for a statement.",
    entityType: "owner",
    workspaceId: "owner-1",
    createdAt: "2026-05-27T14:00:00.000Z",
  },
]);

assert.deepEqual(dashboard.unresolvedCallers, [
  {
    phone: "+15095550100",
    claudeSummary: "Owner called about statement.",
    createdAt: "2026-05-27T15:00:00.000Z",
  },
  {
    phone: "+15095550199",
    claudeSummary: "Unknown caller.",
    createdAt: "2026-05-27T14:00:00.000Z",
  },
]);

console.log("Communications dashboard data verified.");
