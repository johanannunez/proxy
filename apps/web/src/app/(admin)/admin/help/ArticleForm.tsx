"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { HelpArticleEditor } from "@/components/help/HelpArticleEditor";
import { checkSlugExists } from "./actions";
import { WORKSPACE_ROUTE_GROUPS } from "./workspace-routes";
import type { ContentType } from "@/lib/admin/help-intake-parser";

type Category = { id: string; name: string };

type ArticleData = {
  title?: string;
  slug?: string;
  category_id?: string | null;
  summary?: string;
  content?: string;
  tags?: string[];
  read_time_minutes?: number;
  related_portal_path?: string | null;
  status?: string;
  content_type?: string;
};

type SlugStatus = "idle" | "checking" | "available" | "taken";

const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "help", label: "Help" },
  { value: "policy", label: "Policy" },
  { value: "blog", label: "Blog" },
  { value: "flagship", label: "Flagship" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export function ArticleForm({
  categories,
  action,
  initialData,
  articleId,
}: {
  categories: Category[];
  action: (formData: FormData) => Promise<void>;
  initialData?: ArticleData;
  articleId?: string;
}) {
  const [contentType, setContentType] = useState<ContentType>(
    (initialData?.content_type as ContentType) ?? "help"
  );
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!!initialData?.slug);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [articleContent, setArticleContent] = useState(initialData?.content ?? "");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!slug.trim() || contentType === "flagship") {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      const exists = await checkSlugExists(slug, articleId);
      setSlugStatus(exists ? "taken" : "available");
    }, 350);
    return () => clearTimeout(timer);
  }, [slug, contentType, articleId]);

  function handleTitleChange(title: string) {
    if (!slugManual && contentType !== "flagship") {
      setSlug(slugify(title));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManual(true);
    setSlug(value);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await action(formData);
    });
  }

  const showWorkspacePath = contentType !== "blog";

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="content_type" value={contentType} />

      {/* Content type */}
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
                onClick={() => setContentType(opt.value)}
                className="rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
                style={
                  active
                    ? { backgroundColor: "var(--color-brand)", color: "#fff" }
                    : {
                        backgroundColor: "var(--color-warm-gray-50, #fafaf9)",
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
      </div>

      <SectionDivider label="Article" />

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Title
        </label>
        <input
          name="title"
          type="text"
          required
          defaultValue={initialData?.title ?? ""}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
          style={fieldStyle}
          placeholder="How to submit a property"
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
        <input
          name="slug"
          type="text"
          required
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          className="rounded-lg border px-4 py-2.5 text-sm font-mono outline-none transition-colors"
          style={{
            ...fieldStyle,
            borderColor:
              contentType === "flagship"
                ? "var(--color-warning, #d97706)"
                : slugStatus === "taken"
                ? "var(--color-error, #dc2626)"
                : slugStatus === "available"
                ? "var(--color-success, #16a34a)"
                : "var(--color-warm-gray-200)",
          }}
          placeholder={contentType === "flagship" ? "e.g. owners or how-it-works" : "how-to-submit-a-property"}
        />
        {contentType === "flagship" && (
          <p className="text-[11px]" style={{ color: "var(--color-warning, #d97706)" }}>
            Flagship slugs are premium namespace. Enter one manually, short and deliberate.
          </p>
        )}
      </div>

      {/* Category + Status */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Category
          </label>
          <CustomSelect
            name="category_id"
            defaultValue={initialData?.category_id ?? ""}
            options={[
              { value: "", label: "No category" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Status
          </label>
          <CustomSelect
            name="status"
            defaultValue={initialData?.status ?? "draft"}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <SectionDivider label="Content" />

      {/* Summary */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Summary
        </label>
        <textarea
          name="summary"
          defaultValue={initialData?.summary ?? ""}
          className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
          style={{ ...fieldStyle, minHeight: "72px", resize: "vertical" }}
          placeholder="A brief description shown in search results..."
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
          Content
        </label>
        <HelpArticleEditor
          content={articleContent}
          onChange={setArticleContent}
        />
        <input type="hidden" name="content" value={articleContent} />
      </div>

      <SectionDivider label="Discovery" />

      {/* Tags + Read Time */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Tags
          </label>
          <input
            name="tags"
            type="text"
            defaultValue={initialData?.tags?.join(", ") ?? ""}
            className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
            placeholder="getting-started, properties, finances"
          />
          <span className="text-[11px]" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
            Comma-separated
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Read Time (min)
          </label>
          <input
            name="read_time_minutes"
            type="number"
            min={1}
            max={60}
            defaultValue={initialData?.read_time_minutes ?? 5}
            className="rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
            style={fieldStyle}
          />
        </div>
      </div>

      {/* Workspace Path */}
      {showWorkspacePath && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={labelStyle}>
            Workspace Path (optional)
          </label>
          <CustomSelect
            name="related_portal_path"
            defaultValue={initialData?.related_portal_path ?? ""}
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
          <span className="text-[11px]" style={{ color: "var(--color-text-tertiary, #9ca3af)" }}>
            Links this article to a portal page for contextual help.
          </span>
        </div>
      )}

      <SectionDivider label="Publish" />

      <div className="flex justify-end pb-2">
        <button
          type="submit"
          disabled={isPending || slugStatus === "taken"}
          className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {isPending ? "Saving..." : initialData ? "Update Article" : "Create Article"}
        </button>
      </div>
    </form>
  );
}
