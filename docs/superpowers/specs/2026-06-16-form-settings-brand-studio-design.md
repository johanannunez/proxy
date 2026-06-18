# Form Settings Control Center And Brand Studio Design Spec

Date: 2026-06-16
Surface: `/admin/paperwork/templates/[id]` for form templates
Status: Approved design, pending implementation plan

***

## Problem

The form template Settings page is functional but flat. The current page is a
set of separate cards: Publishing, Appearance, Coverage, Share link, and About
this template. The builder also has a separate right-side Settings panel for
description, submit text, thank-you copy, redirect URL, and signature
requirement. Together they work, but they do not feel like one premium control
surface.

The Appearance card is also too small for what form identity needs to become.
It supports only a small Phosphor icon catalog and a few accent colors. There is
no emoji mode, no search, and no smart recommendation flow from the form title
or field labels.

## Decision

Redesign form Settings as a **Control Center** with a strong **Brand Studio**
inside it.

The Control Center is the operator-facing page for deciding whether a form is
ready, how it appears, how people access it, what happens after submission, and
whether it is tracked in coverage.

Brand Studio becomes the identity editor. It supports a larger local icon
catalog, a Notion-like emoji picker, instant search, and deterministic local
suggestions based on the form name, description, and field labels. It must not
depend on AI or network calls in its default path.

## Reliability Principle

Brand Studio v1 is **local, fast, searchable, and deterministic**.

- All icon and emoji data lives in local TypeScript catalogs.
- Search runs in the browser against labels, aliases, categories, and keywords.
- Suggestions use a pure local scoring function.
- No server call, AI call, or third-party dependency is required to open,
  search, or save the picker.
- AI may be added later only as an optional "Improve suggestions" action. It is
  not part of the default picker path.

This keeps the picker hard to break and makes the interaction feel immediate.

***

## Layout

### Page Header Summary

Add a compact form summary band above the settings content:

- Form identity chip: selected icon or emoji, selected tint, form name.
- Status atom: Published or Draft.
- Access atom: Public or Private.
- Response atom: response count.
- Coverage atom: Tracked or Not tracked.
- Share atom: link ready or link unavailable.

This makes the page answer "what is the current setup?" before the operator
starts changing controls.

### Main Grid

Use a two-column settings grid on desktop and one column on narrower screens.
The left column holds operational setup. The right column holds identity and
preview.

Left column:

1. Access and publishing.
2. Completion behavior.
3. Coverage tracking.
4. Metadata.

Right column:

1. Brand Studio.
2. Live respondent preview or compact share preview.

Do not make every item a card inside a card. Each settings group should be a
single surface with row separators and clear headings.

***

## Brand Studio

### Structure

Brand Studio has three internal tabs:

1. **Suggested**
2. **Icons**
3. **Emoji**

The preview chip stays visible at the top of the studio while switching tabs.
Changing color updates every vector icon tile, the preview chip, selected
states, library rows, and the Control Center summary.

### Suggested Tab

Suggested shows 6 to 10 best matches from the local scorer.

Inputs:

- Form name.
- Form description.
- Field labels.
- Field placeholders.
- Field types.

For the current `WiFi Information` form, suggestions should prioritize
wireless, key, home, setup, clipboard, utility, and maintenance concepts.

The tab shows mixed results from icons and emoji. Each result displays:

- Symbol preview.
- Label.
- Type badge: Icon or Emoji.
- Optional reason, such as "Matched Network Name" or "Matched Password."

The picker should still work if the form has no fields. In that case it scores
from the title only.

### Icons Tab

Expand the Phosphor icon catalog into categories:

- Property
- Access
- Utilities
- Documents
- Compliance
- Money
- Maintenance
- Hospitality
- People
- Surveys
- General

Search filters across all categories. Empty search returns categorized groups.
The icon glyph color comes from the selected tint.

### Emoji Tab

The emoji picker borrows the Notion interaction model:

- Search input at the top.
- Suggested row when a query or form context exists.
- Category sections.
- Recent picks stored locally in browser storage.
- Click to select.

Emoji glyphs render in native color. The selected tint still controls the
background tile, ring, and accent treatment around the emoji.

### Color Behavior

