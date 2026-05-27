export type EmailAttachmentMetadata = {
  filename: string;
  contentType?: string;
  url?: string;
};

export function normalizeResendEmailAttachments(value: unknown): EmailAttachmentMetadata[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const filename = readString(item.filename) ?? readString(item.name);
    if (!filename) return [];

    const attachment: EmailAttachmentMetadata = { filename };
    const contentType = readString(item.content_type) ?? readString(item.contentType) ?? readString(item.type);
    const url = readString(item.url) ?? readString(item.download_url) ?? readString(item.downloadUrl);

    if (contentType) attachment.contentType = contentType;
    if (url) attachment.url = url;

    return [attachment];
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
