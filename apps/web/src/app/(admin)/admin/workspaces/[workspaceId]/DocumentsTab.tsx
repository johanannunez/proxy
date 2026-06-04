import type { ElementType } from "react";
import {
  FileText,
  FilePdf,
  Scales,
  Wallet,
  Buildings,
  CheckCircle,
  Clock,
  XCircle,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";
import type { WorkspaceDocument, WorkspaceFormData } from "@/lib/admin/workspace-documents";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { FORM_REGISTRY } from "@/lib/forms/form-registry";
import { saveFormAnswersAsAdmin } from "@/lib/forms/save-form";
import { PROPERTY_FORM_KEYS } from "@/lib/admin/documents-hub-shared";
import styles from "./DocumentsTab.module.css";

const CATEGORY_META: Record<WorkspaceDocument["category"], { label: string; icon: ElementType }> = {
  legal: { label: "Legal", icon: Scales },
  financial: { label: "Financial", icon: Wallet },
  property: { label: "Property-specific", icon: Buildings },
};

function StatusPill({ status }: { status: string }) {
  if (status === "completed" || status === "signed") {
    return (
      <span className={`${styles.pill} ${styles.pillSigned}`}>
        <CheckCircle size={12} weight="fill" />
        Signed
      </span>
    );
  }
  if (status === "expired" || status === "declined") {
    return (
      <span className={`${styles.pill} ${styles.pillExpired}`}>
        <XCircle size={12} weight="fill" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }
  return (
    <span className={`${styles.pill} ${styles.pillPending}`}>
      <Clock size={12} weight="fill" />
      Pending
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DocumentsTab({
  documents,
  forms,
}: {
  documents: WorkspaceDocument[];
  forms?: WorkspaceFormData;
}) {
  const byCategory = new Map<WorkspaceDocument["category"], WorkspaceDocument[]>();
  for (const doc of documents) {
    const list = byCategory.get(doc.category) ?? [];
    list.push(doc);
    byCategory.set(doc.category, list);
  }

  const categoryOrder: WorkspaceDocument["category"][] = ["legal", "financial", "property"];

  const formPropertyId = forms?.propertyId ?? null;
  const formProfileId = forms?.profileId ?? null;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Documents</h2>
        <p className={styles.subtitle}>Agreements, tax forms, and property-specific documents.</p>
      </div>

      {forms ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          <div className={styles.categoryHeader}>
            <FileText size={15} weight="duotone" className={styles.categoryIcon} />
            <h3 className={styles.categoryTitle}>Property forms</h3>
          </div>
          {!formPropertyId || !formProfileId ? (
            <p className={styles.subtitle}>
              This owner has no property yet, so there are no forms to complete.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {PROPERTY_FORM_KEYS.map((key) => (
                <DocumentCard
                  key={key}
                  def={FORM_REGISTRY[key]}
                  data={forms.rawForms[key] ?? {}}
                  action={saveFormAnswersAsAdmin}
                  hiddenFields={{
                    form_key: key,
                    property_id: formPropertyId,
                    profile_id: formProfileId,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {documents.length === 0 ? (
        <div className={styles.emptyState}>
          <FilePdf size={32} weight="duotone" className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No documents yet</p>
          <p className={styles.emptyBody}>
            Documents sent for signature via BoldSign will appear here automatically.
          </p>
        </div>
      ) : (
        <div className={styles.categories}>
          {categoryOrder.map((cat) => {
            const docs = byCategory.get(cat);
            if (!docs || docs.length === 0) return null;
            const { label, icon: Icon } = CATEGORY_META[cat];

            return (
              <div key={cat} className={styles.category}>
                <div className={styles.categoryHeader}>
                  <Icon size={15} weight="duotone" className={styles.categoryIcon} />
                  <h3 className={styles.categoryTitle}>{label}</h3>
                  <span className={styles.categoryCount}>{docs.length}</span>
                </div>
                <div className={styles.docList}>
                  {docs.map((doc) => (
                    <div key={doc.id} className={styles.docRow}>
                      <FileText size={16} weight="duotone" className={styles.docIcon} />
                      <div className={styles.docMain}>
                        <div className={styles.docName}>{doc.templateName}</div>
                        <div className={styles.docMeta}>
                          {doc.propertyLabel ? (
                            <span className={styles.docProperty}>{doc.propertyLabel}</span>
                          ) : null}
                          <span className={styles.docDate}>
                            {doc.signedAt
                              ? `Signed ${formatDate(doc.signedAt)}`
                              : `Sent ${formatDate(doc.createdAt)}`}
                          </span>
                        </div>
                      </div>
                      <StatusPill status={doc.status} />
                      {doc.signedPdfUrl ? (
                        <a
                          href={doc.signedPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.downloadBtn}
                          aria-label={`Download ${doc.templateName}`}
                        >
                          <DownloadSimple size={15} />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
