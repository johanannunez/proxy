import assert from "node:assert/strict";
import {
  buildWorkspaceRequestDraftUrl,
  buildWorkspaceRequestUrl,
  deliveryButtonLabel,
  splitEmailRecipients,
  splitSmsRecipients,
  type ComposerRecipient,
} from "../src/lib/admin/workspace-requests";

const recipients: ComposerRecipient[] = [
  {
    contactId: "tina-contact",
    profileId: "tina-profile",
    fullName: "Tina Olive",
    email: "tina@example.com",
    phone: "509-555-0101",
    role: "to",
    channels: ["email", "sms"],
  },
  {
    contactId: "darryl-contact",
    profileId: "darryl-profile",
    fullName: "Darryl Olive",
    email: "darryl@example.com",
    phone: "509-555-0102",
    role: "cc",
    channels: ["email"],
  },
];

assert.deepEqual(splitEmailRecipients(recipients), {
  to: ["tina@example.com"],
  cc: ["darryl@example.com"],
});

assert.equal(splitSmsRecipients(recipients).length, 1);
assert.equal(splitSmsRecipients(recipients)[0]?.fullName, "Tina Olive");
assert.equal(deliveryButtonLabel(recipients), "Send email and text");
assert.equal(
  buildWorkspaceRequestUrl("http://localhost:4000/", "workspace-1", "request-1"),
  "http://localhost:4000/portal/setup?workspace=workspace-1&request=request-1&source=documents",
);
assert.equal(
  buildWorkspaceRequestDraftUrl("http://localhost:4000/", "workspace-1"),
  "http://localhost:4000/portal/setup?workspace=workspace-1&source=documents",
);
