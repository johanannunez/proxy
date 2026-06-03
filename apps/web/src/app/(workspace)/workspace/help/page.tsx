import type { Metadata } from "next";
import Link from "next/link";
import {
  MagnifyingGlass,
  ArrowRight,
  Clock,
  BookOpenText,
  RocketLaunch,
  Buildings,
  ClipboardText,
  CalendarBlank,
  CurrencyDollar,
  ChatCircle,
  FileText,
  GearSix,
  ListChecks,
  UsersThree,
  Wrench,
  Megaphone,
  Question,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Help Center",
};

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
const iconMap: Record<string, React.ComponentType<any>> = {
  RocketLaunch,
  Buildings,
  ClipboardText,
  CalendarBlank,
  CurrencyDollar,
  ChatCircle,
  FileText,
  GearSix,
  ListChecks,
  UsersThree,
  Wrench,
  Megaphone,
  Question,
  BookOpenText,
};

export default async function WorkspaceHelpPage() {
  const supabase = await createClient();

  const [categoriesResult, popularResult, recentResult] = await Promise.all([
    supabase
      .from("help_categories")
      .select("id, name, slug, description, icon, article_count")
      .order("sort_order"),
    supabase
      .from("help_articles")
      .select("id, title, slug, summary, read_time_minutes, category_id, help_categories!inner(slug, name)")
      .eq("status", "published")
      .order("view_count", { ascending: false })
      .limit(6),
    supabase
      .from("help_articles")
      .select("id, title, slug, summary, read_time_minutes, category_id, help_categories!inner(slug, name)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(4),
  ]);

  const categories = categoriesResult.data ?? [];
  const popularArticles = popularResult.data ?? [];
  const recentArticles = recentResult.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10 lg:py-14">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <BookOpenText size={28} weight="duotone" style={{ color: "var(--color-brand)" }} />
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Help Center
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Find answers about your properties, payouts, calendar, and more.
        </p>
      </div>

      {/* Search */}
      <div className="mb-12">
        <WorkspaceSearchForm />
      </div>

      {/* Categories grid */}
      <section className="mb-14">
        <h2
          className="mb-5 text-lg font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Browse by topic
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const IconComp = iconMap[cat.icon] ?? Question;
            return (
              <Link
                key={cat.id}
                href={`/workspace/help/${cat.slug}`}
                className="group flex items-start gap-3.5 rounded-xl border px-5 py-4 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  backgroundColor: "var(--color-white)",
                  borderColor: "var(--color-warm-gray-200)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--color-warm-gray-50)" }}
                >
                  <IconComp
                    size={18}
                    weight="duotone"
                    style={{ color: "var(--color-brand)" }}
                  />
                </span>
                <div className="min-w-0">
                  <span
                    className="block text-sm font-semibold leading-tight group-hover:underline"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {cat.name}
                  </span>
                  <span
                    className="mt-1 block text-xs leading-snug line-clamp-2"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {cat.description}
                  </span>
                  <span
                    className="mt-1.5 block text-[11px] font-medium"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {cat.article_count} {cat.article_count === 1 ? "article" : "articles"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular articles */}
      {popularArticles.length > 0 && (
        <section className="mb-14">
          <h2
            className="mb-5 text-lg font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Popular articles
          </h2>
          <div className="space-y-2">
            {popularArticles.map((article) => {
              const cat = article.help_categories as unknown as { slug: string; name: string };
              return (
                <Link
                  key={article.id}
                  href={`/workspace/help/${cat.slug}/${article.slug}`}
                  className="group flex items-center justify-between rounded-lg border px-5 py-3.5 transition-shadow hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: "var(--color-white)",
                    borderColor: "var(--color-warm-gray-200)",
                  }}
                >
                  <div className="min-w-0 mr-4">
                    <span
                      className="block text-sm font-medium group-hover:underline"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {article.title}
                    </span>
                    <span
                      className="mt-0.5 flex items-center gap-3 text-xs"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      <span>{cat.name}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {article.read_time_minutes} min read
                      </span>
                    </span>
                  </div>
                  <ArrowRight
                    size={16}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "var(--color-brand)" }}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recently added */}
      {recentArticles.length > 0 && (
        <section className="mb-14">
          <h2
            className="mb-5 text-lg font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Recently added
          </h2>
          <div className="space-y-2">
            {recentArticles.map((article) => {
              const cat = article.help_categories as unknown as { slug: string; name: string };
              return (
                <Link
                  key={article.id}
                  href={`/workspace/help/${cat.slug}/${article.slug}`}
                  className="group flex items-center justify-between rounded-lg border px-5 py-3.5 transition-shadow hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    backgroundColor: "var(--color-white)",
                    borderColor: "var(--color-warm-gray-200)",
                  }}
                >
                  <div className="min-w-0 mr-4">
                    <span
                      className="block text-sm font-medium group-hover:underline"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {article.title}
                    </span>
                    <span
                      className="mt-0.5 flex items-center gap-3 text-xs"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      <span>{cat.name}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {article.read_time_minutes} min read
                      </span>
                    </span>
                  </div>
                  <ArrowRight
                    size={16}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "var(--color-brand)" }}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Still need help */}
      <section
        className="rounded-xl border px-6 py-6 text-center"
        style={{
          backgroundColor: "var(--color-warm-gray-50)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Still need help?
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Send us a message and we will get back to you.
        </p>
        <Link
          href="/workspace/inbox"
          className="mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--color-brand-gradient)" }}
        >
          <ChatCircle size={16} weight="duotone" />
          Send a Message
        </Link>
      </section>

      {/* Public help link */}
      <p
        className="mt-8 text-center text-xs"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        View the full{" "}
        <Link
          href="/help"
          className="underline underline-offset-4 hover:opacity-80"
          style={{ color: "var(--color-brand)" }}
          target="_blank"
        >
          public Help Center
        </Link>
      </p>
    </div>
  );
}

/* ─── Inline search form for the portal help page ─── */

function WorkspaceSearchForm() {
  return (
    <form action="/help" method="get" className="relative">
      <MagnifyingGlass
        size={18}
        weight="duotone"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
        style={{ color: "var(--color-text-tertiary)" }}
      />
      <input
        type="search"
        name="q"
        placeholder="Search help articles..."
        className="w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition-shadow focus:shadow-md focus:ring-2"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          color: "var(--color-text-primary)",
        }}
        autoComplete="off"
      />
    </form>
  );
}
