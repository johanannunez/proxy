import assert from "node:assert/strict";
import { conversationNeedsReply, messageNeedsReply } from "../src/app/(admin)/admin/inbox/reply-state";

assert.equal(
  messageNeedsReply({
    ownerId: "owner-1",
    senderId: "owner-1",
    senderRole: "owner",
    deliveryMethod: "portal",
    metadata: {},
  }),
  true,
);

assert.equal(
  messageNeedsReply({
    ownerId: "owner-1",
    senderId: "owner-1",
    senderRole: "owner",
    deliveryMethod: "email",
    metadata: { direction: "outbound" },
  }),
  false,
);

assert.equal(
  messageNeedsReply({
    ownerId: "owner-1",
    senderId: "owner-1",
    senderRole: "owner",
    deliveryMethod: "email",
    metadata: { direction: "inbound" },
  }),
  true,
);

assert.equal(
  messageNeedsReply({
    ownerId: "owner-1",
    senderId: "owner-1",
    senderRole: "owner",
    deliveryMethod: "email",
    metadata: { direction: "inbound", related_contact_id: "contact-1" },
  }),
  true,
);

assert.equal(
  messageNeedsReply({
    ownerId: "owner-1",
    senderId: "admin-1",
    senderRole: "admin",
    deliveryMethod: "sms",
    metadata: { direction: "outbound" },
  }),
  false,
);

assert.equal(
  conversationNeedsReply({
    ownerId: "owner-1",
    lastMessage: {
      senderId: "owner-1",
      senderRole: "owner",
      deliveryMethod: "email",
      metadata: { direction: "inbound", from: "bookkeeper@example.com" },
    },
  }),
  true,
);

console.log("Admin inbox reply state verified.");
