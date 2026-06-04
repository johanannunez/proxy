# Paperwork Admin Hub Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the admin documents area to "Paperwork," move routes from `/admin/documents/*` to `/admin/paperwork/*`, consolidate Documents/Forms/Templates under a "Paperwork" sub-group in the Operations nav, and add permanent redirects from old paths.

**Architecture:** Next.js App Router folder rename creates the new routes. Two redirect rules in `next.config.mjs` preserve old URLs permanently. `AdminSidebar` gains a `kind: "subgroup"` NavEntry variant to nest Paperwork inside Operations. All internal `router.push`, `href`, and `revalidatePath` calls are updated to the new paths.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, CSS Modules, Phosphor Icons.

---

### Task 1: Add permanent redirects in next.config.mjs

**Files:**
- Modify: `apps/web/next.config.mjs`

The `redirects()` function already exists in this file. Add two rules to the returned array — one for the base path, one wildcard for all sub-routes.

**Step 1: Open the file and add the two rules**

In `apps/web/next.config.mjs`, inside the `async redirects()` return array, append:

```js
{ source: "/admin/documents", destination: "/admin/paperwork", permanent: true },
{ source: "/admin/documents/:path+", destination: "/admin/paperwork/:path+", permanent: true },
```

The `:path+` pattern matches one or more segments (e.g. `forms`, `templates`, `forms/abc123/edit`). The exact `/admin/documents` rule is needed separately because `:path+` does not match a path with zero trailing segments.

**Step 2: TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add apps/web/next.config.mjs
git commit -m "feat: add permanent redirects from /admin/documents to /admin/paperwork"
```

---

### Task 2: Rename the route folder

**Files:**
- Move: `apps/web/src/app/(admin)/admin/documents/` → `apps/web/src/app/(admin)/admin/paperwork/`

Next.js App Router derives URLs from folder names. This one rename moves all routes: the hub, forms, templates, and all nested routes.

**Step 1: Git-rename the folder**

Run from the repo root (not `apps/web/`):

```bash
git mv "apps/web/src/app/(admin)/admin/documents" "apps/web/src/app/(admin)/admin/paperwork"
```

**Step 2: Verify folder structure**

```bash
ls "apps/web/src/app/(admin)/admin/paperwork/"
```

Expected: `DocumentDrawer.module.css  DocumentDrawer.tsx  DocumentsHub.module.css  DocumentsHub.tsx  document-actions.ts  forms/  page.tsx  templates/`

**Step 3: Start dev server and verify new routes**

```bash
cd apps/web && doppler run -- next dev -p 4000
```

Navigate to each URL in the browser and confirm it renders (no 404):
- `http://localhost:4000/admin/paperwork`
- `http://localhost:4000/admin/paperwork/forms`
- `http://localhost:4000/admin/paperwork/templates`

**Step 4: Verify old routes redirect**

- `http://localhost:4000/admin/documents` — should redirect to `/admin/paperwork`
- `http://localhost:4000/admin/documents/forms` — should redirect to `/admin/paperwork/forms`
- `http://localhost:4000/admin/documents/templates` — should redirect to `/admin/paperwork/templates`

In a browser, a 308 permanent redirect will land you on the new URL. Confirm the final URL in the address bar.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: move route folder from /admin/documents to /admin/paperwork"
```

---

### Task 3: Update page metadata title

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/paperwork/page.tsx`

Only the hub page has a `metadata` export. Forms and templates pages do not — nothing to change there.

**Step 1: Change the title**

In `apps/web/src/app/(admin)/admin/paperwork/page.tsx`, find:

```typescript
export const metadata: Metadata = { title: "Documents" };
```

Replace with:

```typescript
export const metadata: Metadata = { title: "Paperwork" };
```

**Step 2: Commit**

```bash
git add "apps/web/src/app/(admin)/admin/paperwork/page.tsx"
git commit -m "feat: update page title to Paperwork"
```

---

### Task 4: Update revalidatePath calls

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/paperwork/document-actions.ts` (3 occurrences)
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/form-actions.ts` (7 occurrences)
- Modify: `apps/web/src/lib/admin/w9-review.ts` (2 occurrences)

`revalidatePath` calls must point to the current route path or Next.js will not invalidate the right cache.

**Step 1: document-actions.ts**

Find all 3 occurrences of `revalidatePath("/admin/documents")` and replace with `revalidatePath("/admin/paperwork")`.

Verify count before editing:
```bash
grep -c 'revalidatePath("/admin/documents")' "apps/web/src/app/(admin)/admin/paperwork/document-actions.ts"
```
Expected: `3`

