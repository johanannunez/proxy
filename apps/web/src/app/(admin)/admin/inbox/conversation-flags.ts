export type ConversationFlagInput = {
  lastMessage: {
    metadata: Record<string, unknown>;
  } | null;
};

export function conversationHasAttachments(conversation: ConversationFlagInput): boolean {
  const metadata = conversation.lastMessage?.metadata;
  if (!metadata) return false;

  const attachmentCount = metadata.attachment_count;
  if (typeof attachmentCount === "number" && attachmentCount > 0) return true;

  const attachments = metadata.attachments;
  return Array.isArray(attachments) && attachments.some(hasFilename);
}

function hasFilename(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const filename = (value as Record<string, unknown>).filename;
  return typeof filename === "string" && filename.trim().length > 0;
}
