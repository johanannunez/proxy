"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle } from "@phosphor-icons/react";
import { CreateTemplateSlideOver } from "./CreateTemplateSlideOver";
import { DocuSealBuilderView } from "./DocuSealBuilderView";
import { activateTemplate } from "./template-actions";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./TemplatesHub.module.css";

type Props = {
  systemTemplates: DocumentTemplate[];
  customTemplates: DocumentTemplate[];
};

type Phase = "list" | "builder";

export function TemplatesHub({ systemTemplates, customTemplates }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [phase, setPhase] = useState<Phase>("list");
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function handleTemplateCreated(template: DocumentTemplate) {
    setShowCreate(false);
    setActiveTemplate(template);
    setPhase("builder");
  }

  function openBuilder(template: DocumentTemplate) {
    setActiveTemplate(template);
    setPhase("builder");
  }

  async function handleBuilderSave() {
    if (!activeTemplate) return;
    await activateTemplate(activeTemplate.id);
    setSavedId(activeTemplate.id);
    setPhase("list");
    setActiveTemplate(null);
    router.refresh();
  }

  function handleBuilderBack() {
    setPhase("list");
    setActiveTemplate(null);
  }

  if (phase === "builder" && activeTemplate?.docuseal_template_id) {
    return (
      <DocuSealBuilderView
        templateId={activeTemplate.docuseal_template_id}
        templateName={activeTemplate.display_name}
        onSave={handleBuilderSave}
        onBack={handleBuilderBack}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <div className={styles.headerText}>
          <h1 className={styles.pageTitle}>Document Templates</h1>
          <p className={styles.pageSubtitle}>
            Manage the document types used in the owner onboarding flow.
          </p>
        </div>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} weight="bold" />
          New Template
        </button>
      </div>

      {savedId && (
        <div className={styles.successBanner}>
          <CheckCircle size={16} weight="duotone" className={styles.successIcon} />
          Template saved and active. Refreshing list…
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Proxy Library</h2>
          <span className={styles.sectionCount}>{systemTemplates.length}</span>
        </div>
        {systemTemplates.length === 0 ? (
          <p className={styles.empty}>No system templates found.</p>
        ) : (
          <div className={styles.templateList}>
            {systemTemplates.map((t) => (
              <TemplateRow key={t.id} template={t} onEdit={() => openBuilder(t)} />
            ))}
          </div>
        )}
      </section>

      {customTemplates.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Custom Templates</h2>
            <span className={styles.sectionCount}>{customTemplates.length}</span>
          </div>
          <div className={styles.templateList}>
            {customTemplates.map((t) => (
              <TemplateRow key={t.id} template={t} onEdit={() => openBuilder(t)} />
            ))}
          </div>
        </section>
      )}

      <CreateTemplateSlideOver
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onTemplateCreated={handleTemplateCreated}
      />
    </div>
  );
}

function TemplateRow({
  template,
  onEdit,
}: {
  template: DocumentTemplate;
  onEdit: () => void;
}) {
  const isReady = template.docuseal_template_id !== null && template.is_active;
  const canEdit = template.docuseal_template_id !== null;

  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <span className={styles.rowName}>{template.display_name}</span>
        <span className={styles.rowKey}>{template.document_key}</span>
      </div>
      <div className={styles.rowMeta}>
        <span className={styles.rowRoles}>{template.signer_roles.join(", ")}</span>
        <span
          className={`${styles.badge} ${isReady ? styles.badgeReady : styles.badgeDraft}`}
        >
          {isReady ? "Ready" : "Draft"}
        </span>
      </div>
      <button
        type="button"
        className={styles.editBtn}
        onClick={onEdit}
        disabled={!canEdit}
        title={!canEdit ? "Upload a PDF first to build the template layout" : "Edit field layout"}
      >
        Edit layout
      </button>
    </div>
  );
}
