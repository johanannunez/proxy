# Form Settings Brand Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium form Settings Control Center with a reliable local Brand Studio for searchable icons, emoji, color, and suggestions.

**Architecture:** Keep the data model stable by reusing `forms.icon` and `forms.icon_color`. Add a client-safe symbol resolver and local search/scoring helper, replace the old appearance picker with `BrandStudio`, and reshape form Settings into a Control Center that also exposes completion behavior from the builder settings panel.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, CSS Modules, Phosphor icons, Vitest.

***

### Task 1: Local Symbol System

**Files:**
- Create: `apps/web/src/app/(admin)/admin/paperwork/forms/form-symbols.tsx`
- Create: `apps/web/src/app/(admin)/admin/paperwork/forms/form-symbol-search.ts`
- Test: `apps/web/src/app/(admin)/admin/paperwork/forms/form-symbol-search.test.ts`
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/form-icon.tsx`

- [ ] **Step 1: Write tests for resolving, searching, and suggestions**

```ts
import { describe, expect, it } from "vitest";
import {
  buildSuggestionContext,
  searchFormSymbols,
  suggestFormSymbols,
} from "./form-symbol-search";
import { resolveFormAppearance } from "./form-icon";

describe("form symbol search", () => {
  it("resolves legacy and namespaced icon values", () => {
    expect(resolveFormAppearance({ id: "form-1", icon: "wifi", icon_color: "blue" }).kind).toBe("icon");
    expect(resolveFormAppearance({ id: "form-1", icon: "icon:wifi", icon_color: "blue" }).symbolValue).toBe("icon:wifi");
  });

  it("resolves emoji codepoint values", () => {
    const resolved = resolveFormAppearance({ id: "form-1", icon: "emoji:1f4f6", icon_color: "blue" });
    expect(resolved.kind).toBe("emoji");
    expect(resolved.emoji).toBe("📶");
  });

  it("searches aliases and keywords", () => {
    const results = searchFormSymbols("wifi password");
    expect(results.some((entry) => entry.value === "icon:wifi")).toBe(true);
    expect(results.some((entry) => entry.value === "emoji:1f4f6")).toBe(true);
  });

  it("suggests wireless and key symbols for WiFi forms", () => {
    const context = buildSuggestionContext({
      name: "WiFi Information",
      description: null,
      fields: [
        { id: "name", type: "short_text", label: "Network Name (SSID)" },
        { id: "password", type: "short_text", label: "Password" },
      ],
    });
    const suggestions = suggestFormSymbols(context, 8);
    expect(suggestions.map((entry) => entry.symbol.value)).toContain("icon:wifi");
    expect(suggestions.map((entry) => entry.symbol.value)).toContain("icon:key");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `cd apps/web && pnpm test src/app/\\(admin\\)/admin/paperwork/forms/form-symbol-search.test.ts`

Expected: FAIL because the new modules do not exist yet.

- [ ] **Step 3: Implement symbol catalogs and scoring**

Create a focused catalog with Phosphor entries and curated emoji entries. Export `FORM_SYMBOLS`, `FORM_TINTS`, `resolveSymbolValue`, `emojiFromCodepoints`, `searchFormSymbols`, `buildSuggestionContext`, and `suggestFormSymbols`.

- [ ] **Step 4: Run the tests**

Run: `cd apps/web && pnpm test src/app/\\(admin\\)/admin/paperwork/forms/form-symbol-search.test.ts`

Expected: PASS.

### Task 2: Brand Studio UI

**Files:**
- Create: `apps/web/src/app/(admin)/admin/paperwork/forms/BrandStudio.tsx`
- Create: `apps/web/src/app/(admin)/admin/paperwork/forms/BrandStudio.module.css`
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/FormAppearancePicker.tsx`
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/FormAppearancePicker.module.css`

- [ ] **Step 1: Add the `BrandStudio` component**

The component accepts `form`, computes suggestions from title and fields, lets users switch between Suggested, Icons, and Emoji, filters local symbols with a search input, saves optimistically through `updateFormAppearanceAction`, and shows inline save errors.

- [ ] **Step 2: Make Brand Studio compact enough for the settings column**

Brand Studio must read as a compact control surface, not a tall library panel. Keep the whole card visually close to two settings-panel rows high by placing the preset color swatches and custom hex control on the same row, with the hex field on the right side of the swatches. Keep the symbol tray icon-only with hover/focus descriptions, and use an internal scroll region for the larger icon and emoji library so the card does not push the respondent preview too far down the page.

Use this layout target:

```text
Brand Studio                                  [preview]
Description copy
[color swatches inline]        [swatch][custom hex input][Apply]
[Search icons and emoji]
Suggested: [icon] [emoji] [icon] [icon]
Library: compact icon-only tray with internal scroll
```

- [ ] **Step 3: Keep compatibility through `FormAppearancePicker`**

Make `FormAppearancePicker` render `BrandStudio` so existing imports keep working while the new component owns the UI.

- [ ] **Step 4: Verify no native select/date/prompt APIs were introduced**

Run: `rg -n "alert\\(|confirm\\(|prompt\\(|<select|type=\"date\"|transition-all" apps/web/src/app/\\(admin\\)/admin/paperwork/forms apps/web/src/app/\\(admin\\)/admin/paperwork/templates/\\[id\\]`

Expected: no new matches from this work.

### Task 3: Form Settings Control Center

**Files:**
- Create: `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/FormSettingsControlCenter.tsx`
- Create: `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/FormSettingsControlCenter.module.css`
- Modify: `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/FormTemplateDetail.tsx`

- [ ] **Step 1: Move top-level form settings into a new component**

Create `FormSettingsControlCenter` with a summary band, Access and Publishing, Completion Behavior, Coverage, Brand Studio, Share Link, and About sections. Reuse existing actions: `publishFormAction`, `unpublishFormAction`, `toggleFormPublicAction`, `updateFormMetaAction`, and `CoverageSettingsCard`.

- [ ] **Step 2: Include completion behavior controls**

Expose form description, submit button text, thank-you message, redirect URL, and require-signature toggle. Save description through `updateFormMetaAction` and schema settings through `updateFormSchemaAction`.

- [ ] **Step 3: Replace the inline `FormSettings` in `FormTemplateDetail`**

Import and render `FormSettingsControlCenter` for the Settings tab.

### Task 4: Verification

**Files:**
- Modify as needed from earlier tasks.

- [ ] **Step 1: Run targeted tests**

Run: `cd apps/web && pnpm test src/app/\\(admin\\)/admin/paperwork/forms/form-symbol-search.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`

Expected: PASS, or report exact existing blockers if unrelated to this change.

- [ ] **Step 3: Run diff hygiene**

Run: `git diff --check`

Expected: PASS.

- [ ] **Step 4: Browser verify**

Open `http://localhost:4015/admin/paperwork/templates/d438e06a-fb6e-4135-87a4-9d8a36c0982b`, switch to Settings, and verify:

- The Control Center summary is visible.
- Brand Studio shows Suggested, Icons, and Emoji tabs.
- Brand Studio is compact, with custom hex on the same row as the color swatches.
- Brand Studio remains roughly two settings-panel rows high, with the icon/emoji library scrolling internally.
- Search finds WiFi and signal results.
- Changing color updates icon previews immediately.
- Emoji selection renders a native emoji inside the tinted tile.
- Share link, publishing, access, coverage, and completion controls still render.