**Step 2: form-actions.ts**

Find all 7 occurrences of `revalidatePath("/admin/documents/forms")` and replace with `revalidatePath("/admin/paperwork/forms")`.

Verify count:
```bash
grep -c 'revalidatePath("/admin/documents/forms")' "apps/web/src/app/(admin)/admin/paperwork/forms/form-actions.ts"
```
Expected: `7`

**Step 3: w9-review.ts**

Find both occurrences of `revalidatePath("/admin/documents")` and replace with `revalidatePath("/admin/paperwork")`.

Verify count:
```bash
grep -c 'revalidatePath("/admin/documents")' apps/web/src/lib/admin/w9-review.ts
```
Expected: `2`

**Step 4: Confirm zero remaining references**

```bash
grep -r '/admin/documents' apps/web/src --include="*.ts" --include="*.tsx" -l
```

Expected: zero output. If any files remain, check them and update.

**Step 5: TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: zero errors.

**Step 6: Commit**

```bash
git add \
  "apps/web/src/app/(admin)/admin/paperwork/document-actions.ts" \
  "apps/web/src/app/(admin)/admin/paperwork/forms/form-actions.ts" \
  "apps/web/src/lib/admin/w9-review.ts"
git commit -m "feat: update revalidatePath calls to /admin/paperwork"
```

---

### Task 5: Update internal navigation links in components

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/FormsHub.tsx` (4 occurrences)
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/[id]/edit/FormBuilderCanvas.tsx` (1 occurrence)
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/[id]/responses/FormResponsesHub.tsx` (1 occurrence)
- Modify: `apps/web/src/app/(admin)/admin/paperwork/forms/[id]/responses/ResponsesHub.tsx` (1 occurrence)

These are `router.push(...)` calls and `href` strings that hard-code the old path.

**Step 1: FormsHub.tsx (4 occurrences)**

Replace every instance of `"/admin/documents/forms` (note: this is a prefix — catches both string literals and template literal starts) with `"/admin/paperwork/forms`.

Verify before editing:
```bash
grep -c '/admin/documents/forms' "apps/web/src/app/(admin)/admin/paperwork/forms/FormsHub.tsx"
```
Expected: `4`

**Step 2: FormBuilderCanvas.tsx (1 occurrence)**

Same replacement. Expected count: `1`

**Step 3: FormResponsesHub.tsx (1 occurrence)**

Same replacement. Expected count: `1`

**Step 4: ResponsesHub.tsx (1 occurrence)**

Same replacement. Expected count: `1`

**Step 5: TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: zero errors.

**Step 6: Commit**

```bash
git add "apps/web/src/app/(admin)/admin/paperwork/forms/"
git commit -m "feat: update internal links to /admin/paperwork/forms"
```

---

### Task 6: Extend AdminSidebar to support subgroups

**Files:**
- Modify: `apps/web/src/components/admin/AdminSidebar.tsx`

Currently, `NavEntry` supports `kind: "item"` (leaf link) and `kind: "group"` (collapsible section with flat items). This task adds `kind: "subgroup"` so a group can contain a nested collapsible section.

**Step 1: Read AdminSidebar.tsx**

Open the file. Find:
1. The `NavEntry` / `NavItem` / `NavGroup` type definitions.
2. The `storageKey` pattern used in groups (uses `localStorage` or a `useLocalStorage` hook).
3. The group items renderer — the JSX that maps over `group.items` and renders each item. Find the component name for a leaf nav item (e.g. `NavItemLink` or inline JSX).
4. Any existing icon imports at the top.

**Step 2: Add the NavSubGroup type**

After the existing `NavItem` and `NavGroup` types, add:

```typescript
type NavSubGroup = {
  kind: "subgroup"
  label: string
  icon: React.ReactNode
  storageKey: string
  matchPrefix: string
  items: NavItem[]
}
```

Add `NavSubGroup` to the `NavEntry` union (alongside `NavItem` and `NavGroup`). Also add it to the `items` array type inside `NavGroup` so a group can contain subgroups:

```typescript
// Before
items: NavItem[]

