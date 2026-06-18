import assert from "node:assert/strict";
import {
  getConversationContextLabel,
  getConversationSearchText,
} from "../src/app/(admin)/admin/inbox/conversation-context";

const contactEmailLog = {
  type: "email_log",
  ownerEmail: "owner@example.com",
  ownerPhone: null,
  lastMessage: {
    deliveryMethod: "email",
    metadata: {
      direction: "inbound",
      from: "bookkeeper@example.com",
      to: ["hello@theparcelco.com"],
      related_contact_name: "Cedar Bookkeeping",
    },
  },
} as const;

assert.equal(getConversationContextLabel(contactEmailLog), "Contact: Cedar Bookkeeping");
assert.match(getConversationSearchText(contactEmailLog), /cedar bookkeeping/);
assert.match(getConversationSearchText(contactEmailLog), /bookkeeper@example\.com/);

const externalInboundEmailLog = {
  type: "email_log",
  ownerEmail: "owner@example.com",
  ownerPhone: null,
  lastMessage: {
    deliveryMethod: "email",
    metadata: {
      direction: "inbound",
      from: "vendor@example.com",
      to: ["hello@theparcelco.com"],
    },
  },
} as const;

assert.equal(getConversationContextLabel(externalInboundEmailLog), "From: vendor@example.com");

const smsThread = {
  type: "direct",
  ownerEmail: "owner@example.com",
  ownerPhone: "+1 (509) 300-1001",
  lastMessage: {
    deliveryMethod: "sms",
    metadata: {
      direction: "inbound",
      phone_from: "+15093001001",
    },
  },
} as const;

assert.equal(getConversationContextLabel(smsThread), "SMS: +15093001001");

console.log("Admin inbox conversation context verified.");
