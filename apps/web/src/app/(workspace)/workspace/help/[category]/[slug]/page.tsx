import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, Clock, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ArticleRenderer } from "@/components/help/ArticleRenderer";
import { HelpfulWidget } from "@/components/help/HelpfulWidget";
import { ArticleCard } from "@/components/help/ArticleCard";

type Params = { category: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("help_articles")
    .select("title, summary")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  return { title: article ? article.title : "Article Not Found" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function WorkspaceArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category: catSlug, slug } = await params;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("help_articles")
    .select("*, help_categories!inner(id, slug, name)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!article) notFound();

  const cat = article.help_categories as unknown as {
    id: string;
    slug: string;
    name: string;
  } | null;

  if (cat?.slug !== catSlug) notFound();

  /* Increment view count (best-effort) */
  try {
    const service = createServiceClient();
    await service
      .from("help_articles")
      .update({ view_count: (article.view_count ?? 0) + 1 })
      .eq("id", article.id);
  } catch {
    /* Non-critical */
  }

  /* Related articles from the same category */
  const { data: related } = await supabase
    .from("help_articles")
    .select("id, title, slug, summary, read_time_minutes, tags")
    .eq("category_id", cat?.id ?? "")
    .eq("status", "published")
    .neq("id", article.id)
    .order("sort_order", { ascending: true })
    .limit(3);

  const relatedArticles = related ?? [];
  const tags = (article.tags as string[] | null) ?? [];

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-10 lg:px-10 lg:py-14">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap items-center gap-1.5 text-sm"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <Link
          href="/workspace/help"
          className="font-medium transition-colors hover:text-[var(--color-brand)]"
        >
          Help Center
        </Link>
        <CaretRight size={12} weight="bold" />
        <Link
          href={`/workspace/help/${catSlug}`}
          className="font-medium transition-colors hover:text-[var(--color-brand)]"
        >
          {cat?.name}
        </Link>
        <CaretRight size={12} weight="bold" />
        <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
          {article.title}
        </span>
      </nav>

      {/* Article header */}
      <header className="mb-10">
        <Link
          href={`/workspace/help/${catSlug}`}
          className="mb-4 inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "rgba(2, 170, 235, 0.08)",
            color: "var(--color-brand)",
          }}
        >
          {cat?.name}
        </Link>

        <h1
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: "var(--color-text-primary)" }}
        >
          {article.title}
        </h1>

        <div
          className="mt-3 flex flex-wrap items-center gap-4 text-sm"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} weight="duotone" />
            {article.read_time_minutes} min read
          </span>
          {article.published_at && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank size={14} weight="duotone" />
              {formatDate(article.published_at)}
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: "var(--color-warm-gray-100)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <hr className="mb-10" style={{ borderColor: "var(--color-warm-gray-100)" }} />

      {/* Article body */}
      <ArticleRenderer content={article.content ?? ""} />

      {/* Helpful widget */}
      <div className="mt-14">
        <HelpfulWidget articleId={article.id} />
      </div>

      {/* Related portal path */}
      {article.related_portal_path && (
        <div
          className="mt-6 rounded-xl border px-5 py-4 text-center"
          style={{
            backgroundColor: "var(--color-warm-gray-50)",
            borderColor: "var(--color-warm-gray-200)",
          }}
        >
          <Link
            href={article.related_portal_path}
            className="text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ color: "var(--color-brand)" }}
          >
            Go to this feature in the portal &rarr;
          </Link>
        </div>
      )}

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <section className="mt-16 border-t pt-12" style={{ borderColor: "var(--color-warm-gray-100)" }}>
          <h2
            className="mb-6 text-lg font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Related articles
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relatedArticles.map((ra) => (
              <ArticleCard
                key={ra.id}
                title={ra.title}
                slug={ra.slug}
                summary={ra.summary}
                categorySlug={catSlug}
                categoryName={cat?.name ?? ""}
                readTimeMinutes={ra.read_time_minutes}
                tags={ra.tags as string[] | undefined}
                basePath="/workspace/help"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
