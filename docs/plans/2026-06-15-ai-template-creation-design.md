# AI Template Creation Flow: Design

**Date:** 2026-06-15
**Status:** Approved, ready for implementation

---

## Problem

The current template creation flow is entirely manual: upload a PDF or type raw text. For property managers managing owner relationships, this creates friction. Writing a professional rental agreement or pet addendum from scratch requires legal knowledge they do not have. The result is either low adoption (they never create templates) or poor-quality documents (they write something informal and hope it holds).

The AI flow solves this by letting a property manager describe what they need in plain language and receive a complete, structured document with all metadata pre-populated.

---

## Feature Scope

Redesign the templates hub at `/admin/paperwork/templates` with:

1. Two clearly separated template sections: Proxy Templates and Your Templates
2. AI-first creation path as the headline action
3. Manual creation (PDF upload, write text) as a secondary escape hatch
4. Fork flow for Proxy Templates
5. Three-layer iteration model for AI-generated output

---

## Templates Hub Architecture

### Two sections

**Proxy Templates** (top section when client has no templates, bottom section when they do)
- Platform-provided, curated by Proxy
- Read-only: cannot edit, delete, or modify
- Each card shows a "Proxy" badge and lock icon
- Action: "Fork to customize" — copies into Your Templates, opens manual editor before building
- Common documents pre-loaded: Short-term rental agreement, Pet damage addendum, Owner authorization letter, Move-in inspection checklist, Management fee schedule

**Your Templates** (top section for returning clients)
- Client-created, AI-generated, or forked from Proxy Templates
- Full CRUD: edit metadata, rebuild in DocuSeal, delete
- AI generation always lands here

### Hub states

**New client (no Your Templates yet)**
The page is the AI creation zone + Proxy Templates. No empty state. The page is full and useful on day one.

**Returning client**
Your Templates is the primary section. A compact "Generate a new template" card sits at the top of Your Templates as the persistent creation trigger. Proxy Templates sits below as a reference library.

### Header actions

- Primary button: "Generate with AI" (brand gradient, prominent)
- Secondary text link: "Upload a PDF" (for manual path)
- Manual "Write it here" mode is a tab inside the upload modal, not a top-level entry point

---

## AI Creation Flow

Triggered by "Generate with AI." Opens a fullscreen overlay. No route change.

### Step 1: Prompt

Full-width, expanded-by-default AI input (MorphPanel pattern, adapted to Proxy brand).

ColorOrb uses Proxy brand gradient: `#02aaeb` to `#1b77be`.

Below the textarea, three optional context chips:
- **Property state** — for legal clause compliance (Nevada, California, etc.)
- **Who signs** — defaults to Owner + Proxy, adjustable
- **Document category** — Agreement, Policy, Authorization, Addendum

Below the chips, three example prompt cards as tap targets:
- "Short-term rental agreement for Airbnb hosts in [state]"
- "Pet damage addendum with owner liability clause"
- "Owner authorization to list on OTAs"

Tapping an example fills the prompt. Submit with Cmd+Enter or send button.

### Step 2: Generation State

The prompt fades out. Two visual layers take over:

**Background:** CPU Architecture component adapted to Proxy brand blues. Not interactive, purely atmospheric.

**Foreground:** Agent Plan component showing five live steps with staggered completion:
1. Analyzing document type
2. Drafting document structure
3. Applying property law clauses
4. Configuring signers and gate step
5. Filling template intelligence

A small contained glowing circle animation (from the AI Loader reference) sits above the agent plan steps. This is NOT a fullscreen takeover. It is a contained element.

The particle canvas (AetherFlow reference) is dropped. It belongs on a marketing page, not in a functional admin tool.

Duration: 3 to 5 seconds visually (stream the actual AI response).

### Step 3: Preview and Refinement

Split panel layout. No stepper. Transitions naturally from generation state.

**Left panel (38%): Intelligence panel**

Pre-filled by AI, all fields editable inline without a separate form:
- Template name
- Document key (auto-generated from name, overridable)
- Description
- Signer order (Owner → Proxy by default)
- Gate step (CustomSelect)

Click any field to edit it directly. No modal, no separate step.

**Right panel (62%): Document preview + refinement**

At the top of the right panel: the AI prompt in compact refinement mode.
- Smaller input, single line
- Placeholder: "Refine this document…"
- This is the primary iteration action

Document content renders below as formatted text with section headers and numbered clauses (not a raw textarea).

Below the document, in descending visual weight:
- "Regenerate" — small secondary button, keeps original prompt, lets client append a correction
- "Edit manually" — quiet text link, opens the rich text editor for surgical control

**Iteration hierarchy:**
- Inline refinement: 90% of usage, headline interaction
- Regenerate: 8%, visible but not competing
- Manual edit: 2%, present but not prominent

### Step 4: Confirm

Located at the bottom of the left panel.

- **Primary CTA:** "Save and place fields" — saves to Your Templates, closes overlay, opens DocuSeal field-placement builder
- **Secondary:** "Save draft" text link — saves without entering DocuSeal

---

## Fork Flow (from Proxy Templates)

1. Client clicks "Fork to customize" on any Proxy Template card
2. A name-confirmation sheet slides in (rename or keep the default name)
3. Confirm opens the rich text editor showing the full document
4. Client edits as needed
5. "Build template" creates the DocuSeal template and opens field placement

No AI step on fork. The document is already written. The fork flow is about customization, not generation.

---

## Component Reference Mapping

| Reference | Used where | Adaptation |
|---|---|---|
| MorphPanel + ColorOrb | Step 1 prompt input | ColorOrb tones → Proxy brand blues |
| Agent Plan | Step 2 generation foreground | Proxy brand colors, 5 property-specific steps |
| CPU Architecture | Step 2 generation backdrop | Brand blues, purely atmospheric |
| AI Loader glowing circle | Step 2 contained top element | Contained, not fullscreen |
| AetherFlow particle canvas | **Dropped** | Marketing element, wrong context |

---

## Design System Constraints

- **Colors:** `--color-brand` (#1b77be), `--color-brand-light` (#02aaeb), `--color-navy` (#0f172a) for overlay backdrop
- **Motion:** `motion/react` only, `--ease-spring` easing, `transform` and `opacity` only, no `transition-all`
- **Typography:** Sora for headings in the overlay, Geist for body/input text
- **Icons:** Phosphor only, duotone weight for feature icons
- **CSS:** CSS Modules alongside Tailwind v4, matching existing component patterns
- **Components:** `CustomSelect` for gate step, never native `<select>`
- **No confirm/alert/prompt dialogs** — inline error states only

---

## Out of Scope

- Streaming token-by-token document generation in the preview (first pass renders complete output)
- Versioning of AI-generated templates
- AI suggestions for existing templates
- Mobile layout (admin is desktop-first)
