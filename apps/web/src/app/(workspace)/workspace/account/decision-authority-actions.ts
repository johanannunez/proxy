"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import {
  saveWorkspaceAuthority,
  markAuthorityPendingSignatures,
  getWorkspaceMembers,
} from "@/lib/workspace/decision-authority";
import { createSubmission, createTemplateFromHtml } from "@/lib/signing/docuseal";
import {
  AUTHORITY_ADDENDUM_DOCUMENT_KEY,
  AUTHORITY_ADDENDUM_SUBMITTERS,
  AUTHORITY_ADDENDUM_FIELDS,
  buildAuthorityAddendumHtml,
} from "@/lib/signing/authority-addendum-html";
import type { AuthorityConfig, GovernanceMode } from "@/types/decision-authority";
import { revalidatePath } from "next/cache";

async function getCurrentProfileAndWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return null;

  const db = untypedDatabase(supabase);

  const { data: profile } = await db
    .from("profiles")
    .select("id, workspace_id")
    .eq("id", user.id)
    .single();

  const p = profile as { id: string; workspace_id: string | null } | null;
  if (!p?.workspace_id) return null;

  const { data: workspace } = await db
    .from("workspaces")
    .select("id, name, type, agency_id")
    .eq("id", p.workspace_id)
    .single();

  const w = workspace as {
    id: string;
    name: string;
    type: string;
    agency_id: string;
  } | null;
  if (!w) return null;

  return { profile: p, workspace: w };
}

/** Save governance config as a draft and return the new authority ID. */
export async function saveAuthorityConfigAction(
  governanceMode: GovernanceMode,
  configs: AuthorityConfig[]
): Promise<{ authorityId: string } | { error: string }> {
  const ctx = await getCurrentProfileAndWorkspace();
  if (!ctx) return { error: "Not authenticated." };

  const authorityId = await saveWorkspaceAuthority({
    workspaceId: ctx.workspace.id,
    orgId: ctx.workspace.agency_id,
    governanceMode,
    configs,
  });

  if (!authorityId) return { error: "Failed to save authority configuration." };

  revalidatePath("/workspace/account");
  return { authorityId };
}

/**
 * Generates a DocuSeal addendum submission and sends signing links to all
 * workspace owners. Marks the authority record as pending_signatures.
 */
export async function sendAddendumForSignatureAction(
  authorityId: string
): Promise<{ ok: true } | { error: string }> {
  // Input validation
  if (!authorityId?.trim()) return { error: "Invalid authority ID." };

  const ctx = await getCurrentProfileAndWorkspace();
  if (!ctx) return { error: "Not authenticated." };

  // IDOR guard: verify the authority record belongs to this workspace
  const supabase = await createClient();
  const db = untypedDatabase(supabase);
  const { data: authority } = await db
    .from("workspace_authority")
    .select("id, workspace_id")
    .eq("id", authorityId)
    .single();
  const a = authority as { id: string; workspace_id: string } | null;
  if (!a || a.workspace_id !== ctx.workspace.id) {
    return { error: "Not found." };
  }

  const templateId = await ensureAuthorityAddendumTemplate();
  if (!templateId) {
    return { error: "Addendum template could not be provisioned. Check DocuSeal configuration." };
  }

  const members = await getWorkspaceMembers(ctx.workspace.id);
  if (members.length < 2) {
    return { error: "At least two workspace members are required to send an addendum." };
  }

  const submitters = members.map((m, i) => ({
    role: `Owner ${i + 1}`,
    email: m.email,
    name: m.full_name ?? undefined,
    externalId: m.id,
  }));

  const result = await createSubmission({
    templateId,
    submitters,
    sendEmail: true,
    orderPreserved: false,
  });

  if (!result) {
    return { error: "Failed to create DocuSeal submission. Check DocuSeal configuration." };
  }

  const ok = await markAuthorityPendingSignatures(authorityId, String(result.submissionId));
  if (!ok) return { error: "Submission created but failed to update authority status." };

  await persistAddendumInPaperwork(
    ctx.profile.id,
    ctx.workspace.id,
    result.submissionId,
    members,
    result.submitters,
  );

  revalidatePath("/workspace/account");
  return { ok: true };
}

