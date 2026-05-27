import assert from "node:assert/strict";
import {
  buildOwnerSmsMessage,
  isHandledQuoEvent,
  normalizeQuoWebhookPayload,
  shouldAppendOwnerSmsMessage,
} from "../src/app/api/webhooks/quo/routing";

const inboundPayload = {
  id: "evt_1",
  type: "message.received",
  data: {
    object: {
      id: "msg_inbound_1",
      from: "(509) 555-0100",
      to: ["+15095550200"],
      body: "Can you send the latest statement?",
      direction: "incoming",
    },
  },
};

const inbound = normalizeQuoWebhookPayload(inboundPayload);

assert.deepEqual(inbound, {
  event: "message.received",
  quoId: "msg_inbound_1",
  channel: "sms",
  direction: "inbound",
  phoneFrom: "+15095550100",
  phoneTo: "+15095550200",
  rawTranscript: "Can you send the latest statement?",
  durationSeconds: null,
  resolvedPhone: "+15095550100",
  processAfter: true,
});

assert.equal(shouldAppendOwnerSmsMessage({
  channel: inbound?.channel,
  resolvedType: "owner",
  rawTranscript: inbound?.rawTranscript,
}), true);

assert.deepEqual(buildOwnerSmsMessage({
  ownerId: "owner-profile",
  adminId: "admin-profile",
  event: inbound,
}), {
  senderId: "owner-profile",
  body: "Can you send the latest statement?",
  quoId: "msg_inbound_1",
  direction: "inbound",
  phoneFrom: "+15095550100",
  phoneTo: "+15095550200",
});

const outboundPayload = {
  type: "message.delivered",
  data: {
    id: "msg_outbound_1",
    from: "+15095550200",
    to: "(509) 555-0100",
    text: "Statement sent.",
    direction: "outgoing",
  },
};

const outbound = normalizeQuoWebhookPayload(outboundPayload);

assert.equal(outbound?.direction, "outbound");
assert.equal(outbound?.resolvedPhone, "+15095550100");
assert.equal(outbound?.processAfter, false);
assert.equal(buildOwnerSmsMessage({
  ownerId: "owner-profile",
  adminId: "admin-profile",
  event: outbound,
})?.senderId, "admin-profile");

const sentPayload = {
  type: "message.sent",
  data: {
    object: {
      id: "msg_sent_1",
      from: "+15095550200",
      to: ["(509) 555-0100"],
      body: "I sent this from OpenPhone.",
      direction: "outgoing",
    },
  },
};

const sent = normalizeQuoWebhookPayload(sentPayload);

assert.equal(isHandledQuoEvent("message.sent"), true);
assert.deepEqual(sent, {
  event: "message.sent",
  quoId: "msg_sent_1",
  channel: "sms",
  direction: "outbound",
  phoneFrom: "+15095550200",
  phoneTo: "+15095550100",
  rawTranscript: "I sent this from OpenPhone.",
  durationSeconds: null,
  resolvedPhone: "+15095550100",
  processAfter: false,
});

const skipped = normalizeQuoWebhookPayload({
  type: "message.received",
  data: { object: { from: "+15095550100", to: "+15095550200", body: "No id" } },
});

assert.equal(skipped, null);

console.log("Quo/OpenPhone SMS routing verified.");
