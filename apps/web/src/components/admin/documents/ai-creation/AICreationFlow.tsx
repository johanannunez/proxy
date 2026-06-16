"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AIPromptStep } from "./AIPromptStep";
import { AIGenerationStep } from "./AIGenerationStep";
import { IntelligencePanel } from "./IntelligencePanel";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
import type { AICreationStep, AIContextChips, AIGeneratedIntelligence } from "./types";
import styles from "./AICreationFlow.module.css";

interface Props {
  onExit: () => void;
  onCreated: (intelligence: AIGeneratedIntelligence) => void;
  onStepChange?: (step: AICreationStep) => void;
}

const DEFAULT_CHIPS: AIContextChips = { state: "", signers: "Owner + Proxy", category: "Agreement" };

export function AICreationFlow({ onExit, onCreated, onStepChange }: Props) {
  const [step, setStep] = useState<AICreationStep>("prompt");
  const [intelligence, setIntelligence] = useState<AIGeneratedIntelligence | null>(null);
  const [activePrompt, setActivePrompt] = useState("");
  const [activeChips, setActiveChips] = useState<AIContextChips>(DEFAULT_CHIPS);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  const handleGenerationComplete = useCallback((result: AIGeneratedIntelligence) => {
    setIntelligence(result);
    setStep("preview");
  }, []);

  function handlePromptSubmit(prompt: string, chips: AIContextChips) {
    setActivePrompt(prompt);
    setActiveChips(chips);
    setStep("generating");
  }

  function handleIntelligenceChange(updated: Partial<AIGeneratedIntelligence>) {
    setIntelligence((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  function handleRefinementSubmit(refinement: string) {
    setActivePrompt((prev) => `${prev}\n\nRefinement: ${refinement}`);
    setStep("generating");
  }

  function handleConfirm() {
    if (intelligence) onCreated(intelligence);
    onExit();
  }

  return (
    <AnimatePresence mode="wait">
      {step === "prompt" && (
        <motion.div
          key="prompt"
          className={styles.centeredContent}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <AIPromptStep onSubmit={handlePromptSubmit} />
        </motion.div>
      )}

      {step === "generating" && (
        <motion.div
          key="generating"
          className={styles.centeredContent}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <AIGenerationStep
            prompt={activePrompt}
            chips={activeChips}
            onComplete={handleGenerationComplete}
          />
        </motion.div>
      )}

      {step === "preview" && intelligence && (
        <motion.div
          key="preview"
          className={styles.splitContent}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.splitLeft}>
            <IntelligencePanel
              intelligence={intelligence}
              onChange={handleIntelligenceChange}
              onConfirm={handleConfirm}
            />
          </div>
          <div className={styles.splitRight}>
            <DocumentPreviewPanel
              intelligence={intelligence}
              onRefinementSubmit={handleRefinementSubmit}
              onRegenerate={() => setStep("generating")}
              onBodyChange={(documentBody) => handleIntelligenceChange({ documentBody })}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
