import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { fetchActionQueue } from "@/lib/admin/action-queue";
import { fetchDocumentsHubData } from "@/lib/admin/documents-hub";
import {
  SECURE_DOC_TYPES,
  type SecureDocKey,
  type SignedDocRow,
} from "@/lib/admin/documents-hub-shared";
import type { ActionQueueItem } from "@/lib/admin/action-queue-types";

export const dynamic = "force-dynamic";

/**
 * A queue item enriched server-side with everything the Action Center drawer
 * needs to run Remind / Resend inline. The page that used to own these handlers
 * (DocumentsHub) is gone, so the join (owner email + latest submission id) moves
 * here rather than shipping the whole owners array to the client.
 */
export type ActionCenterItem = ActionQueueItem & {
  ownerEmail: string | null;
  profileId: string | null;
  /** Latest signature row id for this (owner, doc) — the reminder target. */
  latestDocumentId: string | null;
  /** DocuSeal submission id (stored under the legacy boldsign_document_id). */
  latestSubmissionId: string | null;
  /** Deep link into the Signatures tab for "View details". */
  deepLink: string;
};

/** Expiry/lapsed rows. Empty until the expiry engine (Phase 3) populates them. */
export type ActionCenterExpiringItem = {
  id: string;
  ownerName: string;
  documentTitle: string;
  expiresAt: string;
  deepLink: string;
};

export type ActionCenterResponse = {
  needsAttention: ActionCenterItem[];
  /** Signature rows for the queue's documents — powers the stage meters. */
  rows: SignedDocRow[];
  expiring: ActionCenterExpiringItem[];
  lapsed: ActionCenterExpiringItem[];
};

function isSecureKey(key: string): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

const secureKeys = Object.keys(SECURE_DOC_TYPES) as SecureDocKey[];

export async function GET() {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The queue is small (single RPC). Scope the heavy owner fetch to just the
  // owners it references rather than loading the entire owner base.
  const queue = await fetchActionQueue();
  const queueProfileIds = [
    ...new Set(queue.map((i) => i.owner_id).filter((id): id is string => Boolean(id))),
  ];
  const owners =
    queueProfileIds.length > 0
      ? await fetchDocumentsHubData({ profileIds: queueProfileIds })
      : [];

  const ownersByProfileId = new Map(
    owners
      .filter((o) => o.profileId)
      .map((o) => [o.profileId as string, o] as const),
  );

  // Every signature row by id — for stage meters and reminder targeting.
  const rowById = new Map<string, SignedDocRow>();
  for (const owner of owners) {
    for (const key of secureKeys) {
      for (const version of owner.secureDocs[key].versions) {
        rowById.set(version.id, version);
      }
    }
  }

  const needsAttention: ActionCenterItem[] = queue.map((item) => {
    const owner = ownersByProfileId.get(item.owner_id) ?? null;
    const entry =
      owner && isSecureKey(item.document_key)
        ? owner.secureDocs[item.document_key]
        : null;
    const latest = entry?.latest ?? null;
    return {
      ...item,
      ownerEmail: owner?.email ?? null,
      profileId: owner?.profileId ?? null,
      latestDocumentId: latest?.id ?? item.document_id ?? null,
      latestSubmissionId: latest?.boldsignDocumentId ?? null,
      deepLink: `/admin/paperwork/signatures?owner=${encodeURIComponent(
        item.owner_id,
      )}&doc=${encodeURIComponent(item.document_key)}`,
    };
  });

  // Only the rows the queue references (keeps the payload bounded).
  const neededIds = new Set(needsAttention.map((i) => i.document_id));
  const rows = [...rowById.values()].filter((r) => neededIds.has(r.id));

  const body: ActionCenterResponse = {
    needsAttention,
    rows,
    expiring: [],
    lapsed: [],
  };

  return NextResponse.json(body);
}
