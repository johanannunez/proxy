import { normalizePhone } from "@/lib/admin/normalize-phone";

const HANDLED_EVENTS = new Set([
  "call.transcript.completed",
  "call.recording.completed",
  "call.summary.completed",
  "message.received",
  "message.sent",
  "message.delivered",
]);

export type NormalizedQuoWebhookEvent = {
  event: string;
  quoId: string;
  channel: "call" | "sms";
  direction: "inbound" | "outbound";
  phoneFrom: string;
  phoneTo: string;
  rawTranscript: string | null;
  durationSeconds: number | null;
  resolvedPhone: string;
  processAfter: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isHandledQuoEvent(event: string | undefined): event is string {
  return typeof event === "string" && HANDLED_EVENTS.has(event);
}

export function getPayloadObject(payload: Record<string, unknown>): Record<string, unknown> | null {
  const data = payload.data;
  if (!isRecord(data)) return null;

  if (isRecord(data.object)) {
    return data.object;
  }

  return data;
}

function readPhoneField(value: unknown): string {
  if (typeof value === "string") return normalizePhone(value);
  if (Array.isArray(value)) {
    const firstPhone = value.find((item): item is string => typeof item === "string");
    return normalizePhone(firstPhone ?? "");
  }
  return "";
}

export function readTextField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumberField(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeQuoWebhookPayload(payload: unknown): NormalizedQuoWebhookEvent | null {
  if (!isRecord(payload)) return null;

  const event = readTextField(payload.type);
  const data = getPayloadObject(payload);
  if (!event || !data) return null;

  const quoId =
    readTextField(data.id) ??
    readTextField(data.callId) ??
    readTextField(data.messageId) ??
    readTextField(payload.id);
  if (!quoId) return null;

  const channel: "call" | "sms" = event === "call.transcript.completed" ? "call" : "sms";
  const payloadDirection = readTextField(data.direction);
  const direction =
    channel === "call"
      ? payloadDirection === "outbound"
        ? "outbound"
        : "inbound"
      : payloadDirection === "outgoing" || event === "message.sent" || event === "message.delivered"
        ? "outbound"
        : "inbound";

  const phoneFrom = readPhoneField(data.from);
  const phoneTo = readPhoneField(data.to);
  const rawTranscript =
    channel === "call"
      ? readTextField(data.transcript)
      : readTextField(data.body) ?? readTextField(data.text);
  const resolvedPhone = direction === "inbound" ? phoneFrom : phoneTo;

  return {
    event,
    quoId,
    channel,
    direction,
    phoneFrom,
    phoneTo,
    rawTranscript,
    durationSeconds: channel === "call" ? readNumberField(data.duration) : null,
    resolvedPhone,
    processAfter: direction === "inbound",
  };
}

export function shouldAppendOwnerSmsMessage(args: {
  channel: NormalizedQuoWebhookEvent["channel"] | undefined;
  resolvedType: string | undefined;
  rawTranscript: string | null | undefined;
}): boolean {
  return args.channel === "sms" && args.resolvedType === "owner" && Boolean(args.rawTranscript?.trim());
}

export function buildOwnerSmsMessage(args: {
  ownerId: string;
  adminId: string;
  event: NormalizedQuoWebhookEvent | null;
}): {
  senderId: string;
  body: string;
  quoId: string;
  direction: "inbound" | "outbound";
  phoneFrom: string;
  phoneTo: string;
} | null {
  if (!shouldAppendOwnerSmsMessage({
    channel: args.event?.channel,
    resolvedType: "owner",
    rawTranscript: args.event?.rawTranscript,
  }) || !args.event?.rawTranscript) {
    return null;
  }

  return {
    senderId: args.event.direction === "inbound" ? args.ownerId : args.adminId,
    body: args.event.rawTranscript.trim(),
    quoId: args.event.quoId,
    direction: args.event.direction,
    phoneFrom: args.event.phoneFrom,
    phoneTo: args.event.phoneTo,
  };
}
