"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { HelpArticleEditor } from "@/components/help/HelpArticleEditor";
import { parseAlcoveDraft, type ContentType } from "@/lib/admin/help-intake-parser";
import { createArticle, checkSlugExists } from "../actions";
import { WORKSPACE_ROUTE_GROUPS } from "../workspace-routes";

type Category = { id: string; name: string; slug: string };

type SlugStatus = "idle" | "checking" | "available" | "taken";

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; hint: string }[] = [
  { value: "help", label: "Help", hint: "3-4 word descriptive slug" },
  { value: "policy", label: "Policy", hint: "2-3 word authoritative slug" },
  { value: "blog", label: "Blog", hint: "4-5 word SEO slug, no portal path" },
  { value: "flagship", label: "Flagship", hint: "Manually enter a short slug, premium namespace" },
];

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "how", "when",
  "what", "where", "who", "why", "which", "that", "this", "these",
  "those", "you", "we", "i", "it", "they", "he", "she", "just", "vs",
  "versus", "not", "no", "if", "then", "than", "your", "our",
]);

const MAX_SLUG_WORDS: Record<ContentType, number> = {
  help: 4,
  policy: 3,
  blog: 5,
  flagship: 2,
};

function smartSlugify(text: string, type: ContentType): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  const selected = meaningful.length > 0 ? meaningful : words;
  return selected.slice(0, MAX_SLUG_WORDS[type]).join("-");
}

const fieldStyle = {
  borderColor: "var(--color-warm-gray-200)",
  backgroundColor: "var(--color-white)",
  color: "var(--color-text-primary)",
};

const labelStyle = { color: "var(--color-text-secondary)" };

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span
        className="shrink-0 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-text-tertiary, #9ca3af)" }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ backgroundColor: "var(--color-warm-gray-100)" }} />
    </div>
  );
}

function SlugStatusBadge({ status }: { status: SlugStatus }) {
  if (status === "idle") return null;
  if (status === "checking")
    return (
      <span className="text-[11px]" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
        Checking...
      </span>
    );
  if (status === "available")
    return (
      <span className="text-[11px] font-medium" style={{ color: "var(--color-success, #16a34a)" }}>
        Available
      </span>
    );
  return (
    <span className="text-[11px] font-medium" style={{ color: "var(--color-error, #dc2626)" }}>
      Already in use
    </span>
  );
}