// After
items: (NavItem | NavSubGroup)[]
```

**Step 3: Add the SubGroupNav component**

Add this component just above the main sidebar export. Adapt `useLocalStorage` and the leaf item renderer to match what the file already uses (look for the pattern handling `storageKey` in existing groups).

```tsx
function SubGroupNav({
  entry,
  pathname,
}: {
  entry: NavSubGroup
  pathname: string
}) {
  const isActive = pathname.startsWith(entry.matchPrefix)
  const [expanded, setExpanded] = useLocalStorage(entry.storageKey, isActive)

  return (
    <div className={styles.subGroup}>
      <button
        className={clsx(styles.subGroupTrigger, isActive && styles.subGroupTriggerActive)}
        onClick={() => setExpanded(!expanded)}
      >
        {entry.icon}
        <span>{entry.label}</span>
        <CaretDown
          size={11}
          weight="bold"
          className={clsx(styles.subGroupCaret, expanded && styles.subGroupCaretOpen)}
        />
      </button>
      {expanded && (
        <div className={styles.subGroupItems}>
          {entry.items.map((item) => (
            /* Use whatever component/JSX the file already uses to render a NavItem leaf */
            <NavItemRenderer key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  )
}
```

`CaretDown` is from `@phosphor-icons/react`. Add it to the import if not already present.

`NavItemRenderer` is a placeholder name — substitute whatever the file calls the component or inline JSX that renders a single `kind: "item"` leaf. Look at how the group items renderer maps over its `items` array to find the right name.

**Step 4: Wire SubGroupNav into the group items renderer**

In the section that renders items inside a group, add a branch for `kind === "subgroup"`:

```tsx
{item.kind === "subgroup" && (
  <SubGroupNav key={item.label} entry={item} pathname={pathname} />
)}
```

Place it alongside the existing `kind === "item"` branch.

**Step 5: Add CSS for the subgroup**

Open the CSS module used by `AdminSidebar.tsx` (look at the `styles` import at the top of the file). Add these classes at the end. Match CSS variable names to what the file already uses for nav item colors — do not hardcode hex values.

```css
.subGroup {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.subGroupTrigger {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--nav-item-text, #6b7280);
  cursor: pointer;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  transition: color 150ms ease, background-color 150ms ease;
}

.subGroupTrigger:hover {
  color: var(--nav-item-text-hover, #1a1a1a);
  background-color: var(--nav-item-bg-hover, rgba(0,0,0,0.05));
}

.subGroupTriggerActive {
  color: var(--nav-item-text-active, #1a1a1a);
}

.subGroupItems {
  display: flex;
  flex-direction: column;
  padding-left: 14px;
  gap: 1px;
}

.subGroupCaret {
  margin-left: auto;
  opacity: 0.5;
  transition: transform 150ms ease;
}

.subGroupCaretOpen {
  transform: rotate(180deg);
}
```

**Step 6: TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: zero errors.

**Step 7: Commit**

```bash
git add apps/web/src/components/admin/AdminSidebar.tsx
git commit -m "feat: add NavSubGroup type and SubGroupNav component to AdminSidebar"
```

---

### Task 7: Rewire AdminSidebar nav entries

**Files:**
- Modify: `apps/web/src/components/admin/AdminSidebar.tsx`

Three changes in one file: nav entries, topbar title logic, icon rail matchPrefixes.

**Step 1: Replace the three document items with one Paperwork subgroup**

In the `navEntries` array, find the Operations group `items` array. It currently contains:

```typescript
{ href: "/admin/documents", label: "Documents", icon: <Files size={16} weight="duotone" />, matchPrefix: "/admin/documents" },
{ href: "/admin/documents/templates", label: "Templates", icon: <FileDashed size={16} weight="duotone" />, matchPrefix: "/admin/documents/templates" },
{ href: "/admin/documents/forms", label: "Forms", icon: <Clipboard size={16} weight="duotone" />, matchPrefix: "/admin/documents/forms" },
```

Replace these three items with one subgroup entry:

```typescript
{
  kind: "subgroup",
  label: "Paperwork",
  icon: <Files size={16} weight="duotone" />,
  storageKey: "nav-paperwork-expanded",
  matchPrefix: "/admin/paperwork",
  items: [
    { kind: "item", href: "/admin/paperwork", label: "Documents", icon: <Files size={15} weight="duotone" />, matchPrefix: "/admin/paperwork" },
    { kind: "item", href: "/admin/paperwork/forms", label: "Forms", icon: <Clipboard size={15} weight="duotone" />, matchPrefix: "/admin/paperwork/forms" },
    { kind: "item", href: "/admin/paperwork/templates", label: "Templates", icon: <FileDashed size={15} weight="duotone" />, matchPrefix: "/admin/paperwork/templates" },
  ],
},
```

Note on the Documents item's `matchPrefix`: it intentionally uses `/admin/paperwork` (the full paperwork prefix) not `/admin/paperwork/documents`. The Documents page IS the hub at `/admin/paperwork`. However, this means it will highlight for every paperwork sub-route too. If the file supports an `exact` match option on nav items, use `exact: true` on the Documents item and leave matchPrefix off. If not, this is acceptable behavior for a hub link.

**Step 2: Update the AdminTopBar pageTitle logic**

Find the line (around line 604):

```typescript
if (pathname.startsWith("/admin/documents")) return "Documents";
```

Replace with:

```typescript
if (pathname.startsWith("/admin/paperwork")) return "Paperwork";
```

**Step 3: Update AdminIconRail matchPrefixes**

Find the Operations icon rail entry (around line 721). It has a `matchPrefixes` array that includes `"/admin/documents"`. Replace it with `"/admin/paperwork"`:

```typescript
// Before
matchPrefixes: ["/admin/properties", "/admin/documents", "/admin/projects", "/admin/guest-pulse"],

// After
matchPrefixes: ["/admin/properties", "/admin/paperwork", "/admin/projects", "/admin/guest-pulse"],
```

**Step 4: TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: zero errors.

**Step 5: Visual check in browser**

Navigate to each URL and confirm:

| URL | Expected sidebar state |
|---|---|
| `/admin/paperwork` | Paperwork subgroup open; Documents item highlighted |
| `/admin/paperwork/forms` | Paperwork subgroup open; Forms item highlighted |
| `/admin/paperwork/templates` | Paperwork subgroup open; Templates item highlighted |

Also confirm the topbar shows "Paperwork" as the section title for all three routes.

Collapse the Paperwork subgroup, refresh the page — confirm it stays collapsed (localStorage persistence).

**Step 6: Commit**

```bash
git add apps/web/src/components/admin/AdminSidebar.tsx
git commit -m "feat: add Paperwork subgroup to Operations nav, update topbar title and icon rail"
```

---

### Task 8: Update AdminBottomNav (mobile)

**Files:**
- Modify: `apps/web/src/components/admin/AdminBottomNav.tsx`

Mobile nav only showed a single "Documents" entry in the Operations group (Templates and Forms were not shown separately). Update to "Paperwork" with the new route.

**Step 1: Find the Documents entry**

Find the Operations group in the More sheet (around line 117):

```typescript
{ href: "/admin/documents", label: "Documents", icon: <Files size={17} weight="duotone" />, matchPrefix: "/admin/documents" }
```

**Step 2: Update href, label, and matchPrefix**

```typescript
{ href: "/admin/paperwork", label: "Paperwork", icon: <Files size={17} weight="duotone" />, matchPrefix: "/admin/paperwork" }
```

**Step 3: TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: zero errors.

**Step 4: Visual check (mobile viewport)**

Open `http://localhost:4000/admin/paperwork` at 375px viewport width. Open the "More" sheet and confirm "Paperwork" appears in the Operations group and is highlighted when on any `/admin/paperwork/*` route.

**Step 5: Commit**

```bash
git add apps/web/src/components/admin/AdminBottomNav.tsx
git commit -m "feat: update admin bottom nav to Paperwork label and /admin/paperwork route"
```

---

### Task 9: Final verification

**Step 1: Full TypeScript check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: zero errors.

**Step 2: Grep for any remaining /admin/documents references**

```bash
grep -r '/admin/documents' apps/web/src --include="*.ts" --include="*.tsx"
```

Expected: zero output. If any remain, fix them before continuing.

**Step 3: Route verification checklist**

With dev server running on port 4000, verify each URL:

| URL | Expected |
|---|---|
| `/admin/paperwork` | Documents hub renders (200) |
| `/admin/paperwork/forms` | Forms hub renders (200) |
| `/admin/paperwork/templates` | Templates hub renders (200) |
| `/admin/paperwork/forms/[real-id]/edit` | Form builder renders (200) |
| `/admin/paperwork/forms/[real-id]/responses` | Responses hub renders (200) |
| `/admin/documents` | Redirects to `/admin/paperwork` |
| `/admin/documents/forms` | Redirects to `/admin/paperwork/forms` |
| `/admin/documents/templates` | Redirects to `/admin/paperwork/templates` |
| `/admin/documents/forms/[id]/edit` | Redirects to `/admin/paperwork/forms/[id]/edit` |

For the redirect rows: the browser's final URL should be the `/admin/paperwork/...` destination.

**Step 4: Auth check**

Open an incognito window and navigate to `http://localhost:4000/admin/paperwork`. Expected: redirected to `/login`.

**Step 5: Final commit for any stray changes**

```bash
git status
# If any uncommitted changes remain, commit them with an appropriate message
```