/**
 * Returns the DocuSeal template ID for the authority addendum, provisioning
 * it from code on first use. The template is stored in document_templates
 * (key: "decision_authority_addendum") so it survives across deploys.
 * No env var, no DocuSeal UI setup required.
 */
async function ensureAuthorityAddendumTemplate(): Promise<number | null> {
  const db = createServiceClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: existing } = await db
    .from("document_templates")
    .select("docuseal_template_id")
    .eq("document_key", AUTHORITY_ADDENDUM_DOCUMENT_KEY)
    .is("agency_id", null)
    .eq("is_active", true)
    .not("docuseal_template_id", "is", null)
    .maybeSingle();

  if (existing?.docuseal_template_id) {
    return existing.docuseal_template_id as number;
  }

  const result = await createTemplateFromHtml(
    "Decision Authority Addendum",
    buildAuthorityAddendumHtml(),
    {
      submitters: [...AUTHORITY_ADDENDUM_SUBMITTERS],
      fields: [...AUTHORITY_ADDENDUM_FIELDS],
    },
  );

  if (!result) {
    console.error("[authority] failed to provision addendum template via DocuSeal");
    return null;
  }

  const { error: upsertErr } = await db.from("document_templates").upsert(
    {
      agency_id: null,
      document_key: AUTHORITY_ADDENDUM_DOCUMENT_KEY,
      display_name: "Decision Authority Addendum",
      description: "Workspace governance addendum signed by all co-owners.",
      docuseal_template_id: result.templateId,
      signer_roles: AUTHORITY_ADDENDUM_SUBMITTERS.map((s) => s.name),
      requires_countersignature: false,
      gate_step: null,
      is_system: true,
      is_active: true,
    },
    { onConflict: "document_key,agency_id", ignoreDuplicates: false },
  );

  if (upsertErr) {
    console.error("[authority] failed to persist template row:", upsertErr.message);
  }

  return result.templateId;
}

/**
 * Creates (or updates) a spine document row + document_signers so the signed
 * addendum appears in both owners' Paperwork sections once signing is complete.
 * Non-blocking: a failure here logs but does not abort the addendum send.
 */
async function persistAddendumInPaperwork(
  initiatorProfileId: string,
  workspaceId: string,
  submissionId: number,
  members: Awaited<ReturnType<typeof getWorkspaceMembers>>,
  submitters: { email: string; embedUrl: string }[],
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const now = new Date().toISOString();
  const subId = String(submissionId);

  // Upsert spine row for the initiating owner (select-then-insert-or-update pattern).
  const { data: existing } = await db
    .from("documents")
    .select("id")
    .eq("owner_id", initiatorProfileId)
    .eq("document_key", "decision_authority_addendum")
    .is("form_key", null)
    .is("property_id", null)
    .maybeSingle();

  let spineId: string | null = null;

  if (existing?.id) {
    // Clear stale signer rows before re-persisting.
    await db.from("document_signers").delete().eq("document_id", existing.id);
    const { error: upErr } = await db
      .from("documents")
      .update({ status: "sent", source: "signed_document", source_ref: subId, sent_at: now })
      .eq("id", existing.id);
    if (!upErr) spineId = existing.id as string;
  } else {
    const { data: inserted, error: insErr } = await db
      .from("documents")
      .insert({
        owner_id: initiatorProfileId,
        workspace_id: workspaceId,
        document_key: "decision_authority_addendum",
        title: "Decision Authority Addendum",
        scope_kind: "owner",
        visibility: "client",
        source: "signed_document",
        source_ref: subId,
        status: "sent",
        sent_at: now,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[authority] addendum spine insert failed:", insErr.message);
      return;
    }
    spineId = (inserted as { id: string }).id;
  }

  if (!spineId) return;

  const signerRows = members.map((m, index) => {
    const sub = submitters.find((s) => s.email === m.email);
    return {
      document_id: spineId,
      signer_profile_id: m.id,
      signer_email: m.email,
      signer_name: m.full_name ?? null,
      role: "signer",
      role_index: index + 1,
      order_index: index,
      required: true,
      status: "pending",
      boldsign_document_id: subId,
      embedded_link: sub?.embedUrl ?? null,
      created_at: now,
      updated_at: now,
    };
  });

  const { error: sigErr } = await db.from("document_signers").insert(signerRows);
  if (sigErr) {
    console.error("[authority] addendum document_signers insert failed:", sigErr.message);
  }
}
