"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/auth";
import { buildInviteEmail } from "@/lib/email-template";
import { sendViaResend } from "@/lib/admin/email";
import { logTimelineEvent } from "@/lib/timeline";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { captureServerEvent } from "@/lib/analytics";

/**
 * Single canonical path to invite a contact into their owner portal.
 *
 * Callable from both People and Workspaces. Handles the full flow:
 *   1. (bridge) if the contact has no profile, create the pending owner auth
 *      user — the handle_new_user trigger inserts the profiles row, and we fill
 *      in workspace_id / agency_id / role afterward.
 *   2. swap the placeholder @pending.myproxyhost.com email for the real one.
 *   3. issue a Supabase invite link and send it as a branded email (Resend),
 *      returning the link as a copyable fallback.
 *
 * Everything runs through the service client (RLS reserves profiles inserts for
 * the trigger and gates contacts to admins); the admin gate fires first.
 */

const PENDING_SUFFIX = "@pending.myproxyhost.com";

// The generated Supabase types are stale post-Phase-1B (no agency_id on
// contacts/profiles yet), so the contacts/profiles reads + writes below go
// through the untyped client with explicit row shapes. The columns exist at
// runtime; only the generated types lag.
type ContactRow = {
  id: string;
  profile_id: string | null;
  full_name: string;
  workspace_id: string | null;
  agency_id: string;
};

export type InviteResult = {
  ok: boolean;
  contactId: string;
  profileId?: string;
  inviteLink?: string | null;
  emailed: boolean;
  error?: string;
};

