"use client";

import { motion } from "motion/react";
import { Lock, GitFork, FileText } from "@phosphor-icons/react";
import type { ProxyTemplateRecord } from "./ai-creation/types";
import styles from "./ProxyTemplateCard.module.css";

interface Props {
  template: ProxyTemplateRecord;
  onFork: (template: ProxyTemplateRecord) => void;
}

export function ProxyTemplateCard({ template, onFork }: Props) {
  return (
    <motion.div
      className={styles.card}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.cardTop}>
        <div className={styles.iconWrap}>
          <FileText size={18} weight="duotone" />
        </div>
        <div className={styles.badges}>
          <span className={styles.lockBadge}>
            <Lock size={9} weight="bold" /> Proxy
          </span>
          <span className={styles.catBadge}>{template.category}</span>
        </div>
      </div>

      <h3 className={styles.name}>{template.name}</h3>
      <p className={styles.description}>{template.description}</p>

      <div className={styles.signerRow}>
        {template.signerRoles.map((role, i) => (
          <span key={role} className={styles.signer}>
            {i > 0 && <span className={styles.arrow}>→</span>}
            {role}
          </span>
        ))}
      </div>

      <button
        type="button"
        className={styles.forkBtn}
        onClick={() => onFork(template)}
      >
        <GitFork size={13} weight="bold" /> Fork to customize
      </button>
    </motion.div>
  );
}
