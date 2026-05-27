import assert from "node:assert/strict";
import { shouldCreatePlaceholderMessageForNewConversation } from "../src/app/(admin)/admin/inbox/compose-start";

assert.equal(shouldCreatePlaceholderMessageForNewConversation(), false);

console.log("Admin inbox compose start verified.");
