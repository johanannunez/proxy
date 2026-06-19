"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkle, ArrowRight, Check } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import type { FormField, Form } from "@/lib/admin/forms-types";
import { FORM_ICONS, FORM_TINTS } from "@/app/(admin)/admin/paperwork/forms/form-icon";
import { ColorOrb } from "@/components/admin/documents/ai-creation/ColorOrb";
import { GenerationProgress } from "@/components/admin/documents/ai-creation/GenerationProgress";
import { FormRenderer } from "@/components/forms/FormRenderer";
import styles from "./FormAIFlow.module.css";

const AUDIENCE_OPTIONS: SelectOption[] = [
  { value: "", label: "Anyone" },
  { value: "Property owner / landlord", label: "Property owner" },
  { value: "Guest / renter", label: "Guest / renter" },
  { value: "Internal team / inspector", label: "Internal team" },
];

const GENERATION_LABELS = [
  "Reading your description",
  "Drafting questions",
  "Choosing field types",
  "Marking what's required",
  "Naming and theming",
];
const N = GENERATION_LABELS.length;

type Step = "prompt" | "generating" | "review";

interface AIPayload {
  fields: FormField[];
  name: string;
  icon: string | null;
  iconColor: string | null;
}

interface Props {
  onExit: () => void;
  onCreated: (input: {
    name: string;
    fields: FormField[];
    icon: string | null;
    iconColor: string | null;
  }) => Promise<void>;
  onStepChange?: (step: Step) => void;
}

