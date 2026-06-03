import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { ArticleCard } from "@/components/help/ArticleCard";

type Params = { category: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const supabase = await createClient();

  const { data: cat } = await supabase
    .from("help_categories")
    .select("name")
    .eq("slug", slug)
    .single();

  return { title: cat ? `${cat.name} | Help Center` : "Help Center" };
}

export default async function WorkspaceCategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category: slug } = await params;
  const supabase = await createClient();

  const { data: cat } = await supabase
    .from("help_categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!cat) notFound();

  const { data: articles } = await supabase
    .from("help_articles")
    .select("id, title, slug, summary, read_time_minutes, tags")
    .eq("category_id", cat.id)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  const articleList = articles ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-10 lg:py-14">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex items-center gap-1.5 text-sm"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <Link
          href="/workspace/help"
          className="font-medium transition-colors hover:text-[var(--color-brand)]"
        >
          Help Center
        </Link>
        <CaretRight size={12} weight="bold" />
        <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>
          {cat.name}
        </span>
      </nav>

      {/* Category header */}
      <header className="mb-10">
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {cat.name}
        </h1>
        {cat.description && (
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {cat.description}
          </p>
        )}
      </header>

      {/* Articles */}
      {articleList.length > 0 ? (
        <div className="flex flex-col gap-3">
          {articleList.map((article) => (
            <ArticleCard
              key={article.id}
              title={article.title}
              slug={article.slug}
              summary={article.summary}
              categorySlug={slug}
              categoryName={cat.name}
              readTimeMinutes={article.read_time_minutes}
              tags={article.tags as string[] | undefined}
              basePath="/workspace/help"
            />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl border px-6 py-16 text-center"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            No articles in this category yet.
          </p>
        </div>
      )}
    </div>
  );
}
