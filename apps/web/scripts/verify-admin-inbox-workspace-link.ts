import assert from "node:assert/strict";
import { resolveInboxWorkspaceHref } from "../src/app/(admin)/admin/inbox/workspace-link";

assert.equal(
  resolveInboxWorkspaceHref({
    ownerWorkspaceId: "workspace-owner",
    messages: [],
  }),
  "/admin/workspaces/workspace-owner?tab=inbox",
);

assert.equal(
  resolveInboxWorkspaceHref({
    ownerWorkspaceId: null,
    messages: [
      {
        metadata: {
          workspace_id: "workspace-contact",
        },
      },
    ],
  }),
  "/admin/workspaces/workspace-contact?tab=inbox",
);

assert.equal(
  resolveInboxWorkspaceHref({
    ownerWorkspaceId: null,
    messages: [
      {
        metadata: {
          workspace_id: "",
        },
      },
    ],
  }),
  null,
);

console.log("Admin inbox workspace link verified.");