The color picker remains separate from symbol choice.

Color affects:

- Icon glyph color.
- Icon tile background.
- Selected icon state.
- Emoji tile background and ring.
- Control Center summary chip.
- Forms library row or card.

Color does not recolor the native emoji glyph itself.

***

## Data Model

Reuse existing fields:

- `forms.icon`
- `forms.icon_color`

No migration is required for v1.

Use namespaced values for new saves:

```ts
type FormSymbolValue =
  | `icon:${string}`
  | `emoji:${string}`;
```

Examples:

- `icon:wifi`
- `icon:key`
- `emoji:1f4f6`

The emoji value stores a stable Unicode codepoint sequence, not a raw glyph.
The renderer converts that codepoint sequence to the visible emoji. This avoids
surprises with invisible variation selectors and keeps saved values readable.

Legacy unprefixed icon keys, such as `wifi`, remain supported forever by the
resolver. New saves should use the prefixed format.

`forms.icon_color` continues to store the tint key.

## Local Search And Suggestion Engine

Create a small client-safe symbol system:

```ts
type SymbolKind = "icon" | "emoji";

type FormSymbol = {
  value: FormSymbolValue;
  kind: SymbolKind;
  label: string;
  category: string;
  keywords: string[];
  aliases: string[];
};
```

Suggestion scoring:

1. Normalize the form title, description, field labels, placeholders, and field
   types into lowercase tokens.
2. Score exact keyword and alias matches highest.
3. Score partial matches lower.
4. Give a small boost when a field type matches a symbol category, for example
   file upload to Documents, signature to Documents or Compliance, date to
   Calendar.
5. Deduplicate by concept, then return the top mixed icon and emoji results.

Search behavior:

- Query matches label, aliases, category, and keywords.
- Query with no results shows a calm empty state.
- Search never mutates saved data until a symbol is selected.

***

## Form Settings Consolidation

Move the builder-only settings into the top-level Settings page so form setup
has one home:

- Form description.
- Submit button text.
- Thank-you message.
- Redirect URL.
- Require signature at end.

The builder can still expose quick access to these controls in the right panel,
but the top-level Settings page is the source of truth for full setup.

## Interactions

- Symbol selection saves optimistically through the existing
  `updateFormAppearanceAction`.
- Color selection saves optimistically and updates all previews immediately.
- Failed saves show inline error text in the Brand Studio surface.
- Copy and open share link behavior stays unchanged.
- Publishing, access, coverage, and metadata controls stay explicit. No
  `alert()`, `confirm()`, or `prompt()`.

## Components

New or revised units should stay small:

- `form-symbols.tsx`: icon catalog, emoji catalog exports, and symbol resolver.
- `form-symbol-search.ts`: normalization, search, and suggestion scoring.
- `BrandStudio.tsx`: picker UI and save orchestration.
- `BrandStudio.module.css`: studio layout and symbol grid styling.
- `FormSettingsControlCenter.tsx`: top-level form settings layout.
- `FormSettingsControlCenter.module.css`: Control Center layout.

Keep `FormAppearancePicker` as a compatibility wrapper only if that reduces
implementation risk. Otherwise replace it with `BrandStudio`.

## Testing

Unit tests:

- Legacy icon values resolve correctly.
- Prefixed icon values resolve correctly.
- Emoji codepoint values resolve to visible emoji.
- Color fallback remains deterministic.
- Search matches labels, aliases, categories, and keywords.
- Suggestions rank title and field-label matches ahead of generic symbols.

Component tests:

- Color changes update icon tiles and preview.
- Emoji selection saves the expected namespaced value.
- Search filters the catalog without saving.
- Suggested results render when the form has title and fields.
- Empty forms still get title-based suggestions.

Manual browser checks:

- Current WiFi form suggests wireless and key concepts.
- Settings page works on desktop and mobile widths.
- The form library still renders older unprefixed icons.
- The current selected color updates all vector icon previews.
- Native emoji glyphs stay readable on every tint.

## Out Of Scope

- AI-powered symbol generation.
- Per-form font or full theme editing.
- Custom uploaded icons.
- Database migration for appearance values.
- Redesigning signature-template Settings in this pass.
