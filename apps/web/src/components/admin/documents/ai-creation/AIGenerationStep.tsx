"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { ColorOrb } from "./ColorOrb";
import { GenerationProgress } from "./GenerationProgress";
import { AGENT_STEPS, MOCK_GENERATED } from "./mock-ai";
import type { AIGeneratedIntelligence, AIContextChips } from "./types";
import styles from "./AIGenerationStep.module.css";

interface Props {
  prompt: string;
  chips: AIContextChips;
  onComplete: (result: AIGeneratedIntelligence) => void;
}

const N = AGENT_STEPS.length;

export function AIGenerationStep({ prompt, chips, onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState(AGENT_STEPS[0].label);
  const [finalizing, setFinalizing] = useState(false);

  const apiResultRef = useRef<AIGeneratedIntelligence | null>(null);
  const animationDoneRef = useRef(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Complete only when BOTH the API result and the animation are done. The
  // bar holds at 90% (with a "Finalizing…" label) until the API returns, then
  // snaps to 100% so it never reads "done" while still working.
  const complete = useCallback(() => {
    if (completedRef.current) return;
    if (apiResultRef.current !== null && animationDoneRef.current) {
      completedRef.current = true;
      setFinalizing(false);
      setProgress(100);
      const result = apiResultRef.current;
      window.setTimeout(() => onCompleteRef.current(result ?? MOCK_GENERATED), 320);
    }
  }, []);

  // Fire the real API call immediately, store result in ref.
  useEffect(() => {
    let cancelled = false;

    async function fetchTemplate() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        const res = await fetch("/api/ai/generate-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, chips }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data: AIGeneratedIntelligence = res.ok
          ? await res.json()
          : MOCK_GENERATED;
        if (cancelled) return;
        apiResultRef.current = data;
      } catch {
        if (!cancelled) apiResultRef.current = MOCK_GENERATED;
      }

      if (!cancelled) complete();
    }

    fetchTemplate();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnimationDone = useCallback(() => {
    animationDoneRef.current = true;
    // API still running → hold at 90% with a real "still working" label.
    if (apiResultRef.current === null) setFinalizing(true);
    complete();
  }, [complete]);

  // Drive the progress bar across the activity labels. Labeled work animates
  // to 90% only; the final 10% is reserved for real completion.
  const runSteps = useCallback(async (cancelled: { value: boolean }) => {
    for (let i = 0; i < N; i++) {
      if (cancelled.value) return;
      setLabel(AGENT_STEPS[i].label);
      setProgress(Math.round(((i + 1) / N) * 90));
      await new Promise((r) => setTimeout(r, 650));
    }
    await new Promise((r) => setTimeout(r, 250));
    if (!cancelled.value) handleAnimationDone();
  }, [handleAnimationDone]);

  useEffect(() => {
    const cancelled = { value: false };
    runSteps(cancelled);
    return () => { cancelled.value = true; };
  }, [runSteps]);

  return (
    <motion.div
      className={styles.step}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.cpu}>
        <ColorOrb size={72} />
      </div>
      <GenerationProgress
        value={progress}
        label={finalizing ? "Finalizing your document…" : label}
      />
    </motion.div>
  );
}
