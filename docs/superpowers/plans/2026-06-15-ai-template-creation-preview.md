# AI Template Creation Flow — Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully interactive preview of the AI template creation flow in a git worktree at port 4010, using real Supabase data for "Your Templates" and mock data for the generation animation.

**Architecture:** `TemplatesHubClient` replaces `TemplatesTab` as the hub orchestrator. It owns two sections (Proxy Templates / Your Templates) and the `AICreationOverlay`. The overlay is a 4-step state machine (prompt → generation → preview → confirm) rendered as a fullscreen overlay via `AnimatePresence`. All AI generation is mocked with a simulated delay and a predefined document output. No API calls are made from the overlay.

**Tech Stack:** Next.js App Router, React 19, motion/react, CSS Modules, Tailwind v4, Phosphor Icons (`@phosphor-icons/react`)

**Run command (from `apps/web/` in the worktree):**
```bash
doppler run -- next dev -p 4010
```

---

## File Map

All new files live under `apps/web/src/` unless noted.

**New:**
- `components/admin/documents/ai-creation/types.ts`
- `components/admin/documents/ai-creation/mock-ai.ts`
- `components/admin/documents/ai-creation/ColorOrb.tsx` + `.module.css`
- `components/admin/documents/ai-creation/CPUBackdrop.tsx` + `.module.css`
- `components/admin/documents/ai-creation/AgentPlanSteps.tsx` + `.module.css`
- `components/admin/documents/ai-creation/AIPromptStep.tsx` + `.module.css`
- `components/admin/documents/ai-creation/AIGenerationStep.tsx` + `.module.css`
- `components/admin/documents/ai-creation/IntelligencePanel.tsx` + `.module.css`
- `components/admin/documents/ai-creation/DocumentPreviewPanel.tsx` + `.module.css`
- `components/admin/documents/ai-creation/AICreationOverlay.tsx` + `.module.css`
- `components/admin/documents/ai-creation/index.ts`
- `components/admin/documents/ProxyTemplateCard.tsx` + `.module.css`
- `components/admin/documents/ForkTemplateSheet.tsx` + `.module.css`
- `app/(admin)/admin/paperwork/templates/TemplatesHubClient.tsx` + `.module.css`

**Modified:**
- `app/(admin)/admin/paperwork/templates/page.tsx` — swap `TemplatesTab` for `TemplatesHubClient`, inject mock Proxy Templates

---

## Task 1: Create worktree and branch

**Files:** (shell only)

- [ ] **Step 1: Create the worktree**

Run from `/Users/johanannunez/workspace/proxy`:
```bash
git worktree add ../proxy-worktrees/ai-template-preview -b preview/ai-template-creation
```

- [ ] **Step 2: Verify structure**

```bash
ls ../proxy-worktrees/ai-template-preview/apps/web/src/
```
Expected: `app/  components/  lib/  middleware.ts  proxy.ts  types/`

- [ ] **Step 3: Confirm dev server starts**

```bash
cd ../proxy-worktrees/ai-template-preview/apps/web
doppler run -- next dev -p 4010
```
Expected: `Ready on http://localhost:4010`

Stop the server after confirming (Ctrl+C). All subsequent tasks work on worktree files.

---

## Task 2: Shared types and mock AI module

**Files:**
- Create: `components/admin/documents/ai-creation/types.ts`
- Create: `components/admin/documents/ai-creation/mock-ai.ts`

- [ ] **Step 1: Write types**

```typescript
// components/admin/documents/ai-creation/types.ts

export type AICreationStep = "prompt" | "generating" | "preview" | "confirm";

export type AIContextChips = {
  state: string;
  signers: string;
  category: string;
};

export type AIGeneratedIntelligence = {
  templateName: string;
  documentKey: string;
  description: string;
  signerRoles: string[];
  gateStep: string;
  documentBody: string;
};

export type AgentStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done";
};

export type ProxyTemplateRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  signerRoles: string[];
  gateStep: string;
  previewSnippet: string;
};
```

- [ ] **Step 2: Write mock AI module**

```typescript
// components/admin/documents/ai-creation/mock-ai.ts

import type { AIGeneratedIntelligence, AgentStep } from "./types";

export const AGENT_STEPS: AgentStep[] = [
  { id: "analyze", label: "Analyzing document type", status: "pending" },
  { id: "draft", label: "Drafting document structure", status: "pending" },
  { id: "clauses", label: "Applying property law clauses", status: "pending" },
  { id: "signers", label: "Configuring signers and gate step", status: "pending" },
  { id: "intelligence", label: "Filling template intelligence", status: "pending" },
];

export const MOCK_GENERATED: AIGeneratedIntelligence = {
  templateName: "Short-Term Rental Agreement",
  documentKey: "short_term_rental_agreement",
  description:
    "Governs short-term rentals listed on Airbnb and VRBO. Covers rental period, payment, house rules, and liability. Signed by Owner then countersigned by Proxy.",
  signerRoles: ["Owner", "Proxy"],
  gateStep: "1",
  documentBody: `SHORT-TERM RENTAL AGREEMENT

This Short-Term Rental Agreement ("Agreement") is entered into as of the date of last signature below, between the property owner ("Owner") and Proxy Co-Hosting, LLC ("Proxy"), acting as the authorized co-host and property manager.

1. PROPERTY
   The property subject to this agreement is located at the address on file with Proxy ("Property"). Owner authorizes Proxy to list and manage the Property on short-term rental platforms including Airbnb and VRBO.

2. RENTAL PERIOD AND RATES
   Proxy shall manage bookings for nightly stays not to exceed thirty (30) consecutive nights per guest. Nightly rates, cleaning fees, and platform fees shall be set by Proxy in accordance with dynamic pricing guidelines agreed upon separately.

3. OWNER OBLIGATIONS
   Owner shall maintain the Property in a clean, safe, and rentable condition. Owner shall provide access to the Property and ensure all appliances, utilities, and amenities are functional prior to each guest check-in.

4. PROXY OBLIGATIONS
   Proxy shall handle guest communications, booking management, check-in coordination, and post-stay reviews. Proxy shall remit net rental proceeds to Owner within five (5) business days of each guest checkout, less the management fee.

5. MANAGEMENT FEE
   Owner agrees to pay Proxy a management fee of [__]% of gross rental revenue, as specified in the separately executed Management Fee Schedule.

