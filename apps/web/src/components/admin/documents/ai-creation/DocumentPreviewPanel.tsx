"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowCounterClockwise, ArrowRight } from "@phosphor-icons/react";
import { DocumentEditor } from "@/components/admin/paperwork/DocumentEditor";
import type { AIGeneratedIntelligence } from "./types";
import styles from "./DocumentPreviewPanel.module.css";

interface Props {
  intelligence: AIGeneratedIntelligence;
  onRefinementSubmit: (refinement: string) => void;
  onRegenerate: () => void;
  onBodyChange: (markdown: string) => void;
}

export function DocumentPreviewPanel({
  intelligence,
  onRefinementSubmit,
  onRegenerate,
  onBodyChange,
}: Props) {
  const [refinement, setRefinement] = useState("");

  function handleRefinementSubmit() {
    if (!refinement.trim()) return;
    onRefinementSubmit(refinement.trim());
    setRefinement("");
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.refinementWrap}>
        <input
          className={styles.refinementInput}
          placeholder="Refine this document…"
          value={refinement}
          onChange={(e) => setRefinement(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRefinementSubmit(); } }}
          aria-label="Refine the document"
        />
        <button
          type="button"
          className={styles.refinementBtn}
          onClick={handleRefinementSubmit}
          disabled={!refinement.trim()}
          aria-label="Apply refinement"
        >
          <ArrowRight size={13} weight="bold" />
        </button>
      </div>

      <div className={styles.documentWrap}>
        <DocumentEditor
          theme="dark"
          initialMarkdown={intelligence.documentBody}
          onChange={onBodyChange}
          placeholder="Your document will appear here…"
        />
      </div>

      <div className={styles.secondaryActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onRegenerate}>
          <ArrowCounterClockwise size={13} weight="bold" /> Regenerate
        </button>
        <span className={styles.hint}>Bold, italics, and headings are editable inline.</span>
      </div>
    </motion.div>
  );
}
