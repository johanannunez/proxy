import assert from "node:assert/strict";
import { resolveEmailComposeSubject } from "../src/app/(admin)/admin/inbox/reply-subject";

const messages = [
  {
    deliveryMethod: "email",
    metadata: {
      subject: "May owner statement",
      direction: "inbound",
    },
  },
];

assert.deepEqual(
  resolveEmailComposeSubject({
    conversationType: "email_log",
    typedSubject: "",
    messages,
  }),
  {
    ok: true,
    subject: "Re: May owner statement",
    inherited: true,
  },
);

assert.deepEqual(
  resolveEmailComposeSubject({
    conversationType: "email_log",
    typedSubject: "Re: May owner statement",
    messages,
  }),
  {
    ok: true,
    subject: "Re: May owner statement",
    inherited: false,
  },
);

assert.deepEqual(
  resolveEmailComposeSubject({
    conversationType: "email_log",
    typedSubject: "",
    messages: [
      {
        deliveryMethod: "portal",
        metadata: {},
      },
    ],
  }),
  {
    ok: false,
    error: "Add a subject before sending this email.",
  },
);

assert.deepEqual(
  resolveEmailComposeSubject({
    conversationType: "direct",
    typedSubject: "",
    messages,
  }),
  {
    ok: false,
    error: "Add a subject before sending this email.",
  },
);

console.log("Admin inbox reply subject verified.");
