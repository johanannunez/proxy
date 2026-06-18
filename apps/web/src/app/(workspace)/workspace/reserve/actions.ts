"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { propertyLabel } from "@/lib/address";
import { logTimelineEvent } from "@/lib/timeline";

async function notifyAdminOfBlockRequest(args: {
  ownerEmail: string;
  ownerName: string | null;
  propertyLabel: string;
  startDate: string;
  endDate: string;
  note: string | null;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;
  const to = process.env.INQUIRY_TO_EMAIL ?? "hello@myproxyhost.com";
  const range =
    args.startDate === args.endDate
      ? args.startDate
      : `${args.startDate} → ${args.endDate}`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Proxy <hello@myproxyhost.com>",
        to,
        subject: `New reservation to verify: ${args.propertyLabel} (${range})`,
        text: [
          `An owner reserved time in their home.`,
          ``,
          `Owner: ${args.ownerName ?? args.ownerEmail} (${args.ownerEmail})`,
          `Property: ${args.propertyLabel}`,
          `Dates: ${range}`,
          args.note ? `\nReason:\n${args.note}` : null,
          ``,
          `Check for conflicts: https://www.myproxyhost.com/admin/block-requests`,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    });
  } catch (err) {
    console.error("[BlockRequest] email failed:", err);
  }
}

const Schema = z
  .object({
    propertyId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
    reason: z.string().max(120).optional(),
    adults: z.number().int().min(0).max(30).optional(),
    children: z.number().int().min(0).max(20).optional(),
    pets: z.number().int().min(0).max(10).optional(),
    notes: z.string().max(500).optional(),
    isOwnerStaying: z.boolean().optional(),
    guestName: z.string().max(200).optional(),
    guestEmail: z.string().max(200).optional(),
    guestPhone: z.string().max(40).optional(),
    needsLockCode: z.boolean().optional(),
    requestedLockCode: z.string().max(20).optional(),
    wantsCleaning: z.boolean().optional(),
    cleaningFee: z.number().min(0).optional(),
    damageAcknowledged: z.boolean().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export type BlockRequestResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitBlockRequest(
  input: unknown,
): Promise<BlockRequestResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Please check the dates and try again.",
    };
  }

  const { userId, client: supabase } = await getWorkspaceContext();

  const { error } = await supabase.from("block_requests").insert({
    owner_id: userId,
    property_id: parsed.data.propertyId,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    note: parsed.data.notes ?? parsed.data.note ?? null,
    status: "pending",
    check_in_time: parsed.data.checkInTime ?? null,
    check_out_time: parsed.data.checkOutTime ?? null,
    reason: parsed.data.reason ?? null,
    is_owner_staying: parsed.data.isOwnerStaying ?? true,
    guest_name: parsed.data.guestName ?? null,
    guest_email: parsed.data.guestEmail ?? null,
    guest_phone: parsed.data.guestPhone ?? null,
    adults: parsed.data.adults ?? 1,
    children: parsed.data.children ?? 0,
    pets: parsed.data.pets ?? 0,
    needs_lock_code: parsed.data.needsLockCode ?? false,
    requested_lock_code: parsed.data.requestedLockCode ?? null,
    wants_cleaning: parsed.data.wantsCleaning ?? false,
    cleaning_fee: parsed.data.cleaningFee ?? null,
    damage_acknowledged: parsed.data.damageAcknowledged ?? false,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const [{ data: profile }, { data: property }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("address_line1, address_line2, city, state, postal_code")
      .eq("id", parsed.data.propertyId)
      .maybeSingle(),
  ]);

  after(
    notifyAdminOfBlockRequest({
      ownerEmail: profile?.email ?? "unknown",
      ownerName: profile?.full_name ?? null,
      propertyLabel: propertyLabel(property ?? {}),
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      note: parsed.data.note ?? null,
    }),
  );

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "block_request_submitted",
    entity_type: "block_request",
    entity_id: null,
    actor_id: userId,
    metadata: {
      property_name: propertyLabel(property ?? {}),
      dates: `${parsed.data.startDate} to ${parsed.data.endDate}`,
      reason: parsed.data.reason ?? null,
      description: `Block request submitted for ${parsed.data.startDate} to ${parsed.data.endDate}`,
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: userId,
    eventType: "block_request_submitted",
    category: "calendar",
    title: `Block request for ${parsed.data.startDate} to ${parsed.data.endDate}`,
    propertyId: parsed.data.propertyId,
    metadata: { reason: parsed.data.reason ?? null },
  });

  revalidatePath("/workspace/reserve");
  return { ok: true };
}

