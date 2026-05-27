export type ReplyStateMessage = {
  senderId: string;
  senderRole: string | null;
  deliveryMethod: string;
  metadata: Record<string, unknown>;
};

export type ReplyStateConversation = {
  ownerId: string | null;
  lastMessage: ReplyStateMessage | null;
};

export function conversationNeedsReply(conversation: ReplyStateConversation): boolean {
  if (!conversation.ownerId || !conversation.lastMessage) return false;

  return messageNeedsReply({
    ownerId: conversation.ownerId,
    ...conversation.lastMessage,
  });
}

export function messageNeedsReply(message: ReplyStateMessage & { ownerId: string | null }): boolean {
  if (!message.ownerId) return false;

  const direction = metadataString(message.metadata, "direction");
  if (direction) return direction === "inbound";

  return message.senderId === message.ownerId && message.senderRole !== "admin";
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
