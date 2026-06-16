"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import { ColorOrb } from "./ColorOrb";
import { EXAMPLE_PROMPTS } from "./mock-ai";
import type { AIContextChips } from "./types";
import styles from "./AIPromptStep.module.css";

interface Props {
  onSubmit: (prompt: string, chips: AIContextChips) => void;
}

const STATE_OPTIONS: SelectOption[] = [
  { value: "", label: "Any state" },
  { value: "Alabama", label: "Alabama" },
  { value: "Alaska", label: "Alaska" },
  { value: "Arizona", label: "Arizona" },
  { value: "Arkansas", label: "Arkansas" },
  { value: "California", label: "California" },
  { value: "Colorado", label: "Colorado" },
  { value: "Connecticut", label: "Connecticut" },
  { value: "Delaware", label: "Delaware" },
  { value: "Florida", label: "Florida" },
  { value: "Georgia", label: "Georgia" },
  { value: "Hawaii", label: "Hawaii" },
  { value: "Idaho", label: "Idaho" },
  { value: "Illinois", label: "Illinois" },
  { value: "Indiana", label: "Indiana" },
  { value: "Iowa", label: "Iowa" },
  { value: "Kansas", label: "Kansas" },
  { value: "Kentucky", label: "Kentucky" },
  { value: "Louisiana", label: "Louisiana" },
  { value: "Maine", label: "Maine" },
  { value: "Maryland", label: "Maryland" },
  { value: "Massachusetts", label: "Massachusetts" },
  { value: "Michigan", label: "Michigan" },
  { value: "Minnesota", label: "Minnesota" },
  { value: "Mississippi", label: "Mississippi" },
  { value: "Missouri", label: "Missouri" },
  { value: "Montana", label: "Montana" },
  { value: "Nebraska", label: "Nebraska" },
  { value: "Nevada", label: "Nevada" },
  { value: "New Hampshire", label: "New Hampshire" },
  { value: "New Jersey", label: "New Jersey" },
  { value: "New Mexico", label: "New Mexico" },
  { value: "New York", label: "New York" },
  { value: "North Carolina", label: "North Carolina" },
  { value: "North Dakota", label: "North Dakota" },
  { value: "Ohio", label: "Ohio" },
  { value: "Oklahoma", label: "Oklahoma" },
  { value: "Oregon", label: "Oregon" },
  { value: "Pennsylvania", label: "Pennsylvania" },
  { value: "Rhode Island", label: "Rhode Island" },
  { value: "South Carolina", label: "South Carolina" },
  { value: "South Dakota", label: "South Dakota" },
  { value: "Tennessee", label: "Tennessee" },
  { value: "Texas", label: "Texas" },
  { value: "Utah", label: "Utah" },
  { value: "Vermont", label: "Vermont" },
  { value: "Virginia", label: "Virginia" },
  { value: "Washington", label: "Washington" },
  { value: "West Virginia", label: "West Virginia" },
  { value: "Wisconsin", label: "Wisconsin" },
  { value: "Wyoming", label: "Wyoming" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Agreement", label: "Agreement" },
  { value: "Addendum", label: "Addendum" },
  { value: "Authorization", label: "Authorization" },
  { value: "Policy", label: "Policy" },
  { value: "Disclosure", label: "Disclosure" },
];

const SIGNERS_OPTIONS: SelectOption[] = [
  { value: "Owner + Proxy", label: "Owner + You" },
  { value: "Owner only", label: "Owner only" },
  { value: "Tenant + Owner", label: "Tenant + Owner" },
  { value: "Tenant + Owner + Proxy", label: "Tenant + Owner + You" },
];

export function AIPromptStep({ onSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState("");
  const [signers, setSigners] = useState("Owner + Proxy");
  const [category, setCategory] = useState("Agreement");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  function handleExampleClick(example: string) {
    setPrompt(example);
    textareaRef.current?.focus();
  }

  function handleSubmit() {
    if (!prompt.trim()) return;
    onSubmit(prompt.trim(), { state, signers, category });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <motion.div
      className={styles.step}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.header}>
        <ColorOrb size={30} />
        <div>
          <h2 className={styles.title}>Generate a signature template</h2>
          <p className={styles.subtitle}>Describe the document you need and AI will write the full agreement.</p>
        </div>
      </div>

      <div className={`${styles.inputWrap} ${focused ? styles.inputFocused : ""}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="e.g. Rental host agreement for Airbnb and VRBO — owner signs, I countersign"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          rows={4}
          aria-label="Describe the signature document you need"
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          aria-label="Generate template"
        >
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>

      <div
        className={styles.chips}
        role="group"
        aria-label="Document context"
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
        <span className={styles.chipLabel}>State</span>
        <div className={styles.chipSelectWrap}>
          <CustomSelect
            value={state}
            onChange={setState}
            options={STATE_OPTIONS}
            placeholder="Any state"
          />
        </div>
        <span className={styles.chipLabel}>Signers</span>
        <div className={styles.chipSelectWrap}>
          <CustomSelect
            value={signers}
            onChange={setSigners}
            options={SIGNERS_OPTIONS}
          />
        </div>
        <span className={styles.chipLabel}>Category</span>
        <div className={styles.chipSelectWrap}>
          <CustomSelect
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS}
          />
        </div>
      </div>

      <div className={styles.examples}>
        <span className={styles.examplesLabel}>
          <Sparkle size={12} weight="duotone" /> Example prompts
        </span>
        <div className={styles.exampleList}>
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              type="button"
              className={styles.exampleChip}
              onClick={() => handleExampleClick(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.hint}>
        <kbd className={styles.kbd}>⌘</kbd>
        <kbd className={styles.kbd}>Enter</kbd>
        to generate
      </p>
    </motion.div>
  );
}
