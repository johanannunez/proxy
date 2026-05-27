import assert from "node:assert/strict";
import {
  resolveEmailReplyContext,
  resolveEmailReplyRecipients,
  resolveSendMessageConversationTarget,
  shouldNotifyOwnerForAdminMessage,
} from "../src/app/(admin)/admin/inbox/send-target";

const emailLogTarget = resolveSendMessageConversationTarget({
  deliveryMethod: "email",
  selectedConversation: {
    id: "email-log-1",
    ownerId: "owner-1",
    type: "email_log",
  },
  existingDirectConversationId: "direct-1",
});

assert.deepEqual(emailLogTarget, {
  ok: true,
  conversationId: "email-log-1",
  createDirect: false,
});

const blockedPortalOnEmailLog = resolveSendMessageConversationTarget({
  deliveryMethod: "portal",
  selectedConversation: {
    id: "email-log-1",
    ownerId: "owner-1",
    type: "email_log",
  },
  existingDirectConversationId: "direct-1",
});

assert.deepEqual(blockedPortalOnEmailLog, {
  ok: false,
  error: "Email history threads can only send email replies.",
});

const directTarget = resolveSendMessageConversationTarget({
  deliveryMethod: "sms",
  selectedConversation: {
    id: "direct-2",
    ownerId: "owner-1",
    type: "direct",
  },
  existingDirectConversationId: "direct-1",
});

assert.deepEqual(directTarget, {
  ok: true,
  conversationId: "direct-2",
  createDirect: false,
});

const createDirectTarget = resolveSendMessageConversationTarget({
  deliveryMethod: "portal",
  selectedConversation: null,
  existingDirectConversationId: null,
});

assert.deepEqual(createDirectTarget, {
  ok: true,
  conversationId: null,
  createDirect: true,
});

const emailLogRecipients = resolveEmailReplyRecipients({
  conversationType: "email_log",
  ownerEmail: "owner@example.com",
  messages: [
    {
      deliveryMethod: "email",
      metadata: {
        direction: "inbound",
        from: "bookkeeper@example.com",
        to: ["hello@theparcelco.com"],
      },
    },
    {
      deliveryMethod: "email",
      metadata: {
        direction: "outbound",
        from: "hello@theparcelco.com",
        to: ["bookkeeper@example.com"],
      },
    },
  ],
});

assert.deepEqual(emailLogRecipients, {
  ok: true,
  to: ["bookkeeper@example.com"],
});

assert.deepEqual(
  resolveEmailReplyContext([
    {
      deliveryMethod: "email",
      metadata: {
        direction: "inbound",
        from: "bookkeeper@example.com",
        related_contact_id: "contact-1",
        related_contact_name: "Cedar Bookkeeping",
        workspace_id: "workspace-1",
      },
    },
    {
      deliveryMethod: "email",
      metadata: {
        direction: "outbound",
        from: "hello@theparcelco.com",
        to: ["bookkeeper@example.com"],
      },
    },
  ]),
  {
    relatedContactId: "contact-1",
    relatedContactName: "Cedar Bookkeeping",
    workspaceId: "workspace-1",
  },
);

const directRecipients = resolveEmailReplyRecipients({
  conversationType: "direct",
  ownerEmail: "owner@example.com",
  messages: [],
});

assert.deepEqual(directRecipients, {
  ok: true,
  to: ["owner@example.com"],
});

const missingRecipients = resolveEmailReplyRecipients({
  conversationType: "email_log",
  ownerEmail: "",
  messages: [
    {
      deliveryMethod: "email",
      metadata: {
        direction: "outbound",
        from: "hello@theparcelco.com",
        to: ["owner@example.com"],
      },
    },
  ],
});

assert.deepEqual(missingRecipients, {
  ok: false,
  error: "No email recipient could be resolved for this thread.",
});

assert.equal(
  shouldNotifyOwnerForAdminMessage({
    deliveryMethod: "email",
    conversationType: "email_log",
    ownerEmail: "owner@example.com",
    recipients: ["bookkeeper@example.com"],
  }),
  false,
);

assert.equal(
  shouldNotifyOwnerForAdminMessage({
    deliveryMethod: "email",
    conversationType: "email_log",
    ownerEmail: "owner@example.com",
    recipients: ["owner@example.com"],
  }),
  true,
);

assert.equal(
  shouldNotifyOwnerForAdminMessage({
    deliveryMethod: "sms",
    conversationType: "direct",
    ownerEmail: "owner@example.com",
    recipients: [],
  }),
  true,
);

console.log("Admin inbox send target routing verified.");