export function FormAIFlow({ onExit: _onExit, onCreated, onStepChange }: Props) {
  const [step, setStep] = useState<Step>("prompt");
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [formName, setFormName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [icon, setIcon] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs for dual-gate: animation done + API result both required before advancing.
  const apiResultRef = useRef<AIPayload | null>(null);
  const animationDoneRef = useRef(false);
  const completedRef = useRef(false);

  // Stable ref so maybeFinish can call the latest state setters without re-creating.
  const applyPayloadRef = useRef<(payload: AIPayload) => void>(() => {});
  applyPayloadRef.current = (payload: AIPayload) => {
    setFields(payload.fields);
    setFormName(payload.name);
    setIcon(payload.icon);
    setIconColor(payload.iconColor);
    setStep("review");
  };

  // Reset all state on mount (host controls visibility via remount).
  useEffect(() => {
    setStep("prompt");
    setPrompt("");
    setAudience("");
    setFormName("");
    setFields([]);
    setIcon(null);
    setIconColor(null);
    setError(null);
    setConfirming(false);
    setProgress(0);
    setLabel("");
    setFinalizing(false);
    apiResultRef.current = null;
    animationDoneRef.current = false;
    completedRef.current = false;
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  // Notify host whenever step changes.
  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  // Complete only when BOTH the API result and the animation are done. The
  // bar holds at 90% (with a "Finalizing…" label) while the API is still
  // working, then snaps to 100% so the line never reads "done" while thinking.
  const maybeFinish = useCallback(() => {
    if (completedRef.current) return;
    if (apiResultRef.current !== null && animationDoneRef.current) {
      completedRef.current = true;
      setFinalizing(false);
      setProgress(100);
      const payload = apiResultRef.current;
      window.setTimeout(() => applyPayloadRef.current(payload), 320);
    }
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setError(null);
    // Reset gates before entering generating step.
    apiResultRef.current = null;
    animationDoneRef.current = false;
    completedRef.current = false;
    setFinalizing(false);
    setProgress(0);
    setLabel(GENERATION_LABELS[0]);
    setStep("generating");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const res = await fetch("/api/admin/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt.trim(), context: audience || undefined }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok || !data.fields) {
        setError(data.error ?? "Generation failed. Try again.");
        setStep("prompt");
        return;
      }

      const generated = data.fields as FormField[];

      // Resolve the name here while `prompt` is in scope.
      const sectionLabel = generated.find((f) => f.type === "section_header")?.label;
      const fallback = (sectionLabel ?? prompt.trim()).slice(0, 60).trimEnd();
      const resolvedName =
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : fallback.charAt(0).toUpperCase() + fallback.slice(1);

      apiResultRef.current = {
        fields: generated,
        name: resolvedName,
        icon: typeof data.icon === "string" ? data.icon : null,
        iconColor: typeof data.iconColor === "string" ? data.iconColor : null,
      };
      maybeFinish();
    } catch (err) {
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Took too long. Try a shorter description."
        : "Network error. Try again.";
      setError(msg);
      setStep("prompt");
    }
  }

  // Drive the progress bar label loop while generating.
  useEffect(() => {
    if (step !== "generating") return;
    const cancelled = { value: false };

    async function runSteps() {
      // Labeled work animates the bar to 90% only — the last 10% is reserved
      // for real completion, so the bar can't claim "done" while the API works.
      for (let i = 0; i < N; i++) {
        if (cancelled.value) return;
        setLabel(GENERATION_LABELS[i]);
        setProgress(Math.round(((i + 1) / N) * 90));
        await new Promise<void>((r) => setTimeout(r, 600));
      }
      await new Promise<void>((r) => setTimeout(r, 250));
      if (cancelled.value) return;
      animationDoneRef.current = true;
      // API still running → hold at 90% with a real "still working" label.
      if (apiResultRef.current === null) setFinalizing(true);
      maybeFinish();
    }

    runSteps();
    return () => { cancelled.value = true; };
  }, [step, maybeFinish]);

  async function handleConfirm() {
    if (confirming || !formName.trim()) return;
    setError(null);
    setConfirming(true);
    try {
      await onCreated({ name: formName.trim(), fields, icon, iconColor });
      // Success: the host closes the gallery and navigates away. Keep the
      // finalizing view mounted until unmount so the review never flashes
      // back during the modal's exit animation.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the form.");
      setConfirming(false);
    }
  }

  const questionCount = fields.filter(
    (f) => !["section_header", "description", "divider"].includes(f.type),
  ).length;

  // Build a full Form object for FormRenderer preview (only schema.fields + schema.settings are read).
  const liveForm = useMemo<Form>(() => ({
    id: "",
    agency_id: "",
    name: formName,
    description: null,
    schema: { version: 1, fields, settings: {} },
    is_public: false,
    slug: null,
    is_active: false,
    created_by: null,
    tracked: false,
    category: null,
    archived_at: null,
    icon,
    icon_color: iconColor,
    created_at: "",
    updated_at: "",
  }), [fields, formName, icon, iconColor]);

  return (
    <AnimatePresence mode="wait">
      {step === "prompt" && (
        <motion.div
          key="prompt"
          className={styles.step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.badge}>
            <Sparkle size={13} weight="duotone" />
            Generate with AI
          </div>
          <h2 className={styles.title}>Describe your form</h2>
          <p className={styles.subtitle}>
            Tell us what you need and AI will generate the questions for you.
          </p>

          <div className={styles.inputWrap}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder="e.g. Guest check-in survey asking about their stay, cleanliness, and recommendations"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              rows={4}
            />
          </div>

          <div
            className={styles.chips}
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
            <span className={styles.chipLabel}>Audience</span>
            <div className={styles.chipSelectWrap}>
              <CustomSelect
                value={audience}
                onChange={setAudience}
                options={AUDIENCE_OPTIONS}
                placeholder="Anyone"
              />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={!prompt.trim()}
          >
            Generate form <ArrowRight size={15} weight="bold" />
          </button>

          <p className={styles.hint}>
            <kbd className={styles.kbd}>⌘</kbd>
            <kbd className={styles.kbd}>Enter</kbd>
            to generate
          </p>
        </motion.div>
      )}

      {step === "generating" && (
        <motion.div
          key="generating"
          className={`${styles.step} ${styles.stepCenter}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.genOrbWrap}>
            <ColorOrb size={72} />
            <GenerationProgress
              value={progress}
              label={finalizing ? "Finalizing your form…" : label}
            />
          </div>
          <h2 className={styles.title}>Building your form…</h2>
          <p className={styles.subtitle}>
            Generating questions based on your description.
          </p>
        </motion.div>
      )}

      {step === "review" && !confirming && (
        <motion.div
          key="review"
          className={`${styles.step} ${styles.stepWide}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.badge}>
            <Check size={13} weight="bold" />
            {questionCount} {questionCount === 1 ? "question" : "questions"} generated
          </div>
          <h2 className={styles.reviewTitle}>Review your form</h2>

          <div className={styles.nameField}>
            <label className={styles.nameLabel} htmlFor="form-ai-name">Form name</label>
            <div className={styles.nameRow}>
              {(() => {
                const iconEntry = FORM_ICONS.find((e) => e.key === icon) ?? FORM_ICONS[0];
                const tintEntry = FORM_TINTS.find((e) => e.key === iconColor) ?? FORM_TINTS[0];
                const IconCmp = iconEntry.Icon;
                return (
                  <span
                    className={styles.iconChip}
                    style={{ background: tintEntry.bg, color: tintEntry.fg }}
                    title={`${iconEntry.label} icon`}
                  >
                    <IconCmp size={18} weight="duotone" />
                  </span>
                );
              })()}
              <input
                id="form-ai-name"
                className={styles.nameInput}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.previewSheet}>
            <FormRenderer form={liveForm} preview />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.reviewActions}>
            <button
              type="button"
              className={styles.regenerateBtn}
              onClick={() => setStep("prompt")}
            >
              Regenerate
            </button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={!formName.trim()}
            >
              Create form <Check size={14} weight="bold" />
            </button>
          </div>
        </motion.div>
      )}

      {step === "review" && confirming && (
        <motion.div
          key="finalizing"
          className={`${styles.step} ${styles.stepCenter}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.genOrbWrap}>
            <ColorOrb size={72} />
            <p className={styles.subtitle}>Finalizing your form…</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
