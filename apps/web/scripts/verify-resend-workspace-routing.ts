import assert from "node:assert/strict";
import {
  resolveEmailDirection,
  resolveEmailWorkspaceMatch,
} from "../src/app/api/webhooks/resend/routing";

const owner = {
  id: "owner-profile",
  email: "owner@example.com",
  role: "owner",
  workspaceId: "workspace-1",
};

const contact = {
  id: "contact-1",
  email: "bookkeeper@example.com",
  profileId: null,
  workspaceId: "workspace-1",
  fullName: "Bookkeeper Example",
};

const result = resolveEmailWorkspaceMatch({
  profileMatches: [owner],
  contactMatches: [contact],
  from: "bookkeeper@example.com",
  recipients: ["hello@theparcelco.com"],
  ownerForWorkspaceId: new Map([["workspace-1", owner]]),
});

assert.deepEqual(result, {
  owner,
  relatedContact: contact,
});

const unmatched = resolveEmailWorkspaceMatch({
  profileMatches: [],
  contactMatches: [contact],
  from: "bookkeeper@example.com",
  recipients: ["hello@theparcelco.com"],
  ownerForWorkspaceId: new Map(),
});

assert.equal(unmatched, null);

assert.equal(
  resolveEmailDirection({
    owner,
    relatedContact: contact,
    sender: undefined,
    from: "bookkeeper@example.com",
    recipients: ["hello@theparcelco.com"],
  }),
  "inbound",
);

assert.equal(
  resolveEmailDirection({
    owner,
    relatedContact: null,
    sender: undefined,
    from: "vendor@example.com",
    recipients: ["owner@example.com"],
  }),
  "inbound",
);

assert.equal(
  resolveEmailDirection({
    owner,
    relatedContact: null,
    sender: {
      id: "admin-profile",
      email: "johanan@theparcelco.com",
      role: "admin",
      workspaceId: null,
    },
    from: "johanan@theparcelco.com",
    recipients: ["owner@example.com"],
  }),
  "outbound",
);

console.log("Resend workspace contact routing verified.");
