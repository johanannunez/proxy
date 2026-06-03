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
  const { category: catSlug, slug } = await params;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("help_articles")
    .select("title, summary, help_categories!inner(slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!article) return { title: "Article Not Found" };

  const cat = article.help_categories as unknown as { slug: string } | null;
  if (cat?.slug !== catSlug) return { title: "Article Not Found" };

  return {
    title: article.title,
    description: article.summary,
    alternates: {
      canonical: `https://www.myproxyhost.com/help/${catSlug}/${slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
    },
  };
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

export default async function ArticlePage({
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
    <main
      className="min-h-screen pt-28 pb-24 sm:pt-36"
      style={{ backgroundColor: "var(--color-off-white)" }}
    >
      <article className="mx-auto max-w-[720px] px-6">
        {/* ── Breadcrumb ── */}
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <Link
            href="/help"
            className="font-medium transition-colors duration-150 hover:text-[var(--color-brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
          >
            Help Center
          </Link>
          <CaretRight size={12} weight="bold" />
          <Link
            href={`/help/${catSlug}`}
            className="font-medium transition-colors duration-150 hover:text-[var(--color-brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
          >
            {cat?.name}
          </Link>
          <CaretRight size={12} weight="bold" />
          <span
            className="font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {article.title}
          </span>
        </nav>

        {/* ── Article header ── */}
        <header className="mb-10">
          {/* Category badge */}
          <Link
            href={`/help/${catSlug}`}
            className="mb-4 inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-opacity duration-150 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
            style={{
              backgroundColor: "rgba(2, 170, 235, 0.08)",
              color: "var(--color-brand)",
            }}
          >
            {cat?.name}
          </Link>

          <h1
            className="text-h1 mb-4"
            style={{ color: "var(--color-text-primary)" }}
          >
            {article.title}
          </h1>

          {/* Meta row */}
          <div
            className="flex flex-wrap items-center gap-4 text-sm"
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

          {/* Tags */}
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

        {/* ── Divider ── */}
        <hr
          className="mb-10"
          style={{ borderColor: "var(--color-warm-gray-100)" }}
        />

        {/* ── Article body ── */}
        <ArticleRenderer content={article.content ?? ""} />

        {/* ── Helpful widget ── */}
        <div className="mt-14">
          <HelpfulWidget articleId={article.id} />
        </div>

        {/* ── Workspace link ── */}
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
              className="text-sm font-semibold transition-opacity duration-150 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
              style={{ color: "var(--color-brand)" }}
            >
              Go to this feature in the portal &rarr;
            </Link>
          </div>
        )}
      </article>

      {/* ── Related Articles ── */}
      {relatedArticles.length > 0 && (
        <section
          className="mt-20 border-t pt-16 pb-4"
          style={{ borderColor: "var(--color-warm-gray-100)" }}
        >
          <div className="mx-auto max-w-3xl px-6">
            <h2
              className="text-h3 mb-8"
              style={{ color: "var(--color-text-primary)" }}
            >
              Related articles
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
