"use client";

/**
 * SignaturesHub — Library | Activity sub-tab layout (2026-06-15 redesign).
 *
 * Library tab: TemplateCard grid or list view for signature masters. Send button
 * opens SendSheet (same pattern as TemplatesTab). A cross-link nudges admins
 * toward Forms when they want a form instead.
 *
 * Activity tab: ActivityTable of every owner-document pair that has been sent at
 * least once. Rows open the DocumentDrawer (same drawer as before). Filters:
 * search + status select.
 *
 * Deep-link (?owner=&doc=) preserved verbatim from the old hub; also switches to
 * Activity so the opened row is visible behind the drawer.
 */

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { PenNib, PaperPlaneTilt } from "@phosphor-icons/react";
import {
  SECURE_DOC_TYPES,
  avatarColor,
  type DocHubOwner,
  type SecureDocKey,
} from "@/lib/admin/documents-hub-shared";
import type { SendRecipient, UnifiedTemplate } from "../templates/unified-types";
import { DocumentDrawer } from "../DocumentDrawer";
import { SendSheet } from "../templates/SendSheet";
import {
  HubSubTabs,
  ViewToggle,
  HubGroupLabel,
  type HubTab,
  type HubView,
} from "@/components/admin/paperwork/HubChrome";
import {
  TemplateCard,
  accentForSeed,
} from "@/components/admin/paperwork/TemplateCard";
import {
  ActivityTable,
  type ActivityRow,
} from "@/components/admin/paperwork/ActivityTable";
import { CustomSelect } from "@/components/admin/CustomSelect";
import styles from "./SignaturesHub.module.css";

/** True e-sign instruments (DocuSeal-backed). */
const SIGNATURE_DOC_KEYS: SecureDocKey[] = [
  "host_rental_agreement",
  "ach_authorization",
  "card_authorization",
];

type StatusFilter = "all" | "awaiting" | "viewed" | "signed";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "awaiting", label: "Awaiting" },
  { value: "viewed", label: "Viewed" },
  { value: "signed", label: "Signed" },
];