6. UNAUTHORIZED SUBLETTING
   Owner shall not enter into any separate rental agreements for the Property during active Proxy management periods without prior written consent from Proxy.

7. LIABILITY
   Owner assumes full liability for the condition of the Property. Proxy shall not be held liable for guest damages beyond the security deposit amount collected. Owner is encouraged to maintain short-term rental insurance.

8. TERMINATION
   Either party may terminate this Agreement with thirty (30) days written notice. Outstanding bookings at time of termination shall be honored unless mutually agreed otherwise.

9. GOVERNING LAW
   This Agreement shall be governed by the laws of the state in which the Property is located.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date below.`,
};

export const PROXY_TEMPLATES: import("./types").ProxyTemplateRecord[] = [
  {
    id: "proxy-1",
    name: "Short-Term Rental Agreement",
    description: "Governs Airbnb and VRBO listings. Covers rental period, payment, and liability.",
    category: "Agreement",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "1",
    previewSnippet: "This Short-Term Rental Agreement is entered into between the property owner and Proxy Co-Hosting, LLC...",
  },
  {
    id: "proxy-2",
    name: "Pet Damage Addendum",
    description: "Supplements the rental agreement for properties that allow pets. Defines damage liability and deposit terms.",
    category: "Addendum",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "1",
    previewSnippet: "This addendum modifies the Short-Term Rental Agreement to address pet-related damage and liability...",
  },
  {
    id: "proxy-3",
    name: "Owner Authorization Letter",
    description: "Authorizes Proxy to list the property on OTAs and act on the owner's behalf.",
    category: "Authorization",
    signerRoles: ["Owner"],
    gateStep: "2",
    previewSnippet: "I, the undersigned property owner, hereby authorize Proxy Co-Hosting, LLC to list and manage...",
  },
  {
    id: "proxy-4",
    name: "Move-In Inspection Checklist",
    description: "Documents property condition at the start of a management relationship.",
    category: "Policy",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "3",
    previewSnippet: "This checklist documents the agreed-upon condition of the property at the commencement of management...",
  },
  {
    id: "proxy-5",
    name: "Management Fee Schedule",
    description: "Defines commission rate, cleaning fee split, and payout schedule.",
    category: "Agreement",
    signerRoles: ["Owner", "Proxy"],
    gateStep: "2",
    previewSnippet: "Owner agrees to pay Proxy a management fee as specified herein, calculated as a percentage of gross...",
  },
];

export const EXAMPLE_PROMPTS = [
  "Short-term rental agreement for Airbnb hosts in Nevada, owner and I both sign",
  "Pet damage addendum with owner liability clause",
  "Owner authorization letter to list on Airbnb, VRBO, and direct booking",
];
```

- [ ] **Step 3: Commit**

```bash
cd apps/web
git add src/components/admin/documents/ai-creation/types.ts src/components/admin/documents/ai-creation/mock-ai.ts
git commit -m "feat(ai-templates): add types and mock AI generation data"
```

---

## Task 3: ColorOrb component

**Files:**
- Create: `components/admin/documents/ai-creation/ColorOrb.tsx`
- Create: `components/admin/documents/ai-creation/ColorOrb.module.css`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/documents/ai-creation/ColorOrb.tsx
"use client";

interface Props {
  size?: number;
  className?: string;
}

export function ColorOrb({ size = 32, className = "" }: Props) {
  return (
    <div
      className={`color-orb-proxy ${className}`}
      style={{ width: size, height: size } as React.CSSProperties}
      aria-hidden
    />
  );
}
```

- [ ] **Step 2: Write the CSS Module**

```css
/* components/admin/documents/ai-creation/ColorOrb.module.css */
/* Not used — styles injected via globals to allow @property and @keyframes */
```

- [ ] **Step 3: Add orb styles to the worktree's globals.css**

Open `apps/web/src/app/globals.css` and add at the very end:

```css
/* ─── AI Template Creation: ColorOrb ─── */
@property --orb-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.color-orb-proxy {
  border-radius: 50%;
  background:
    conic-gradient(
      from calc(var(--orb-angle) * 2) at 25% 70%,
      #0ea5e9, transparent 20% 80%, #0ea5e9
    ),
    conic-gradient(
      from calc(var(--orb-angle) * -3) at 80% 20%,
      #1b77be, transparent 40% 60%, #1b77be
    ),
    conic-gradient(
      from calc(var(--orb-angle) * 1) at 15% 5%,
      #02aaeb, transparent 10% 90%, #02aaeb
    );
  filter: blur(2px) contrast(1.8);
  animation: orb-spin 18s linear infinite;
  flex-shrink: 0;
}

@keyframes orb-spin {
  to { --orb-angle: 360deg; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/documents/ai-creation/ColorOrb.tsx src/app/globals.css
git commit -m "feat(ai-templates): add ColorOrb component with brand blue tones"
```

---

## Task 4: CPUBackdrop component

**Files:**
- Create: `components/admin/documents/ai-creation/CPUBackdrop.tsx`
- Create: `components/admin/documents/ai-creation/CPUBackdrop.module.css`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/documents/ai-creation/CPUBackdrop.tsx
"use client";

import { motion } from "motion/react";
import styles from "./CPUBackdrop.module.css";

const NODES = [
  { x: "20%", y: "15%", delay: 0 },
  { x: "50%", y: "8%", delay: 0.4 },
  { x: "80%", y: "15%", delay: 0.8 },
  { x: "10%", y: "45%", delay: 0.2 },
  { x: "35%", y: "38%", delay: 0.6 },
  { x: "65%", y: "38%", delay: 1.0 },
  { x: "90%", y: "45%", delay: 0.3 },
  { x: "20%", y: "72%", delay: 0.7 },
  { x: "50%", y: "80%", delay: 0.5 },
  { x: "80%", y: "72%", delay: 0.9 },
];

const LINES = [
  { x1: "20%", y1: "15%", x2: "50%", y2: "8%" },
  { x1: "50%", y1: "8%", x2: "80%", y2: "15%" },
  { x1: "20%", y1: "15%", x2: "10%", y2: "45%" },
  { x1: "50%", y1: "8%", x2: "35%", y2: "38%" },
  { x1: "50%", y1: "8%", x2: "65%", y2: "38%" },
  { x1: "80%", y1: "15%", x2: "90%", y2: "45%" },
  { x1: "10%", y1: "45%", x2: "35%", y2: "38%" },
  { x1: "35%", y1: "38%", x2: "65%", y2: "38%" },
  { x1: "65%", y1: "38%", x2: "90%", y2: "45%" },
  { x1: "20%", y1: "72%", x2: "35%", y2: "38%" },
  { x1: "50%", y1: "80%", x2: "65%", y2: "38%" },
  { x1: "80%", y1: "72%", x2: "65%", y2: "38%" },
  { x1: "20%", y1: "72%", x2: "50%", y2: "80%" },
  { x1: "50%", y1: "80%", x2: "80%", y2: "72%" },
];

export function CPUBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden>
      <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#02aaeb" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#1b77be" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        {LINES.map((l, i) => (
          <motion.line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="url(#lineGrad)"
            strokeWidth="0.3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, delay: i * 0.08, ease: "easeOut" }}
          />
        ))}
      </svg>
      {NODES.map((n, i) => (
        <motion.div
          key={i}
          className={styles.node}
          style={{ left: n.x, top: n.y }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: n.delay, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className={styles.nodePulse}
            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, delay: n.delay, repeat: Infinity, ease: "easeOut" }}
          />
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS Module**

```css
/* components/admin/documents/ai-creation/CPUBackdrop.module.css */
.backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.node {
  position: absolute;
  width: 6px;
  height: 6px;
  transform: translate(-50%, -50%);
}

.node::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--color-brand-light);
  box-shadow: 0 0 8px 2px rgba(2, 170, 235, 0.4);
}

.nodePulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(2, 170, 235, 0.3);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/documents/ai-creation/CPUBackdrop.tsx src/components/admin/documents/ai-creation/CPUBackdrop.module.css
git commit -m "feat(ai-templates): add CPU backdrop atmospheric visual"
```

---

## Task 5: AgentPlanSteps component

**Files:**
- Create: `components/admin/documents/ai-creation/AgentPlanSteps.tsx`
- Create: `components/admin/documents/ai-creation/AgentPlanSteps.module.css`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/documents/ai-creation/AgentPlanSteps.tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { Check, SpinnerGap } from "@phosphor-icons/react";
import type { AgentStep } from "./types";
import styles from "./AgentPlanSteps.module.css";

interface Props {
  steps: AgentStep[];
}

export function AgentPlanSteps({ steps }: Props) {
  return (
    <div className={styles.list} role="status" aria-live="polite">
      {steps.map((step, i) => (
        <motion.div
          key={step.id}
          className={styles.row}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={`${styles.icon} ${styles[step.status]}`}>
            <AnimatePresence mode="wait">
              {step.status === "done" ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                >
                  <Check size={11} weight="bold" />
                </motion.span>
              ) : step.status === "running" ? (
                <motion.span key="spin" className={styles.spin}>
                  <SpinnerGap size={11} weight="bold" />
                </motion.span>
              ) : (
                <motion.span key="dot" className={styles.dot} />
              )}
            </AnimatePresence>
          </div>
          <span className={`${styles.label} ${styles[step.status]}`}>
            {step.label}
          </span>
          {step.status === "done" && (
            <motion.div
              className={styles.completeLine}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS Module**

```css
/* components/admin/documents/ai-creation/AgentPlanSteps.module.css */
.list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  z-index: 1;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.icon.pending {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
}

.icon.running {
  background: rgba(2, 170, 235, 0.15);
  border: 1px solid rgba(2, 170, 235, 0.4);
  color: var(--color-brand-light);
}

