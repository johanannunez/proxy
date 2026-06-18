import assert from "node:assert/strict";
import { getMessageDisplayParticipant } from "../src/app/(admin)/admin/inbox/message-display";

const relatedContactMessage = {
  senderName: "Alex Mercer",
  senderRole: "owner",
  deliveryMethod: "email",
  metadata: {
    direction: "inbound",
    from: "bookkeeper@example.com",
    related_contact_name: "Cedar Bookkeeping",
  },
};

assert.deepEqual(getMessageDisplayParticipant(relatedContactMessage), {
  name: "Cedar Bookkeeping",
  detail: "bookkeeper@example.com",
});

const externalEmailMessage = {
  senderName: "Alex Mercer",
  senderRole: "owner",
  deliveryMethod: "email",
  metadata: {
    direction: "inbound",
    from: "vendor@example.com",
  },
};

assert.deepEqual(getMessageDisplayParticipant(externalEmailMessage), {
  name: "vendor@example.com",
  detail: "Email contact",
});

const ownerSmsMessage = {
  senderName: "Alex Mercer",
  senderRole: "owner",
  deliveryMethod: "sms",
  metadata: {
    direction: "inbound",
    phone_from: "+15093001001",
  },
};

assert.deepEqual(getMessageDisplayParticipant(ownerSmsMessage), {
  name: "Alex Mercer",
  detail: "+15093001001",
});

const adminEmailMessage = {
  senderName: "Johanan Nunez",
  senderRole: "admin",
  deliveryMethod: "email",
  metadata: {
    direction: "outbound",
    to: ["bookkeeper@example.com"],
  },
};

assert.deepEqual(getMessageDisplayParticipant(adminEmailMessage), {
  name: "Johanan Nunez",
  detail: "bookkeeper@example.com",
});

console.log("Admin inbox message display verified.");
