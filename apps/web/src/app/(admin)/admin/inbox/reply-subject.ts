export type EmailSubjectMessage = {
  deliveryMethod: string;
  metadata: Record<string, unknown>;
};

export type EmailComposeSubjectResult =
  | {
      ok: true;
      subject: string;
      inherited: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export function resolveEmailComposeSubject(args: {
  conversationType: string;
  typedSubject: string;
  messages: EmailSubjectMessage[];
}): EmailComposeSubjectResult {
  const typedSubject = args.typedSubject.trim();
  if (typedSubject) {
    return { ok: true, subject: typedSubject, inherited: false };
  }

  if (args.conversationType === "email_log") {
    const existingSubject = findLatestEmailSubject(args.messages);
    if (existingSubject) {
      return { ok: true, subject: withReplyPrefix(existingSubject), inherited: true };
    }
  }

  return { ok: false, error: "Add a subject before sending this email." };
}

function findLatestEmailSubject(messages: EmailSubjectMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.deliveryMethod !== "email") continue;
    const subject = metadataString(message.metadata, "subject");
    if (subject) return subject;
  }

  return null;
}

function withReplyPrefix(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
