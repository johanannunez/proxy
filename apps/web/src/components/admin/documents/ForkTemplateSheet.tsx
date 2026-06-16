"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, GitFork } from "@phosphor-icons/react";
import type { ProxyTemplateRecord } from "./ai-creation/types";
import styles from "./ForkTemplateSheet.module.css";

interface Props {
  template: ProxyTemplateRecord | null;
  onClose: () => void;
  onFork: (name: string) => void;
}

export function ForkTemplateSheet({ template, onClose, onFork }: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (template) setName(template.name);
  }, [template]);

  function handleConfirm() {
    if (!name.trim()) return;
    onFork(name.trim());
    onClose();
  }

  return (
    <AnimatePresence>
      {template && (
        <>
          <motion.div
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className={styles.sheet}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            role="dialog"
            aria-modal
            aria-labelledby="fork-title"
          >
            <div className={styles.header}>
              <div>
                <h3 id="fork-title" className={styles.title}>Fork to customize</h3>
                <p className={styles.subtitle}>&ldquo;{template.name}&rdquo;</p>
              </div>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
                <X size={14} weight="bold" />
              </button>
            </div>

            <div className={styles.body}>
              <label className={styles.label} htmlFor="fork-name">Name your copy</label>
              <input
                id="fork-name"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                autoFocus
              />
              <p className={styles.hint}>
                A copy appears in Your Templates. The Proxy original stays unchanged.
              </p>
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                type="button"
                className={styles.forkBtn}
                onClick={handleConfirm}
                disabled={!name.trim()}
              >
                <GitFork size={13} weight="bold" /> Fork template
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