/** Format an ISO string as "Jun 14" (short month + day), or "—" when null. */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SignaturesHub({
  owners,
  templates,
  recipients,
}: {
  owners: DocHubOwner[];
  templates: UnifiedTemplate[];
  recipients: SendRecipient[];
}) {
  const router = useRouter();

  /* ── Tab + view state ── */
  const [tab, setTab] = useState<HubTab>("library");
  const [view, setView] = useState<HubView>("cards");

  /* ── Send sheet (Library tab) ── */
  const [sendTarget, setSendTarget] = useState<UnifiedTemplate | null>(null);

  /* ── Document drawer (Activity tab) ── */
  const [drawerEntry, setDrawerEntry] = useState<{
    owner: DocHubOwner;
    docKey: SecureDocKey;
  } | null>(null);

  /* ── Activity filters ── */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  /* Deep link from the Action Center:
     /admin/paperwork/signatures?owner=<profileId|contactId>&doc=<secureDocKey> */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get("owner");
    const docParam = params.get("doc");
    if (!ownerParam || !docParam || !(docParam in SECURE_DOC_TYPES)) return;
    const owner = owners.find(
      (o) => o.profileId === ownerParam || o.contactId === ownerParam,
    );
    if (owner) {
      setDrawerEntry({ owner, docKey: docParam as SecureDocKey });
      setTab("activity");
    }
  }, [owners]);

  /* ── Signature templates only (filter out form templates) ── */
  const sigTemplates = templates.filter((t) => t.kind === "signature");

  /* ── Build ActivityRows from owners × SIGNATURE_DOC_KEYS ── */
  const allRows: ActivityRow[] = [];
  for (const owner of owners) {
    for (const key of SIGNATURE_DOC_KEYS) {
      const entry = owner.secureDocs[key];
      if (entry.status === "not_sent") continue;
      const latest = entry.latest;

      let status: ActivityRow["status"];
      if (entry.status === "completed") {
        status = { label: "Signed", tone: "complete" };
      } else if (entry.status === "pending" && latest?.viewedAt) {
        status = { label: "Viewed", tone: "viewed" };
      } else {
        status = { label: "Awaiting", tone: "awaiting" };
      }

      allRows.push({
        id: `${owner.contactId}__${key}`,
        doc: SECURE_DOC_TYPES[key].label,
        glyph: <PenNib size={14} weight="duotone" />,
        who: owner.fullName,
        whoColor: avatarColor(owner.fullName),
        status,
        sent: fmtDate(latest?.sentAt ?? null),
        seen: latest?.viewedAt ? fmtDate(latest.viewedAt) : null,
        last: latest?.signedAt ? fmtDate(latest.signedAt) : "—",
        onOpen: () => setDrawerEntry({ owner, docKey: key }),
      });
    }
  }

  /* Sort most recently sent first. */
  allRows.sort((a, b) => {
    const aTime = owners
      .find((o) => o.contactId === a.id.split("__")[0])
      ?.secureDocs[a.id.split("__")[1] as SecureDocKey]?.latest?.sentAt ?? "";
    const bTime = owners
      .find((o) => o.contactId === b.id.split("__")[0])
      ?.secureDocs[b.id.split("__")[1] as SecureDocKey]?.latest?.sentAt ?? "";
    return bTime.localeCompare(aTime);
  });

  /* Apply search + status filter. */
  const filteredRows = allRows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.who.toLowerCase().includes(q) && !r.doc.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all") {
      if (statusFilter === "awaiting" && r.status.tone !== "awaiting") return false;
      if (statusFilter === "viewed" && r.status.tone !== "viewed") return false;
      if (statusFilter === "signed" && r.status.tone !== "complete") return false;
    }
    return true;
  });

  const activityFilters = (
    <div className={styles.actFilters}>
      <input
        type="text"
        className={styles.actSearch}
        placeholder="Search owner or document"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search signatures"
      />
      <div className={styles.actSelectWrap}>
        <CustomSelect
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.hub}>
      <HubSubTabs
        tab={tab}
        onTab={setTab}
        libraryLabel="signatures"
        crossLink={{
          label: "Need a form instead?",
          linkText: "Forms",
          href: "/admin/paperwork/forms",
        }}
        right={
          tab === "library" ? (
            <ViewToggle view={view} onView={setView} />
          ) : (
            activityFilters
          )
        }
      />

      {tab === "library" && (
        <div className={styles.libBody}>
          <HubGroupLabel>Your signatures</HubGroupLabel>

          {sigTemplates.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No signature templates yet</p>
              <p className={styles.emptyBody}>
                Create a signature template to get started. Each template becomes
                a tracked document you can send to any owner.
              </p>
            </div>
          ) : view === "cards" ? (
            <div className={styles.libGrid}>
              {sigTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  spec={{
                    kind: "signature",
                    accent: accentForSeed(t.documentKey ?? t.id),
                  }}
                  name={t.name}
                  meta={t.sentCount > 0 ? `${t.sentCount} sent` : "Not sent yet"}
                  badge={t.isReady ? undefined : "Draft"}
                  onOpen={() => router.push(`/admin/paperwork/templates/${t.id}`)}
                  actions={
                    <button
                      type="button"
                      className={styles.sendBtn}
                      onClick={() => setSendTarget(t)}
                    >
                      <PaperPlaneTilt size={13} weight="bold" />
                      Send
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <div className={styles.libList}>
              {sigTemplates.map((t) => (
                <div key={t.id} className={styles.libRow}>
                  <span className={styles.libRowGlyph}>
                    <PenNib size={15} weight="duotone" />
                  </span>
                  <span className={styles.libRowName}>{t.name}</span>
                  <span className={styles.libRowMeta}>
                    {t.sentCount > 0 ? `${t.sentCount} sent` : "Not sent yet"}
                  </span>
                  {!t.isReady && (
                    <span className={styles.libRowBadge}>Draft</span>
                  )}
                  <div className={styles.libRowActions}>
                    <button
                      type="button"
                      className={styles.libRowOpen}
                      onClick={() => router.push(`/admin/paperwork/templates/${t.id}`)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className={styles.sendBtn}
                      onClick={() => setSendTarget(t)}
                    >
                      <PaperPlaneTilt size={13} weight="bold" />
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <ActivityTable
          rows={filteredRows}
          lastLabel="Signed"
          emptyText={
            allRows.length === 0
              ? "No signatures have been sent yet. Send one from the Library tab."
              : "No results match your filters."
          }
        />
      )}

      <AnimatePresence>
        {sendTarget && (
          <SendSheet
            key={sendTarget.id}
            template={sendTarget}
            recipients={recipients}
            onClose={() => setSendTarget(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawerEntry && (
          <DocumentDrawer
            key={drawerEntry.owner.contactId}
            owner={drawerEntry.owner}
            initialDocKey={drawerEntry.docKey}
            onClose={() => setDrawerEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
