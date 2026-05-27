import assert from "node:assert/strict";
import { conversationHasAttachments } from "../src/app/(admin)/admin/inbox/conversation-flags";

assert.equal(
  conversationHasAttachments({
    lastMessage: {
      metadata: {
        attachments: [
          {
            filename: "statement.pdf",
          },
        ],
      },
    },
  }),
  true,
);

assert.equal(
  conversationHasAttachments({
    lastMessage: {
      metadata: {
        attachment_count: 2,
      },
    },
  }),
  true,
);

assert.equal(
  conversationHasAttachments({
    lastMessage: {
      metadata: {
        attachments: [],
        attachment_count: 0,
      },
    },
  }),
  false,
);

assert.equal(conversationHasAttachments({ lastMessage: null }), false);

console.log("Admin inbox conversation flags verified.");
