export type ProfileEmailMatch = {
  id: string;
  email: string;
  role: string;
  workspaceId: string | null;
};

export type ContactEmailMatch = {
  id: string;
  email: string;
  profileId: string | null;
  workspaceId: string | null;
  fullName: string | null;
};

export type EmailWorkspaceMatch = {
  owner: ProfileEmailMatch;
  relatedContact: ContactEmailMatch | null;
};

export type EmailDirection = "inbound" | "outbound";

export function resolveEmailWorkspaceMatch(args: {
  profileMatches: ProfileEmailMatch[];
  contactMatches: ContactEmailMatch[];
  from: string;
  recipients: string[];
  ownerForWorkspaceId: Map<string, ProfileEmailMatch>;
}): EmailWorkspaceMatch | null {
  const profileOwner = pickOwner(args.profileMatches, args.from, args.recipients);
  const contact = pickContact(args.contactMatches, args.from, args.recipients);
  if (profileOwner) {
    return { owner: profileOwner, relatedContact: contact };
  }

  if (!contact?.workspaceId) return null;

  const owner = args.ownerForWorkspaceId.get(contact.workspaceId);
  return owner ? { owner, relatedContact: contact } : null;
}

export function resolveEmailDirection(args: {
  owner: ProfileEmailMatch;
  relatedContact: ContactEmailMatch | null;
  sender: ProfileEmailMatch | undefined;
  from: string;
  recipients: string[];
}): EmailDirection {
  if (args.sender?.role === "admin") return "outbound";

  const from = args.from.toLowerCase();
  if (args.sender?.id === args.owner.id) return "inbound";
  if (args.relatedContact?.email.toLowerCase() === from) return "inbound";

  const recipientSet = new Set(args.recipients.map((email) => email.toLowerCase()));
  if (recipientSet.has(args.owner.email.toLowerCase())) return "inbound";

  return "outbound";
}

function pickOwner(
  matches: ProfileEmailMatch[],
  from: string,
  recipients: string[],
): ProfileEmailMatch | null {
  const fromMatch = matches.find((profile) => profile.email.toLowerCase() === from.toLowerCase());
  if (fromMatch?.role === "owner") return fromMatch;

  const recipientSet = new Set(recipients.map((email) => email.toLowerCase()));
  return matches.find((profile) => profile.role === "owner" && recipientSet.has(profile.email.toLowerCase())) ?? null;
}

function pickContact(
  matches: ContactEmailMatch[],
  from: string,
  recipients: string[],
): ContactEmailMatch | null {
  const fromMatch = matches.find((contact) => contact.email.toLowerCase() === from.toLowerCase());
  if (fromMatch) return fromMatch;

  const recipientSet = new Set(recipients.map((email) => email.toLowerCase()));
  return matches.find((contact) => recipientSet.has(contact.email.toLowerCase())) ?? null;
}
