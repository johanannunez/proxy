# Guest Pulse Interactions Design

**Date:** 2026-04-23
**Scope:** Three UX enhancements to InsightDetailPanel and card interactions in GuestPulse / PulseBoard.

---

## 1. Cinematic Panel Entrance Animation

**Component:** `InsightDetailPanel.tsx`

Use `motion/react` (already in project via AdminSidebar) to animate the panel in and out.

### Behavior

- **Trigger:** Panel mounts when `activeInsight` is set in `GuestPulse` or `PulseBoard`. Wrap the conditional render in `AnimatePresence` so exit animation fires before unmount.
- **Backdrop:** `motion.div` animates `opacity: 0 → 0.18` at 180ms ease-out. Exit: 160ms ease-in.
- **Panel:** `motion.div` animates `x: "100%" → x: 0` with `spring({ stiffness: 280, damping: 24 })`. Produces a single clean overshoot (~6px) then snaps to rest. Exit: `x: 0 → "100%"` at 200ms ease-in (no spring on close).
- **No layout shift.** Overlay is `position: fixed`.

### Implementation notes

- `AnimatePresence` wraps `{activeInsight && <InsightDetailPanel ... />}` in each parent.
- The overlay `div` and inner panel `div` both become `motion.div`.
- Export the panel via a wrapper that handles its own `AnimatePresence` internally, or lift it to the parent — lifting is cleaner since the parent controls mount state.

---

## 2. Task Creation Modal — Full Control

**New component:** `CreateTaskModal.tsx` + `CreateTaskModal.module.css`
**Trigger:** "Create task" / "Create task + subtasks" button in `InsightDetailPanel` footer.

### UX Flow

1. User clicks "Create task" in the panel footer.
2. A centered modal opens over everything (z-index above the side panel). The side panel stays visible underneath.
3. User reviews and edits all fields, then confirms.
4. On success: modal closes, side panel closes, insight card removes itself from the feed.

### Modal Fields

| Field | Pre-fill | Control |
|---|---|---|
| Title | Insight title | Single-line text input |
| Description | Insight body | Textarea (4 rows) |
| Assigned to | Unassigned | Dropdown from `profiles` team members |
| Due date | Empty | Date input (optional) |
| Subtasks | One row per `suggestedFixes` item | Editable rows with drag handle, text, × delete |

**Subtask rows:**
- Each row: drag handle icon + editable text input + × delete button.
- "Add subtask" button at the bottom adds a blank row.
- Reorder via drag-to-reorder using `@dnd-kit/sortable` if available in the monorepo; otherwise up/down arrow buttons. Check `pnpm list` before deciding.
- If all subtasks are deleted, creates a single task with no children.

### Data flow

- `fetchAssignableProfiles()` — new server action in `insight-actions.ts` that queries `profiles` for admin users. Called once when modal opens (via `useEffect` or Suspense).
- `createTaskFromInsight` — existing server action, extended to accept `assignedTo: string | null` and `dueDate: string | null` params, and pass them to the `tasks` insert.
- On success: call `onComplete()` to remove card from feed, then close both modal and panel.

### Error handling

- If task creation fails, show inline error inside the modal footer. Modal stays open so the user doesn't lose their edits.

---

## 3. Mark Complete Button Transformation

**Component:** `InsightDetailPanel.tsx`

### Behavior

- **Default state:** "Mark complete" button renders normally as the primary footer button.
- **First click:** Sets `confirmingComplete: true`. The button area expands in place to show two inline elements side by side:
  - `[ ✓ Yes, mark done ]` — green/success color, fires `completeInsight` on click.
  - `[ Cancel ]` — ghost style, resets `confirmingComplete: false`.
- **Confirm click:** Fires `completeInsight(insight.id)`, calls `onComplete?.()`, closes panel.
- **Cancel or click-away:** Resets to default state. No action taken.
- **Layout:** Both buttons sit in the same space as the original single button. No height change, no floating element. Achieved via a conditional render swap inside the footer.

### Animation

- The swap uses a simple CSS transition on the button content (opacity + slight translateY) — no framer-motion needed here since it is in-place within the footer.

---

## File Map

### Create
- `apps/web/src/app/(admin)/admin/CreateTaskModal.tsx`
- `apps/web/src/app/(admin)/admin/CreateTaskModal.module.css`

### Modify
- `apps/web/src/app/(admin)/admin/InsightDetailPanel.tsx`
- `apps/web/src/app/(admin)/admin/InsightDetailPanel.module.css`
- `apps/web/src/app/(admin)/admin/GuestPulse.tsx`
- `apps/web/src/app/(admin)/admin/guest-pulse/PulseBoard.tsx`
- `apps/web/src/lib/admin/insight-actions.ts`

---

## Dependency Check

Before implementation: verify whether `@dnd-kit/sortable` is in the monorepo. If yes, use it for subtask reorder. If not, use up/down arrow buttons — do not add a new dependency for this.
