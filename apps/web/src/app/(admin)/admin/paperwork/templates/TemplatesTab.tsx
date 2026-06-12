"use client";

/**
 * TemplatesTab — client orchestrator for the Templates tab (signature/PDF
 * masters). Owns the list, the send sheet, and the PDF-upload slide-over
 * (auto-opened by the create chooser via ?create=pdf). New signature
 * templates land on their detail page to place fields.
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { CreateTemplateSlideOver } from "./CreateTemplateSlideOver";
import { UnifiedTemplatesList } from "./UnifiedTemplatesList";
import { SendSheet } from "./SendSheet";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import type { SendRecipient, UnifiedTemplate } from "./unified-types";

export function TemplatesTab({
  templates,
  recipients,
}: {
  templates: UnifiedTemplate[];
  recipients: SendRecipient[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(
    () => searchParams.get("create") === "pdf",
  );
  const [sendTarget, setSendTarget] = useState<UnifiedTemplate | null>(null);

  function handleTemplateCreated(template: DocumentTemplate) {
    setCreateOpen(false);
    router.push(`/admin/paperwork/templates/${template.id}`);
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    if (searchParams.get("create") === "pdf") {
      router.replace("/admin/paperwork/templates");
    }
  }

  return (
    <>
      <UnifiedTemplatesList templates={templates} onSend={setSendTarget} />

      <CreateTemplateSlideOver
        open={createOpen}
        onClose={handleCloseCreate}
        onTemplateCreated={handleTemplateCreated}
      />

      <AnimatePresence>
        {sendTarget && (
          <SendSheet
            template={sendTarget}
            recipients={recipients}
            onClose={() => setSendTarget(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