export type DecisionResult = { ok: true } | { ok: false; error: string };

const DecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "declined"]),
});

export async function decideBlockRequest(
  input: unknown,
): Promise<DecisionResult> {
  const parsed = DecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin")
    return { ok: false, error: "Admins only." };

  const { data: updated, error } = await supabase
    .from("block_requests")
    .update({ status: parsed.data.decision })
    .eq("id", parsed.data.id)
    .select("owner_id, start_date, end_date")
    .single();

  if (error) return { ok: false, error: error.message };

  // Create in-app notification for the owner
  if (updated) {
    const { createNotification } = await import("@/lib/notifications");
    const { sendPushToOwner } = await import("@/lib/push");
    const range = updated.start_date === updated.end_date
      ? formatDate(updated.start_date)
      : `${formatDate(updated.start_date)} - ${formatDate(updated.end_date)}`;

    const isApproved = parsed.data.decision === "approved";
    const title = isApproved
      ? "Your dates are confirmed"
      : "Conflict on your block dates";
    const body = isApproved
      ? `Your block for ${range} is clear of other bookings.`
      : `Another booking already covers part of ${range}. Open Reserve to pick new dates.`;

    createNotification({
      ownerId: updated.owner_id,
      type: isApproved ? "block_approved" : "block_denied",
      title,
      body,
      link: "/workspace/reserve",
    }).catch(() => {});

    // Push notification too
    sendPushToOwner({
      ownerId: updated.owner_id,
      title,
      body,
      url: "/workspace/reserve",
      tag: "parcel-block",
    }).catch(() => {});
  }

  // Log activity (fire-and-forget)
  const svcLog = createServiceClient();
  const actionName = parsed.data.decision === "approved"
    ? "block_request_confirmed"
    : "block_request_conflict";
  svcLog.from("activity_log").insert({
    action: actionName,
    entity_type: "block_request",
    entity_id: parsed.data.id,
    actor_id: user.id,
    metadata: {
      decision: parsed.data.decision,
      dates: updated ? `${updated.start_date} to ${updated.end_date}` : null,
      description: `Block request ${parsed.data.decision}`,
    },
  }).then(() => {}, () => {});

  if (updated) {
    const approved = parsed.data.decision === "approved";
    const range = updated.start_date === updated.end_date
      ? formatDate(updated.start_date)
      : `${formatDate(updated.start_date)} to ${formatDate(updated.end_date)}`;
    void logTimelineEvent({
      ownerId: updated.owner_id,
      eventType: approved ? "block_request_approved" : "block_request_denied",
      category: "calendar",
      title: approved
        ? `Block request approved: ${range}`
        : `Block request denied: ${range}`,
      visibility: "owner",
      createdBy: user.id,
    });
  }

  revalidatePath("/admin/block-requests");
  revalidatePath("/workspace/reserve");
  return { ok: true };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CancelSchema = z.object({
  id: z.string().uuid(),
});

export async function cancelBlockRequest(
  input: unknown,
): Promise<BlockRequestResult> {
  const parsed = CancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Only allow cancelling own pending requests
  const { data, error } = await supabase
    .from("block_requests")
    .update({ status: "cancelled" as string })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id)
    .eq("status", "pending")
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Request not found or already processed." };

  // Log activity (fire-and-forget)
  const svcCancel = createServiceClient();
  svcCancel.from("activity_log").insert({
    action: "block_request_cancelled",
    entity_type: "block_request",
    entity_id: parsed.data.id,
    actor_id: user.id,
    metadata: {
      description: "Block request cancelled by owner",
    },
  }).then(() => {}, () => {});

  revalidatePath("/workspace/reserve");
  return { ok: true };
}

const ReopenSchema = z.object({
  id: z.string().uuid(),
});

export async function reopenBlockRequest(
  input: unknown,
): Promise<DecisionResult> {
  const parsed = ReopenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin")
    return { ok: false, error: "Admins only." };

  const { data, error } = await supabase
    .from("block_requests")
    .update({ status: "pending" })
    .eq("id", parsed.data.id)
    .in("status", ["declined", "cancelled"])
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0)
    return { ok: false, error: "Request not found or not in a reopenable state." };

  // Log activity (fire-and-forget)
  const svcReopen = createServiceClient();
  svcReopen.from("activity_log").insert({
    action: "block_request_reopened",
    entity_type: "block_request",
    entity_id: parsed.data.id,
    actor_id: user.id,
    metadata: {
      description: "Block request reopened by admin",
    },
  }).then(() => {}, () => {});

  revalidatePath("/admin/block-requests");
  revalidatePath("/workspace/reserve");
  return { ok: true };
}
