import assert from "node:assert/strict";
import { normalizeResendEmailAttachments } from "../src/app/api/webhooks/resend/attachments";

const attachments = normalizeResendEmailAttachments([
  {
    filename: "owner-statement.pdf",
    content_type: "application/pdf",
    url: "https://example.com/statement.pdf",
  },
  {
    name: "photo.jpg",
    type: "image/jpeg",
  },
  {
    filename: "",
    content_type: "text/plain",
  },
]);

assert.deepEqual(attachments, [
  {
    filename: "owner-statement.pdf",
    contentType: "application/pdf",
    url: "https://example.com/statement.pdf",
  },
  {
    filename: "photo.jpg",
    contentType: "image/jpeg",
  },
]);

assert.deepEqual(normalizeResendEmailAttachments(null), []);
assert.deepEqual(normalizeResendEmailAttachments({ filename: "not-array.pdf" }), []);

console.log("Resend email attachments verified.");