export function IntakePage({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"paste" | "review">("paste");
  const [rawText, setRawText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const [contentType, setContentType] = useState<ContentType>("help");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [readTime, setReadTime] = useState<number | "">(5);
  const [workspacePath, setWorkspacePath] = useState("");
  const [workspacePathEditing, setWorkspacePathEditing] = useState(false);
  const [needsVisual, setNeedsVisual] = useState(false);
  const [needsVisualDismissed, setNeedsVisualDismissed] = useState(false);
  const [publishedInfo, setPublishedInfo] = useState<{
    title: string;
    slug: string;
    categorySlug: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug.trim() || contentType === "flagship") {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      const exists = await checkSlugExists(slug);
      setSlugStatus(exists ? "taken" : "available");
    }, 350);
    return () => clearTimeout(timer);
  }, [slug, contentType]);

  function handleParse() {
    const parsed = parseAlcoveDraft(rawText);
    if (!parsed) {
      setParseError(
        "Could not parse the draft. Make sure you pasted the full output from Alcove, including all required fields."
      );
      return;
    }
    setParseError(null);
    setContentType(parsed.contentType);
    setTitle(parsed.title);
    setSlugManual(false);

    if (parsed.contentType === "flagship") {
      setSlug("");
    } else if (parsed.suggestedSlug) {
      setSlug(parsed.suggestedSlug);
      setSlugManual(true);
    } else {
      setSlug(smartSlugify(parsed.title, parsed.contentType));
    }

    setSummary(parsed.summary);
    setContent(parsed.content);
    setTags(parsed.tags.join(", "));
    setReadTime(parsed.readTimeMinutes);
    setWorkspacePath(parsed.suggestedWorkspacePath ?? "");
    setWorkspacePathEditing(!parsed.suggestedWorkspacePath);
    setNeedsVisual(parsed.needsVisual);
    setNeedsVisualDismissed(false);

    const matched = categories.find(
      (c) => c.name.toLowerCase() === parsed.suggestedCategory.toLowerCase()
    );
    setCategoryId(matched?.id ?? categories[0]?.id ?? "");

    setPhase("review");
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugManual && contentType !== "flagship") {
      setSlug(smartSlugify(value, contentType));
    }
  }

  function handleContentTypeChange(type: ContentType) {
    setContentType(type);
    if (!slugManual && type !== "flagship") {
      setSlug(smartSlugify(title, type));
    }
    if (type === "flagship") setSlug("");
    if (type === "blog") setWorkspacePath("");
  }

  function buildFormData(status: "draft" | "published"): FormData {
    const fd = new FormData();
    fd.set("title", title);
    fd.set("slug", slug);
    fd.set("summary", summary);
    fd.set("content", content);
    fd.set("category_id", categoryId);
    fd.set("content_type", contentType);
    fd.set("related_portal_path", workspacePath);
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tagList.includes("source:ai-intake")) tagList.push("source:ai-intake");
    fd.set("tags", tagList.join(", "));
    fd.set("read_time_minutes", String(readTime !== "" ? readTime : 5));
    fd.set("status", status);
    return fd;
  }

  function handleSave(status: "draft" | "published") {
    setSaveError(null);
    startTransition(async () => {
      try {
        await createArticle(buildFormData(status));
        if (status === "published") {
          const selectedCategory = categories.find((c) => c.id === categoryId);
          setPublishedInfo({
            title,
            slug,
            categorySlug: selectedCategory?.slug ?? "",
          });
        } else {
          router.push("/admin/help");
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save article.");
      }
    });
  }

  if (publishedInfo) {
    const liveUrl = `/help/${publishedInfo.categorySlug}/${publishedInfo.slug}`;
    return (
      <div className="flex flex-col items-center gap-8 py-16 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{ backgroundColor: "var(--color-success-subtle, #dcfce7)", color: "var(--color-success, #16a34a)" }}
        >
          ✓
        </div>
        <div className="flex flex-col gap-2">
          <h2
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Article Published
          </h2>
          <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
            {publishedInfo.title}
          </p>
          <p
            className="mt-1 font-mono text-sm"
            style={{ color: "var(--color-text-tertiary, #9ca3af)" }}
          >
            {liveUrl}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            View live article →
          </a>
          <button
            onClick={() => router.push("/admin/help")}
            className="inline-flex items-center gap-2 rounded-lg border px-6 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-primary)",
            }}
          >
            Back to Help Center
          </button>
        </div>
      </div>
    );
  }

  if (phase === "paste") {
    return (
      <div className="flex flex-col gap-4">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="w-full rounded-lg border px-4 py-3 text-sm font-mono outline-none transition-colors"
          style={{ ...fieldStyle, minHeight: "340px", resize: "vertical" }}
          placeholder={`Paste the full Alcove output here, e.g.:

---
TITLE: How do we handle items damaged by guests?

SUMMARY: ...

CONTENT:
## The core tradeoff
...

TAGS: damage, refunds, guest policy

CATEGORY: Guest Management

READ TIME: 3

CONTENT_TYPE: help

SLUG: damage-claim-process

PORTAL_PATH: none

NEEDS_VISUAL: false
---`}
        />

        {parseError && (
          <p className="text-sm" style={{ color: "var(--color-error, #dc2626)" }}>
            {parseError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            Parse and Review
          </button>
        </div>
      </div>
    );
  }

  const showWorkspacePath = contentType !== "blog";

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => setPhase("paste")}
        className="self-start text-sm font-medium transition-colors"
        style={{ color: "var(--color-text-secondary)" }}
      >
        &larr; Start over
      </button>

      {/* Content type selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Content Type
        </span>
        <div className="flex gap-2">
          {CONTENT_TYPE_OPTIONS.map((opt) => {
            const active = contentType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleContentTypeChange(opt.value)}
                className="rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
                style={
                  active
                    ? {
                        backgroundColor: "var(--color-brand)",
                        color: "#fff",
                      }
                    : {
                        backgroundColor: "var(--color-warm-gray-50, #fafaf9)",
                        borderColor: "var(--color-warm-gray-200)",
                        border: "1px solid var(--color-warm-gray-200)",
                        color: "var(--color-text-secondary)",
                      }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px]" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
          {CONTENT_TYPE_OPTIONS.find((o) => o.value === contentType)?.hint}
        </p>
      </div>

      <SectionDivider label="Article" />

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
          style={fieldStyle}
        />
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Slug
          </label>
          <SlugStatusBadge status={slugStatus} />
        </div>
        {contentType === "flagship" ? (
          <>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlugManual(true); setSlug(e.target.value); }}
              className="rounded-lg border px-4 py-2.5 text-sm font-mono outline-none transition-colors"
              style={{
                ...fieldStyle,
                borderColor: "var(--color-warning, #d97706)",
              }}
              placeholder="e.g. owners or how-it-works"
            />
            <p className="text-[11px]" style={{ color: "var(--color-warning, #d97706)" }}>
              Flagship slugs are premium namespace. Enter one manually — short, deliberate, never generated.
            </p>
          </>
        ) : (
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlugManual(true); setSlug(e.target.value); }}
            className="rounded-lg border px-4 py-2.5 text-sm font-mono outline-none transition-colors"
            style={{
              ...fieldStyle,
              borderColor:
                slugStatus === "taken"
                  ? "var(--color-error, #dc2626)"
                  : slugStatus === "available"
                  ? "var(--color-success, #16a34a)"
                  : "var(--color-warm-gray-200)",
            }}
          />
        )}
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Category
        </label>
        <CustomSelect
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: "", label: "No category" },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
      </div>

      <SectionDivider label="Content" />

      {/* Needs-visual banner */}
      {needsVisual && !needsVisualDismissed && (
        <div
          className="flex items-start justify-between gap-4 rounded-lg px-4 py-3"
          style={{
            backgroundColor: "var(--color-warning-subtle, #fffbeb)",
            border: "1px solid var(--color-warning-border, #fde68a)",
          }}
        >
          <div className="flex gap-2.5">
            <span style={{ color: "var(--color-warning, #d97706)" }}>⚠</span>
            <p className="text-sm" style={{ color: "var(--color-warning-text, #92400e)" }}>
              This article describes a process. Consider adding screenshots or numbered steps before publishing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNeedsVisualDismissed(true)}
            className="shrink-0 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--color-warning, #d97706)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Summary
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
          style={{ ...fieldStyle, minHeight: "72px", resize: "vertical" }}
        />
        <p className="text-[11px]" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
          Shown in search results. 1-2 sentences.
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Content
        </label>
        <HelpArticleEditor content={content} onChange={setContent} />
      </div>

      <SectionDivider label="Discovery" />

      {/* Tags + Read Time */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Tags
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          />
          <p className="text-[11px]" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
            Comma-separated. <code>source:ai-intake</code> added automatically.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Read Time (min)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={readTime}
            onChange={(e) =>
              setReadTime(e.target.value === "" ? "" : parseInt(e.target.value, 10))
            }
            className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          />
        </div>
      </div>

      {/* Workspace Path */}
      {showWorkspacePath && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Workspace Path
          </label>

          {workspacePath && !workspacePathEditing ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-warm-gray-50, #fafaf9)",
                  color: "var(--color-text-primary)",
                }}
              >
                {workspacePath}
                <button
                  type="button"
                  onClick={() => { setWorkspacePath(""); setWorkspacePathEditing(true); }}
                  className="ml-1 opacity-50 transition-opacity hover:opacity-100"
                  aria-label="Clear portal path"
                >
                  ×
                </button>
              </span>
              <button
                type="button"
                onClick={() => setWorkspacePathEditing(true)}
                className="text-xs font-medium transition-colors"
                style={{ color: "var(--color-brand)" }}
              >
                Edit
              </button>
            </div>
          ) : (
            <CustomSelect
              value={workspacePath}
              onChange={(value) => {
                setWorkspacePath(value);
                if (value) setWorkspacePathEditing(false);
              }}
              placeholder="No portal path"
              groups={[
                {
                  label: "General",
                  options: [{ value: "", label: "No portal path" }],
                },
                ...WORKSPACE_ROUTE_GROUPS.map((group) => ({
                  label: group.label,
                  options: group.routes.map((route) => ({
                    value: route.path,
                    label: `${route.label} (${route.path})`,
                  })),
                })),
              ]}
            />
          )}

          <p className="text-[11px]" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
            Links this article to a portal page for contextual help. Suggested by Alcove based on article content.
          </p>
        </div>
      )}

      <SectionDivider label="Publish" />

      {categories.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-error, #dc2626)" }}>
          No help categories exist yet. Create at least one category before publishing.
        </p>
      )}

      {saveError && (
        <p className="text-sm" style={{ color: "var(--color-error, #dc2626)" }}>
          {saveError}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pb-2">
        <button
          onClick={() => handleSave("draft")}
          disabled={isPending || !title.trim() || !categoryId}
          className="inline-flex items-center gap-2 rounded-lg border px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-primary)",
          }}
        >
          {isPending ? "Saving..." : "Save as Draft"}
        </button>
        <button
          onClick={() => handleSave("published")}
          disabled={isPending || !title.trim() || !categoryId || slugStatus === "taken" || (contentType === "flagship" && !slug.trim())}
          className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {isPending ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}
