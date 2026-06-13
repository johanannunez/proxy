"use client";

/**
 * TemplatesTab — client orchestrator for the Templates tab (signature/PDF
 * masters). Owns the visual library and the send sheet. The create flow lives
 * in PaperworkShell (a centered, guarded, multi-step modal that opens
 * instantly), so this component no longer manages template creation.
 */

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { UnifiedTemplatesList } from "./UnifiedTemplatesList";
import { SendSheet } from "./SendSheet";
import type { SendRecipient, UnifiedTemplate } from "./unified-types";

export function TemplatesTab({
  templates,
  recipients,
}: {
  templates: UnifiedTemplate[];
  recipients: SendRecipient[];
}) {
  const [sendTarget, setSendTarget] = useState<UnifiedTemplate | null>(null);

  return (
    <>
      <UnifiedTemplatesList templates={templates} onSend={setSendTarget} />

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