.icon.done {
  background: rgba(22, 163, 74, 0.2);
  border: 1px solid rgba(22, 163, 74, 0.4);
  color: #4ade80;
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.spin {
  display: flex;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.label {
  font-size: 13.5px;
  font-weight: 500;
  transition: color 0.3s ease;
}

.label.pending { color: rgba(255, 255, 255, 0.35); }
.label.running { color: rgba(255, 255, 255, 0.9); }
.label.done { color: rgba(255, 255, 255, 0.55); }

.completeLine {
  position: absolute;
  left: 34px;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(74, 222, 128, 0.15), transparent);
  transform-origin: left;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/documents/ai-creation/AgentPlanSteps.tsx src/components/admin/documents/ai-creation/AgentPlanSteps.module.css
git commit -m "feat(ai-templates): add AgentPlanSteps with staggered completion animation"
```

---

## Task 6: AIPromptStep (Step 1)

**Files:**
- Create: `components/admin/documents/ai-creation/AIPromptStep.tsx`
- Create: `components/admin/documents/ai-creation/AIPromptStep.module.css`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/documents/ai-creation/AIPromptStep.tsx
"use client";

import { useState, useRef } from "react";
import { motion } from "motion/react";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import { ColorOrb } from "./ColorOrb";
import { EXAMPLE_PROMPTS } from "./mock-ai";
import styles from "./AIPromptStep.module.css";

interface Props {
  onSubmit: (prompt: string, chips: { state: string; signers: string; category: string }) => void;
}

const STATES = ["Select state", "Nevada", "California", "Florida", "Texas", "New York", "Washington", "Arizona"];
const CATEGORIES = ["Agreement", "Addendum", "Authorization", "Policy", "Checklist"];
const SIGNERS = ["Owner + Proxy", "Owner only", "Tenant + Owner", "Tenant + Owner + Proxy"];

export function AIPromptStep({ onSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState("Select state");
  const [signers, setSigners] = useState("Owner + Proxy");
  const [category, setCategory] = useState("Agreement");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleExampleClick(example: string) {
    setPrompt(example);
    textareaRef.current?.focus();
  }

  function handleSubmit() {
    if (!prompt.trim()) return;
    onSubmit(prompt.trim(), { state, signers, category });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <motion.div
      className={styles.step}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.header}>
        <ColorOrb size={28} />
        <div>
          <h2 className={styles.title}>Generate a template with AI</h2>
          <p className={styles.subtitle}>Describe the document you need in plain language.</p>
        </div>
      </div>

      <div className={`${styles.inputWrap} ${focused ? styles.inputFocused : ""}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="e.g. Short-term rental agreement for Airbnb hosts in Nevada, owner and I both sign"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          rows={4}
          autoFocus
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

      <div className={styles.chips}>
        <label className={styles.chipLabel}>Property state</label>
        <select
          className={styles.chipSelect}
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <label className={styles.chipLabel}>Who signs</label>
        <select
          className={styles.chipSelect}
          value={signers}
          onChange={(e) => setSigners(e.target.value)}
        >
          {SIGNERS.map((s) => <option key={s}>{s}</option>)}
        </select>

        <label className={styles.chipLabel}>Category</label>
        <select
          className={styles.chipSelect}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className={styles.examples}>
        <span className={styles.examplesLabel}>
          <Sparkle size={12} weight="duotone" /> Try an example
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
        <kbd className={styles.kbd}>⌘</kbd><kbd className={styles.kbd}>Enter</kbd> to generate
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 2: Write the CSS Module**

Note: uses native `<select>` here because this is a preview in the overlay context (CustomSelect needs a server-loaded portal). Replace with CustomSelect in production.

```css
/* components/admin/documents/ai-creation/AIPromptStep.module.css */
.step {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 620px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.title {
  margin: 0 0 3px;
  font-family: var(--font-sora), var(--font-sans);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.45);
}

.inputWrap {
  position: relative;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.inputFocused {
  border-color: rgba(2, 170, 235, 0.5);
  box-shadow: 0 0 0 3px rgba(2, 170, 235, 0.1), 0 0 24px rgba(2, 170, 235, 0.08);
}

.textarea {
  width: 100%;
  min-height: 110px;
  padding: 16px 52px 16px 18px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
}

.textarea::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.sendBtn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  background: var(--color-brand-gradient);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: opacity 0.2s ease, transform 0.15s ease;
}

.sendBtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.sendBtn:not(:disabled):hover {
  transform: scale(1.05);
}

.chips {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chipLabel {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

.chipSelect {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12.5px;
  padding: 5px 10px;
  cursor: pointer;
  outline: none;
}

.examples {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.examplesLabel {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.exampleList {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.exampleChip {
  text-align: left;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  padding: 9px 14px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.exampleChip:hover {
  background: rgba(2, 170, 235, 0.08);
  border-color: rgba(2, 170, 235, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.2);
}

.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 11px;
  font-family: var(--font-sans);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/documents/ai-creation/AIPromptStep.tsx src/components/admin/documents/ai-creation/AIPromptStep.module.css
git commit -m "feat(ai-templates): add AIPromptStep with colorful input and example chips"
```

---

## Task 7: AIGenerationStep (Step 2)

**Files:**
- Create: `components/admin/documents/ai-creation/AIGenerationStep.tsx`
- Create: `components/admin/documents/ai-creation/AIGenerationStep.module.css`

- [ ] **Step 1: Write the component**

This component drives the agent step progression with `useEffect` and `setTimeout`. Each step completes in 600ms intervals with a 400ms "running" phase before marking done.

```tsx
// components/admin/documents/ai-creation/AIGenerationStep.tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ColorOrb } from "./ColorOrb";
import { CPUBackdrop } from "./CPUBackdrop";
import { AgentPlanSteps } from "./AgentPlanSteps";
import { AGENT_STEPS } from "./mock-ai";
import type { AgentStep, AIGeneratedIntelligence } from "./types";
import styles from "./AIGenerationStep.module.css";

interface Props {
  onComplete: (result: AIGeneratedIntelligence) => void;
}

export function AIGenerationStep({ onComplete }: Props) {
  const [steps, setSteps] = useState<AgentStep[]>(
    AGENT_STEPS.map((s) => ({ ...s, status: "pending" as const }))
  );

  useEffect(() => {
    let cancelled = false;

    async function runSteps() {
      const { MOCK_GENERATED } = await import("./mock-ai");

      for (let i = 0; i < AGENT_STEPS.length; i++) {
        if (cancelled) return;

        // Mark running
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "running" } : s
          )
        );

        await new Promise((r) => setTimeout(r, 500));
        if (cancelled) return;

        // Mark done
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "done" } : s
          )
        );

        await new Promise((r) => setTimeout(r, 120));
      }

      // All done — short pause then complete
      await new Promise((r) => setTimeout(r, 400));
      if (!cancelled) onComplete(MOCK_GENERATED);
    }

    runSteps();
    return () => { cancelled = true; };
  }, [onComplete]);

  return (
    <motion.div
      className={styles.step}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <CPUBackdrop />

      <div className={styles.content}>
        <div className={styles.orbRow}>
          <ColorOrb size={40} />
          <div>
            <p className={styles.generating}>Generating</p>
            <div className={styles.dots}>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className={styles.dot}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </div>
        </div>

        <AgentPlanSteps steps={steps} />
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Write the CSS Module**

```css
/* components/admin/documents/ai-creation/AIGenerationStep.module.css */
.step {
  position: relative;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 32px;
  width: 100%;
}

.orbRow {
  display: flex;
  align-items: center;
  gap: 16px;
}

.generating {
  margin: 0 0 4px;
  font-family: var(--font-sora), var(--font-sans);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}

.dots {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 16px;
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-brand-light);
  display: inline-block;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/documents/ai-creation/AIGenerationStep.tsx src/components/admin/documents/ai-creation/AIGenerationStep.module.css
git commit -m "feat(ai-templates): add AIGenerationStep with animated agent plan progression"
```

---

## Task 8: IntelligencePanel (Step 3 left)

**Files:**
- Create: `components/admin/documents/ai-creation/IntelligencePanel.tsx`
- Create: `components/admin/documents/ai-creation/IntelligencePanel.module.css`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/documents/ai-creation/IntelligencePanel.tsx
"use client";

import { motion } from "motion/react";
import { SparkleIcon } from "@phosphor-icons/react";
import { Sparkle } from "@phosphor-icons/react";
import type { AIGeneratedIntelligence } from "./types";
import styles from "./IntelligencePanel.module.css";

const GATE_LABELS: Record<string, string> = {
  "": "None",
  "1": "Agreement (step 1)",
  "2": "Payment (step 2)",
  "3": "Banking (step 3)",
  "4": "Identity (step 4)",
};

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
        <Sparkle size={12} weight="duotone" />
        AI-generated
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Template name</label>
          <input
            className={styles.fieldInput}
            value={intelligence.templateName}
            onChange={(e) => onChange({ templateName: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Document key</label>
          <input
            className={`${styles.fieldInput} ${styles.mono}`}
            value={intelligence.documentKey}
            onChange={(e) => onChange({ documentKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
          />
          <p className={styles.fieldHint}>Lowercase letters, numbers, underscores</p>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Description</label>
          <textarea
            className={`${styles.fieldInput} ${styles.textarea}`}
            value={intelligence.description}
            rows={3}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Signers</label>
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
          <label className={styles.fieldLabel}>Onboarding gate</label>
          <select
            className={styles.fieldSelect}
            value={intelligence.gateStep}
            onChange={(e) => onChange({ gateStep: e.target.value })}
          >
            {Object.entries(GATE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
        Save and place fields
      </button>
      <p className={styles.confirmHint}>Opens DocuSeal to add signature fields</p>
    </motion.div>
  );
}
```

- [ ] **Step 2: Write the CSS Module**

```css
/* components/admin/documents/ai-creation/IntelligencePanel.module.css */
.panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(2, 170, 235, 0.12);
  border: 1px solid rgba(2, 170, 235, 0.25);
  border-radius: 999px;
  color: var(--color-brand-light);
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  width: fit-content;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.fieldLabel {
  font-size: 11.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fieldInput {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13.5px;
  padding: 9px 12px;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s ease;
}

.fieldInput:focus {
  border-color: rgba(2, 170, 235, 0.4);
}

.mono {
  font-family: var(--font-ibm-plex-mono), monospace;
  font-size: 12.5px;
}

.textarea {
  resize: none;
  line-height: 1.5;
}

.fieldHint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
}

.fieldSelect {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13.5px;
  padding: 9px 12px;
  outline: none;
  cursor: pointer;
}

.signerList {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.signerRow {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  padding: 8px 12px;
}

.signerNum {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(2, 170, 235, 0.15);
  border: 1px solid rgba(2, 170, 235, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-brand-light);
}

.signerName {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  flex: 1;
}

.signerLast {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

.confirmBtn {
  width: 100%;
  padding: 12px;
  background: var(--color-brand-gradient);
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.15s ease;
}

.confirmBtn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.confirmHint {
  margin: 0;
  text-align: center;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.2);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/documents/ai-creation/IntelligencePanel.tsx src/components/admin/documents/ai-creation/IntelligencePanel.module.css
git commit -m "feat(ai-templates): add IntelligencePanel with inline-editable AI fields"
```

---

## Task 9: DocumentPreviewPanel (Step 3 right)

**Files:**
- Create: `components/admin/documents/ai-creation/DocumentPreviewPanel.tsx`
- Create: `components/admin/documents/ai-creation/DocumentPreviewPanel.module.css`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/documents/ai-creation/DocumentPreviewPanel.tsx
"use client";

import { useState, useRef } from "react";
import { motion } from "motion/react";
import { ArrowCounterClockwise, PencilSimple, ArrowRight } from "@phosphor-icons/react";
import type { AIGeneratedIntelligence } from "./types";
import styles from "./DocumentPreviewPanel.module.css";

interface Props {
  intelligence: AIGeneratedIntelligence;
  onRefinementSubmit: (refinement: string) => void;
  onRegenerate: () => void;
  onManualEdit: () => void;
}

export function DocumentPreviewPanel({
  intelligence,
  onRefinementSubmit,
  onRegenerate,
  onManualEdit,
}: Props) {
  const [refinement, setRefinement] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState(intelligence.documentBody);

  function handleRefinementSubmit() {
    if (!refinement.trim()) return;
    onRefinementSubmit(refinement.trim());
    setRefinement("");
  }

  function handleManualEdit() {
    setEditMode(true);
    onManualEdit();
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Refinement input */}
      <div className={styles.refinementWrap}>
        <input
          className={styles.refinementInput}
          placeholder="Refine this document…"
          value={refinement}
          onChange={(e) => setRefinement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleRefinementSubmit(); }
          }}
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

      {/* Document body */}
      <div className={styles.documentWrap}>
        {editMode ? (
          <textarea
            className={styles.editArea}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            autoFocus
          />
        ) : (
          <pre className={styles.documentBody}>{intelligence.documentBody}</pre>
        )}
      </div>

      {/* Secondary actions */}
      <div className={styles.secondaryActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onRegenerate}>
          <ArrowCounterClockwise size={13} weight="bold" /> Regenerate
        </button>
        <button type="button" className={styles.tertiaryBtn} onClick={handleManualEdit}>
          <PencilSimple size={13} weight="regular" /> Edit manually
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Write the CSS Module**

```css
/* components/admin/documents/ai-creation/DocumentPreviewPanel.module.css */
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.refinementWrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  flex-shrink: 0;
  transition: border-color 0.15s ease;
}

.refinementWrap:focus-within {
  border-color: rgba(2, 170, 235, 0.35);
}

.refinementInput {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.85);
  font-family: var(--font-sans);
}

.refinementInput::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.refinementBtn {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  background: rgba(2, 170, 235, 0.2);
  border: 1px solid rgba(2, 170, 235, 0.3);
  color: var(--color-brand-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.refinementBtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.refinementBtn:not(:disabled):hover {
  background: rgba(2, 170, 235, 0.3);
}

.documentWrap {
  flex: 1;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  padding: 20px;
  min-height: 0;
}

.documentBody {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12.5px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.65);
  white-space: pre-wrap;
  word-break: break-word;
}

.editArea {
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-sans);
  font-size: 12.5px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.8);
  resize: none;
}

.secondaryActions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.secondaryBtn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.55);
  font-size: 12.5px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.secondaryBtn:hover {
  background: rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.75);
}

.tertiaryBtn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.28);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.tertiaryBtn:hover {
  color: rgba(255, 255, 255, 0.5);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/documents/ai-creation/DocumentPreviewPanel.tsx src/components/admin/documents/ai-creation/DocumentPreviewPanel.module.css
git commit -m "feat(ai-templates): add DocumentPreviewPanel with inline refinement and manual edit"
```

---

## Task 10: AICreationOverlay — the step orchestrator

**Files:**
- Create: `components/admin/documents/ai-creation/AICreationOverlay.tsx`
- Create: `components/admin/documents/ai-creation/AICreationOverlay.module.css`
- Create: `components/admin/documents/ai-creation/index.ts`

- [ ] **Step 1: Write the overlay orchestrator**

```tsx
// components/admin/documents/ai-creation/AICreationOverlay.tsx
"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { AIPromptStep } from "./AIPromptStep";
import { AIGenerationStep } from "./AIGenerationStep";
import { IntelligencePanel } from "./IntelligencePanel";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel";
import type { AICreationStep, AIContextChips, AIGeneratedIntelligence } from "./types";
import styles from "./AICreationOverlay.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AICreationOverlay({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<AICreationStep>("prompt");
  const [promptText, setPromptText] = useState("");
  const [chips, setChips] = useState<AIContextChips>({ state: "Select state", signers: "Owner + Proxy", category: "Agreement" });
  const [intelligence, setIntelligence] = useState<AIGeneratedIntelligence | null>(null);

  function handlePromptSubmit(prompt: string, contextChips: AIContextChips) {
    setPromptText(prompt);
    setChips(contextChips);
    setStep("generating");
  }

  const handleGenerationComplete = useCallback((result: AIGeneratedIntelligence) => {
    setIntelligence(result);
    setStep("preview");
  }, []);

  function handleIntelligenceChange(updated: Partial<AIGeneratedIntelligence>) {
    setIntelligence((prev) => prev ? { ...prev, ...updated } : prev);
  }

  function handleRefinementSubmit(refinement: string) {
    // Preview: just show a regenerate to simulate refinement applying
    setStep("generating");
  }

  function handleRegenerate() {
    setStep("generating");
  }

  function handleConfirm() {
    // In production: create the DocuSeal template, redirect to field placement.
    // Preview: show success then close.
    onCreated();
    handleClose();
  }

  function handleClose() {
    onClose();
    // Reset after exit animation
    setTimeout(() => {
      setStep("prompt");
      setIntelligence(null);
      setPromptText("");
    }, 300);
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop}>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Close */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={handleClose}
          aria-label="Close"
        >
          <X size={16} weight="bold" />
        </button>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === "prompt" && (
            <motion.div key="prompt" className={styles.centeredContent}>
              <AIPromptStep onSubmit={handlePromptSubmit} />
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div key="generating" className={styles.centeredContent}>
              <AIGenerationStep onComplete={handleGenerationComplete} />
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
                  onRegenerate={handleRegenerate}
                  onManualEdit={() => {}}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Write the CSS Module**

```css
/* components/admin/documents/ai-creation/AICreationOverlay.module.css */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
}