export async function inviteContact(args: {
  contactId: string;
  realEmail: string;
  /** How the email greeting addresses them; defaults to the contact's full name. */
  greetingName?: string;
}): Promise<InviteResult> {
  const { contactId } = args;
  const fail = (error: string): InviteResult => ({
    ok: false,
    contactId,
    emailed: false,
    error,
  });

  let actorId: string;
  try {
    const { user } = await requireAdminUser();
    actorId = user.id;
  } catch {
    return fail("Admin access required.");
  }

  const email = args.realEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return fail("Enter a valid email address.");
  }
  if (email.endsWith(PENDING_SUFFIX)) {
    return fail("That is not a real email address.");
  }

  const svc = createServiceClient();
  const db = untypedDatabase(svc);

  const { data: contact, error: contactErr } = await db
    .from<ContactRow>("contacts")
    .select("id, profile_id, full_name, workspace_id, agency_id")
    .eq("id", contactId)
    .maybeSingle();

  if (contactErr || !contact) {
    return fail("Contact not found.");
  }

  let profileId: string | null = contact.profile_id;
  // Tracks an account created *in this call* so we can roll it back if a later
  // step fails (the bridge writes are not in one transaction).
  let createdProfileId: string | null = null;

  if (!profileId) {
    // ── Bridge: no profile yet → create the pending owner account ──
    const pendingEmail = `${crypto.randomUUID()}${PENDING_SUFFIX}`;
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email: pendingEmail,
      email_confirm: false,
      user_metadata: { full_name: contact.full_name },
    });

    if (createErr || !created?.user) {
      return fail(createErr?.message ?? "Could not create the owner account.");
    }

    const newProfileId = created.user.id;

    // The handle_new_user trigger already inserted the profiles row; fill in the
    // rest. agency_id is set explicitly from the contact so it stays correct
    // once the platform is multi-agency (today the column default happens to
    // match The Parcel Company).
    const { error: profileErr } = await db
      .from("profiles")
      .update({
        full_name: contact.full_name,
        workspace_id: contact.workspace_id,
        agency_id: contact.agency_id,
        role: "owner",
        updated_at: new Date().toISOString(),
      })
      .eq("id", newProfileId);

    if (profileErr) {
      // Roll back the orphaned auth user so we never leave a half-made owner.
      await svc.auth.admin.deleteUser(newProfileId);
      return fail("Could not finish setting up the owner account.");
    }

    // Link contact → profile, but only while still unlinked. Guards against two
    // admins inviting the same contact at once (the read + write is not atomic).
    const { data: linked, error: linkErr } = await db
      .from<{ id: string }>("contacts")
      .update({ profile_id: newProfileId })
      .eq("id", contactId)
      .is("profile_id", null)
      .select("id")
      .maybeSingle();

    if (linkErr || !linked) {
      await svc.auth.admin.deleteUser(newProfileId);
      return fail(
        "This contact was just invited by another session. Refresh and try again.",
      );
    }

    profileId = newProfileId;
    createdProfileId = newProfileId;
  } else {
    // ── Profile exists → only proceed if it is still pending ──
    const { data: existing } = await db
      .from<{ email: string | null }>("profiles")
      .select("email")
      .eq("id", profileId)
      .maybeSingle();

    if (existing?.email && !existing.email.endsWith(PENDING_SUFFIX)) {
      return fail("This contact has already been invited.");
    }
  }

  // ── Swap the placeholder email for the real one ──
  const { error: updateError } = await svc.auth.admin.updateUserById(profileId, {
    email,
    email_confirm: true,
  });
  if (updateError) {
    // If we created the account in this call, roll it back so the contact stays
    // clean and retryable rather than stranded as a half-invited owner.
    if (createdProfileId) {
      await svc.auth.admin.deleteUser(createdProfileId);
      await db
        .from("contacts")
        .update({ profile_id: null })
        .eq("id", contactId)
        .eq("profile_id", createdProfileId);
    }
    return fail(updateError.message);
  }

  await db
    .from("profiles")
    .update({ email, updated_at: new Date().toISOString() })
    .eq("id", profileId);

  // VERIFY LIVE: the 'invite' link type on a just-confirmed user must be
  // confirmed against a real Supabase invite during the dogfood test; if it
  // misbehaves, switch to 'recovery' (a one-line change). The link is returned
  // either way so the admin always has a fallback.
  const { data: linkData } = await svc.auth.admin.generateLink({
    type: "invite",
    email,
  });
  const inviteLink = linkData?.properties?.action_link ?? null;

  let emailed = false;
  if (inviteLink) {
    const sent = await sendViaResend({
      to: [email],
      subject: "You are invited to your Proxy owner workspace",
      html: buildInviteEmail({
        ownerName: args.greetingName?.trim() || contact.full_name,
        inviteLink,
      }),
    });
    emailed = sent.ok;
  }

  svc
    .from("activity_log")
    .insert({
      action: "owner_invited",
      entity_type: "profile",
      entity_id: profileId,
      actor_id: actorId,
      metadata: { invited_email: email, contact_id: contactId, emailed },
    })
    .then(
      () => {},
      () => {},
    );

  void logTimelineEvent({
    ownerId: profileId,
    eventType: "welcome",
    category: "account",
    title: "Welcome to Proxy",
    body: `Invited as ${email}`,
    visibility: "owner",
    isPinned: true,
    createdBy: actorId,
  });

  // Activation-funnel signal (M3). Attributed to the inviting admin with
  // agency_id, so PostHog can compute "first invite" per agency. Best-effort.
  await captureServerEvent(
    actorId,
    "owner_invited",
    {
      agency_id: contact.agency_id,
      invited_profile_id: profileId,
      contact_id: contactId,
      emailed,
    },
    contact.agency_id ? { agency: contact.agency_id } : undefined,
  );

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin/people");

  return { ok: true, contactId, profileId, inviteLink, emailed };
}

/**
 * Invite several contacts in one action. Each invite is independent; a failure
 * on one does not abort the rest. Returns a per-contact result so the UI can
 * show a summary ("3 invited, 1 already active, 0 failed").
 */
export async function bulkInviteContacts(
  items: Array<{ contactId: string; realEmail: string }>,
): Promise<InviteResult[]> {
  try {
    await requireAdminUser();
  } catch {
    return items.map((it) => ({
      ok: false,
      contactId: it.contactId,
      emailed: false,
      error: "Admin access required.",
    }));
  }

  const results = await Promise.allSettled(
    items.map((it) => inviteContact(it)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          ok: false,
          contactId: items[i].contactId,
          emailed: false,
          error: "Invite failed.",
        },
  );
}
