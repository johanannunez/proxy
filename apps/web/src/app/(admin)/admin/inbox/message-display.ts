export type MessageDisplayInput = {
  senderName: string;
  senderRole: string;
  deliveryMethod: string;
  metadata: Record<string, unknown>;
};

export type MessageDisplayParticipant = {
  name: string;
  detail: string | null;
};

const PARCEL_EMAILS = new Set([
  "hello@theparcelco.com",
  "support@theparcelco.com",
  "team@theparcelco.com",
]);

export function getMessageDisplayParticipant(message: MessageDisplayInput): MessageDisplayParticipant {
  if (message.deliveryMethod === "email") {
    const direction = metadataString(message.metadata, "direction");
    const from = normalizeEmail(metadataString(message.metadata, "from"));
    const relatedContactName = metadataString(message.metadata, "related_contact_name");

    if (direction === "inbound") {
      if (relatedContactName) {
        return {
          name: relatedContactName,
          detail: from,
        };
      }

      if (from && !PARCEL_EMAILS.has(from)) {
        return {
          name: from,
          detail: "Email contact",
        };
      }
    }

    const outboundRecipient = metadataStringArray(message.metadata, "to")
      .map(normalizeEmail)
      .find((email): email is string => Boolean(email && !PARCEL_EMAILS.has(email)));
    return {
      name: message.senderName,
      detail: outboundRecipient ?? null,
    };
  }

  if (message.deliveryMethod === "sms") {
    return {
      name: message.senderName,
      detail:
        metadataString(message.metadata, "phone_from") ??
        metadataString(message.metadata, "phone_to") ??
        metadataString(message.metadata, "sms_to"),
    };
  }

  return {
    name: message.senderName,
    detail: null,
  };
}

function normalizeEmail(value: string | null): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  const single = metadataString(metadata, key);
  return single ? [single] : [];
}
