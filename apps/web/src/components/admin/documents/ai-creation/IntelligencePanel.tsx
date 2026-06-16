"use client";

import { motion } from "motion/react";
import { Sparkle } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import type { AIGeneratedIntelligence } from "./types";
import styles from "./IntelligencePanel.module.css";

const GATE_OPTIONS: SelectOption[] = [
  { value: "", label: "None (standalone)" },
  { value: "1", label: "Agreement (step 1)" },
  { value: "2", label: "Payment (step 2)" },
  { value: "3", label: "Banking (step 3)" },
  { value: "4", label: "Identity (step 4)" },
];

interface Props {
  intelligence: AIGeneratedIntelligence;
  onChange: (updated: Partial<AIGeneratedIntelligence>) => void;
  onConfirm: () => void;
}

export function IntelligencePanel({ intelligence, onChange, onConfirm }: Props) {
  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.badge}>
        <Sparkle size={11} weight="duotone" />
        AI-generated
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="ip-name">Template name</label>
          <input
            id="ip-name"
            className={styles.fieldInput}
            value={intelligence.templateName}
            onChange={(e) => onChange({ templateName: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="ip-key">Document key</label>
          <input
            id="ip-key"
            className={`${styles.fieldInput} ${styles.mono}`}
            value={intelligence.documentKey}
            onChange={(e) =>
              onChange({ documentKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })
            }
          />
          <p className={styles.fieldHint}>Lowercase, numbers, underscores only</p>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="ip-desc">Description</label>
          <textarea
            id="ip-desc"
            className={`${styles.fieldInput} ${styles.textarea}`}
            value={intelligence.description}
            rows={3}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Signing order</span>
          <div className={styles.signerList}>
            {intelligence.signerRoles.map((role, i) => (
              <div key={role} className={styles.signerRow}>
                <span className={styles.signerNum}>{i + 1}</span>
                <span className={styles.signerName}>{role}</span>
                {i === intelligence.signerRoles.length - 1 && (
                  <span className={styles.signerLast}>signs last</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="ip-gate">Onboarding gate</label>
          <div
            style={{
              "--color-white": "rgba(255,255,255,0.06)",
              "--cs-menu-bg": "#1b2740",
              "--color-text-primary": "rgba(255,255,255,0.88)",
              "--color-text-tertiary": "rgba(255,255,255,0.38)",
              "--color-warm-gray-200": "rgba(255,255,255,0.14)",
              "--color-warm-gray-50": "rgba(255,255,255,0.08)",
              "--color-brand": "#02aaeb",
            } as React.CSSProperties}
          >
            <CustomSelect
              id="ip-gate"
              value={intelligence.gateStep}
              onChange={(v) => onChange({ gateStep: v })}
              options={GATE_OPTIONS}
              placeholder="None (standalone)"
            />
          </div>
        </div>
      </div>

      <div className={styles.confirmArea}>
        <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
          Save and place fields
        </button>
        <p className={styles.confirmHint}>Opens DocuSeal to add signature fields</p>
      </div>
    </motion.div>
  );
}
