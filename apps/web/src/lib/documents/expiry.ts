import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase, type UntypedDatabaseClient } from "@/lib/supabase/untyped";

/**
 * Workstream A3: daily expiry processing for the documents spine.
 *
 * Runs from /api/cron/document-expiry with the service role client (no user
 * session in a cron). `documents.expires_at` is a DATE column, so comparisons
 * use YYYY-MM-DD strings.
 */

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

export interface ExpiryResult {
  /** Documents newly marked status = 'expiring' (within 30 days). */
  expiring: number;
  /** Documents newly marked status = 'expired' (past expires_at). */
  expired: number;
}

/**
 * Updates documents approaching expiry. Run daily via cron.
 * - Documents past expires_at → status = 'expired'
 *   (matches both 'on_file' and 'expiring' — a document flagged as expiring
 *   yesterday must still cross over to expired once the date passes)
 * - Documents expiring within 30 days → status = 'expiring'
 */
export async function processDocumentExpiry(
  db?: UntypedDatabaseClient,
): Promise<ExpiryResult> {
  const client = db ?? untypedDatabase(createServiceClient());

  const today = toDateString(new Date());

  // Mark as expired.
  const { data: expiredRows, error: expiredError } = await client
    .from<Array<{ id: string }>>("documents")
    .update({ status: "expired" })
    .lt("expires_at", today)
    .in("status", ["on_file", "expiring"])
    .select("id");
  if (expiredError) {
    throw new Error(`Expiry update failed: ${expiredError.message}`);
  }

  // Mark as expiring (within 30 days).
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data: expiringRows, error: expiringError } = await client
    .from<Array<{ id: string }>>("documents")
    .update({ status: "expiring" })
    .lte("expires_at", toDateString(thirtyDaysFromNow))
    .gt("expires_at", today)
    .eq("status", "on_file")
    .select("id");
  if (expiringError) {
    throw new Error(`Expiring update failed: ${expiringError.message}`);
  }

  return {
    expiring: expiringRows?.length ?? 0,
    expired: expiredRows?.length ?? 0,
  };
}

export interface ExpiringDocumentRow {
  id: string;
  owner_id: string;
  title: string;
  document_key: string | null;
  status: string;
  expires_at: string;
  workspace_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

/**
 * Documents that are expiring within 30 days or already expired, oldest
 * deadline first — feeds the admin expiry card (Workstream A4).
 *
 * `orgId` is accepted for the multi-tenant API shape; documents are
 * single-org today so it is not yet used in the query.
 */
export async function fetchExpiringDocuments(
  _orgId: string,
  db?: UntypedDatabaseClient,
): Promise<ExpiringDocumentRow[]> {
  const client = db ?? untypedDatabase(createServiceClient());

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data, error } = await client
    .from<ExpiringDocumentRow[]>("documents")
    .select(
      "id, owner_id, title, document_key, status, expires_at, workspace_id, profiles!owner_id(full_name, email)",
    )
    .in("status", ["expiring", "expired"])
    .lte("expires_at", toDateString(thirtyDaysFromNow))
    .order("expires_at", { ascending: true });
  if (error) {
    throw new Error(`fetchExpiringDocuments failed: ${error.message}`);
  }

  return data ?? [];
}
