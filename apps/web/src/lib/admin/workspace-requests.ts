export type WorkspaceRequestAssignmentScope = "workspace" | "person" | "multiple_people";
export type WorkspaceRequestCompletionRule = "any_assignee" | "each_assignee";
export type WorkspaceRequestRecipientRole = "to" | "cc" | "notify_only";
export type WorkspaceRequestDeliveryChannel = "email" | "sms";

export type ComposerRecipient = {
  contactId: string;
  profileId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: WorkspaceRequestRecipientRole;
  channels: WorkspaceRequestDeliveryChannel[];
};

export function buildWorkspaceRequestUrl(origin: string, workspaceId: string, requestId: string): string {
  const params = new URLSearchParams({
    workspace: workspaceId,
    request: requestId,
    source: "documents",
  });
  return `${origin.replace(/\/$/, "")}/workspace/setup?${params.toString()}`;
}

export function buildWorkspaceRequestDraftUrl(origin: string, workspaceId: string): string {
  const params = new URLSearchParams({
    workspace: workspaceId,
    source: "documents",
  });
  return `${origin.replace(/\/$/, "")}/workspace/setup?${params.toString()}`;
}

export function splitEmailRecipients(recipients: ComposerRecipient[]): {
  to: string[];
  cc: string[];
} {
  const to = recipients
    .filter((recipient) => recipient.role === "to" && recipient.channels.includes("email") && recipient.email)
    .map((recipient) => recipient.email as string);

  const cc = recipients
    .filter((recipient) => recipient.role === "cc" && recipient.channels.includes("email") && recipient.email)
    .map((recipient) => recipient.email as string);

  return { to, cc };
}

export function splitSmsRecipients(recipients: ComposerRecipient[]): ComposerRecipient[] {
  return recipients.filter((recipient) =>
    recipient.role !== "notify_only" && recipient.channels.includes("sms") && Boolean(recipient.phone),
  );
}

export function deliveryButtonLabel(recipients: ComposerRecipient[]): string {
  const deliverableRecipients = recipients.filter((recipient) => recipient.role !== "notify_only");
  const emailCount = deliverableRecipients.filter((recipient) => recipient.channels.includes("email")).length;
  const smsCount = deliverableRecipients.filter((recipient) => recipient.channels.includes("sms")).length;
  if (emailCount > 0 && smsCount > 0) return "Send email and text";
  if (emailCount > 1) return `Send email to ${emailCount} people`;
  if (emailCount === 1) return "Send email";
  if (smsCount > 1) return `Send text to ${smsCount} people`;
  if (smsCount === 1) return "Send text";
  return "Choose delivery";
}