.overlay {
  position: absolute;
  inset: 0;
  background: var(--color-navy);
  background-image:
    radial-gradient(ellipse 60% 50% at 30% 20%, rgba(2, 170, 235, 0.07) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 80% 80%, rgba(27, 119, 190, 0.06) 0%, transparent 70%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.closeBtn {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 10;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.closeBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}

.centeredContent {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.splitContent {
  flex: 1;
  display: grid;
  grid-template-columns: 38fr 62fr;
  gap: 0;
  overflow: hidden;
}

.splitLeft {
  padding: 40px 32px;
  border-right: 1px solid rgba(255, 255, 255, 0.07);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.splitRight {
  padding: 40px 36px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 3: Write the index re-export**

```typescript
// components/admin/documents/ai-creation/index.ts
export { AICreationOverlay } from "./AICreationOverlay";
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/documents/ai-creation/AICreationOverlay.tsx src/components/admin/documents/ai-creation/AICreationOverlay.module.css src/components/admin/documents/ai-creation/index.ts
git commit -m "feat(ai-templates): add AICreationOverlay step orchestrator"
```

---

## Task 11: ProxyTemplateCard + ForkTemplateSheet

**Files:**
- Create: `components/admin/documents/ProxyTemplateCard.tsx`
- Create: `components/admin/documents/ProxyTemplateCard.module.css`
- Create: `components/admin/documents/ForkTemplateSheet.tsx`
- Create: `components/admin/documents/ForkTemplateSheet.module.css`

- [ ] **Step 1: Write ProxyTemplateCard**

```tsx
// components/admin/documents/ProxyTemplateCard.tsx
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
          <span className={styles.badge}>
            <Lock size={9} weight="bold" /> Proxy
          </span>
          <span className={styles.categoryBadge}>{template.category}</span>
        </div>
      </div>

      <h3 className={styles.name}>{template.name}</h3>
      <p className={styles.description}>{template.description}</p>

      <div className={styles.signerRow}>
        {template.signerRoles.map((r, i) => (
          <span key={r} className={styles.signer}>
            {i > 0 && <span className={styles.signerArrow}>→</span>}
            {r}
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
```

- [ ] **Step 2: Write ProxyTemplateCard CSS**

```css
/* components/admin/documents/ProxyTemplateCard.module.css */
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  background: var(--surface-elevated, #fff);
  border: 1px solid var(--border-default, rgba(0,0,0,0.08));
  border-radius: var(--radius-lg);
  cursor: default;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.cardTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.iconWrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: rgba(27, 119, 190, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-brand);
}

.badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(27, 119, 190, 0.08);
  border: 1px solid rgba(27, 119, 190, 0.2);
  border-radius: 999px;
  color: var(--color-brand);
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 8px;
}

.categoryBadge {
  background: rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 10.5px;
  padding: 3px 8px;
}

.name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.description {
  margin: 0;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.signerRow {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
}

.signer {
  font-size: 11.5px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 5px;
}

.signerArrow {
  color: var(--color-text-secondary);
  opacity: 0.4;
}

.forkBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  margin-top: 4px;
  background: transparent;
  border: 1px solid var(--border-default, rgba(0,0,0,0.08));
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.forkBtn:hover {
  background: rgba(27, 119, 190, 0.05);
  border-color: rgba(27, 119, 190, 0.2);
  color: var(--color-brand);
}
```

- [ ] **Step 3: Write ForkTemplateSheet**

```tsx
// components/admin/documents/ForkTemplateSheet.tsx
"use client";

import { useState } from "react";
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
  const [name, setName] = useState(template?.name ?? "");

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
            onClick={onClose}
          />
          <motion.div
            className={styles.sheet}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            role="dialog"
            aria-modal
            aria-label="Fork template"
          >
            <div className={styles.header}>
              <div>
                <h3 className={styles.title}>Fork to customize</h3>
                <p className={styles.subtitle}>"{template.name}"</p>
              </div>
              <button type="button" className={styles.closeBtn} onClick={onClose}>
                <X size={14} weight="bold" />
              </button>
            </div>

            <div className={styles.body}>
              <label className={styles.label}>Name your copy</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                autoFocus
              />
              <p className={styles.hint}>
                A copy will appear in Your Templates. The Proxy original stays unchanged.
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
```

- [ ] **Step 4: Write ForkTemplateSheet CSS**

```css
/* components/admin/documents/ForkTemplateSheet.module.css */
.scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(3px);
}

.sheet {
  position: fixed;
  z-index: 81;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(440px, calc(100vw - 32px));
  background: var(--surface-elevated, #fff);
  border: 1px solid var(--border-default, rgba(0,0,0,0.08));
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 22px 16px;
  border-bottom: 1px solid var(--border-default, rgba(0,0,0,0.06));
}

.title {
  margin: 0 0 3px;
  font-family: var(--font-sora), var(--font-sans);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.closeBtn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0,0,0,0.04);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.15s ease;
}

.closeBtn:hover {
  background: rgba(0,0,0,0.08);
}

.body {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px rgba(27, 119, 190, 0.1);
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid var(--border-default, rgba(0,0,0,0.06));
}

.cancelBtn {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: var(--radius-md);
  font-size: 13.5px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease;
}

.cancelBtn:hover {
  background: rgba(0,0,0,0.04);
}

.forkBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--color-brand-gradient);
  border: none;
  border-radius: var(--radius-md);
  font-size: 13.5px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.forkBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/documents/ProxyTemplateCard.tsx src/components/admin/documents/ProxyTemplateCard.module.css src/components/admin/documents/ForkTemplateSheet.tsx src/components/admin/documents/ForkTemplateSheet.module.css
git commit -m "feat(ai-templates): add ProxyTemplateCard and ForkTemplateSheet"
```

---

## Task 12: TemplatesHubClient — hub redesign

**Files:**
- Create: `app/(admin)/admin/paperwork/templates/TemplatesHubClient.tsx`
- Create: `app/(admin)/admin/paperwork/templates/TemplatesHubClient.module.css`

- [ ] **Step 1: Write TemplatesHubClient**

```tsx
// app/(admin)/admin/paperwork/templates/TemplatesHubClient.tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkle, UploadSimple, Lock } from "@phosphor-icons/react";
import { AICreationOverlay } from "@/components/admin/documents/ai-creation";
import { ProxyTemplateCard } from "@/components/admin/documents/ProxyTemplateCard";
import { ForkTemplateSheet } from "@/components/admin/documents/ForkTemplateSheet";
import { UnifiedTemplatesList } from "./UnifiedTemplatesList";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { SendSheet } from "./SendSheet";
import { PROXY_TEMPLATES } from "@/components/admin/documents/ai-creation/mock-ai";
import type { UnifiedTemplate, SendRecipient } from "./unified-types";
import type { ProxyTemplateRecord } from "@/components/admin/documents/ai-creation/types";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./TemplatesHubClient.module.css";

interface Props {
  templates: UnifiedTemplate[];
  recipients: SendRecipient[];
}

export function TemplatesHubClient({ templates, recipients }: Props) {
  const [aiOverlayOpen, setAiOverlayOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [forkTarget, setForkTarget] = useState<ProxyTemplateRecord | null>(null);
  const [sendTarget, setSendTarget] = useState<UnifiedTemplate | null>(null);
  const [localTemplates, setLocalTemplates] = useState<UnifiedTemplate[]>(templates);
  const [forkedNames, setForkedNames] = useState<string[]>([]);

  const hasYourTemplates = localTemplates.length > 0 || forkedNames.length > 0;

  function handleCreated(template: DocumentTemplate) {
    // Optimistic: add a stub entry. In production, revalidatePath handles this.
    const stub: UnifiedTemplate = {
      id: template.id,
      kind: "signature",
      name: template.display_name,
      description: template.description,
      isSystem: false,
      isReady: false,
      documentKey: template.document_key,
      docusealTemplateId: null,
      signerRoles: template.signer_roles,
      previewImageUrl: null,
      sentCount: 0,
      responseCount: 0,
      fieldCount: 0,
      previewFields: [],
      slug: null,
      isPublic: false,
    };
    setLocalTemplates((prev) => [stub, ...prev]);
  }

  function handleAICreated() {
    // Preview: add a simulated "Short-Term Rental Agreement" stub
    const stub: UnifiedTemplate = {
      id: `ai-${Date.now()}`,
      kind: "signature",
      name: "Short-Term Rental Agreement",
      description: "Generated with AI — click to place fields",
      isSystem: false,
      isReady: false,
      documentKey: "short_term_rental_agreement",
      docusealTemplateId: null,
      signerRoles: ["Owner", "Proxy"],
      previewImageUrl: null,
      sentCount: 0,
      responseCount: 0,
      fieldCount: 0,
      previewFields: [],
      slug: null,
      isPublic: false,
    };
    setLocalTemplates((prev) => [stub, ...prev]);
  }

  function handleFork(name: string) {
    setForkedNames((prev) => [name, ...prev]);
  }

  return (
    <div className={styles.hub}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Templates</h1>
          <p className={styles.pageSubtitle}>
            Manage your document library. Generate new templates with AI or upload your own.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.uploadBtn}
            onClick={() => setCreateModalOpen(true)}
          >
            <UploadSimple size={14} weight="bold" /> Upload PDF
          </button>
          <button
            type="button"
            className={styles.aiBtn}
            onClick={() => setAiOverlayOpen(true)}
          >
            <Sparkle size={14} weight="duotone" /> Generate with AI
          </button>
        </div>
      </div>

      {/* Your Templates */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Your Templates</h2>
          {!hasYourTemplates && (
            <p className={styles.sectionSubtitle}>
              Templates you create or fork from the Proxy library appear here.
            </p>
          )}
        </div>

        {hasYourTemplates ? (
          <>
            {/* Forked templates shown as placeholder cards in preview */}
            {forkedNames.length > 0 && (
              <div className={styles.forkedList}>
                {forkedNames.map((n) => (
                  <div key={n} className={styles.forkedCard}>
                    <span className={styles.forkedName}>{n}</span>
                    <span className={styles.forkedBadge}>Forked — place fields to activate</span>
                  </div>
                ))}
              </div>
            )}
            <UnifiedTemplatesList templates={localTemplates} onSend={setSendTarget} />
          </>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Sparkle size={22} weight="duotone" />
            </div>
            <p className={styles.emptyText}>No templates yet.</p>
            <p className={styles.emptyHint}>
              Generate one with AI or fork a Proxy template below.
            </p>
            <button
              type="button"
              className={styles.aiBtn}
              onClick={() => setAiOverlayOpen(true)}
            >
              <Sparkle size={13} weight="duotone" /> Generate my first template
            </button>
          </div>
        )}
      </section>

      {/* Proxy Templates */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>Proxy Templates</h2>
            <span className={styles.proxyBadge}>
              <Lock size={10} weight="bold" /> Platform library
            </span>
          </div>
          <p className={styles.sectionSubtitle}>
            Curated documents from Proxy. Read-only. Fork any template to customize it.
          </p>
        </div>

        <div className={styles.proxyGrid}>
          {PROXY_TEMPLATES.map((t) => (
            <ProxyTemplateCard
              key={t.id}
              template={t}
              onFork={() => setForkTarget(t)}
            />
          ))}
        </div>
      </section>

      {/* Overlays */}
      <AICreationOverlay
        open={aiOverlayOpen}
        onClose={() => setAiOverlayOpen(false)}
        onCreated={handleAICreated}
      />

      <CreateTemplateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />

      <ForkTemplateSheet
        template={forkTarget}
        onClose={() => setForkTarget(null)}
        onFork={handleFork}
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
    </div>
  );
}
```

- [ ] **Step 2: Write TemplatesHubClient CSS**

```css
/* app/(admin)/admin/paperwork/templates/TemplatesHubClient.module.css */
.hub {
  display: flex;
  flex-direction: column;
  gap: 48px;
  padding: 32px 36px 64px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.pageTitle {
  margin: 0 0 5px;
  font-family: var(--font-sora), var(--font-sans);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}

.pageSubtitle {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.headerActions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.uploadBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  background: transparent;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: var(--radius-md);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.uploadBtn:hover {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.15);
  color: var(--color-text-primary);
}

.aiBtn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  background: var(--color-brand-gradient);
  border: none;
  border-radius: var(--radius-md);
  font-size: 13.5px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(27, 119, 190, 0.3);
  transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.aiBtn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 4px 18px rgba(27, 119, 190, 0.35);
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sectionHeader {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sectionTitleRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sectionTitle {
  margin: 0;
  font-family: var(--font-sora), var(--font-sans);
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.sectionSubtitle {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.proxyBadge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(27, 119, 190, 0.07);
  border: 1px solid rgba(27, 119, 190, 0.18);
  border-radius: 999px;
  color: var(--color-brand);
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 9px;
}

/* Proxy grid */
.proxyGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

/* Empty state */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  border: 1px dashed rgba(0,0,0,0.1);
  border-radius: var(--radius-lg);
  background: rgba(0,0,0,0.01);
  text-align: center;
}

.emptyIcon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: rgba(27, 119, 190, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-brand);
}

.emptyText {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.emptyHint {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* Forked list */
.forkedList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.forkedCard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(27, 119, 190, 0.04);
  border: 1px solid rgba(27, 119, 190, 0.12);
  border-radius: var(--radius-md);
}

.forkedName {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.forkedBadge {
  font-size: 12px;
  color: var(--color-brand);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/paperwork/templates/TemplatesHubClient.tsx src/app/\(admin\)/admin/paperwork/templates/TemplatesHubClient.module.css
git commit -m "feat(ai-templates): add TemplatesHubClient with two-section hub layout"
```

---

## Task 13: Update page.tsx and verify end-to-end flow

**Files:**
- Modify: `app/(admin)/admin/paperwork/templates/page.tsx`

- [ ] **Step 1: Update the page to use TemplatesHubClient**

Replace the `TemplatesTab` import and usage:

```tsx
// At the top, replace TemplatesTab import:
import { TemplatesHubClient } from "./TemplatesHubClient";
// Remove: import { TemplatesTab } from "./TemplatesTab";
```

Replace the return block:

```tsx
return (
  <PaperworkShell active="templates" orgId={orgId}>
    <main className={styles.main}>
      <TemplatesHubClient templates={unified} recipients={recipients} />
    </main>
  </PaperworkShell>
);
```

- [ ] **Step 2: Start dev server on port 4010**

From `apps/web/` in the worktree:
```bash
doppler run -- next dev -p 4010
```
Expected: `Ready on http://localhost:4010`

- [ ] **Step 3: Open and verify the page**

Navigate to `http://localhost:4010/admin/paperwork/templates` (use dev auth at `/api/dev/auth` first if needed).

Verify:
- Page shows "Templates" header with "Upload PDF" + "Generate with AI" buttons
- Proxy Templates grid shows 5 cards
- Your Templates section shows existing DB templates (or empty state if none)
- "Generate with AI" opens the fullscreen overlay
- Typing in the prompt and submitting transitions to the generation animation
- Agent plan steps complete one by one
- After generation, split panel shows intelligence fields and document preview
- Refinement input is visible above the document
- "Save and place fields" closes overlay and adds a stub to Your Templates
- "Fork to customize" on a Proxy card opens the fork sheet

- [ ] **Step 4: Fix any TypeScript errors**

```bash
pnpm exec tsc --noEmit
```
Fix any errors before committing.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/paperwork/templates/page.tsx
git commit -m "feat(ai-templates): wire TemplatesHubClient into templates page — preview complete"
```

---

## Self-Review

**Spec coverage:**

| Design requirement | Covered in task |
|---|---|
| Two-section hub (Proxy / Your Templates) | Task 12 |
| "Generate with AI" as primary CTA | Task 12 |
| "Upload PDF" as secondary action | Task 12 |
| AI overlay Step 1 (prompt + context chips + examples) | Task 6 |
| AI overlay Step 2 (CPU backdrop + agent plan) | Tasks 3, 4, 5, 7 |
| AI overlay Step 3 (split panel: intelligence + preview) | Tasks 8, 9, 10 |
| Inline refinement input (primary iteration action) | Task 9 |
| Regenerate (secondary) | Task 9 |
| Manual edit (tertiary) | Task 9 |
| Confirm / Save and place fields | Task 10 |
| Proxy Templates grid with fork action | Tasks 11, 12 |
| Fork sheet with name confirmation | Task 11 |
| Mock AI data (no real API calls) | Task 2 |
| ColorOrb with Proxy brand blues | Task 3 |
| AetherFlow particle canvas dropped | n/a |

**Type consistency:** `AIGeneratedIntelligence` is defined in `types.ts` (Task 2) and used identically in Tasks 8, 9, 10. `ProxyTemplateRecord` defined in `types.ts`, used in Tasks 11, 12. No drift.

**Placeholder scan:** None found. All code is complete.
